import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Alert,
  Chip,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  GavelOutlined as TermsIcon,
  OpenInNewOutlined as ReadTermsIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getUserData } from '../utils/userData';
import { PASSWORD_UPDATE_REQUIRED_KEY } from '../utils/passwordPolicy';
import {
  CURRENT_TERMS_VERSION,
  needsTermsReacceptance,
  recordTermsAcceptance,
  TERMS_LAST_UPDATED_LABEL,
  TERMS_VERSION_KEY,
} from '../utils/termsOfService';
import TermsOfService from './TermsOfService';

const HIGHLIGHTS = [
  'Mandatory MFA with an authenticator app',
  'Minimum 12-character passwords',
  'Automatic sign-out after inactivity',
  'Security event logging and provider disclosures',
] as const;

/**
 * Blocks app use until the user accepts the current Terms version.
 * Deferred while the forced password-update dialog is active.
 */
const TermsReacceptanceDialog: React.FC<{ onComplete?: () => void; gateManaged?: boolean }> = ({
  onComplete,
  gateManaged = false,
}) => {
  const theme = useTheme();
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(gateManaged);
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser?.id) {
      setOpen(false);
      return;
    }

    if (gateManaged) {
      setOpen(true);
      return;
    }

    let cancelled = false;

    const evaluate = async () => {
      const passwordPending = await getUserData<boolean>(currentUser.id, PASSWORD_UPDATE_REQUIRED_KEY);
      if (cancelled) return;
      if (passwordPending === true) {
        setOpen(false);
        return;
      }
      const version = await getUserData<string>(currentUser.id, TERMS_VERSION_KEY);
      if (cancelled) return;
      setOpen(needsTermsReacceptance(version));
    };

    void evaluate();
    const interval = setInterval(() => {
      void evaluate();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser?.id, gateManaged]);

  const handleAccept = async () => {
    if (!currentUser?.id || !accepted) return;
    setError('');
    try {
      setSaving(true);
      await recordTermsAcceptance(currentUser.id);
      setOpen(false);
      setAccepted(false);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record acceptance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setOpen(false);
      window.location.replace('/login');
    }
  };

  if (!currentUser) return null;

  const headerBg = `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`;

  return (
    <>
      <Dialog
        open={open}
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(15, 23, 42, 0.14)',
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            px: 3,
            pt: 3,
            pb: 2.5,
            background: headerBg,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper',
                color: 'primary.main',
                boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.08)}`,
                flexShrink: 0,
              }}
            >
              <TermsIcon aria-hidden />
            </Box>
            <Box sx={{ minWidth: 0, pt: 0.25 }}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.75 }}>
                Updated Terms of Service
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={`Version ${CURRENT_TERMS_VERSION}`}
                  sx={{ fontWeight: 600, bgcolor: 'background.paper' }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Updated ${TERMS_LAST_UPDATED_LABEL}`}
                  sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6) }}
                />
              </Stack>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.65 }}>
            We&apos;ve updated our Terms of Service and User Agreement with important security and
            access requirements. Please review the summary below and accept to continue using ImPACTS.
          </Typography>

          <Box
            sx={{
              mb: 2.5,
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25, color: 'text.primary' }}>
              What&apos;s new
            </Typography>
            <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2.25 }}>
              {HIGHLIGHTS.map((item) => (
                <Typography key={item} component="li" variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                  {item}
                </Typography>
              ))}
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {error}
            </Alert>
          )}

          <Button
            variant="outlined"
            onClick={() => setShowTerms(true)}
            fullWidth
            startIcon={<ReadTermsIcon fontSize="small" />}
            sx={{
              mb: 2,
              py: 1.1,
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            Read full Terms of Service
          </Button>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'grey.50',
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                  I have read and agree to the updated Terms of Service and User Agreement
                </Typography>
              }
              sx={{ m: 0, alignItems: 'flex-start', '& .MuiCheckbox-root': { pt: 0.25 } }}
            />
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1,
            borderTop: `1px solid ${theme.palette.divider}`,
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            '& > :not(style) ~ :not(style)': { ml: { xs: 0, sm: 'auto' } },
          }}
        >
          <Button
            onClick={handleLogout}
            disabled={saving}
            color="inherit"
            sx={{ textTransform: 'none', fontWeight: 500, width: { xs: '100%', sm: 'auto' } }}
          >
            Log out
          </Button>
          <Button
            variant="contained"
            onClick={handleAccept}
            disabled={!accepted || saving}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              borderRadius: 2,
              boxShadow: 'none',
              width: { xs: '100%', sm: 'auto' },
              '&:hover': { boxShadow: 1 },
            }}
          >
            {saving ? 'Saving…' : 'Accept and continue'}
          </Button>
        </DialogActions>
      </Dialog>

      <TermsOfService open={showTerms} onClose={() => setShowTerms(false)} readOnly />
    </>
  );
};

export default TermsReacceptanceDialog;
