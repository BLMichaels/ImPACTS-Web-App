import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';
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

/** Lazy-loaded bundle for the Platform overview tab (reduces initial JS for Reports). */
export default function AdminPlatformOverviewCharts({ aggregated }: { aggregated: AggregatedLite }) {
  return (
    <Grid container spacing={2} sx={{ mb: 1 }}>
      <Grid item xs={12} md={6}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              People by role
            </Typography>
            <PlatformPeoplePieChart managers={aggregated.managers} mentors={aggregated.mentors} peccs={aggregated.peccs} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Sites &amp; network
            </Typography>
            <PlatformSitesBarChart
              sites={aggregated.sites}
              contacts={aggregated.contacts}
              activeAssignments={aggregated.activeAssignments}
              totalHospitals={aggregated.totalHospitals}
            />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
