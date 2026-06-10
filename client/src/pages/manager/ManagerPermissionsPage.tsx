import React from 'react';
import { Typography, Container, Alert, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import GranularPermissionsManager from '../../components/admin/GranularPermissionsManager';

const ManagerPermissionsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Team Permissions
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Manage permissions and PECC tab visibility for mentors and PECCs on your team. Changes apply to what each
        user can see in their navbar and dashboards.
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Includes mentors you manage (primary and secondary assignments) and PECCs at your team&apos;s hospitals.
          </Typography>
          <Button size="small" onClick={() => navigate('/manager/crm')}>
            Open CRM
          </Button>
        </Stack>
      </Alert>
      <GranularPermissionsManager mode="manager" />
    </Container>
  );
};

export default ManagerPermissionsPage;
