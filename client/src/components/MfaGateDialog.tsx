import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { isPasswordRecoverySession } from '../utils/authFlow';
import { getUserData } from '../utils/userData';
import { PASSWORD_UPDATE_REQUIRED_KEY } from '../utils/passwordPolicy';
import { needsTermsReacceptance, TERMS_VERSION_KEY } from '../utils/termsOfService';
import { resolveMfaGateState, type MfaGateState } from '../utils/mfa';
import MfaEnrollmentForm, { MFA_ENROLLMENT_FORM_ID } from './MfaEnrollmentForm';
import MfaChallengeForm from './MfaChallengeForm';

const dialogPaperSx = {
  borderRadius: 3,
  width: 'min(1120px, calc(100vw - 24px))',
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'calc(100vh - 24px)',
  display: 'flex',
  flexDirection: 'column',
};

/**
 * Blocks the app until MFA is verified (returning users) or enrolled (first-time setup).
 * Skipped during password-recovery sessions and while password/terms dialogs are active.
 */
const MfaGateDialog: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [gate, setGate] = useState<MfaGateState>('none');
  const [checking, setChecking] = useState(true);
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollCanSubmit, setEnrollCanSubmit] = useState(false);

  const handleEnrollSubmitState = useCallback((state: { loading: boolean; canSubmit: boolean }) => {
    setEnrollSubmitting(state.loading);
    setEnrollCanSubmit(state.canSubmit);
  }, []);

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

  const isEnroll = gate === 'enroll';

  return (
    <Dialog
      open
      disableEscapeKeyDown
      maxWidth={false}
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ pb: 1, flexShrink: 0 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
          {isEnroll ? 'Set up multi-factor authentication' : 'Verify your identity'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
          {isEnroll
            ? 'One-time setup (~2 min). Follow the steps on the left, scan the QR code on the right, then enter your verification code.'
            : 'Enter the 6-digit code from the authenticator app you set up earlier.'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 1, flex: '1 1 auto', overflow: 'visible' }}>
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
            layout="split"
            hideIntro
            hideActions
            onSubmitStateChange={handleEnrollSubmitState}
          />
        )}
      </DialogContent>
      {isEnroll ? (
        <DialogActions
          sx={{
            px: 3,
            py: 1.5,
            flexShrink: 0,
            borderTop: 1,
            borderColor: 'divider',
            gap: 1,
          }}
        >
          <Button onClick={handleLogout} color="inherit" disabled={enrollSubmitting} sx={{ textTransform: 'none' }}>
            Log out
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            type="submit"
            form={MFA_ENROLLMENT_FORM_ID}
            variant="contained"
            disabled={!enrollCanSubmit || enrollSubmitting}
            sx={{ textTransform: 'none', fontWeight: 600, minWidth: 180 }}
          >
            {enrollSubmitting ? 'Verifying…' : 'Enable authenticator'}
          </Button>
        </DialogActions>
      ) : (
        <DialogActions sx={{ px: 3, pb: 2, flexShrink: 0 }}>
          <Button onClick={handleLogout} color="inherit">
            Log out
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default MfaGateDialog;
