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
        description="Manage permissions and PECC tab visibility for mentors and PECCs you supervise. Admins and other roles are not listed and cannot be changed here."
        actions={
          <Button size="small" variant="outlined" onClick={() => navigate('/manager/team?tab=sites')}>
            Open Sites
          </Button>
        }
      />
      <Alert severity="info">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            User list is limited to mentors you supervise (primary/secondary) and PECCs at their sites or assigned
            directly to you. Cohort co-managers, admins, and other roles are excluded.
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
