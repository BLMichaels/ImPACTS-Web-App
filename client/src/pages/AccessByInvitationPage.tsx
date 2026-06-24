import React from 'react';
import { Box, Button, Container, Link, Typography } from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useNavigate } from 'react-router-dom';
import { IMPACTS_CONTACT_EMAIL } from '../config/appUrls';

/**
 * Public self-registration is disabled. New users must use an invitation link from a program administrator.
 */
const AccessByInvitationPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Typography component="h1" variant="h4" gutterBottom>
          Access by invitation
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The PECC Support Tool does not offer open self-registration. New accounts are created only through a
          secure invitation from an ImPACTS program administrator, mentor, or manager.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 2 }}>
          <VpnKeyIcon color="primary" sx={{ mt: 0.25 }} />
          <Typography variant="body1">
            If you received an invitation email, open the link in that message to complete your account setup.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 3 }}>
          <MailOutlineIcon color="primary" sx={{ mt: 0.25 }} />
          <Typography variant="body1">
            Need access? Contact your ImPACTS program administrator or email{' '}
            <Link href={`mailto:${IMPACTS_CONTACT_EMAIL}`}>{IMPACTS_CONTACT_EMAIL}</Link>.
          </Typography>
        </Box>

        <Button fullWidth variant="contained" onClick={() => navigate('/login')} sx={{ mb: 1.5 }}>
          Back to sign in
        </Button>
      </Box>
    </Container>
  );
};

export default AccessByInvitationPage;
