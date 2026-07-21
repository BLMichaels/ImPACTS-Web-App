import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { PlatformPeoplePieChart, PlatformSitesBarChart } from './AdminReportCharts';

interface AggregatedLite {
  managers: number;
  mentors: number;
  peccs: number;
  sites: number;
  contacts: number;
  activeAssignments: number;
  totalHospitals: number;
}

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 1.75,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** Lazy-loaded bundle for the Platform overview tab (reduces initial JS for Reports). */
export default function AdminPlatformOverviewCharts({ aggregated }: { aggregated: AggregatedLite }) {
  return (
    <Grid container spacing={1.5} sx={{ mb: 1 }}>
      <Grid item xs={12} md={6}>
        <ChartShell title="People by role">
          <PlatformPeoplePieChart managers={aggregated.managers} mentors={aggregated.mentors} peccs={aggregated.peccs} />
        </ChartShell>
      </Grid>
      <Grid item xs={12} md={6}>
        <ChartShell title="Sites & network">
          <PlatformSitesBarChart
            sites={aggregated.sites}
            contacts={aggregated.contacts}
            activeAssignments={aggregated.activeAssignments}
            totalHospitals={aggregated.totalHospitals}
          />
        </ChartShell>
      </Grid>
    </Grid>
  );
}
