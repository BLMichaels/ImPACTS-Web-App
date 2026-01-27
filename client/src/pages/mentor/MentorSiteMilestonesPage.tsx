import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import { Construction as ConstructionIcon } from '@mui/icons-material';

const MentorSiteMilestonesPage: React.FC = () => {
  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Site Milestones</Typography>
      
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <ConstructionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>Coming Soon</Typography>
        <Typography color="textSecondary">
          Track and manage milestones for each of your hospital sites.
        </Typography>
        
        <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
          <Typography variant="subtitle2" gutterBottom>Planned Features:</Typography>
          <ul style={{ margin: 0 }}>
            <li>Create and track site-specific milestones</li>
            <li>Set target dates and track completion</li>
            <li>Assign tasks to team members</li>
            <li>View milestone progress across all your hospitals</li>
            <li>Generate milestone reports</li>
          </ul>
        </Alert>
      </Paper>
    </Box>
  );
};

export default MentorSiteMilestonesPage;
