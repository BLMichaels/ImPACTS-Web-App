import { useCallback, useEffect, useState } from 'react';
import { isPasswordRecoverySession } from '../utils/authFlow';
import { getUserData } from '../utils/userData';
import { PASSWORD_UPDATE_REQUIRED_KEY } from '../utils/passwordPolicy';
import { needsTermsReacceptance, TERMS_VERSION_KEY } from '../utils/termsOfService';
import { hasVerifiedTotpEnrollment, resolveMfaGateState, type MfaGateState } from '../utils/mfa';

export type SecurityGateStatus =
  | 'none'
  | 'checking'
  | 'password'
  | 'terms'
  | 'mfa-challenge'
  | 'mfa-enroll'
  | 'ready';

function mfaGateToStatus(gate: MfaGateState): SecurityGateStatus {
  if (gate === 'challenge') return 'mfa-challenge';
  if (gate === 'enroll') return 'mfa-enroll';
  return 'ready';
}

/**
 * When MFA status cannot be resolved, prefer enroll (QR setup) over challenge.
 * First-time users with no authenticator must never be stranded on a code-only screen.
 * If a verified factor exists, keep challenge so existing MFA still blocks the app.
 */
async function failClosedMfaStatus(): Promise<'mfa-challenge' | 'mfa-enroll'> {
  try {
    const verified = await hasVerifiedTotpEnrollment();
    return verified ? 'mfa-challenge' : 'mfa-enroll';
  } catch (err) {
    console.warn('[useSecurityGate] Could not list MFA factors after gate error; defaulting to enroll', err);
    return 'mfa-enroll';
  }
}

export function useSecurityGate(userId: string | undefined) {
  const [status, setStatus] = useState<SecurityGateStatus>(userId ? 'checking' : 'none');

  const evaluate = useCallback(async (): Promise<SecurityGateStatus> => {
    if (!userId) return 'none';
    if (isPasswordRecoverySession()) return 'ready';

    const passwordPending = await getUserData<boolean>(userId, PASSWORD_UPDATE_REQUIRED_KEY);
    if (passwordPending === true) return 'password';

    const termsVersion = await getUserData<string>(userId, TERMS_VERSION_KEY);
    if (needsTermsReacceptance(termsVersion)) return 'terms';

    const mfaGate = await resolveMfaGateState();
    return mfaGateToStatus(mfaGate);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStatus('none');
      return;
    }
    setStatus('checking');
    try {
      setStatus(await evaluate());
    } catch (err) {
      console.warn('[useSecurityGate] MFA evaluation failed; resolving fail-closed status', err);
      setStatus(await failClosedMfaStatus());
    }
  }, [evaluate, userId]);

  useEffect(() => {
    if (!userId) {
      setStatus('none');
      return;
    }
    if (isPasswordRecoverySession()) {
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    void evaluate()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(async (err) => {
        console.warn('[useSecurityGate] MFA evaluation failed; resolving fail-closed status', err);
        const next = await failClosedMfaStatus();
        if (!cancelled) setStatus(next);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, evaluate]);

  return { status, refresh };
}

export function isSecurityGateBlocking(status: SecurityGateStatus): boolean {
  return (
    status === 'checking' ||
    status === 'password' ||
    status === 'terms' ||
    status === 'mfa-challenge' ||
    status === 'mfa-enroll'
  );
}
