import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { isPasswordRecoverySession } from '../utils/authFlow';
import { getUserData } from '../utils/userData';
import { PASSWORD_UPDATE_REQUIRED_KEY } from '../utils/passwordPolicy';
import { needsTermsReacceptance, TERMS_VERSION_KEY } from '../utils/termsOfService';
import { resolveMfaGateState, type MfaGateState } from '../utils/mfa';
import MfaEnrollmentForm from './MfaEnrollmentForm';
import MfaChallengeForm from './MfaChallengeForm';

/**
 * Blocks the app until MFA is verified (returning users) or enrolled (first-time setup).
 * Skipped during password-recovery sessions and while password/terms dialogs are active.
 */
const MfaGateDialog: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [gate, setGate] = useState<MfaGateState>('none');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!currentUser?.id || isPasswordRecoverySession()) {
      setGate('none');
      setChecking(false);
      return;
    }

    let cancelled = false;

    const evaluate = async () => {
      try {
        const passwordPending = await getUserData<boolean>(currentUser.id, PASSWORD_UPDATE_REQUIRED_KEY);
        if (cancelled) return;
        if (passwordPending === true) {
          setGate('none');
          return;
        }
        const termsVersion = await getUserData<string>(currentUser.id, TERMS_VERSION_KEY);
        if (cancelled) return;
        if (needsTermsReacceptance(termsVersion)) {
          setGate('none');
          return;
        }
        const nextGate = await resolveMfaGateState();
        if (!cancelled) setGate(nextGate);
      } catch {
        if (!cancelled) setGate('none');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    setChecking(true);
    void evaluate();
    const interval = setInterval(() => {
      void evaluate();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setGate('none');
      window.location.replace('/login');
    }
  };

  if (!currentUser || gate === 'none' || checking) return null;

  const title = gate === 'challenge' ? 'Verify your identity' : 'Set up multi-factor authentication';
  const subtitle =
    gate === 'challenge'
      ? 'Enter the 6-digit code from the authenticator app you set up earlier.'
      : 'Follow the step-by-step instructions below. This is a one-time setup and takes about 2 minutes.';

  return (
    <Dialog open disableEscapeKeyDown maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          {subtitle}
        </Alert>
        {gate === 'challenge' ? (
          <MfaChallengeForm
            email={currentUser.email}
            userId={currentUser.id}
            onSuccess={() => setGate('none')}
            onCancel={handleLogout}
          />
        ) : (
          <MfaEnrollmentForm
            email={currentUser.email}
            userId={currentUser.id}
            onEnrolled={() => setGate('none')}
            onCancel={handleLogout}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleLogout} color="inherit">
          Log out
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MfaGateDialog;
