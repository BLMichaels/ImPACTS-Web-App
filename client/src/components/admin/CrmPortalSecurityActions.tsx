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
  Typography,
} from '@mui/material';
import {
  LockReset as LockResetIcon,
  PhonelinkLock as MfaIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { getPasswordResetRedirectUrl } from '../../utils/authFlow';
import { adminResetUserMfa } from '../../utils/adminResetUserMfa';

interface CrmPortalSecurityActionsProps {
  email?: string | null;
  portalUserId?: string | null;
  /** When false, hide actions (non-admin viewers). */
  canManage?: boolean;
}

const CrmPortalSecurityActions: React.FC<CrmPortalSecurityActionsProps> = ({
  email,
  portalUserId,
  canManage = false,
}) => {
  const { resetPasswordForEmail } = useAuth();
  const [loading, setLoading] = useState<'password' | 'mfa' | null>(null);
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [mfaConfirmOpen, setMfaConfirmOpen] = useState(false);

  const emailTrim = email?.trim() ?? '';
  const hasPortalHint = Boolean(portalUserId && !portalUserId.startsWith('pending:'));

  if (!canManage || !emailTrim) {
    return null;
  }

  const handlePasswordReset = async () => {
    setMessage(null);
    setLoading('password');
    try {
      await resetPasswordForEmail(emailTrim, getPasswordResetRedirectUrl());
      setMessage({
        severity: 'success',
        text: `If ${emailTrim} has a portal account, a password reset email was sent from no.reply@impactscollaborative.com. Ask them to check spam/junk.`,
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
          Send a password reset link or clear MFA so this person can sign in again. Login email:{' '}
          <strong>{emailTrim}</strong>
          {hasPortalHint ? (
            <>
              {' '}
              · Portal account linked
            </>
          ) : (
            <>
              {' '}
              · No portal account linked yet — reset email only works after the account is provisioned or they
              complete an invitation.
            </>
          )}
        </Typography>
        {message ? (
          <Alert severity={message.severity} sx={{ mb: 1.5 }} onClose={() => setMessage(null)}>
            {message.text}
          </Alert>
        ) : null}
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
    </>
  );
};

export default CrmPortalSecurityActions;
