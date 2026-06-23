import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
  Typography,
} from '@mui/material';
import {
  beginTotpEnrollment,
  totpQrDataUrl,
  verifyMfaCode,
} from '../utils/mfa';
import { logSecurityEvent } from '../utils/securityEvents';

interface MfaEnrollmentFormProps {
  email?: string | null;
  userId?: string | null;
  onEnrolled: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

const MfaEnrollmentForm: React.FC<MfaEnrollmentFormProps> = ({
  email,
  userId,
  onEnrolled,
  onCancel,
  cancelLabel = 'Log out',
}) => {
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBootstrapping(true);
        setError('');
        const data = await beginTotpEnrollment();
        if (cancelled) return;
        setFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not start MFA setup.');
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalized = verifyCode.replace(/\s/g, '');
    if (!factorId) {
      setError('Enrollment did not start correctly. Refresh and try again.');
      return;
    }
    if (normalized.length < 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    try {
      setLoading(true);
      await verifyMfaCode(factorId, normalized);
      void logSecurityEvent('mfa_enrolled', { email, userId });
      onEnrolled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleEnable}>
      <Typography variant="body2" color="text.secondary" paragraph>
        Multi-factor authentication (MFA) is required for all ImPACTS accounts. Scan the QR code with a
        free authenticator app, then enter the 6-digit code to finish setup.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}
      {bootstrapping ? (
        <Typography variant="body2" color="text.secondary">
          Preparing your authenticator setup…
        </Typography>
      ) : (
        <>
          {qrCode ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 2,
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Box
                component="img"
                src={totpQrDataUrl(qrCode)}
                alt="QR code for authenticator app setup"
                sx={{ width: 200, height: 200 }}
              />
            </Box>
          ) : null}
          {secret ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Manual entry key: <Box component="span" sx={{ fontFamily: 'monospace' }}>{secret}</Box>
            </Typography>
          ) : null}
          <TextField
            fullWidth
            required
            label="6-digit verification code"
            value={verifyCode}
            onChange={(e) => {
              setVerifyCode(e.target.value);
              if (error) setError('');
            }}
            inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
            autoFocus
          />
        </>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        {onCancel ? (
          <Button type="button" onClick={onCancel} disabled={loading || bootstrapping} color="inherit">
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="contained"
          disabled={loading || bootstrapping || !factorId}
          fullWidth
        >
          {loading ? 'Enabling…' : 'Enable authenticator'}
        </Button>
      </Box>
    </Box>
  );
};

export default MfaEnrollmentForm;
