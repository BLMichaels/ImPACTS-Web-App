import React from 'react';
import { Box, Typography } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';
import { useAuth } from '../../context/AuthContext';

export default function ManagerReportsPage() {
  const { currentUser } = useAuth();
  if (!currentUser?.id) return null;

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TimelineIcon fontSize="large" />
        Reports
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Export scoped data for your mentoring team — PECCs, PRS timelines, mentor hours, invitations, wages,
        and site milestones. Use CSV with de-identification for research submissions.
      </Typography>
      <StaffPeccReportBuilder scope="manager" actorUserId={currentUser.id} />
    </Box>
  );
}
