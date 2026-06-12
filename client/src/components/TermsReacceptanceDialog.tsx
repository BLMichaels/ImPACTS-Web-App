import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
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
      <Dialog open={open} disableEscapeKeyDown maxWidth="sm" fullWidth>
        <DialogTitle>Updated Terms of Service</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            We updated our Terms of Service and User Agreement (version {CURRENT_TERMS_VERSION}),
            including security, logging, and password requirements. Please review and accept to
            continue using ImPACTS.
          </Alert>
          <Typography variant="body2" color="text.secondary" paragraph>
            Changes include minimum password length, automatic sign-out after inactivity, security
            event logging, and disclosure of infrastructure providers used to operate the Tool.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {error}
            </Alert>
          )}
          <Box sx={{ mb: 1 }}>
            <Button variant="outlined" onClick={() => setShowTerms(true)} fullWidth>
              Read full Terms of Service
            </Button>
          </Box>
          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                color="primary"
              />
            }
            label="I have read and agree to the updated Terms of Service and User Agreement"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleLogout} color="inherit" disabled={saving}>
            Log out
          </Button>
          <Button variant="contained" onClick={handleAccept} disabled={!accepted || saving}>
            {saving ? 'Saving…' : 'Accept and continue'}
          </Button>
        </DialogActions>
      </Dialog>

      <TermsOfService open={showTerms} onClose={() => setShowTerms(false)} readOnly />
    </>
  );
};

export default TermsReacceptanceDialog;
