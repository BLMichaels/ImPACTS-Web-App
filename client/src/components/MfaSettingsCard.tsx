import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Typography,
  alpha,
  useTheme,
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
  const theme = useTheme();
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
    <Box
      sx={{
        mt: 0.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: { xs: 1.75, md: 2 },
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.secondary.main, 0.04),
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <MfaIcon sx={{ color: 'secondary.dark', fontSize: 20 }} />
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, letterSpacing: -0.01 }}>
          Multi-factor authentication (MFA)
        </Typography>
        {loading ? null : (
          <Chip
            size="small"
            color={enrolled ? 'success' : 'warning'}
            label={enrolled ? 'Enabled' : 'Required — not set up'}
            sx={{ ml: { xs: 0, sm: 'auto' } }}
          />
        )}
      </Box>
      <Box sx={{ px: { xs: 1.75, md: 2 }, py: 1.75 }}>
        <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 1.5 }}>
          The PECC Support Tool requires MFA with a free authenticator app. If you have not set it up yet, follow the
          numbered steps below. Password reset on the login page is not affected.
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
              MFA is mandatory for all users. To remove or replace an authenticator, contact your ImPACTS program
              administrator.
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
      </Box>
    </Box>
  );
};

export default MfaSettingsCard;
