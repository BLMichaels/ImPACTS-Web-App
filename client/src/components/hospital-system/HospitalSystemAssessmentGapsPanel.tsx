import React, { useMemo } from 'react';
import {
  Alert,
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { SnapshotBarChart } from '../pecc/SnapshotBarChart';
import { SnapshotHorizontalBarChart } from '../pecc/SnapshotHorizontalBarChart';
import { AdminSection } from '../admin/AdminPageChrome';
import {
  GAP_STATUS_LABELS,
  type AssessmentGapsAggregate,
} from '../../utils/hospitalSystemAggregates';

interface Props {
  aggregate: AssessmentGapsAggregate | null;
  loading?: boolean;
  systemName: string;
}

const shortDomain = (domain: string) => {
  if (domain.length <= 42) return domain;
  return `${domain.slice(0, 40)}…`;
};

const HospitalSystemAssessmentGapsPanel: React.FC<Props> = ({ aggregate, loading, systemName }) => {
  const statusChart = useMemo(() => {
    if (!aggregate) return [];
    return GAP_STATUS_LABELS.map((label) => ({
      label,
      value: aggregate.statusPlanCounts[label] || 0,
      sublabel: `${aggregate.statusSiteCounts[label] || 0} of ${aggregate.totalSites} sites`,
    })).filter((d) => d.value > 0);
  }, [aggregate]);

  const statusSitesChart = useMemo(() => {
    if (!aggregate) return [];
    return GAP_STATUS_LABELS.map((label) => ({
      label,
      value: aggregate.statusSiteCounts[label] || 0,
      sublabel: `of ${aggregate.totalSites} sites`,
    })).filter((d) => d.value > 0);
  }, [aggregate]);

  if (loading) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Loading assessment gap aggregates for {systemName}…
      </Alert>
    );
  }

  if (!aggregate || aggregate.totalPlans === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        No assessment gap plans found across hospitals in this system yet. Gap plans are created on each site&apos;s
        Assessment Gaps page.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        {[
          { label: 'Gap plans', value: String(aggregate.totalPlans), hint: 'Across all sites' },
          {
            label: 'Closing activities',
            value: String(aggregate.totalClosingActivities),
            hint: 'Tagged to these gaps',
          },
          {
            label: 'Activity hours',
            value: String(aggregate.totalClosingHours),
            hint: 'Hours toward closing gaps',
          },
          {
            label: 'Sites with gaps',
            value: `${aggregate.sitesWithAnyGap} / ${aggregate.totalSites}`,
            hint: 'Sites that have at least one gap plan',
          },
        ].map((kpi) => (
          <Grid item xs={6} md={3} key={kpi.label}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                {kpi.label}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
                {kpi.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {kpi.hint}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <AdminSection title="Gap plans by status" description="Count of gap plans in each status across the system.">
            <SnapshotBarChart data={statusChart} valueLabel="Plans" height={280} />
          </AdminSection>
        </Grid>
        <Grid item xs={12} md={6}>
          <AdminSection
            title="Sites by status"
            description={`How many of ${aggregate.totalSites} sites have at least one gap in each status.`}
          >
            <SnapshotBarChart data={statusSitesChart} valueLabel="Sites" height={280} />
          </AdminSection>
        </Grid>
      </Grid>

      <AdminSection
        title="Status by pediatric readiness domain"
        description="How gap plans in each NPRP domain break down by status."
      >
        <TableContainer>
          <Table size="small" aria-label="Domain status breakdown">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                {GAP_STATUS_LABELS.map((s) => (
                  <TableCell key={s} align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {s}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Total
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aggregate.domainRows.map((row) => (
                <TableRow key={row.domain} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} title={row.domain}>
                      {shortDomain(row.domain)}
                    </Typography>
                  </TableCell>
                  {GAP_STATUS_LABELS.map((s) => (
                    <TableCell key={s} align="right">
                      {row.statusCounts[s] || 0}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Chip size="small" label={row.total} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ mt: 2 }}>
          <SnapshotHorizontalBarChart
            data={aggregate.domainRows
              .filter((r) => r.total > 0)
              .map((r) => ({ label: shortDomain(r.domain), value: r.total, sublabel: r.domain }))}
            valueLabel="Plans"
            minHeight={220}
          />
        </Box>
      </AdminSection>

      <AdminSection
        title="Gap inventory across sites"
        description="Each assessment gap, how many sites have it, status coverage (sites of total), and activities tagged toward closing it."
      >
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table size="small" stickyHeader aria-label="Gap inventory">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Gap</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Domain</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Sites with gap
                </TableCell>
                {GAP_STATUS_LABELS.map((s) => (
                  <TableCell key={s} align="right" sx={{ fontWeight: 700, maxWidth: 88 }}>
                    {s}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Activities
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Hours
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aggregate.gapInventory.map((row) => (
                <TableRow key={row.gapKey} hover>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {row.questionText}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 160 }}>
                    <Typography variant="caption" color="text.secondary" title={row.domain}>
                      {shortDomain(row.domain)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {row.sitesWithGap} / {row.totalSites}
                  </TableCell>
                  {GAP_STATUS_LABELS.map((s) => (
                    <TableCell key={s} align="right">
                      {(row.statusSiteCounts[s] || 0) > 0
                        ? `${row.statusSiteCounts[s]} / ${row.totalSites}`
                        : '—'}
                    </TableCell>
                  ))}
                  <TableCell align="right">{row.activityCount}</TableCell>
                  <TableCell align="right">{row.activityHours}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AdminSection>
    </Stack>
  );
};

export default HospitalSystemAssessmentGapsPanel;
