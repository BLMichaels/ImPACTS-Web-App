import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  LockReset as LockResetIcon,
  PhonelinkLock as MfaIcon,
  VpnKey as KeyIcon,
} from '@mui/icons-material';
import { adminResetUserMfa } from '../../utils/adminResetUserMfa';
import { adminSendPasswordReset, adminSetPortalPassword } from '../../utils/adminPortalAuth';

const MIN_PASSWORD_LENGTH = 12;

interface CrmPortalSecurityActionsProps {
  email?: string | null;
  portalUserId?: string | null;
  portalRole?: 'pecc' | 'manager' | 'mentor' | 'admin';
  firstName?: string;
  lastName?: string;
  /** When false, hide actions (non-admin viewers). */
  canManage?: boolean;
}

const CrmPortalSecurityActions: React.FC<CrmPortalSecurityActionsProps> = ({
  email,
  portalUserId,
  portalRole = 'pecc',
  firstName = '',
  lastName = '',
  canManage = false,
}) => {
  const [loading, setLoading] = useState<'password' | 'mfa' | 'setPassword' | null>(null);
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [mfaConfirmOpen, setMfaConfirmOpen] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetLinkOpen, setResetLinkOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const emailTrim = email?.trim() ?? '';
  const hasPortalHint = Boolean(portalUserId && !portalUserId.startsWith('pending:'));

  if (!canManage || !emailTrim) {
    return null;
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ severity: 'success', text: 'Link copied to clipboard.' });
    } catch {
      setMessage({ severity: 'info', text: 'Select the link below and copy it manually.' });
    }
  };

  const handlePasswordReset = async () => {
    setMessage(null);
    setLoading('password');
    try {
      const result = await adminSendPasswordReset(emailTrim);
      if ('error' in result) {
        setMessage({ severity: 'error', text: result.error });
        return;
      }
      setResetLink(result.action_link);
      setResetLinkOpen(true);
      setMessage({
        severity: result.email_sent ? 'success' : 'info',
        text: result.message,
      });
    } catch (err) {
      setMessage({
        severity: 'error',
        text: err instanceof Error ? err.message : 'Could not send password reset email.',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleSetPassword = async () => {
    const pwd = newPassword.trim();
    if (pwd.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        severity: 'error',
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }
    setMessage(null);
    setLoading('setPassword');
    try {
      const result = await adminSetPortalPassword({
        email: emailTrim,
        role: portalRole,
        password: pwd,
        first_name: firstName,
        last_name: lastName,
      });
      if ('error' in result) {
        setMessage({ severity: 'error', text: result.error });
        return;
      }
      setNewPassword('');
      setMessage({
        severity: 'success',
        text: result.verified
          ? `Login password set and verified for ${emailTrim}. They can sign in now with this password.`
          : `Login password set for ${emailTrim}.`,
      });
    } catch (err) {
      setMessage({
        severity: 'error',
        text: err instanceof Error ? err.message : 'Could not set portal password.',
      });
    } finally {
      setLoading(null);
    }
  };

  const handleMfaReset = async () => {
    setMfaConfirmOpen(false);
    setMessage(null);
    setLoading('mfa');
    try {
      const result = await adminResetUserMfa({
        user_id: hasPortalHint ? portalUserId! : undefined,
        email: emailTrim,
      });
      if ('error' in result) {
        setMessage({ severity: 'error', text: result.error });
        return;
      }
      if (result.had_factors === 0) {
        setMessage({
          severity: 'info',
          text: 'No MFA authenticators were enrolled on this account. They will set up MFA on first sign-in if required.',
        });
      } else {
        setMessage({
          severity: 'success',
          text: `Removed ${result.removed} authenticator${result.removed === 1 ? '' : 's'}. On next sign-in they must set up MFA again.`,
        });
      }
    } catch (err) {
      setMessage({
        severity: 'error',
        text: err instanceof Error ? err.message : 'Could not reset MFA.',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <MfaIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" fontWeight={700}>
            Portal security
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
          Set a login password, send a reset link (via Resend from no.reply@impactscollaborative.com), or clear
          MFA. Login email: <strong>{emailTrim}</strong>
          {hasPortalHint ? (
            <> · Portal account linked</>
          ) : (
            <> · No portal account linked yet — set a password below to create one.</>
          )}
        </Typography>
        {message ? (
          <Alert severity={message.severity} sx={{ mb: 1.5 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        ) : null}
        <Stack spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
            <TextField
              label="Set login password"
              type="password"
              size="small"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helperText={`At least ${MIN_PASSWORD_LENGTH} characters — creates account if needed`}
              sx={{ flex: 1, minWidth: 200 }}
            />
            <Button
              variant="contained"
              startIcon={<KeyIcon />}
              disabled={loading !== null || !newPassword.trim()}
              onClick={() => void handleSetPassword()}
              sx={{ whiteSpace: 'nowrap', mt: { xs: 0, sm: 0.5 } }}
            >
              {loading === 'setPassword' ? 'Saving…' : 'Set password'}
            </Button>
          </Stack>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            startIcon={<LockResetIcon />}
            disabled={loading !== null}
            onClick={() => void handlePasswordReset()}
          >
            {loading === 'password' ? 'Sending…' : 'Send password reset email'}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<MfaIcon />}
            disabled={loading !== null}
            onClick={() => setMfaConfirmOpen(true)}
          >
            {loading === 'mfa' ? 'Resetting…' : 'Reset MFA (authenticator)'}
          </Button>
        </Stack>
      </Paper>

      <Dialog open={mfaConfirmOpen} onClose={() => setMfaConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset MFA for this user?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This removes all authenticator apps enrolled for <strong>{emailTrim}</strong>. They will be prompted
            to set up MFA again on their next successful sign-in. Use this if they lost their phone or are stuck
            on the MFA screen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMfaConfirmOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={() => void handleMfaReset()} color="warning" variant="contained">
            Reset MFA
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={resetLinkOpen}
        onClose={() => setResetLinkOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Password reset link</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            If the user does not receive the email (or a spam filter opens the link and invalidates it), copy
            this link and send it to them directly. It works once — open on the device they will use to sign in.
          </Typography>
          {resetLink ? (
            <Box
              component="pre"
              sx={{
                p: 1.5,
                bgcolor: 'grey.100',
                borderRadius: 1,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                m: 0,
              }}
            >
              {resetLink}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetLinkOpen(false)} color="inherit">
            Close
          </Button>
          {resetLink ? (
            <Button
              startIcon={<CopyIcon />}
              variant="contained"
              onClick={() => void copyToClipboard(resetLink)}
            >
              Copy link
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CrmPortalSecurityActions;
