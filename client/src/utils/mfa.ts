import { Factor, AuthenticatorAssuranceLevels } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type MfaGateState = 'none' | 'challenge' | 'enroll';

export type AuthenticatorAssuranceLevelResponse = {
  currentLevel: AuthenticatorAssuranceLevels | null;
  nextLevel: AuthenticatorAssuranceLevels | null;
};

export function totpQrDataUrl(svg: string): string {
  if (!svg) return '';
  if (svg.startsWith('data:')) return svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getVerifiedTotpFactors(factors: Factor[] | undefined): Factor[] {
  return (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified');
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
  const levels = await getAuthenticatorLevels();
  if (needsMfaChallenge(levels)) return 'challenge';
  const enrolled = await hasVerifiedTotpEnrollment();
  if (!enrolled) return 'enroll';
  return 'none';
}

/** Remove abandoned unverified factors so a fresh enrollment can start. */
export async function cleanupUnverifiedMfaFactors(): Promise<void> {
  const factors = await listAllMfaFactors();
  await Promise.all(
    factors
      .filter((f) => f.status === 'unverified')
      .map((f) => supabase.auth.mfa.unenroll({ factorId: f.id }))
  );
}

export async function beginTotpEnrollment(friendlyName = 'ImPACTS Authenticator') {
  await cleanupUnverifiedMfaFactors();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });
  if (error) throw error;
  if (!data?.id || !data.totp) throw new Error('Could not start authenticator enrollment.');
  return data;
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
