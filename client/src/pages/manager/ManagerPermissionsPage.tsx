import React from 'react';
import { Box, Typography, Container } from '@mui/material';
import GranularPermissionsManager from '../../components/admin/GranularPermissionsManager';

const ManagerPermissionsPage: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Team Permissions</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage permissions and tab visibility for your team members, cohorts, and programs.
      </Typography>
      <GranularPermissionsManager mode="manager" />
    </Container>
  );
};

export default ManagerPermissionsPage;
