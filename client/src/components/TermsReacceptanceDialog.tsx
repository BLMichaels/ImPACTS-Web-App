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
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getUserData } from '../utils/userData';
import { PASSWORD_UPDATE_REQUIRED_KEY } from '../utils/passwordPolicy';
import {
  CURRENT_TERMS_VERSION,
  needsTermsReacceptance,
  recordTermsAcceptance,
  TERMS_VERSION_KEY,
} from '../utils/termsOfService';
import TermsOfService from './TermsOfService';

const TERMS_FONT = '"Times New Roman", Times, serif';
const termsDoc = {
  fontFamily: TERMS_FONT,
  fontSize: '12pt',
  lineHeight: 1,
  color: '#000000',
  textAlign: 'left' as const,
};

/**
 * Blocks app use until the user accepts the current Terms version.
 * Deferred while the forced password-update dialog is active.
 */
const TermsReacceptanceDialog: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser?.id) {
      setOpen(false);
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
  }, [currentUser?.id]);

  const handleAccept = async () => {
    if (!currentUser?.id || !accepted) return;
    setError('');
    try {
      setSaving(true);
      await recordTermsAcceptance(currentUser.id);
      setOpen(false);
      setAccepted(false);
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

  return (
    <>
      <Dialog
        open={open}
        disableEscapeKeyDown
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#ffffff', color: '#000000', border: '1px solid #000000' } }}
      >
        <DialogTitle sx={{ ...termsDoc, fontWeight: 700, borderBottom: '1px solid #000000' }}>
          Updated Terms of Service
        </DialogTitle>
        <DialogContent sx={{ ...termsDoc, py: 2 }}>
          <Typography component="p" sx={{ ...termsDoc, mb: 1 }}>
            We updated our Terms of Service and User Agreement (version {CURRENT_TERMS_VERSION}),
            including security, logging, password, and multi-factor authentication (MFA) requirements.
            Please review and accept to continue using ImPACTS.
          </Typography>
          <Typography component="p" sx={{ ...termsDoc, mb: 2 }}>
            Changes include mandatory MFA with an authenticator app, minimum password length,
            automatic sign-out after inactivity, security event logging, and disclosure of
            infrastructure providers used to operate the Tool.
          </Typography>
          {error && (
            <Typography component="p" sx={{ ...termsDoc, fontWeight: 700, mb: 2 }} role="alert">
              {error}
            </Typography>
          )}
          <Box sx={{ mb: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setShowTerms(true)}
              fullWidth
              sx={{
                ...termsDoc,
                textTransform: 'none',
                color: '#000000',
                borderColor: '#000000',
                '&:hover': { borderColor: '#000000', bgcolor: '#f5f5f5' },
              }}
            >
              Read full Terms of Service
            </Button>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                sx={{ color: '#000000', '&.Mui-checked': { color: '#000000' } }}
              />
            }
            label="I have read and agree to the updated Terms of Service and User Agreement"
            sx={{ ...termsDoc, '& .MuiFormControlLabel-label': { ...termsDoc } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, borderTop: '1px solid #000000' }}>
          <Button
            onClick={handleLogout}
            disabled={saving}
            sx={{ ...termsDoc, textTransform: 'none', color: '#000000' }}
          >
            Log out
          </Button>
          <Button
            variant="outlined"
            onClick={handleAccept}
            disabled={!accepted || saving}
            sx={{
              ...termsDoc,
              textTransform: 'none',
              color: '#000000',
              borderColor: '#000000',
              '&:hover': { borderColor: '#000000', bgcolor: '#f5f5f5' },
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
