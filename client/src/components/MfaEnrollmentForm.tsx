import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
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

export const MFA_ENROLLMENT_FORM_ID = 'mfa-enrollment-form';

interface MfaEnrollmentFormProps {
  email?: string | null;
  userId?: string | null;
  onEnrolled: () => void;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Wider two-column layout for blocking dialogs. */
  layout?: 'stacked' | 'split';
  hideIntro?: boolean;
  hideActions?: boolean;
  onSubmitStateChange?: (state: { loading: boolean; canSubmit: boolean }) => void;
}

const MfaEnrollmentForm: React.FC<MfaEnrollmentFormProps> = ({
  email,
  userId,
  onEnrolled,
  onCancel,
  cancelLabel = 'Log out',
  layout = 'stacked',
  hideIntro = false,
  hideActions = false,
  onSubmitStateChange,
}) => {
  const split = layout === 'split';
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [copied, setCopied] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [restarted, setRestarted] = useState(false);
  const qrSectionRef = useRef<HTMLDivElement | null>(null);

  const startEnrollment = useCallback(async (isCancelled?: () => boolean) => {
    try {
      setBootstrapping(true);
      setError('');
      const data = await beginTotpEnrollment();
      if (isCancelled?.()) return;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err) {
      if (!isCancelled?.()) {
        setFactorId('');
        setQrCode('');
        setSecret('');
        setError(err instanceof Error ? err.message : 'Could not start MFA setup.');
      }
    } finally {
      if (!isCancelled?.()) setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void startEnrollment(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [startEnrollment]);

  useEffect(() => {
    onSubmitStateChange?.({
      loading,
      canSubmit: !bootstrapping && !!factorId,
    });
  }, [loading, bootstrapping, factorId, onSubmitStateChange]);

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

  const handleRestartEnrollment = async () => {
    setVerifyCode('');
    setCopied(false);
    setManualExpanded(false);
    setRestarted(true);
    await startEnrollment();
    window.setTimeout(() => {
      qrSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const showQrPanel = bootstrapping || !!qrCode;
  const showRestartActions = !loading;

  const restartActions = showRestartActions ? (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.25 }}>
      <Button
        type="button"
        variant="outlined"
        size="small"
        onClick={handleRestartEnrollment}
        disabled={loading || bootstrapping}
        sx={{ textTransform: 'none' }}
      >
        {bootstrapping ? 'Generating new QR code…' : 'Wrong app or need a new code? Get new QR code'}
      </Button>
      {!qrCode && !bootstrapping ? (
        <Button
          type="button"
          variant="contained"
          size="small"
          onClick={handleRestartEnrollment}
          disabled={loading}
          sx={{ textTransform: 'none' }}
        >
          Show QR code
        </Button>
      ) : null}
    </Stack>
  ) : null;

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

  const qrSize = split ? 156 : 200;

  const setupPanel = (
    <>
      {showQrPanel ? (
        <Box ref={qrSectionRef} sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75, fontSize: '0.875rem' }}>
            QR code — Step 2
          </Typography>
          <Alert severity="warning" sx={{ mb: 1.25, py: 0.5, '& .MuiAlert-message': { fontSize: '0.8125rem', lineHeight: 1.45 } }}>
            <strong>Do not scan with your phone&apos;s regular Camera app.</strong> Open your authenticator
            app (Google Authenticator, Microsoft Authenticator, Passwords, Authy, 1Password, etc.) and use
            its built-in <strong>Scan QR code</strong> feature.
          </Alert>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              p: 1.25,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
              position: 'relative',
              minHeight: qrSize + 20,
            }}
          >
            {qrCode ? (
              <Box
                component="img"
                src={totpQrDataUrl(qrCode)}
                alt="QR code to add the PECC Support Tool to your authenticator app"
                sx={{
                  width: qrSize,
                  height: qrSize,
                  maxWidth: '100%',
                  opacity: bootstrapping ? 0.35 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                Preparing your QR code…
              </Typography>
            )}
            {bootstrapping ? (
              <CircularProgress
                size={32}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  mt: '-16px',
                  ml: '-16px',
                }}
                aria-label="Generating QR code"
              />
            ) : null}
          </Box>
          {isIosDevice() ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, lineHeight: 1.4 }}>
              iPhone tip: long-press this QR code on the page (not Camera) → Add Verification Code in
              Passwords.
            </Typography>
          ) : null}
          {restartActions}
        </Box>
      ) : (
        <Box sx={{ mb: 1.5 }}>
          <Alert severity="error" sx={{ mb: 1.25 }}>
            We could not load a QR code. Tap below to try again.
          </Alert>
          {restartActions}
        </Box>
      )}

      {restarted && !bootstrapping && qrCode ? (
        <Alert severity="info" sx={{ mb: 1.5, py: 0.5, '& .MuiAlert-message': { fontSize: '0.8125rem', lineHeight: 1.45 } }}>
          A new QR code and setup key were generated. Remove any old PECC Support Tool or ImPACTS entry from your
          authenticator app, then scan or enter the new one below.
        </Alert>
      ) : null}

      {secret ? (
        <Accordion
          expanded={manualExpanded}
          onChange={(_, expanded) => setManualExpanded(expanded)}
          disableGutters
          elevation={0}
          sx={{
            mb: 1.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ px: 1.5, minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
              Manual entry (can&apos;t scan?)
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.25 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, lineHeight: 1.45 }}>
              Paste into your app under <strong>Enter setup key</strong>.
              {email ? (
                <>
                  {' '}
                  Account: <strong>PECC Support Tool</strong> · <strong>{email}</strong>
                </>
              ) : null}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                fullWidth
                size="small"
                value={secret}
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.8rem' },
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={copied ? 'Copied' : 'Copy setup key'}>
                        <IconButton onClick={handleCopySecret} edge="end" aria-label="Copy setup key" size="small">
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="outlined" onClick={handleCopySecret} size="small" sx={{ flexShrink: 0, textTransform: 'none' }}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      ) : null}

      <TextField
        fullWidth
        required
        size="small"
        label="6-digit code — Steps 3–4"
        helperText="Use the current code from your app (~30 sec refresh)."
        value={verifyCode}
        onChange={(e) => {
          setVerifyCode(e.target.value);
          if (error) setError('');
        }}
        inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
      />

      {!showQrPanel ? null : (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, lineHeight: 1.45 }}>
          Scanned with the wrong app or can&apos;t find the code? Use <strong>Get new QR code</strong> above.
        </Typography>
      )}
    </>
  );

  const actions = hideActions ? null : (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        mt: split ? 2 : 2.5,
        flexDirection: { xs: 'column', sm: 'row' },
      }}
    >
      {onCancel ? (
        <Button type="button" onClick={onCancel} disabled={loading || bootstrapping} color="inherit">
          {cancelLabel}
        </Button>
      ) : null}
      <Button
        type="submit"
        variant="contained"
        disabled={loading || bootstrapping || !factorId}
        fullWidth={!split}
        sx={split ? { minWidth: 200 } : undefined}
      >
        {loading ? 'Verifying…' : 'Enable authenticator'}
      </Button>
    </Box>
  );

  const splitGrid = (
    <Box
      sx={{
        containerType: 'inline-size',
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: '1fr',
          '@container (min-width: 560px)': {
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(260px, 0.85fr)',
          },
        }}
      >
        <Box>
          <MfaInstructionSteps mode="enroll" compact qrBeside />
        </Box>
        <Box>{setupPanel}</Box>
      </Box>
      {actions}
    </Box>
  );

  return (
    <Box component="form" onSubmit={handleEnable} id={MFA_ENROLLMENT_FORM_ID}>
      {!hideIntro ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            One-time MFA setup
          </Typography>
          <Typography variant="body2">
            MFA is required for all PECC Support Tool accounts. Follow the steps to link a free authenticator app.
          </Typography>
        </Alert>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }} role="alert">
          {error}
        </Alert>
      ) : null}

      {split ? (
        splitGrid
      ) : (
        <>
          <MfaInstructionSteps mode="enroll" />
          {setupPanel}
          {actions}
        </>
      )}
    </Box>
  );
};

export default MfaEnrollmentForm;
