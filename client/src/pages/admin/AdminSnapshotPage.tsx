import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';

export default function AdminSnapshotPage() {
  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TimelineIcon fontSize="large" />
        Snapshot
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Admin snapshot view — aggregate readiness, activities, and site progress. To be built out.
      </Typography>
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Snapshot content will be added here (e.g. cross-site summaries, exports, dashboards).
        </Typography>
      </Paper>
    </Box>
  );
}
