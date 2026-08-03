import React from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import GranularPermissionsManager from '../../components/admin/GranularPermissionsManager';
import { AdminPageShell, AdminHero, AdminSection } from '../../components/admin/AdminPageChrome';

const ManagerPermissionsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AdminPageShell>
      <AdminHero
        overline="Manager"
        title="Team Permissions"
        description="Manage permissions and PECC tab visibility for mentors and PECCs on your team. Changes apply to what each user can see in their navbar and dashboards."
        actions={
          <Button size="small" variant="outlined" onClick={() => navigate('/manager/team?tab=sites')}>
            Open CRM
          </Button>
        }
      />
      <Alert severity="info">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Includes mentors you manage (primary and secondary assignments), people in cohorts you manage, and PECCs at
            your team&apos;s hospitals.
          </Typography>
        </Stack>
      </Alert>
      <AdminSection overline="Access" title="Granular permissions" disableBodyPadding>
        <GranularPermissionsManager mode="manager" />
      </AdminSection>
    </AdminPageShell>
  );
};

export default ManagerPermissionsPage;
