import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  Divider,
  Button,
  LinearProgress,
  Chip,
  Alert,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  alpha,
} from '@mui/material';
import {
  Assignment as ActivityIcon,
  PictureAsPdf as PictureAsPdfIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format, subDays } from 'date-fns';
import { useManagerTeamDashboard, type ManagerTeamMentorRow } from '../../hooks/useManagerTeamDashboard';
import { exportManagerTeamSnapshotPdf } from '../../utils/managerTeamSnapshotPdf';
import { getUserDisplayName } from '../../utils/displayName';
import { getManagedHospitalScopeKeysForManager } from '../../utils/managerTeamScope';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';
import { SnapshotBarChart } from '../../components/pecc/SnapshotBarChart';
import { SnapshotHorizontalBarChart } from '../../components/pecc/SnapshotHorizontalBarChart';

type MentorSortKey = 'name' | 'sites' | 'peccs' | 'hoursMonth' | 'activitiesMonth' | 'lastActivity';

const ManagerOverviewPage: React.FC = () => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hospitalNotes, setHospitalNotes] = useState<Array<{ date: string; text: string }>>([]);
  const [hospitalNotesName, setHospitalNotesName] = useState<string | null>(null);
  const [hospitalNotesOutOfScope, setHospitalNotesOutOfScope] = useState(false);
  const [sortKey, setSortKey] = useState<MentorSortKey>('hoursMonth');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data, loading, error, retry } = useManagerTeamDashboard(userProfile?.id);
  const {
    mentors,
    peccs,
    totalPeccs,
    totalSites,
    avgPeccProgress,
    managerOwn,
    teamHoursThisMonth,
    teamActivitiesThisMonth,
    teamTotalHours,
  } = data;

  const peccAggregates = useMemo(
    () => ({
      activeLast30: peccs.filter((p) => p.activitiesLast30 > 0).length,
      activities: peccs.reduce((sum, p) => sum + p.activityCount, 0),
      hours: peccs.reduce((sum, p) => sum + p.activityHours, 0),
      gapPlans: peccs.reduce((sum, p) => sum + p.gapPlanCount, 0),
    }),
    [peccs]
  );

  const sortedPeccs = useMemo(
    () =>
      [...peccs].sort((a, b) => {
        const at = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
        const bt = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
        return bt - at || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }),
    [peccs]
  );

  const selectedHospitalId = searchParams.get('hospital');
  useEffect(() => {
    if (!selectedHospitalId || !userProfile?.id) {
      setHospitalNotes([]);
      setHospitalNotesName(null);
      setHospitalNotesOutOfScope(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const scopeKeys = await getManagedHospitalScopeKeysForManager(userProfile.id);
      if (cancelled) return;
      const { hospitalKeysMatch } = await import('../../utils/hospitalId');
      const inScope = scopeKeys.some((k) => hospitalKeysMatch(k, selectedHospitalId));
      if (!inScope) {
        setHospitalNotesOutOfScope(true);
        setHospitalNotes([]);
        setHospitalNotesName(null);
        return;
      }
      setHospitalNotesOutOfScope(false);
      const { data: row, error: fetchError } = await supabase
        .from('hospitals')
        .select('name, notes_log')
        .eq('id', selectedHospitalId)
        .maybeSingle();
      if (cancelled || fetchError) return;
      setHospitalNotesName((row as { name?: string } | null)?.name ?? null);
      const raw = (row as { notes_log?: unknown })?.notes_log;
      const log = Array.isArray(raw)
        ? raw
            .map((e: { date?: string; text?: string }) => ({ date: e.date ?? '', text: e.text ?? '' }))
            .filter((n) => n.date && n.text)
        : [];
      setHospitalNotes(log.sort((a, b) => b.date.localeCompare(a.date)));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedHospitalId, userProfile?.id]);

  const handleExportPdf = () => {
    const name = userProfile ? getUserDisplayName(userProfile) : 'Manager';
    exportManagerTeamSnapshotPdf(data, name);
  };

  const metrics = useMemo(() => {
    const activeThisMonth = mentors.filter((m) => m.hoursThisMonth > 0 || m.activitiesThisMonth > 0);
    const avgHours =
      mentors.length > 0 ? teamHoursThisMonth / mentors.length : 0;
    const avgSites =
      mentors.length > 0
        ? mentors.reduce((s, m) => s + m.assignedHospitals.length, 0) / mentors.length
        : 0;
    return {
      activeThisMonth: activeThisMonth.length,
      avgHoursPerMentor: avgHours,
      avgSitesPerMentor: avgSites,
    };
  }, [mentors, teamHoursThisMonth]);

  const hoursByMentorChart = useMemo(
    () =>
      [...mentors]
        .sort((a, b) => b.hoursThisMonth - a.hoursThisMonth)
        .slice(0, 12)
        .map((m) => ({
          label: `${m.firstName} ${m.lastName}`.trim() || m.email,
          value: Number(m.hoursThisMonth.toFixed(1)),
          sublabel: `${m.activitiesThisMonth} activities`,
        })),
    [mentors]
  );

  const sitesByMentorChart = useMemo(
    () =>
      [...mentors]
        .sort((a, b) => b.assignedHospitals.length - a.assignedHospitals.length)
        .slice(0, 12)
        .map((m) => ({
          label: `${m.firstName} ${m.lastName}`.trim() || m.email,
          value: m.assignedHospitals.length,
          sublabel: `${m.assignedHospitals.reduce((s, h) => s + h.peccCount, 0)} PECCs`,
        })),
    [mentors]
  );

  const sortedMentors = useMemo(() => {
    const rows = [...mentors];
    const dir = sortDir === 'asc' ? 1 : -1;
    const nameOf = (m: ManagerTeamMentorRow) =>
      `${m.lastName} ${m.firstName}`.trim().toLowerCase();
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * nameOf(a).localeCompare(nameOf(b));
        case 'sites':
          return dir * (a.assignedHospitals.length - b.assignedHospitals.length);
        case 'peccs': {
          const ap = a.assignedHospitals.reduce((s, h) => s + h.peccCount, 0);
          const bp = b.assignedHospitals.reduce((s, h) => s + h.peccCount, 0);
          return dir * (ap - bp);
        }
        case 'hoursMonth':
          return dir * (a.hoursThisMonth - b.hoursThisMonth);
        case 'activitiesMonth':
          return dir * (a.activitiesThisMonth - b.activitiesThisMonth);
        case 'lastActivity': {
          const at = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
          const bt = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
          return dir * (at - bt);
        }
        default:
          return 0;
      }
    });
    return rows;
  }, [mentors, sortKey, sortDir]);

  const toggleSort = (key: MentorSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const kpiItems = [
    {
      label: 'Mentors',
      value: String(mentors.length),
      caption: `${metrics.activeThisMonth} active this month`,
    },
    {
      label: 'Sites',
      value: String(totalSites),
      caption: `${metrics.avgSitesPerMentor.toFixed(1)} avg per mentor`,
    },
    {
      label: 'PECCs',
      value: String(totalPeccs),
      caption: `${avgPeccProgress}% avg checklist`,
    },
    {
      label: 'Hours (month)',
      value: `${teamHoursThisMonth.toFixed(1)}h`,
      caption: `${teamActivitiesThisMonth} activities`,
    },
    {
      label: 'Lifetime hours',
      value: `${teamTotalHours.toFixed(1)}h`,
      caption: `${metrics.avgHoursPerMentor.toFixed(1)}h avg / mentor this month`,
    },
  ];

  if (loading) {
    return (
      <AdminPageShell>
        <AdminHero overline="Manager" title="Snapshot" description="Loading your team metrics…" />
        <Paper elevation={0} sx={{ ...adminSectionShellSx, p: 3 }}>
          <LinearProgress />
        </Paper>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      {error && (
        <Alert severity="error" onClose={() => {}}>
          {error}
          <Button size="small" sx={{ ml: 1 }} onClick={retry}>
            Retry
          </Button>
        </Alert>
      )}

      <AdminHero
        overline="Team metrics"
        title="Snapshot"
        description="Live mentoring volume, site coverage, and PECC progress across mentors you manage — not the roster itself."
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" onClick={() => navigate('/manager/team?tab=roster')}>
              Manage mentors
            </Button>
            <Button variant="outlined" size="small" onClick={() => navigate('/manager/team?tab=reports')}>
              Reports
            </Button>
            <Button
              variant="contained"
              size="small"
              color="secondary"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleExportPdf}
            >
              Export PDF
            </Button>
          </Stack>
        }
      />

      <Alert severity="info" variant="outlined" sx={{ bgcolor: (t) => alpha(t.palette.secondary.main, 0.04) }}>
        Use <Button size="small" onClick={() => navigate('/manager/activities')}>Activities</Button> to log your
        management work or direct mentoring with a PECC at any site in your scope.
      </Alert>

      {selectedHospitalId && (
        <AdminSection
          overline="Site"
          title={`Notes: ${hospitalNotesOutOfScope ? 'Hospital' : (hospitalNotesName ?? 'Hospital')}`}
          description="Notes from mentors, managers, and admins on this site."
        >
          {hospitalNotesOutOfScope ? (
            <Alert severity="warning">
              This hospital is outside your managed scope. You can only view notes for sites assigned to mentors you
              supervise or otherwise in your manager hospital scope.
            </Alert>
          ) : hospitalNotes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No notes yet.
            </Typography>
          ) : (
            <List dense>
              {hospitalNotes.map((entry, i) => (
                <ListItem key={i} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch', py: 0.5 }}>
                  <Typography variant="caption" color="primary">
                    {entry.date}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {entry.text}
                  </Typography>
                  {i < hospitalNotes.length - 1 && <Divider sx={{ my: 1 }} />}
                </ListItem>
              ))}
            </List>
          )}
        </AdminSection>
      )}

      <Paper elevation={0} sx={adminSectionShellSx}>
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
          >
            At a glance
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Aggregated metrics for your mentoring network
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(5, minmax(0, 1fr))',
            },
            '& > *': {
              borderRight: { xs: 'none', sm: '1px solid' },
              borderBottom: { xs: '1px solid', md: 'none' },
              borderColor: 'divider',
            },
            '& > *:nth-of-type(2n)': { borderRight: { xs: 'none', sm: '1px solid' } },
            '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
          }}
        >
          {kpiItems.map((item) => (
            <Box key={item.label} sx={{ px: { xs: 1.75, md: 2 }, py: 1.75, textAlign: 'center' }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase', fontSize: '0.65rem' }}
              >
                {item.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.35rem',
                  letterSpacing: -0.02,
                  color: 'secondary.dark',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.15,
                  mt: 0.5,
                }}
              >
                {item.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                {item.caption}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {(managerOwn.hasAssignments || managerOwn.totalActivities > 0) && (
        <AdminSection
          overline="Your mentoring"
          title="My hours"
          description="Your direct mentor work (separate from the team rollup above)."
          actions={
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<ActivityIcon />}
              onClick={() => navigate('/manager/activities')}
            >
              My activities
            </Button>
          }
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${managerOwn.hoursThisMonth.toFixed(1)}h this month`} color="secondary" />
            <Chip size="small" label={`${managerOwn.lastMonthHours.toFixed(1)}h last month`} variant="outlined" />
            <Chip size="small" label={`${managerOwn.hoursTotal.toFixed(1)}h lifetime`} variant="outlined" />
            <Chip size="small" label={`${managerOwn.totalActivities} activities`} variant="outlined" />
          </Stack>
          {managerOwn.hospitalNames.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              Directly assigned sites: {managerOwn.hospitalNames.join(', ')}
            </Typography>
          )}
        </AdminSection>
      )}

      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid item xs={12} md={6}>
          <AdminSection
            overline="This month"
            title="Hours by mentor"
            description="Mentoring hours logged across your team"
          >
            <SnapshotBarChart
              data={hoursByMentorChart}
              valueLabel="Hours"
              height={320}
              emptyMessage="No mentoring hours logged this month yet."
            />
          </AdminSection>
        </Grid>
        <Grid item xs={12} md={6}>
          <AdminSection
            overline="Coverage"
            title="Sites by mentor"
            description="Assigned hospitals (with PECC counts)"
          >
            <SnapshotHorizontalBarChart
              data={sitesByMentorChart}
              valueLabel="Sites"
              emptyMessage="No hospital assignments on your mentors yet."
            />
          </AdminSection>
        </Grid>
      </Grid>

      <AdminSection
        overline="Checklist"
        title="PECC readiness progress"
        description="Average site checklist completion across PECCs at your mentors’ hospitals"
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '2rem',
              color: 'secondary.dark',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
            }}
          >
            {avgPeccProgress}%
          </Typography>
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, avgPeccProgress))}
              color="secondary"
              sx={{ height: 10, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              {totalPeccs} PECC{totalPeccs === 1 ? '' : 's'} across {totalSites} site{totalSites === 1 ? '' : 's'}
            </Typography>
          </Box>
        </Box>
      </AdminSection>

      <AdminSection
        overline="Mentor work"
        title="Mentor activity & attention"
        description="One sortable view of workload and recent activity. Quiet mentors are flagged in the table."
        actions={
          <Button size="small" variant="contained" color="secondary" onClick={() => navigate('/manager/team?tab=roster')}>
            Mentors
          </Button>
        }
        disableBodyPadding
      >
        {mentors.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
            <Typography variant="body1" color="text.secondary">
              No mentors found yet. Assign mentors under Team → Sites, or ask an admin to link you as a manager.
            </Typography>
            <Button variant="contained" color="secondary" sx={{ mt: 2 }} onClick={() => navigate('/manager/team?tab=sites')}>
              Go to Sites
            </Button>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortKey === 'name' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'name'}
                      direction={sortKey === 'name' ? sortDir : 'asc'}
                      onClick={() => toggleSort('name')}
                    >
                      Mentor
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={sortKey === 'sites' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'sites'}
                      direction={sortKey === 'sites' ? sortDir : 'desc'}
                      onClick={() => toggleSort('sites')}
                    >
                      Sites
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={sortKey === 'peccs' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'peccs'}
                      direction={sortKey === 'peccs' ? sortDir : 'desc'}
                      onClick={() => toggleSort('peccs')}
                    >
                      PECCs
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={sortKey === 'hoursMonth' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'hoursMonth'}
                      direction={sortKey === 'hoursMonth' ? sortDir : 'desc'}
                      onClick={() => toggleSort('hoursMonth')}
                    >
                      Hours (mo)
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={sortKey === 'activitiesMonth' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'activitiesMonth'}
                      direction={sortKey === 'activitiesMonth' ? sortDir : 'desc'}
                      onClick={() => toggleSort('activitiesMonth')}
                    >
                      Activities (mo)
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Lifetime h</TableCell>
                  <TableCell align="right" sortDirection={sortKey === 'lastActivity' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'lastActivity'}
                      direction={sortKey === 'lastActivity' ? sortDir : 'desc'}
                      onClick={() => toggleSort('lastActivity')}
                    >
                      Last activity
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedMentors.map((mentor) => {
                  const peccCount = mentor.assignedHospitals.reduce((s, h) => s + h.peccCount, 0);
                  const quiet =
                    !mentor.lastActivity || new Date(mentor.lastActivity) < subDays(new Date(), 30);
                  return (
                    <TableRow key={mentor.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {mentor.firstName} {mentor.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {mentor.email}
                        </Typography>
                        {quiet && (
                          <Chip size="small" label="Quiet 30d" color="warning" variant="outlined" sx={{ ml: 1, height: 20 }} />
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {mentor.assignedHospitals.length}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {peccCount}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {mentor.hoursThisMonth.toFixed(1)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {mentor.activitiesThisMonth}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {mentor.hoursTotal.toFixed(1)}
                      </TableCell>
                      <TableCell align="right">
                        {mentor.lastActivity
                          ? format(new Date(mentor.lastActivity), 'MMM d, yyyy')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </AdminSection>

      <AdminSection
        overline="PECC work"
        title="PECC activity & progress"
        description="Named PECCs in your hierarchy, including PECCs you mentor directly and PECCs in managed cohorts."
        actions={
          <Button size="small" variant="contained" color="secondary" onClick={() => navigate('/manager/team?tab=roster')}>
            Open roster
          </Button>
        }
        disableBodyPadding
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {[
            ['Active (30d)', `${peccAggregates.activeLast30}/${peccs.length}`],
            ['Activities', String(peccAggregates.activities)],
            ['Hours', `${peccAggregates.hours.toFixed(1)}h`],
            ['Gap plans', String(peccAggregates.gapPlans)],
          ].map(([label, value]) => (
            <Box key={label} sx={{ px: 2, py: 1.5, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={650}>
                {label}
              </Typography>
              <Typography variant="h6" color="secondary.dark" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
        {sortedPeccs.length === 0 ? (
          <Alert severity="info" sx={{ m: 2 }}>
            No PECCs are currently linked to your direct hierarchy or managed cohorts.
          </Alert>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="PECC work">
              <TableHead>
                <TableRow>
                  <TableCell>PECC</TableCell>
                  <TableCell>Site</TableCell>
                  <TableCell align="right">Checklist</TableCell>
                  <TableCell align="right">Activities (30d / total)</TableCell>
                  <TableCell align="right">Hours</TableCell>
                  <TableCell align="right">Gap plans</TableCell>
                  <TableCell align="right">Last activity</TableCell>
                  <TableCell align="right">Last login</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPeccs.map((pecc) => (
                  <TableRow key={pecc.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={650}>
                        {pecc.firstName} {pecc.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pecc.email}
                      </Typography>
                    </TableCell>
                    <TableCell>{pecc.hospitalName}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                        <Box sx={{ width: 64 }}>
                          <LinearProgress
                            variant="determinate"
                            value={pecc.checklistProgress}
                            color={pecc.checklistProgress >= 75 ? 'success' : 'secondary'}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                        <Typography variant="body2">{pecc.checklistProgress}%</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{pecc.activitiesLast30} / {pecc.activityCount}</TableCell>
                    <TableCell align="right">{pecc.activityHours.toFixed(1)}h</TableCell>
                    <TableCell align="right">{pecc.gapPlanCount}</TableCell>
                    <TableCell align="right">
                      {pecc.lastActivity ? format(new Date(pecc.lastActivity), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {pecc.lastLogin ? format(new Date(pecc.lastLogin), 'MMM d, yyyy') : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </AdminSection>
    </AdminPageShell>
  );
};

export default ManagerOverviewPage;
