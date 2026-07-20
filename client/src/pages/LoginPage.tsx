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
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateNewPassword, PASSWORD_REQUIREMENT_TEXT } from '../utils/passwordPolicy';

const SLATE = '#455a64';
const SLATE_DARK = '#2f3e46';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.9)',
    borderRadius: 2,
  },
};

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
  let formSubtitle = 'Enter your email and password to open the PECC Support Tool.';
  if (showSetPassword) {
    formTitle = 'Set new password';
    formSubtitle = 'Choose a strong password for your PECC Support Tool account.';
  } else if (showForgotPassword) {
    formTitle = 'Reset password';
    formSubtitle = 'We will email you a link to set a new password.';
  }

  let formBody: React.ReactNode;
  if (showSetPassword) {
    formBody = setPasswordSuccess ? (
      <Stack spacing={2}>
        <Alert severity="success">Password updated. You can now sign in with your new password.</Alert>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            setShowSetPassword(false);
            setSetPasswordSuccess(false);
          }}
          sx={{ py: 1.25, fontWeight: 600, bgcolor: SLATE, '&:hover': { bgcolor: SLATE_DARK } }}
        >
          Back to sign in
        </Button>
      </Stack>
    ) : (
      <Box component="form" onSubmit={handleSetPasswordSubmit}>
        <Stack spacing={2}>
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
            sx={{ py: 1.25, fontWeight: 600, bgcolor: SLATE, '&:hover': { bgcolor: SLATE_DARK } }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </Button>
          <Button fullWidth variant="text" onClick={() => { setShowSetPassword(false); setError(''); }} sx={{ color: SLATE }}>
            Back to sign in
          </Button>
        </Stack>
      </Box>
    );
  } else if (showForgotPassword) {
    formBody = forgotSuccess ? (
      <Stack spacing={2}>
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
          sx={{ py: 1.25, fontWeight: 600, bgcolor: SLATE, '&:hover': { bgcolor: SLATE_DARK } }}
        >
          Back to sign in
        </Button>
      </Stack>
    ) : (
      <Box component="form" onSubmit={handleForgotSubmit}>
        <Stack spacing={2}>
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
            sx={{ py: 1.25, fontWeight: 600, bgcolor: SLATE, '&:hover': { bgcolor: SLATE_DARK } }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
          <Button fullWidth variant="text" onClick={() => { setShowForgotPassword(false); setError(''); }} sx={{ color: SLATE }}>
            Back to sign in
          </Button>
        </Stack>
      </Box>
    );
  } else {
    formBody = (
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          {timedOut && !error && (
            <Alert severity="info">You were signed out due to inactivity. Please sign in again.</Alert>
          )}
          <Alert severity="info" icon={<LockIcon fontSize="inherit" />}>
            After you sign in, you will set up or verify MFA with a free authenticator app (one-time setup, then a
            quick code at each login).
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
              sx={{ fontWeight: 500, color: SLATE }}
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
              py: 1.35,
              fontWeight: 600,
              bgcolor: SLATE,
              boxShadow: `0 10px 28px ${alpha(SLATE, 0.25)}`,
              '&:hover': { bgcolor: SLATE_DARK },
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
              sx={{ fontWeight: 600, color: SLATE, verticalAlign: 'baseline' }}
            >
              Request an invitation
            </Link>
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        color: SLATE_DARK,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 90% 60% at 8% -10%, ${alpha('#93c5fd', 0.55)} 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 95% 5%, ${alpha('#fda4af', 0.4)} 0%, transparent 50%),
            radial-gradient(ellipse 80% 55% at 50% 100%, ${alpha('#5eead4', 0.35)} 0%, transparent 55%),
            linear-gradient(165deg, #f8fafc 0%, #eef2ff 38%, #f0fdfa 72%, #f8fafc 100%)
          `,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.3,
          backgroundImage: `
            linear-gradient(${alpha(SLATE, 0.06)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(SLATE, 0.06)} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(180deg, black 0%, black 75%, transparent 100%)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          component="header"
          sx={{
            px: { xs: 2, sm: 3, lg: 5 },
            py: { xs: 2, md: 2.5 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            component="button"
            type="button"
            onClick={() => navigate('/')}
            sx={{
              border: 0,
              background: 'none',
              cursor: 'pointer',
              p: 0,
              textAlign: 'left',
              color: 'inherit',
              '&:focus-visible': { outline: `2px solid ${SLATE}`, outlineOffset: 4, borderRadius: 1 },
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${SLATE} 0%, ${alpha(SLATE, 0.75)} 100%)`,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '1rem',
                boxShadow: `0 4px 16px ${alpha(SLATE, 0.2)}`,
              }}
              aria-hidden
            >
              P
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
                PECC Support Tool
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                From the ImPACTS program
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="text"
            onClick={() => navigate('/')}
            sx={{ fontWeight: 600, color: SLATE_DARK }}
          >
            Back to home
          </Button>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 3, md: 6 },
            alignItems: 'center',
            px: { xs: 2, sm: 3, lg: 6 },
            py: { xs: 2, md: 4 },
            pb: { xs: 5, md: 6 },
          }}
        >
          {/* Brand / trust panel */}
          <Stack
            spacing={3}
            sx={{
              maxWidth: 480,
              display: { xs: 'none', md: 'flex' },
              pr: { md: 2 },
            }}
          >
            <Typography
              component="h1"
              variant="h3"
              sx={{ fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15 }}
            >
              Sign in to the PECC Support Tool
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65 }}>
              Track activities, close readiness gaps, collaborate with your cohort, and review your snapshot — all in
              one place for pediatric emergency care coordination.
            </Typography>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(SLATE, 0.08),
                    color: SLATE,
                    flexShrink: 0,
                  }}
                >
                  <NoPhiIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    No patient PHI
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    Do not enter real patient names, MRNs, or other protected health information.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(SLATE, 0.08),
                    color: SLATE,
                    flexShrink: 0,
                  }}
                >
                  <LockIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    MFA protected
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    Authenticator-app MFA is required after sign-in to protect hospital readiness data.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(SLATE, 0.08),
                    color: SLATE,
                    flexShrink: 0,
                  }}
                >
                  <ShieldIcon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Invitation-only access
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    Accounts are created by ImPACTS program administrators — not open registration.
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Stack>

          {/* Form card */}
          <Box sx={{ width: '100%', maxWidth: 440, mx: { xs: 'auto', md: 0 }, justifySelf: { md: 'end' } }}>
            <Box
              sx={{
                display: { xs: 'block', md: 'none' },
                mb: 2.5,
                textAlign: 'center',
              }}
            >
              <Typography component="h1" variant="h4" sx={{ fontWeight: 600, mb: 0.75 }}>
                {formTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formSubtitle}
              </Typography>
            </Box>

            <Box
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(16px)',
                border: '1px solid',
                borderColor: alpha('#fff', 0.85),
                boxShadow: `0 24px 64px ${alpha(SLATE, 0.12)}`,
              }}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' }, mb: 2.5 }}>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {formTitle}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                  {formSubtitle}
                </Typography>
              </Box>
              {formBody}
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', textAlign: 'center', mt: 2.5, lineHeight: 1.55, px: 1 }}
            >
              Do not enter Protected Health Information (PHI) or real patient data. Free-text fields are screened for
              common HIPAA identifiers. By using this site you agree to the Terms of Service (available after sign-in).
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default LoginPage;
