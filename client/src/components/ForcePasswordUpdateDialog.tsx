import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Typography,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getUserData } from '../utils/userData';
import {
  PASSWORD_UPDATE_REQUIRED_KEY,
  PASSWORD_REQUIREMENT_TEXT,
  validateNewPassword,
} from '../utils/passwordPolicy';
import PasswordPolicyChecklist, { passwordFieldHelperText } from './PasswordPolicyChecklist';

/**
 * Shown when the signed-in user's password predates the 12-character policy
 * (flagged at login). Blocks app use until the password is updated or the
 * user signs out.
 */
interface ForcePasswordUpdateDialogProps {
  onComplete?: () => void;
  /** When true, dialog is shown by SecurityGateShell (always open). */
  gateManaged?: boolean;
}

const ForcePasswordUpdateDialog: React.FC<ForcePasswordUpdateDialogProps> = ({
  onComplete,
  gateManaged = false,
}) => {
  const { currentUser, updatePassword, logout } = useAuth();
  const [open, setOpen] = useState(gateManaged);
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) {
      setOpen(false);
      return;
    }
    if (gateManaged) {
      setOpen(true);
      return;
    }
    getUserData<boolean>(currentUser.id, PASSWORD_UPDATE_REQUIRED_KEY)
      .then((flag) => {
        if (!cancelled && flag === true) setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, gateManaged]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowValidation(true);
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
    if (!currentPassword.trim()) {
      setError('Enter your current password (the one you just used to sign in).');
      return;
    }
    try {
      setSaving(true);
      await updatePassword(newPassword, currentPassword);
      setOpen(false);
      setNewPassword('');
      setCurrentPassword('');
      setConfirmPassword('');
      setShowValidation(false);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
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

  const confirmMismatch =
    showValidation &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;

  return (
    <Dialog open={open} disableEscapeKeyDown maxWidth="sm" fullWidth>
      <DialogTitle>Password update required</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Our password requirements have been strengthened. Please set a new password to
            continue using ImPACTS.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {PASSWORD_REQUIREMENT_TEXT}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {error}
            </Alert>
          )}
          <TextField
            margin="normal"
            required
            fullWidth
            label="Current password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              if (error) setError('');
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (error) setError('');
            }}
            onBlur={() => setShowValidation(true)}
            error={showValidation && !!validateNewPassword(newPassword) && newPassword.length > 0}
            helperText={passwordFieldHelperText(newPassword, showValidation)}
            FormHelperTextProps={{
              sx: {
                color:
                  showValidation && validateNewPassword(newPassword) ? 'error.main' : 'text.secondary',
              },
            }}
          />
          <PasswordPolicyChecklist password={newPassword} showValidation={showValidation} compact />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError('');
            }}
            error={confirmMismatch}
            helperText={confirmMismatch ? 'Passwords do not match.' : undefined}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleLogout} color="inherit" disabled={saving}>
            Log out
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Updating…' : 'Update password'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ForcePasswordUpdateDialog;
