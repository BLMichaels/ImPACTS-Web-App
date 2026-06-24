import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert, Container, Link } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateNewPassword, PASSWORD_REQUIREMENT_TEXT } from '../utils/passwordPolicy';

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

  // Detect password recovery redirect (hash contains type=recovery)
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

  if (showSetPassword) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h4" gutterBottom>
            Set new password
          </Typography>
          {setPasswordSuccess ? (
            <>
              <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                Password updated. You can now log in with your new password.
              </Alert>
              <Button fullWidth variant="contained" onClick={() => { setShowSetPassword(false); setSetPasswordSuccess(false); }}>
                Back to login
              </Button>
            </>
          ) : (
            <>
              {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
              <Box component="form" onSubmit={handleSetPasswordSubmit} sx={{ mt: 1, width: '100%' }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="newPassword"
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText={PASSWORD_REQUIREMENT_TEXT}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="confirmPassword"
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                  {loading ? 'Updating...' : 'Update password'}
                </Button>
                <Button fullWidth variant="text" onClick={() => { setShowSetPassword(false); setError(''); }}>
                  Back to login
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Container>
    );
  }

  if (showForgotPassword) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h4" gutterBottom>
            Forgot password
          </Typography>
          {forgotSuccess ? (
            <>
              <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                Check your email for a link to reset your password. The link may take a few minutes to arrive.
              </Alert>
              <Button fullWidth variant="contained" onClick={() => { setShowForgotPassword(false); setForgotSuccess(false); }}>
                Back to login
              </Button>
            </>
          ) : (
            <>
              {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}
              <Box component="form" onSubmit={handleForgotSubmit} sx={{ mt: 1, width: '100%' }}>
                <TextField
                  margin="normal"
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
                />
                <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </Button>
                <Button fullWidth variant="text" onClick={() => { setShowForgotPassword(false); setError(''); }}>
                  Back to login
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h4" gutterBottom>
          Login
        </Typography>

        {timedOut && !error && (
          <Alert severity="info" sx={{ mb: 2, width: '100%' }}>
            You were signed out due to inactivity. Please log in again.
          </Alert>
        )}
        <Alert severity="info" sx={{ mb: 2, width: '100%' }}>
          After you sign in, you will set up or verify MFA with a free authenticator app (one-time setup,
          then a quick code at each login).
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <Link component="button" type="button" variant="body2" onClick={() => setShowForgotPassword(true)}>
              Forgot password?
            </Link>
          </Box>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => navigate('/register')}
          >
            Don&apos;t have an account? Register
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default LoginPage;
