import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
} from '@mui/material';
import { verifyMfaLogin } from '../utils/mfa';
import { logSecurityEvent } from '../utils/securityEvents';
import { useAuth } from '../context/AuthContext';
import MfaInstructionSteps from './MfaInstructionSteps';

interface MfaChallengeFormProps {
  email?: string | null;
  userId?: string | null;
  onSuccess: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  submitLabel?: string;
  compact?: boolean;
}

const MfaChallengeForm: React.FC<MfaChallengeFormProps> = ({
  email,
  userId,
  onSuccess,
  onCancel,
  cancelLabel = 'Log out',
  submitLabel = 'Verify code',
  compact = false,
}) => {
  const { logout } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalized = code.replace(/\s/g, '');
    if (normalized.length < 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      setLoading(true);
      await verifyMfaLogin(normalized);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed. Try again.';
      setError(message);
      void logSecurityEvent('mfa_challenge_failed', {
        email,
        userId,
        metadata: { reason: message },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (onCancel) {
      onCancel();
      return;
    }
    try {
      await logout();
    } finally {
      window.location.replace('/login');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      <MfaInstructionSteps mode="verify" />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      <TextField
        fullWidth
        required
        label="6-digit authentication code"
        helperText="Codes change every ~30 seconds. Wait for a new code if verification fails."
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (error) setError('');
        }}
        inputProps={{
          inputMode: 'numeric',
          autoComplete: 'one-time-code',
          'aria-label': 'Authenticator code',
        }}
        autoFocus
        size={compact ? 'small' : 'medium'}
      />

      <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexDirection: compact ? 'column' : 'row' }}>
        {onCancel ? (
          <Button type="button" onClick={handleCancel} disabled={loading} color="inherit">
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="submit" variant="contained" disabled={loading} fullWidth={compact}>
          {loading ? 'Verifying…' : submitLabel}
        </Button>
      </Box>
    </Box>
  );
};

export default MfaChallengeForm;
