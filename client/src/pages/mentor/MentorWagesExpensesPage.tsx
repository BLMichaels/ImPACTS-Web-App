import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert
} from '@mui/material';
import { Construction as ConstructionIcon } from '@mui/icons-material';

const MentorWagesExpensesPage: React.FC = () => {
  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Wages & Expenses</Typography>
      
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <ConstructionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>Coming Soon</Typography>
        <Typography color="textSecondary">
          Track your wages and submit expenses for reimbursement.
        </Typography>
        
        <Alert severity="info" sx={{ mt: 3, textAlign: 'left' }}>
          <Typography variant="subtitle2" gutterBottom>Planned Features:</Typography>
          <ul style={{ margin: 0 }}>
            <li>View your hourly rate and stipend information</li>
            <li>Track hours worked per pay period</li>
            <li>Submit expenses with receipt uploads</li>
            <li>View expense approval status</li>
            <li>Export wage reports for your records</li>
          </ul>
        </Alert>
      </Paper>
    </Box>
  );
};

export default MentorWagesExpensesPage;
