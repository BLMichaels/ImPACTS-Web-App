import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  TextField,
  SelectChangeEvent,
  Tabs,
  Tab,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  alpha,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PageviewIcon from '@mui/icons-material/Pageview';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import TimelineIcon from '@mui/icons-material/Timeline';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupIcon from '@mui/icons-material/Group';
import WorkIcon from '@mui/icons-material/Work';
import LinkIcon from '@mui/icons-material/Link';
import EventIcon from '@mui/icons-material/Event';
import MailIcon from '@mui/icons-material/Mail';
import SchoolIcon from '@mui/icons-material/School';
import FlagIcon from '@mui/icons-material/Flag';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import RefreshIcon from '@mui/icons-material/Refresh';
import { supabase } from '../../supabase';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const MENTOR_HOURS_PERIODS = [
  { value: 'month', label: 'This month' },
  { value: '3months', label: 'Last 3 months' },
];

const TABLE_LIMITS = [5, 10, 15, 25];

interface UsageEvent {
  id: string;
  user_id: string;
  role: string;
  event_type: string;
  path: string;
  metadata: {
    time_spent_seconds?: number;
    target?: string;
    url?: string;
    label?: string;
    link_context?: string;
    action?: string;
    checklist_id?: string;
    item_id?: string;
    activity_id?: string;
    name?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

interface AggregatedPlatformData {
  managers: number;
  mentors: number;
  peccs: number;
  sites: number;
  contacts: number;
  avgPeccProgress: number;
  mentorHoursThisMonth: number;
  mentorActivitiesThisMonth: number;
  mentorHoursLast3Months: number;
  mentorActivitiesLast3Months: number;
  // Additional metrics
  totalHospitals: number;
  activeAssignments: number;
  mentorsWithoutAssignments: number;
  programs: number;
  cohorts: number;
  invitationsPending: number;
  invitationsAcceptedThisMonth: number;
  siteMilestonesTotal: number;
  siteMilestonesCompleted: number;
  peccHoursThisMonth: number;
  peccActivitiesThisMonth: number;
}

export default function AdminSnapshotPage() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [periodValue, setPeriodValue] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [mentorHoursPeriod, setMentorHoursPeriod] = useState<string>('month');
  const [tableLimit, setTableLimit] = useState(10);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [aggregated, setAggregated] = useState<AggregatedPlatformData | null>(null);
  const [aggregatedLoading, setAggregatedLoading] = useState(true);
  const [aggregatedError, setAggregatedError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const runQuery = () => {
      let query = supabase
        .from('usage_events')
        .select('id, user_id, role, event_type, path, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(50000);

      if (periodValue === 'all') {
        // No date filter
      } else if (periodValue === 'custom' && customFrom && customTo) {
        const fromIso = new Date(customFrom + 'T00:00:00.000Z').toISOString();
        const toEnd = new Date(customTo + 'T23:59:59.999Z').toISOString();
        query = query.gte('created_at', fromIso).lte('created_at', toEnd);
      } else if (['7', '30', '90'].includes(periodValue)) {
        const days = parseInt(periodValue, 10);
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte('created_at', since.toISOString());
      } else {
        // custom but missing dates – don't fetch
        setLoading(false);
        setEvents([]);
        return;
      }

      query.then(({ data, error: err }) => {
        if (!mounted) return;
        if (err) {
          setError(err.message);
          setEvents([]);
        } else {
          setEvents((data as UsageEvent[]) || []);
        }
        setLoading(false);
      });
    };

    runQuery();
    return () => { mounted = false; };
  }, [periodValue, customFrom, customTo, retryCount]);

  // Load aggregated platform data (managers, mentors, PECCs, sites, contacts, progress)
  useEffect(() => {
    let mounted = true;
    setAggregatedLoading(true);
    setAggregatedError(null);
    (async () => {
      try {
        const [
          managersRes,
          mentorsRes,
          peccsRes,
          assignmentsRes,
          contactsRes,
          hospitalsRes,
          programsRes,
          cohortsRes,
          invitationsRes,
          milestonesRes,
          peccActivitiesRes
        ] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'manager').eq('is_active', true),
          supabase.from('users').select('id').eq('role', 'mentor').eq('is_active', true),
          supabase.from('users').select('id, hospital_facility_id').eq('role', 'pecc').eq('is_active', true),
          supabase.from('mentor_hospital_assignments').select('hospital_id, mentor_id').eq('is_active', true),
          supabase.from('hospital_contacts').select('id', { count: 'exact', head: true }),
          supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('programs').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('cohorts').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('invitations').select('id, status, accepted_at').in('status', ['pending', 'accepted']),
          supabase.from('site_milestones').select('id, status'),
          supabase.from('pecc_activities').select('hours, date').gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10))
        ]);
        if (!mounted) return;
        const managers = managersRes.count ?? 0;
        const mentors = (mentorsRes.data || []).length;
        const peccs = (peccsRes.data || []).length;
        const contacts = contactsRes.count ?? 0;
        const assignmentsData = (assignmentsRes.data || []) as { hospital_id: string; mentor_id: string }[];
        const hospitalIds = [...new Set(assignmentsData.map((a) => a.hospital_id).filter(Boolean))];
        const sites = hospitalIds.length;
        const totalHospitals = hospitalsRes.count ?? 0;
        const activeAssignments = assignmentsData.length;
        const assignedMentorIds = new Set(assignmentsData.map((a) => a.mentor_id));
        const mentorsWithoutAssignments = mentors - assignedMentorIds.size;
        const programs = programsRes.count ?? 0;
        const cohorts = cohortsRes.count ?? 0;
        const invitationsData = (invitationsRes.data || []) as { status: string; accepted_at: string | null }[];
        const invitationsPending = invitationsData.filter((i) => i.status === 'pending').length;
        const invMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const invitationsAcceptedThisMonth = invitationsData.filter(
          (i) => i.status === 'accepted' && i.accepted_at && i.accepted_at >= invMonthStart
        ).length;
        const milestonesData = (milestonesRes.data || []) as { status: string }[];
        const siteMilestonesTotal = milestonesData.length;
        const siteMilestonesCompleted = milestonesData.filter((m) => m.status === 'completed').length;
        const peccActivitiesData = (peccActivitiesRes.data || []) as { hours: number; date: string }[];
        const peccHoursThisMonth = peccActivitiesData.reduce((s, a) => s + (a.hours || 0), 0);
        const peccActivitiesThisMonth = peccActivitiesData.length;
        const peccList = (peccsRes.data || []) as { id: string; hospital_facility_id: string }[];
        let progressSum = 0;
        let progressCount = 0;
        for (const p of peccList) {
          if (!p.hospital_facility_id) continue;
          const { data: checklistData } = await supabase
            .from('site_checklist_progress')
            .select('completed')
            .eq('hospital_id', p.hospital_facility_id);
          const completed = (checklistData || []).filter((t: { completed: boolean }) => t.completed).length;
          const totalTasks = 100;
          const pct = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
          progressSum += pct;
          progressCount += 1;
        }
        const avgPeccProgress = progressCount > 0 ? Math.round(progressSum / progressCount) : 0;
        const mentorIds = ((mentorsRes.data || []) as { id: string }[]).map((m) => m.id);
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        let mentorHoursThisMonth = 0;
        let mentorActivitiesThisMonth = 0;
        let mentorHoursLast3Months = 0;
        let mentorActivitiesLast3Months = 0;
        for (const mid of mentorIds) {
          const acts = await getMentorActivitiesForUser(mid);
          const thisMonth = acts.filter((a: { date: string }) => new Date(a.date) >= monthStart);
          const last3Months = acts.filter((a: { date: string }) => new Date(a.date) >= threeMonthsAgo);
          mentorActivitiesThisMonth += thisMonth.length;
          mentorHoursThisMonth += thisMonth.reduce((s: number, a: { hours?: number }) => s + (a.hours || 0), 0);
          mentorActivitiesLast3Months += last3Months.length;
          mentorHoursLast3Months += last3Months.reduce((s: number, a: { hours?: number }) => s + (a.hours || 0), 0);
        }
        if (!mounted) return;
        setAggregated({
          managers,
          mentors,
          peccs,
          sites,
          contacts,
          avgPeccProgress,
          mentorHoursThisMonth,
          mentorActivitiesThisMonth,
          mentorHoursLast3Months,
          mentorActivitiesLast3Months,
          totalHospitals,
          activeAssignments,
          mentorsWithoutAssignments,
          programs,
          cohorts,
          invitationsPending,
          invitationsAcceptedThisMonth,
          siteMilestonesTotal,
          siteMilestonesCompleted,
          peccHoursThisMonth,
          peccActivitiesThisMonth
        });
      } catch (e: unknown) {
        if (!mounted) return;
        setAggregatedError(e instanceof Error ? e.message : 'Failed to load platform data');
      } finally {
        if (mounted) setAggregatedLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [retryCount]);

  const metrics = useMemo(() => {
    const logins = events.filter((e) => e.event_type === 'login');
    const pageViews = events.filter((e) => e.event_type === 'page_view');
    const clicks = events.filter((e) => e.event_type === 'click');
    const linkClicks = events.filter((e) => e.event_type === 'link_click');
    const checklistEvents = events.filter((e) => e.event_type === 'checklist');
    const activityEvents = events.filter((e) => e.event_type === 'activity');

    const uniqueLoginsByRole: Record<string, Set<string>> = {};
    logins.forEach((e) => {
      if (!uniqueLoginsByRole[e.role]) uniqueLoginsByRole[e.role] = new Set();
      uniqueLoginsByRole[e.role].add(e.user_id);
    });

    const pageCountByPath: Record<string, number> = {};
    const pageCountByPathAndRole: Record<string, Record<string, number>> = {};
    pageViews.forEach((e) => {
      const path = e.path || '/';
      pageCountByPath[path] = (pageCountByPath[path] || 0) + 1;
      if (!pageCountByPathAndRole[path]) pageCountByPathAndRole[path] = {};
      pageCountByPathAndRole[path][e.role] = (pageCountByPathAndRole[path][e.role] || 0) + 1;
    });

    const timeByPath: Record<string, { total: number; count: number }> = {};
    pageViews.forEach((e) => {
      const sec = e.metadata?.time_spent_seconds;
      if (sec == null || sec < 0) return;
      const path = e.path || '/';
      if (!timeByPath[path]) timeByPath[path] = { total: 0, count: 0 };
      timeByPath[path].total += sec;
      timeByPath[path].count += 1;
    });

    const clickCountByTarget: Record<string, number> = {};
    const clickCountByRole: Record<string, number> = {};
    clicks.forEach((e) => {
      const target = (e.metadata?.target as string) || 'unknown';
      clickCountByTarget[target] = (clickCountByTarget[target] || 0) + 1;
      clickCountByRole[e.role] = (clickCountByRole[e.role] || 0) + 1;
    });

    const linkClickCountByLabel: Record<string, number> = {};
    linkClicks.forEach((e) => {
      const key = (e.metadata?.label as string) || (e.metadata?.url as string) || e.path || 'unknown';
      linkClickCountByLabel[key] = (linkClickCountByLabel[key] || 0) + 1;
    });

    const checklistCountByAction: Record<string, number> = {};
    checklistEvents.forEach((e) => {
      const action = (e.metadata?.action as string) || 'unknown';
      checklistCountByAction[action] = (checklistCountByAction[action] || 0) + 1;
    });

    const activityCountByAction: Record<string, number> = {};
    activityEvents.forEach((e) => {
      const action = (e.metadata?.action as string) || 'unknown';
      activityCountByAction[action] = (activityCountByAction[action] || 0) + 1;
    });

    const limit = tableLimit;
    const mostUsedPages = Object.entries(pageCountByPath)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const avgTimeByPath = Object.entries(timeByPath)
      .map(([path, { total, count }]) => ({ path, avgSeconds: total / count, viewsWithTime: count }))
      .filter((x) => x.avgSeconds >= 1)
      .sort((a, b) => b.avgSeconds - a.avgSeconds)
      .slice(0, limit);

    const topClicks = Object.entries(clickCountByTarget)
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topLinkClicks = Object.entries(linkClickCountByLabel)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topChecklistActions = Object.entries(checklistCountByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topActivityActions = Object.entries(activityCountByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      totalLogins: logins.length,
      uniqueLoginsByRole,
      mostUsedPages,
      avgTimeByPath,
      topClicks,
      totalPageViews: pageViews.length,
      totalClicks: clicks.length,
      clickCountByRole,
      totalLinkClicks: linkClicks.length,
      topLinkClicks,
      totalChecklistEvents: checklistEvents.length,
      topChecklistActions,
      totalActivityEvents: activityEvents.length,
      topActivityActions,
    };
  }, [events, tableLimit]);

  const pathLabel = (path: string) => {
    if (path === '/') return 'Home';
    const p = path.replace(/^\//, '');
    const rolePrefix = ['admin', 'mentor', 'manager'].find((r) => p.startsWith(r + '/'));
    if (rolePrefix) return p.replace(rolePrefix + '/', '').replace(/-/g, ' ') || rolePrefix;
    return p.replace(/-/g, ' ') || path;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  };

  const mentorHours = mentorHoursPeriod === '3months' ? aggregated?.mentorHoursLast3Months ?? 0 : aggregated?.mentorHoursThisMonth ?? 0;
  const mentorActivities = mentorHoursPeriod === '3months' ? aggregated?.mentorActivitiesLast3Months ?? 0 : aggregated?.mentorActivitiesThisMonth ?? 0;

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon fontSize="large" />
            Snapshot
          </Typography>
          <Typography color="text.secondary">
            Platform overview, usage analytics, and cross-tier metrics.
          </Typography>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v: number) => setActiveTab(v as 0 | 1)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab icon={<DashboardIcon />} iconPosition="start" label="Platform overview" />
        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Usage analytics" />
      </Tabs>

      {activeTab === 0 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={600}>Platform overview</Typography>
                <Typography variant="body2" color="text.secondary">
                  Aggregated counts from managers, mentors, and PECC tiers.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Mentor hours</InputLabel>
                  <Select
                    value={mentorHoursPeriod}
                    label="Mentor hours"
                    onChange={(e: SelectChangeEvent) => setMentorHoursPeriod(e.target.value)}
                  >
                    {MENTOR_HOURS_PERIODS.map((p) => (
                      <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => setRetryCount((c) => c + 1)}
                  disabled={aggregatedLoading}
                >
                  Refresh
                </Button>
              </Stack>
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            {aggregatedError && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setAggregatedError(null); setRetryCount((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {aggregatedError}
              </Alert>
            )}
            {aggregatedLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading platform metrics...</Typography>
              </Box>
            ) : aggregated ? (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  People by tier
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <PeopleIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Managers</Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{aggregated.managers}</Typography>
                        <Typography variant="caption" color="text.secondary">Active platform-wide</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <AssignmentIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Mentors</Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{aggregated.mentors}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aggregated.managers > 0 ? `~${(aggregated.mentors / aggregated.managers).toFixed(0)} per manager` : 'Active platform-wide'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <GroupIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>PECCs</Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{aggregated.peccs}</Typography>
                        <Typography variant="caption" color="text.secondary">At assigned sites</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Sites & contacts
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <LocalHospitalIcon color="info" />
                          <Typography variant="subtitle1" fontWeight={600}>Sites (assigned)</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.sites}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          of {aggregated.totalHospitals} total hospitals
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'secondary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <PeopleIcon color="secondary" />
                          <Typography variant="subtitle1" fontWeight={600}>Contacts</Typography>
                        </Box>
                        <Typography variant="h4" color="secondary.main">{aggregated.contacts}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aggregated.sites > 0 ? `~${(aggregated.contacts / aggregated.sites).toFixed(0)} per site` : 'Hospital CRM'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <AssignmentIcon color="info" fontSize="small" />
                          <Typography variant="subtitle1" fontWeight={600}>Active assignments</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.activeAssignments}</Typography>
                        <Typography variant="caption" color="text.secondary">Mentor–site links</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: aggregated.mentorsWithoutAssignments > 0 ? 'warning.main' : 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          {aggregated.mentorsWithoutAssignments > 0 ? <WarningAmberIcon color="warning" /> : <PeopleIcon color="success" />}
                          <Typography variant="subtitle1" fontWeight={600}>Mentors unassigned</Typography>
                        </Box>
                        <Typography variant="h4" color={aggregated.mentorsWithoutAssignments > 0 ? 'warning.main' : 'success.main'}>{aggregated.mentorsWithoutAssignments}</Typography>
                        <Typography variant="caption" color="text.secondary">No site assignments</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Programs & cohorts
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <SchoolIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Programs</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">{aggregated.programs}</Typography>
                        <Typography variant="caption" color="text.secondary">Active programs</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <GroupIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Cohorts</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">{aggregated.cohorts}</Typography>
                        <Typography variant="caption" color="text.secondary">Active cohorts</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <MailIcon color="info" />
                          <Typography variant="subtitle1" fontWeight={600}>Invitations pending</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.invitationsPending}</Typography>
                        <Typography variant="caption" color="text.secondary">Awaiting acceptance</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <EventIcon color="success" />
                          <Typography variant="subtitle1" fontWeight={600}>Accepted this month</Typography>
                        </Box>
                        <Typography variant="h4" color="success.main">{aggregated.invitationsAcceptedThisMonth}</Typography>
                        <Typography variant="caption" color="text.secondary">New users joined</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Milestones & PECC activities
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <FlagIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Site milestones</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">{aggregated.siteMilestonesCompleted}</Typography>
                        <Typography variant="caption" color="text.secondary">of {aggregated.siteMilestonesTotal} completed</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'secondary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <WorkIcon color="secondary" />
                          <Typography variant="subtitle1" fontWeight={600}>PECC hours (this month)</Typography>
                        </Box>
                        <Typography variant="h4" color="secondary.main">{aggregated.peccHoursThisMonth.toFixed(1)}h</Typography>
                        <Typography variant="caption" color="text.secondary">{aggregated.peccActivitiesThisMonth} activities</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Engagement
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <TimelineIcon color="success" />
                          <Typography variant="subtitle1" fontWeight={600}>PECC checklist progress</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                          <Typography variant="h4" color="success.main">{aggregated.avgPeccProgress}%</Typography>
                          <Typography variant="body2" color="text.secondary">avg completion</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(aggregated.avgPeccProgress, 100)}
                          sx={{ height: 8, borderRadius: 1, bgcolor: (t) => alpha(t.palette.success.main, 0.2) }}
                          color="success"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <WorkIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>
                            Mentor hours ({mentorHoursPeriod === '3months' ? 'last 3 months' : 'this month'})
                          </Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{mentorHours.toFixed(1)}h</Typography>
                        <Typography variant="caption" color="text.secondary">{mentorActivities} activities logged</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </>
            ) : null}
          </Box>
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Period</InputLabel>
                <Select
                  value={periodValue}
                  label="Period"
                  onChange={(e: SelectChangeEvent) => setPeriodValue(e.target.value)}
                >
                  {PERIODS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {periodValue === 'custom' && (
                <>
                  <TextField
                    size="small"
                    label="From"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    label="To"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                </>
              )}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Table rows</InputLabel>
                <Select
                  value={String(tableLimit)}
                  label="Table rows"
                  onChange={(e: SelectChangeEvent) => setTableLimit(Number(e.target.value))}
                >
                  {TABLE_LIMITS.map((n) => (
                    <MenuItem key={n} value={String(n)}>Top {n}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setRetryCount((c) => c + 1)}
                disabled={loading}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          <Box sx={{ p: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {error}
              </Alert>
            )}
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading usage analytics...</Typography>
              </Box>
            ) : (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PeopleIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Logins</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalLogins}</Typography>
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {Object.entries(metrics.uniqueLoginsByRole).map(([role, set]) => (
                            <Chip key={role} label={`${role}: ${set.size}`} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PageviewIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Page views</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalPageViews}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <TouchAppIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Clicks</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalClicks}</Typography>
                        {Object.keys(metrics.clickCountByRole).length > 0 && (
                          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(metrics.clickCountByRole).map(([role, count]) => (
                              <Chip key={role} label={`${role}: ${count}`} size="small" variant="outlined" />
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <LinkIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Link clicks</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalLinkClicks}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Accordion defaultExpanded disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600}>Pages & engagement</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Most used pages</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Page</TableCell>
                                <TableCell align="right">Views</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.mostUsedPages.length === 0 ? (
                                <TableRow><TableCell colSpan={2}>No page views in period</TableCell></TableRow>
                              ) : (
                                metrics.mostUsedPages.map(({ path, count }) => (
                                  <TableRow key={path}>
                                    <TableCell>{pathLabel(path)}</TableCell>
                                    <TableCell align="right">{count}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Avg time on page</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Page</TableCell>
                                <TableCell align="right">Avg time</TableCell>
                                <TableCell align="right">Samples</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.avgTimeByPath.length === 0 ? (
                                <TableRow><TableCell colSpan={3}>No duration data</TableCell></TableRow>
                              ) : (
                                metrics.avgTimeByPath.map(({ path, avgSeconds, viewsWithTime }) => (
                                  <TableRow key={path}>
                                    <TableCell>{pathLabel(path)}</TableCell>
                                    <TableCell align="right">{formatDuration(avgSeconds)}</TableCell>
                                    <TableCell align="right">{viewsWithTime}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion defaultExpanded disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600}>Clickthroughs & actions</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Top clickthroughs</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Action / target</TableCell>
                                <TableCell align="right">Clicks</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.topClicks.length === 0 ? (
                                <TableRow><TableCell colSpan={2}>No click events</TableCell></TableRow>
                              ) : (
                                metrics.topClicks.map(({ target, count }) => (
                                  <TableRow key={target}>
                                    <TableCell>{target}</TableCell>
                                    <TableCell align="right">{count}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Link clicks</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Link / label</TableCell>
                                <TableCell align="right">Clicks</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.topLinkClicks.length === 0 ? (
                                <TableRow><TableCell colSpan={2}>No link clicks</TableCell></TableRow>
                              ) : (
                                metrics.topLinkClicks.map(({ label, count }) => (
                                  <TableRow key={label}>
                                    <TableCell>{label}</TableCell>
                                    <TableCell align="right">{count}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Checklist actions</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Action</TableCell>
                                <TableCell align="right">Count</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.topChecklistActions.length === 0 ? (
                                <TableRow><TableCell colSpan={2}>No checklist events</TableCell></TableRow>
                              ) : (
                                metrics.topChecklistActions.map(({ action, count }) => (
                                  <TableRow key={action}>
                                    <TableCell>{action}</TableCell>
                                    <TableCell align="right">{count}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Activity actions</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Action</TableCell>
                                <TableCell align="right">Count</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {metrics.topActivityActions.length === 0 ? (
                                <TableRow><TableCell colSpan={2}>No activity events</TableCell></TableRow>
                              ) : (
                                metrics.topActivityActions.map(({ action, count }) => (
                                  <TableRow key={action}>
                                    <TableCell>{action}</TableCell>
                                    <TableCell align="right">{count}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
