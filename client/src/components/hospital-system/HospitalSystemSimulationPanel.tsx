import React, { useMemo } from 'react';
import {
  Alert,
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
import { AdminSection } from '../admin/AdminPageChrome';
import type { SimulationAggregate } from '../../utils/hospitalSystemAggregates';

interface Props {
  aggregate: SimulationAggregate | null;
  loading?: boolean;
  systemName: string;
}

const HospitalSystemSimulationPanel: React.FC<Props> = ({ aggregate, loading, systemName }) => {
  const caseChart = useMemo(() => {
    if (!aggregate) return [];
    return aggregate.caseRows.slice(0, 12).map((row) => ({
      label: row.caseName,
      value: row.totalRuns,
      sublabel: `${row.totalParticipants} participants`,
    }));
  }, [aggregate]);

  const siteSessionsChart = useMemo(() => {
    if (!aggregate) return [];
    return aggregate.siteRows.map((row) => ({
      label: row.hospitalName,
      value: row.sessions,
      sublabel: `${row.participants} participants`,
    }));
  }, [aggregate]);

  const simGapChart = useMemo(() => {
    if (!aggregate) return [];
    return aggregate.simGapStatus
      .filter((s) => s.count > 0)
      .map((s) => ({
        label: s.label,
        value: s.count,
        sublabel: `${s.sites} of ${aggregate.totalSites} sites`,
      }));
  }, [aggregate]);

  if (loading) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Loading simulation aggregates for {systemName}…
      </Alert>
    );
  }

  if (!aggregate || (aggregate.totalSessions === 0 && aggregate.totalSimGaps === 0)) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        No simulation sessions or simulation gaps found for hospitals in this system yet. Sites record cases and gaps
        on the Simulation Gaps page.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        {[
          { label: 'Sessions', value: String(aggregate.totalSessions), hint: 'Cases run across sites' },
          { label: 'Participants', value: String(aggregate.totalParticipants), hint: 'Total attendees recorded' },
          { label: 'Simulation gaps', value: String(aggregate.totalSimGaps), hint: 'From Simulation Gaps pages' },
          {
            label: 'Sites with sims',
            value: String(aggregate.siteRows.filter((s) => s.sessions > 0).length),
            hint: `Of ${aggregate.totalSites} sites`,
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
          <AdminSection title="Sessions by case" description="How often each simulation case has been run system-wide.">
            <SnapshotBarChart data={caseChart} valueLabel="Runs" height={300} />
          </AdminSection>
        </Grid>
        <Grid item xs={12} md={6}>
          <AdminSection title="Sessions by site" description="Simulation volume at each hospital in the system.">
            <SnapshotBarChart data={siteSessionsChart} valueLabel="Sessions" height={300} />
          </AdminSection>
        </Grid>
      </Grid>

      <AdminSection
        title="Simulation gaps by status"
        description={`Sites of ${aggregate.totalSites} that have gaps in each status.`}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <SnapshotBarChart data={simGapChart} valueLabel="Gaps" height={260} />
          </Grid>
          <Grid item xs={12} md={7}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Gaps
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      Sites
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aggregate.simGapStatus.map((row) => (
                    <TableRow key={row.status} hover>
                      <TableCell>{row.label}</TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                      <TableCell align="right">
                        {row.sites} / {aggregate.totalSites}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      </AdminSection>

      <AdminSection
        title="Case × site matrix"
        description="Runs and participants for each case at each site, plus system totals."
      >
        <TableContainer sx={{ maxHeight: 480, overflowX: 'auto' }}>
          <Table size="small" stickyHeader aria-label="Case by site matrix">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Case</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Total runs
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Total participants
                </TableCell>
                {aggregate.siteRows.map((site) => (
                  <TableCell key={site.hospitalId} align="right" sx={{ fontWeight: 700, minWidth: 100 }}>
                    {site.hospitalName}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {aggregate.caseRows.map((row) => {
                const byId = new Map(row.bySite.map((c) => [c.hospitalId, c]));
                return (
                  <TableRow key={row.caseKey} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {row.caseName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip size="small" label={row.totalRuns} />
                    </TableCell>
                    <TableCell align="right">{row.totalParticipants}</TableCell>
                    {aggregate.siteRows.map((site) => {
                      const cell = byId.get(site.hospitalId);
                      if (!cell) {
                        return (
                          <TableCell key={site.hospitalId} align="right" sx={{ color: 'text.disabled' }}>
                            —
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={site.hospitalId} align="right">
                          <Typography variant="body2">{cell.runs} runs</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cell.participants} participants
                          </Typography>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </AdminSection>

      <AdminSection title="Site simulation summary" description="Per-hospital session, participant, and open gap counts.">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Hospital</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Sessions
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Participants
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Open sim gaps
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aggregate.siteRows.map((row) => (
                <TableRow key={row.hospitalId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {row.hospitalName}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{row.sessions}</TableCell>
                  <TableCell align="right">{row.participants}</TableCell>
                  <TableCell align="right">{row.openSimGaps}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </AdminSection>
    </Stack>
  );
};

export default HospitalSystemSimulationPanel;
