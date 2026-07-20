import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  LockOutlined as LockIcon,
  NoPhotographyOutlined as NoPhiIcon,
  TimerOutlined as TimerIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { hasVerifiedTotpEnrollment } from '../utils/mfa';
import { IDLE_TIMEOUT_MINUTES } from '../utils/sessionPolicy';
import AuthMarketingShell, { AUTH_SLATE, AUTH_SLATE_DARK } from './AuthMarketingShell';
import MfaEnrollmentForm, { MFA_ENROLLMENT_FORM_ID } from './MfaEnrollmentForm';
import MfaChallengeForm from './MfaChallengeForm';

interface MfaGateScreenProps {
  mode: 'mfa-challenge' | 'mfa-enroll';
  onComplete: () => void;
}

/**
 * Full-screen MFA gate — matches login chrome; no app navbar behind this.
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
    <AuthMarketingShell
      showBackHome={false}
      headerAction={
        <Button variant="text" onClick={handleLogout} sx={{ fontWeight: 600, color: AUTH_SLATE_DARK }}>
          Log out
        </Button>
      }
    >
      <Box
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: isEnroll ? 1100 : 1000,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: { xs: 1, md: 2 },
          pb: { xs: 4, md: 5 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { md: 'center' },
          gap: { xs: 2.5, md: 3 },
        }}
      >
        <Box>
          <Typography
            component="h1"
            variant="h4"
            sx={{ fontWeight: 600, letterSpacing: '-0.02em', mb: 0.75, fontSize: { xs: '1.55rem', md: '1.85rem' } }}
          >
            {isEnroll ? 'Set up multi-factor authentication' : 'Verify your identity'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.6 }}>
            {isEnroll
              ? 'One-time setup. Complete MFA before you can use the PECC Support Tool.'
              : 'Enter your authenticator code to continue. You cannot open the PECC Support Tool until verification is complete.'}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: isEnroll ? 'minmax(0, 1fr)' : 'minmax(220px, 280px) minmax(0, 1fr)',
            },
            ...(!isEnroll && {
              gridTemplateRows: { md: '1fr auto' },
            }),
            gap: { xs: 2.5, md: 3 },
            alignItems: { xs: 'start', md: isEnroll ? 'start' : 'stretch' },
          }}
        >
          {!isEnroll ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: alpha(AUTH_SLATE, 0.12),
                bgcolor: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(10px)',
                order: { xs: 2, md: 1 },
                gridRow: { md: 1 },
                gridColumn: { md: 1 },
                height: { md: '100%' },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack spacing={1.75}>
                {[
                  {
                    icon: <LockIcon sx={{ fontSize: 18 }} />,
                    title: 'MFA protects this session',
                    text: 'Codes come from the authenticator app you enrolled for the PECC Support Tool.',
                  },
                  {
                    icon: <NoPhiIcon sx={{ fontSize: 18 }} />,
                    title: 'No patient PHI',
                    text: 'Never enter real patient identifiers anywhere in the tool.',
                  },
                  {
                    icon: <TimerIcon sx={{ fontSize: 18 }} />,
                    title: `Idle sign-out (${IDLE_TIMEOUT_MINUTES} min)`,
                    text: 'Inactive sessions end automatically on shared workstations.',
                  },
                  {
                    icon: <ShieldIcon sx={{ fontSize: 18 }} />,
                    title: 'Wrong device?',
                    text: 'Use Log out above, then sign in again on the right computer.',
                  },
                ].map((item) => (
                  <Stack key={item.title} direction="row" spacing={1.25} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.25,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(AUTH_SLATE, 0.08),
                        color: AUTH_SLATE,
                        flexShrink: 0,
                      }}
                      aria-hidden
                    >
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.25, mb: 0.2 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45, display: 'block' }}>
                        {item.text}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ) : null}

          <Box
            sx={{
              order: { xs: 1, md: 2 },
              ...(!isEnroll && {
                gridRow: { md: 1 },
                gridColumn: { md: 2 },
                height: { md: '100%' },
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }),
            }}
          >
            <Box
              sx={{
                p: { xs: 2.25, sm: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(16px)',
                border: '1px solid',
                borderColor: alpha('#fff', 0.9),
                boxShadow: `0 20px 48px ${alpha(AUTH_SLATE, 0.12)}`,
                ...(!isEnroll && {
                  flex: { md: 1 },
                  height: { md: '100%' },
                  display: 'flex',
                  flexDirection: 'column',
                }),
              }}
            >
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
            </Box>

            {isEnroll ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1.5,
                  mt: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  onClick={() => setEnrollKey((k) => k + 1)}
                  color="inherit"
                  disabled={enrollSubmitting}
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                >
                  Get new QR code
                </Button>
                <Box sx={{ display: 'flex', gap: 1.25, ml: 'auto' }}>
                  <Button
                    onClick={handleLogout}
                    color="inherit"
                    disabled={enrollSubmitting}
                    sx={{ textTransform: 'none' }}
                  >
                    Log out
                  </Button>
                  <Button
                    type="submit"
                    form={MFA_ENROLLMENT_FORM_ID}
                    variant="contained"
                    disabled={!enrollCanSubmit || enrollSubmitting}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      minWidth: 180,
                      bgcolor: AUTH_SLATE,
                      '&:hover': { bgcolor: AUTH_SLATE_DARK },
                    }}
                  >
                    {enrollSubmitting ? 'Verifying…' : 'Enable authenticator'}
                  </Button>
                </Box>
              </Box>
            ) : null}

            {isEnroll ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textAlign: 'center', mt: 2, lineHeight: 1.5 }}
              >
                Do not enter Protected Health Information (PHI). Free-text fields are screened for common HIPAA
                identifiers.
              </Typography>
            ) : null}
          </Box>

          {!isEnroll ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                textAlign: 'center',
                mt: { xs: -0.5, md: 0 },
                lineHeight: 1.5,
                order: { xs: 3, md: 3 },
                gridRow: { md: 2 },
                gridColumn: { md: 2 },
              }}
            >
              Do not enter Protected Health Information (PHI). Free-text fields are screened for common HIPAA
              identifiers.
            </Typography>
          ) : null}
        </Box>
      </Box>
    </AuthMarketingShell>
  );
};

export default MfaGateScreen;
