import React, { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  beginTotpEnrollment,
  totpQrDataUrl,
  verifyMfaCode,
} from '../utils/mfa';
import { isIosDevice } from '../utils/device';
import { logSecurityEvent } from '../utils/securityEvents';
import MfaInstructionSteps from './MfaInstructionSteps';

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
  const [copied, setCopied] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(isIosDevice());

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

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy the setup key. Select and copy it manually.');
    }
  };

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
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          One-time setup (about 2 minutes)
        </Typography>
        <Typography variant="body2">
          MFA is required for all ImPACTS accounts. Follow the steps below to link a free authenticator
          app to your account.
        </Typography>
      </Alert>

      <MfaInstructionSteps mode="enroll" />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {error}
        </Alert>
      )}

      {bootstrapping ? (
        <Typography variant="body2" color="text.secondary">
          Preparing your QR code and setup key…
        </Typography>
      ) : (
        <>
          {qrCode ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                QR code (Step 2)
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  p: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  component="img"
                  src={totpQrDataUrl(qrCode)}
                  alt="QR code to add ImPACTS to your authenticator app"
                  sx={{ width: 200, height: 200, maxWidth: '100%' }}
                />
              </Box>
              {isIosDevice() ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Tip: long-press the QR code above, then tap Add Verification Code in Passwords.
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {secret ? (
            <Accordion
              expanded={manualExpanded}
              onChange={(_, expanded) => setManualExpanded(expanded)}
              disableGutters
              elevation={0}
              sx={{
                mb: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Manual entry (if you can&apos;t scan the QR code)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                  In your authenticator app, choose <strong>Enter setup key</strong> (or{' '}
                  <strong>Enter code manually</strong>), then paste this key. Account name:{' '}
                  <strong>ImPACTS</strong>
                  {email ? (
                    <>
                      {' '}
                      · Email: <strong>{email}</strong>
                    </>
                  ) : null}
                  .
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    size="small"
                    value={secret}
                    InputProps={{
                      readOnly: true,
                      sx: { fontFamily: 'monospace', fontSize: '0.9rem' },
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title={copied ? 'Copied' : 'Copy setup key'}>
                            <IconButton onClick={handleCopySecret} edge="end" aria-label="Copy setup key">
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button variant="outlined" onClick={handleCopySecret} sx={{ flexShrink: 0, textTransform: 'none' }}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ) : null}

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Enter verification code (Steps 3–4)
          </Typography>
          <TextField
            fullWidth
            required
            label="6-digit code from your authenticator app"
            helperText="Use the current code shown in Passwords or your authenticator app. Codes refresh every ~30 seconds."
            value={verifyCode}
            onChange={(e) => {
              setVerifyCode(e.target.value);
              if (error) setError('');
            }}
            inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
          />
        </>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexDirection: { xs: 'column', sm: 'row' } }}>
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
          {loading ? 'Verifying…' : 'Enable authenticator'}
        </Button>
      </Box>
    </Box>
  );
};

export default MfaEnrollmentForm;
