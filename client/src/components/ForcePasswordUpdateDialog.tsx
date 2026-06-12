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
import { getUserData, setUserData } from '../utils/userData';
import {
  PASSWORD_UPDATE_REQUIRED_KEY,
  PASSWORD_REQUIREMENT_TEXT,
  validateNewPassword,
} from '../utils/passwordPolicy';
import { logSecurityEvent } from '../utils/securityEvents';

/**
 * Shown when the signed-in user's password predates the 15-character policy
 * (flagged at login). Blocks app use until the password is updated or the
 * user signs out.
 */
const ForcePasswordUpdateDialog: React.FC = () => {
  const { currentUser, updatePassword, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) {
      setOpen(false);
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
  }, [currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
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
      setSaving(true);
      await updatePassword(newPassword);
      if (currentUser?.id) {
        await setUserData(currentUser.id, PASSWORD_UPDATE_REQUIRED_KEY, false);
        void logSecurityEvent('password_updated', {
          email: currentUser.email,
          userId: currentUser.id,
          metadata: { reason: 'policy_upgrade' },
        });
      }
      setOpen(false);
      setNewPassword('');
      setConfirmPassword('');
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

  return (
    <Dialog open={open} disableEscapeKeyDown maxWidth="sm" fullWidth>
      <DialogTitle>Password update required</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Our password requirements have been strengthened. Please set a new password to
            continue using ImPACTS.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {PASSWORD_REQUIREMENT_TEXT}
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            margin="normal"
            required
            fullWidth
            label="New password"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
