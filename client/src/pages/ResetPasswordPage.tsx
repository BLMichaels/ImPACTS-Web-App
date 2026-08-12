import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthMarketingShell, { AUTH_SLATE, AUTH_SLATE_DARK } from '../components/AuthMarketingShell';
import PasswordPolicyChecklist from '../components/PasswordPolicyChecklist';
import { validateNewPassword, PASSWORD_REQUIREMENT_TEXT } from '../utils/passwordPolicy';
import {
  clearPasswordRecoverySession,
  getPasswordRecoveryError,
  isPasswordRecoverySession,
} from '../utils/authFlow';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.92)',
    borderRadius: 2,
  },
};

/**
 * Dedicated password-reset completion page.
 * Users land here from the Supabase recovery email (`redirectTo=/reset-password`).
 */
const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, updatePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [waitingForSession, setWaitingForSession] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const storedError = getPasswordRecoveryError();
    if (storedError) {
      setLinkError(storedError);
      setWaitingForSession(false);
      return;
    }

    if (!isPasswordRecoverySession() && !currentUser) {
      // Give Supabase a moment to finish exchanging the recovery URL.
      const t = window.setTimeout(() => {
        if (!isPasswordRecoverySession() && !currentUser) {
          setLinkError(
            'This password reset link is missing, expired, or was already used. Request a new reset email from the sign-in page.'
          );
          setWaitingForSession(false);
        }
      }, 2500);
      return () => window.clearTimeout(t);
    }

    if (currentUser) {
      setWaitingForSession(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authLoading) return;
    if (currentUser && isPasswordRecoverySession()) {
      setWaitingForSession(false);
      setLinkError(null);
    }
  }, [authLoading, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!currentUser) {
      setError('Your reset session expired. Request a new password reset email and try again.');
      return;
    }
    try {
      setLoading(true);
      await updatePassword(newPassword);
      clearPasswordRecoverySession();
      try {
        await logout();
      } catch {
        /* still show success — password was updated */
      }
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password.';
      // Common when recovery session never established
      if (/session|auth/i.test(message)) {
        setError(
          'Your reset session expired or is incomplete. Go back to sign in, request a new reset link, and open it in this same browser.'
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  let body: React.ReactNode;
  if (success) {
    body = (
      <Stack spacing={1.75}>
        <Alert severity="success">
          Password updated. Sign in with your email and new password. You may be asked for your authenticator code next.
        </Alert>
        <Button
          fullWidth
          variant="contained"
          onClick={() => navigate('/login', { replace: true })}
          sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
        >
          Continue to sign in
        </Button>
      </Stack>
    );
  } else if (linkError) {
    body = (
      <Stack spacing={1.75}>
        <Alert severity="error">{linkError}</Alert>
        <Button
          fullWidth
          variant="contained"
          onClick={() => {
            clearPasswordRecoverySession();
            navigate('/login', { replace: true, state: { openForgotPassword: true } });
          }}
          sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
        >
          Request a new reset link
        </Button>
      </Stack>
    );
  } else if (authLoading || waitingForSession) {
    body = (
      <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size={32} aria-label="Preparing password reset" />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Verifying your password reset link…
        </Typography>
      </Stack>
    );
  } else {
    body = (
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={1.75}>
          <Alert severity="info">
            Choose a new password for {currentUser?.email || 'your account'}. After saving, you will sign in normally.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            required
            fullWidth
            name="newPassword"
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText={PASSWORD_REQUIREMENT_TEXT}
            sx={fieldSx}
          />
          <PasswordPolicyChecklist password={newPassword} />
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
            disabled={loading || !currentUser}
            sx={{ py: 1.2, fontWeight: 600, bgcolor: AUTH_SLATE, '&:hover': { bgcolor: AUTH_SLATE_DARK } }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => {
              clearPasswordRecoverySession();
              navigate('/login', { replace: true });
            }}
            sx={{ color: AUTH_SLATE }}
          >
            Cancel and return to sign in
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <AuthMarketingShell showBackHome={false}>
      <Box
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 480,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: { xs: 3, md: 6 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography
          component="h1"
          variant="h4"
          sx={{ fontWeight: 600, letterSpacing: '-0.02em', mb: 0.75, fontSize: { xs: '1.55rem', md: '1.85rem' } }}
        >
          Set a new password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
          Complete your password reset for the PECC Support Tool.
        </Typography>
        <Box
          sx={{
            p: { xs: 2.25, sm: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(16px)',
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.9)',
          }}
        >
          {body}
        </Box>
      </Box>
    </AuthMarketingShell>
  );
};

export default ResetPasswordPage;
