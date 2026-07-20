import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Link,
  Stack,
  alpha,
} from '@mui/material';
import {
  ShieldOutlined as ShieldIcon,
  NoPhotographyOutlined as NoPhiIcon,
  LockOutlined as LockIcon,
  TimerOutlined as TimerIcon,
  VerifiedUserOutlined as ScreeningIcon,
  MailOutline as InviteIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateNewPassword, PASSWORD_REQUIREMENT_TEXT } from '../utils/passwordPolicy';
import { IDLE_TIMEOUT_MINUTES } from '../utils/sessionPolicy';
import AuthMarketingShell, { AUTH_SLATE, AUTH_SLATE_DARK } from '../components/AuthMarketingShell';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.92)',
    borderRadius: 2,
  },
};

const SECURITY_POINTS = [
  {
    icon: <NoPhiIcon sx={{ fontSize: 18 }} />,
    title: 'No patient PHI',
    text: 'Do not enter real patient names, MRNs, or other protected health information. Staff names are fine.',
  },
  {
    icon: <LockIcon sx={{ fontSize: 18 }} />,
    title: 'MFA required',
    text: 'After sign-in, verify with a free authenticator app before you can use the tool.',
  },
  {
    icon: <TimerIcon sx={{ fontSize: 18 }} />,
    title: `Auto sign-out after ${IDLE_TIMEOUT_MINUTES} minutes`,
    text: 'Inactive sessions end automatically to reduce risk on shared workstations.',
  },
  {
    icon: <ScreeningIcon sx={{ fontSize: 18 }} />,
    title: 'Free-text screening',
    text: 'Notes are checked for common HIPAA identifiers; high-risk matches are blocked.',
  },
  {
    icon: <InviteIcon sx={{ fontSize: 18 }} />,
    title: 'Invitation-only',
    text: 'Accounts come from ImPACTS program administrators — not open registration.',
  },
  {
    icon: <ShieldIcon sx={{ fontSize: 18 }} />,
    title: 'QI / readiness use only',
    text: 'Built for pediatric emergency readiness work — not a clinical record or EHR.',
  },
];

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setPasswordSuccess, setSetPasswordSuccess] = useState(false);
  const { login, resetPasswordForEmail, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const timedOut = searchParams.get('timeout') === '1';

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash.includes('type=recovery')) {
      setShowSetPassword(true);
      setShowForgotPassword(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      window.location.replace('/app');
    } catch (err) {
      const details = err instanceof Error ? err.message : '';
      setError(details ? `Failed to log in: ${details}` : 'Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    try {
      setError('');
      setLoading(true);
      await resetPasswordForEmail(email, `${window.location.origin}/login`);
      setForgotSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const policyError = validateNewPassword(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      setLoading(true);
      await updatePassword(newPassword);
      setSetPasswordSuccess(true);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setTimeout(() => {
        setShowSetPassword(false);
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  let formTitle = 'Sign in';
  let formSubtitle = 'Use your PECC Support Tool email and password.';
  if (showSetPassword) {
    formTitle = 'Set new password';
    formSubtitle = 'Choose a strong password for your account.';
  } else if (showForgotPassword) {
    formTitle = 'Reset password';
    formSubtitle = 'We will email you a link to set a new password.';
  }

  let formBody: React.ReactNode;
  if (showSetPassword) {
    formBody = setPasswordSuccess ? (
      <Stack spacing={1.75}>
        <Alert severity="success">Password updated. You can now sign in with your new password.</Alert>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            setShowSetPassword(false);
            setSetPasswordSuccess(false);
          }}
          sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
        >
          Back to sign in
        </Button>
      </Stack>
    ) : (
      <Box component="form" onSubmit={handleSetPasswordSubmit}>
        <Stack spacing={1.75}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            required
            fullWidth
            name="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText={PASSWORD_REQUIREMENT_TEXT}
            sx={fieldSx}
          />
          <TextField
            required
            fullWidth
            name="confirmPassword"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            sx={fieldSx}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </Button>
          <Button fullWidth variant="text" onClick={() => { setShowSetPassword(false); setError(''); }} sx={{ color: AUTH_SLATE }}>
            Back to sign in
          </Button>
        </Stack>
      </Box>
    );
  } else if (showForgotPassword) {
    formBody = forgotSuccess ? (
      <Stack spacing={1.75}>
        <Alert severity="success">
          Check your email for a link to reset your password. The link may take a few minutes to arrive.
        </Alert>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            setShowForgotPassword(false);
            setForgotSuccess(false);
          }}
          sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
        >
          Back to sign in
        </Button>
      </Stack>
    ) : (
      <Box component="form" onSubmit={handleForgotSubmit}>
        <Stack spacing={1.75}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            required
            fullWidth
            id="forgot-email"
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={fieldSx}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
          <Button fullWidth variant="text" onClick={() => { setShowForgotPassword(false); setError(''); }} sx={{ color: AUTH_SLATE }}>
            Back to sign in
          </Button>
        </Stack>
      </Box>
    );
  } else {
    formBody = (
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={1.75}>
          {timedOut && !error && (
            <Alert severity="info">You were signed out due to inactivity. Please sign in again.</Alert>
          )}
          <Alert severity="info" icon={<LockIcon fontSize="inherit" />} sx={{ py: 0.75 }}>
            After sign-in you will set up or verify MFA with a free authenticator app.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            required
            fullWidth
            id="email"
            label="Email address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={fieldSx}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -0.5 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => setShowForgotPassword(true)}
              sx={{ fontWeight: 500, color: AUTH_SLATE }}
            >
              Forgot password?
            </Link>
          </Box>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              py: 1.25,
              fontWeight: 600,
              bgcolor: AUTH_SLATE,
              boxShadow: `0 10px 24px ${alpha(AUTH_SLATE, 0.22)}`,
              '&:hover': { bgcolor: AUTH_SLATE_DARK },
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
          <Typography variant="body2" color="text.secondary" align="center">
            Need an account?{' '}
            <Link
              component="button"
              type="button"
              onClick={() => navigate('/register')}
              sx={{ fontWeight: 600, color: AUTH_SLATE, verticalAlign: 'baseline' }}
            >
              Request an invitation
            </Link>
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <AuthMarketingShell>
      <Box
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 1080,
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
            sx={{ fontWeight: 600, letterSpacing: '-0.02em', mb: 0.75, fontSize: { xs: '1.65rem', md: '2rem' } }}
          >
            Sign in to the PECC Support Tool
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.6 }}>
            Track activities, close readiness gaps, collaborate with your cohort, and review your snapshot — for
            pediatric emergency care coordination.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(300px, 380px)' },
            gap: { xs: 2.5, md: 3 },
            alignItems: 'start',
          }}
        >
          {/* Security grid fills the left / main column */}
          <Box
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(AUTH_SLATE, 0.12),
              bgcolor: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(10px)',
              order: { xs: 2, md: 1 },
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.75 }}>
              <ShieldIcon sx={{ color: AUTH_SLATE, fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Security &amp; appropriate use
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.75,
              }}
            >
              {SECURITY_POINTS.map((point) => (
                <Stack key={point.title} direction="row" spacing={1.25} alignItems="flex-start">
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
                    {point.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.25, mb: 0.25 }}>
                      {point.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45, display: 'block' }}>
                      {point.text}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>
          </Box>

          {/* Form card */}
          <Box sx={{ order: { xs: 1, md: 2 } }}>
            <Box
              sx={{
                p: { xs: 2.25, sm: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(16px)',
                border: '1px solid',
                borderColor: alpha('#fff', 0.9),
                boxShadow: `0 20px 48px ${alpha(AUTH_SLATE, 0.12)}`,
              }}
            >
              <Typography component="h2" variant="h6" sx={{ fontWeight: 600, mb: 0.35 }}>
                {formTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                {formSubtitle}
              </Typography>
              {formBody}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 1.75, lineHeight: 1.5, px: 0.5 }}
            >
              Screening is heuristic and does not guarantee detection of all PHI. Terms of Service are available after
              sign-in.
            </Typography>
          </Box>
        </Box>
      </Box>
    </AuthMarketingShell>
  );
};

export default LoginPage;
