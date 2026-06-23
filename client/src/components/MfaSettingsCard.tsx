import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import { PhonelinkLock as MfaIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import {
  getVerifiedTotpFactors,
  hasVerifiedTotpEnrollment,
  listAllMfaFactors,
} from '../utils/mfa';
import MfaEnrollmentForm from './MfaEnrollmentForm';

const MfaSettingsCard: React.FC = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrolledFactors, setEnrolledFactors] = useState<{ id: string; label: string }[]>([]);
  const [showAddBackup, setShowAddBackup] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    setError('');
    try {
      const factors = await listAllMfaFactors();
      const verified = getVerifiedTotpFactors(factors);
      setEnrolled(verified.length > 0);
      setEnrolledFactors(
        verified.map((f) => ({
          id: f.id,
          label: f.friendly_name?.trim() || 'Authenticator app',
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load MFA status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [currentUser?.id]);

  const handleEnrolled = async () => {
    setShowAddBackup(false);
    await refresh();
    const ok = await hasVerifiedTotpEnrollment();
    setEnrolled(ok);
  };

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <MfaIcon color="primary" />
          <Typography variant="h6" component="h3">
            Multi-factor authentication (MFA)
          </Typography>
          {loading ? null : (
            <Chip
              size="small"
              color={enrolled ? 'success' : 'warning'}
              label={enrolled ? 'Enabled' : 'Required — not set up'}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          ImPACTS requires a free authenticator app (Google Authenticator, 1Password, Authy, or Apple
          Passwords). Password reset emails are not affected — you can still use Forgot password on the
          login page.
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading MFA status…
            </Typography>
          </Box>
        ) : enrolled ? (
          <>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Enrolled authenticator{enrolledFactors.length === 1 ? '' : 's'}:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
              {enrolledFactors.map((factor) => (
                <li key={factor.id}>
                  <Typography variant="body2">{factor.label}</Typography>
                </li>
              ))}
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              MFA is mandatory for all users. To remove or replace an authenticator, contact your
              ImPACTS administrator.
            </Alert>
            {!showAddBackup ? (
              <Button variant="outlined" onClick={() => setShowAddBackup(true)}>
                Add backup authenticator
              </Button>
            ) : (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Add a backup authenticator
                </Typography>
                <MfaEnrollmentForm
                  email={currentUser?.email}
                  userId={currentUser?.id}
                  onEnrolled={handleEnrolled}
                  onCancel={() => setShowAddBackup(false)}
                  cancelLabel="Cancel"
                />
              </>
            )}
          </>
        ) : (
          <MfaEnrollmentForm
            email={currentUser?.email}
            userId={currentUser?.id}
            onEnrolled={handleEnrolled}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default MfaSettingsCard;
