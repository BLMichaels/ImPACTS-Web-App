import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { hasVerifiedTotpEnrollment } from '../utils/mfa';
import MfaEnrollmentForm, { MFA_ENROLLMENT_FORM_ID } from './MfaEnrollmentForm';
import MfaChallengeForm from './MfaChallengeForm';

interface MfaGateScreenProps {
  mode: 'mfa-challenge' | 'mfa-enroll';
  onComplete: () => void;
}

/**
 * Full-screen MFA gate — no navbar or app content renders behind this.
 */
const MfaGateScreen: React.FC<MfaGateScreenProps> = ({ mode, onComplete }) => {
  const { currentUser, logout } = useAuth();
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollCanSubmit, setEnrollCanSubmit] = useState(false);
  const [enrollKey, setEnrollKey] = useState(0);
  const [effectiveMode, setEffectiveMode] = useState(mode);

  const isEnroll = effectiveMode === 'mfa-enroll';

  useEffect(() => {
    setEffectiveMode(mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'mfa-challenge') return;
    let cancelled = false;
    void hasVerifiedTotpEnrollment().then((verified) => {
      if (!cancelled && !verified) setEffectiveMode('mfa-enroll');
    });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleSuccess = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      window.location.replace('/login');
    }
  };

  if (!currentUser) return null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        component="header"
        sx={{
          py: 2,
          px: 3,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          ImPACTS
        </Typography>
      </Box>

      <Container maxWidth={isEnroll ? false : 'sm'} sx={{ flex: 1, py: 4, px: { xs: 2, sm: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, sm: 3 },
            borderRadius: 3,
            border: 1,
            borderColor: 'divider',
            maxWidth: isEnroll ? 'min(1120px, 100%)' : 560,
            mx: 'auto',
          }}
        >
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 0.75 }}>
            {isEnroll ? 'Set up multi-factor authentication' : 'Verify your identity'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.5 }}>
            {isEnroll
              ? 'One-time setup (~2 min). Complete MFA before you can access ImPACTS.'
              : 'Enter your authenticator code to continue. You cannot access the app until verification is complete.'}
          </Typography>

          {isEnroll ? (
            <MfaEnrollmentForm
              key={enrollKey}
              email={currentUser.email}
              userId={currentUser.id}
              onEnrolled={handleSuccess}
              layout="split"
              hideIntro
              hideActions
              onSubmitStateChange={({ loading, canSubmit }) => {
                setEnrollSubmitting(loading);
                setEnrollCanSubmit(canSubmit);
              }}
            />
          ) : (
            <MfaChallengeForm
              email={currentUser.email}
              userId={currentUser.id}
              onSuccess={handleSuccess}
              onCancel={handleLogout}
              cancelLabel="Log out"
              onNeedsEnrollment={() => setEffectiveMode('mfa-enroll')}
            />
          )}
        </Paper>

        {isEnroll ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1.5,
              mt: 2,
              maxWidth: 'min(1120px, 100%)',
              mx: 'auto',
              flexWrap: 'wrap',
            }}
          >
            <Button
              onClick={() => setEnrollKey((k) => k + 1)}
              color="inherit"
              disabled={enrollSubmitting}
              sx={{ textTransform: 'none' }}
            >
              Get new QR code
            </Button>
            <Box sx={{ display: 'flex', gap: 1.5, ml: 'auto' }}>
              <Button onClick={handleLogout} color="inherit" disabled={enrollSubmitting} sx={{ textTransform: 'none' }}>
                Log out
              </Button>
              <Button
                type="submit"
                form={MFA_ENROLLMENT_FORM_ID}
                variant="contained"
                disabled={!enrollCanSubmit || enrollSubmitting}
                sx={{ textTransform: 'none', fontWeight: 600, minWidth: 180 }}
              >
                {enrollSubmitting ? 'Verifying…' : 'Enable authenticator'}
              </Button>
            </Box>
          </Box>
        ) : null}
      </Container>
    </Box>
  );
};

export default MfaGateScreen;
