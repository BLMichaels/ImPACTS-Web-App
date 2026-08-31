import { useCallback, useEffect, useState } from 'react';
import { isPasswordRecoverySession } from '../utils/authFlow';
import { getUserData } from '../utils/userData';
import { PASSWORD_UPDATE_REQUIRED_KEY } from '../utils/passwordPolicy';
import { needsTermsReacceptance, TERMS_VERSION_KEY } from '../utils/termsOfService';
import { resolveMfaGateState, type MfaGateState } from '../utils/mfa';

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
      console.warn('[useSecurityGate] MFA evaluation failed; failing closed to challenge', err);
      setStatus('mfa-challenge');
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
      .catch((err) => {
        console.warn('[useSecurityGate] MFA evaluation failed; failing closed to challenge', err);
        if (!cancelled) setStatus('mfa-challenge');
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
