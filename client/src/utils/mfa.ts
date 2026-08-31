import { Factor, AuthenticatorAssuranceLevels } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type MfaGateState = 'none' | 'challenge' | 'enroll';

export type AuthenticatorAssuranceLevelResponse = {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
};

export const DEFAULT_TOTP_FRIENDLY_NAME = 'PECC Support Tool';

/** Thrown when the account already has a verified authenticator — user should enter a code, not enroll again. */
export class MfaAlreadyEnrolledError extends Error {
  constructor(message = 'You already have an authenticator set up. Enter your 6-digit code to continue.') {
    super(message);
    this.name = 'MfaAlreadyEnrolledError';
  }
}

export function totpQrDataUrl(svg: string): string {
  if (!svg) return '';
  if (svg.startsWith('data:')) return svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getVerifiedTotpFactors(factors: Factor[] | undefined): Factor[] {
  return (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified');
}

export function getUnverifiedTotpFactors(factors: Factor[] | undefined): Factor[] {
  return (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'unverified');
}

export async function listAllMfaFactors(): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return [...(data?.totp ?? []), ...(data?.phone ?? [])];
}

export async function getAuthenticatorLevels(): Promise<AuthenticatorAssuranceLevelResponse | null> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return data;
}

export function needsMfaChallenge(levels: AuthenticatorAssuranceLevelResponse | null): boolean {
  if (!levels) return false;
  return levels.nextLevel === 'aal2' && levels.currentLevel !== 'aal2';
}

export async function hasVerifiedTotpEnrollment(): Promise<boolean> {
  const factors = await listAllMfaFactors();
  return getVerifiedTotpFactors(factors).length > 0;
}

export async function resolveMfaGateState(): Promise<MfaGateState> {
  const factors = await listAllMfaFactors();
  const verifiedTotp = getVerifiedTotpFactors(factors);
  if (verifiedTotp.length === 0) {
    // Drop abandoned enrollments so the setup screen can issue a fresh QR code.
    await cleanupUnverifiedMfaFactors();
    return 'enroll';
  }
  const levels = await getAuthenticatorLevels();
  if (needsMfaChallenge(levels)) return 'challenge';
  return 'none';
}

function isFriendlyNameExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /already exists|friendly.?name/i.test(msg);
}

/** Remove abandoned unverified factors so a fresh enrollment can start. */
export async function cleanupUnverifiedMfaFactors(): Promise<number> {
  const factors = await listAllMfaFactors();
  const unverified = factors.filter((f) => f.status === 'unverified');
  let removed = 0;
  for (const factor of unverified) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (!error) removed += 1;
  }
  return removed;
}

/** Remove unverified TOTP factors that block re-enrollment (same friendly name). */
async function cleanupBlockingTotpFactors(friendlyName: string): Promise<number> {
  const factors = await listAllMfaFactors();
  let removed = 0;
  for (const factor of factors) {
    if (factor.factor_type !== 'totp') continue;
    if (factor.status !== 'unverified') continue;
    const name = (factor.friendly_name || '').trim();
    if (name && name !== friendlyName) continue;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (!error) removed += 1;
  }
  return removed;
}

export async function beginTotpEnrollment(
  friendlyName = DEFAULT_TOTP_FRIENDLY_NAME,
  options?: { allowWhenVerified?: boolean }
) {
  const factors = await listAllMfaFactors();
  if (!options?.allowWhenVerified && getVerifiedTotpFactors(factors).length > 0) {
    throw new MfaAlreadyEnrolledError();
  }

  if (options?.allowWhenVerified) {
    await cleanupBlockingTotpFactors(friendlyName);
  } else {
    await cleanupUnverifiedMfaFactors();
  }

  const enrollOnce = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });
    if (error) throw error;
    if (!data?.id || !data.totp) throw new Error('Could not start authenticator enrollment.');
    return data;
  };

  try {
    return await enrollOnce();
  } catch (err) {
    if (!isFriendlyNameExistsError(err)) throw err;

    // Stale unverified enrollment with the same label — remove and retry once.
    await cleanupBlockingTotpFactors(friendlyName);
    await cleanupUnverifiedMfaFactors();

    const refreshed = await listAllMfaFactors();
    if (!options?.allowWhenVerified && getVerifiedTotpFactors(refreshed).length > 0) {
      throw new MfaAlreadyEnrolledError();
    }

    try {
      return await enrollOnce();
    } catch (retryErr) {
      if (isFriendlyNameExistsError(retryErr)) {
        throw new Error(
          'A previous MFA setup is still on your account. Tap “Get new QR code” once more. If it keeps failing, log out and sign in again, or contact support.'
        );
      }
      throw retryErr;
    }
  }
}

export async function verifyMfaCode(factorId: string, code: string): Promise<void> {
  const normalized = code.replace(/\s/g, '');
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: normalized,
  });
  if (verifyError) throw verifyError;

  if (verifyData?.access_token && verifyData?.refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: verifyData.access_token,
      refresh_token: verifyData.refresh_token,
    });
    if (sessionError) throw sessionError;
  } else {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
  }

  await waitForMfaChallengeCleared();
}

/** Poll until MFA challenge is satisfied (session at AAL2). */
export async function waitForMfaChallengeCleared(maxAttempts = 15): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const levels = await getAuthenticatorLevels();
    if (!needsMfaChallenge(levels)) return;
    await new Promise((resolve) => {
      window.setTimeout(resolve, 150);
    });
  }
  throw new Error('MFA verification did not complete. Please try again.');
}

export async function verifyMfaLogin(code: string): Promise<void> {
  const factors = await listAllMfaFactors();
  const totp = getVerifiedTotpFactors(factors)[0];
  if (!totp) throw new Error('No authenticator is enrolled for this account.');
  await verifyMfaCode(totp.id, code);
}
