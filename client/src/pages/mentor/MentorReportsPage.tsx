import React from 'react';
import { Box, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';
import { useAuth } from '../../context/AuthContext';

export default function MentorReportsPage() {
  const { currentUser } = useAuth();
  if (!currentUser?.id) return null;

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TimelineIcon fontSize="large" />
        Reports
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Export data for your assigned sites — PECC progress, PRS over time, activities, gap plans, simulations,
        and your logged mentor hours.
      </Typography>
      <StaffPeccReportBuilder scope="mentor" actorUserId={currentUser.id} />
    </Box>
  );
}
