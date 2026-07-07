import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
} from '@mui/material';
import { verifyMfaLogin, hasVerifiedTotpEnrollment } from '../utils/mfa';
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
  /** Hide inline action row (e.g. when parent dialog provides footer buttons). */
  hideActions?: boolean;
  /** Auto-verify when 6 digits are entered (default true). */
  autoSubmit?: boolean;
  /** When no verified authenticator exists, switch back to enrollment. */
  onNeedsEnrollment?: () => void;
}

const MfaChallengeForm: React.FC<MfaChallengeFormProps> = ({
  email,
  userId,
  onSuccess,
  onCancel,
  cancelLabel = 'Log out',
  submitLabel = 'Verify code',
  compact = false,
  hideActions = false,
  autoSubmit = true,
  onNeedsEnrollment,
}) => {
  const { logout } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void hasVerifiedTotpEnrollment().then((verified) => {
      if (!cancelled && !verified) onNeedsEnrollment?.();
    });
    return () => {
      cancelled = true;
    };
  }, [onNeedsEnrollment]);

  const verifyCode = useCallback(
    async (rawCode: string) => {
      if (verifyingRef.current) return;
      const normalized = rawCode.replace(/\s/g, '');
      if (normalized.length < 6) {
        setError('Enter the 6-digit code from your authenticator app.');
        return;
      }
      setError('');
      try {
        verifyingRef.current = true;
        setLoading(true);
        await verifyMfaLogin(normalized);
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed. Try again.';
        setError(message);
        setCode('');
        if (message.toLowerCase().includes('no authenticator')) {
          onNeedsEnrollment?.();
        }
        void logSecurityEvent('mfa_challenge_failed', {
          email,
          userId,
          metadata: { reason: message },
        });
      } finally {
        verifyingRef.current = false;
        setLoading(false);
      }
    },
    [email, onNeedsEnrollment, onSuccess, userId]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(code);
  };

  useEffect(() => {
    if (!autoSubmit || loading || verifyingRef.current) return;
    const normalized = code.replace(/\D/g, '');
    if (normalized.length === 6) {
      void verifyCode(normalized);
    }
  }, [autoSubmit, code, loading, verifyCode]);

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
      <MfaInstructionSteps mode="verify" compact={compact} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      {loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Verifying your code…
        </Alert>
      )}

      <TextField
        fullWidth
        required
        label="6-digit authentication code"
        helperText="Codes change every ~30 seconds. Verification runs automatically when you enter 6 digits."
        value={code}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          if (error) setError('');
        }}
        inputProps={{
          inputMode: 'numeric',
          autoComplete: 'one-time-code',
          'aria-label': 'Authenticator code',
          maxLength: 6,
        }}
        autoFocus
        size={compact ? 'small' : 'medium'}
        disabled={loading}
      />

      {!hideActions ? (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexDirection: compact ? 'column' : 'row' }}>
          {onCancel ? (
            <Button type="button" onClick={handleCancel} disabled={loading} color="inherit">
              {cancelLabel}
            </Button>
          ) : null}
          <Button type="submit" variant="contained" disabled={loading || code.length < 6} fullWidth={compact}>
            {loading ? 'Verifying…' : submitLabel}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default MfaChallengeForm;
