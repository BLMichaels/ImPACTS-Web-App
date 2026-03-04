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
import { supabase } from '../../supabase';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

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
}

export default function AdminSnapshotPage() {
  const [periodValue, setPeriodValue] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
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
        const [managersRes, mentorsRes, peccsRes, assignmentsRes, contactsRes] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'manager').eq('is_active', true),
          supabase.from('users').select('id').eq('role', 'mentor').eq('is_active', true),
          supabase.from('users').select('id, hospital_facility_id').eq('role', 'pecc').eq('is_active', true),
          supabase.from('mentor_hospital_assignments').select('hospital_id').eq('is_active', true),
          supabase.from('hospital_contacts').select('id', { count: 'exact', head: true })
        ]);
        if (!mounted) return;
        const managers = managersRes.count ?? 0;
        const mentors = (mentorsRes.data || []).length;
        const peccs = (peccsRes.data || []).length;
        const contacts = contactsRes.count ?? 0;
        const hospitalIds = [...new Set((assignmentsRes.data || []).map((a: { hospital_id: string }) => a.hospital_id).filter(Boolean))];
        const sites = hospitalIds.length;
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
        let mentorHoursThisMonth = 0;
        let mentorActivitiesThisMonth = 0;
        for (const mid of mentorIds) {
          const acts = await getMentorActivitiesForUser(mid);
          const thisMonth = acts.filter((a: { date: string }) => new Date(a.date) >= monthStart);
          mentorActivitiesThisMonth += thisMonth.length;
          mentorHoursThisMonth += thisMonth.reduce((s: number, a: { hours?: number }) => s + (a.hours || 0), 0);
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
          mentorActivitiesThisMonth
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

    const mostUsedPages = Object.entries(pageCountByPath)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const avgTimeByPath = Object.entries(timeByPath)
      .map(([path, { total, count }]) => ({ path, avgSeconds: total / count, viewsWithTime: count }))
      .filter((x) => x.avgSeconds >= 1)
      .sort((a, b) => b.avgSeconds - a.avgSeconds)
      .slice(0, 15);

    const topClicks = Object.entries(clickCountByTarget)
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const topLinkClicks = Object.entries(linkClickCountByLabel)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const topChecklistActions = Object.entries(checklistCountByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topActivityActions = Object.entries(activityCountByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

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
  }, [events]);

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

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TimelineIcon fontSize="large" />
        Snapshot
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Aggregate readiness, activities, site progress, and usage metrics to evaluate designs and materials.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Usage analytics
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
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
                sx={{ width: 160 }}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
            </>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={
            <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount(c => c + 1); }}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">Loading usage analytics...</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Logins */}
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PeopleIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>Logins</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{metrics.totalLogins}</Typography>
                  <Typography variant="body2" color="text.secondary">total in period</Typography>
                  <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.entries(metrics.uniqueLoginsByRole).map(([role, set]) => (
                      <Chip key={role} label={`${role}: ${set.size}`} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PageviewIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>Page views</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{metrics.totalPageViews}</Typography>
                  <Typography variant="body2" color="text.secondary">in period</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ScheduleIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>Time on page</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">Avg by page below</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TouchAppIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={600}>Clicks</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{metrics.totalClicks}</Typography>
                  <Typography variant="body2" color="text.secondary">tracked in period</Typography>
                  {Object.keys(metrics.clickCountByRole).length > 0 && (
                    <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {Object.entries(metrics.clickCountByRole).map(([role, count]) => (
                        <Chip key={role} label={`${role}: ${count}`} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Most used pages */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Most used pages</Typography>
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
                          <TableRow><TableCell colSpan={2} color="text.secondary">No page views in period</TableCell></TableRow>
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
                </CardContent>
              </Card>
            </Grid>

            {/* Avg time on page */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Avg time on page</Typography>
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
                          <TableRow><TableCell colSpan={3} color="text.secondary">No duration data in period</TableCell></TableRow>
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
                </CardContent>
              </Card>
            </Grid>

            {/* Top clickthroughs */}
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Top clickthroughs (tracked actions)</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Buttons/links that use trackClick() appear here.
                  </Typography>
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
                          <TableRow><TableCell colSpan={2} color="text.secondary">No click events in period</TableCell></TableRow>
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
                </CardContent>
              </Card>
            </Grid>

            {/* Link clicks (nav and in-app links) */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Link clicks</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Total: {metrics.totalLinkClicks}</Typography>
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
                          <TableRow><TableCell colSpan={2} color="text.secondary">No link clicks in period</TableCell></TableRow>
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
                </CardContent>
              </Card>
            </Grid>

            {/* Checklist actions */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Checklist actions</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Total: {metrics.totalChecklistEvents}</Typography>
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
                          <TableRow><TableCell colSpan={2} color="text.secondary">No checklist events in period</TableCell></TableRow>
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
                </CardContent>
              </Card>
            </Grid>

            {/* Activity actions */}
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600} gutterBottom>Activity actions</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Total: {metrics.totalActivityEvents}</Typography>
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
                          <TableRow><TableCell colSpan={2} color="text.secondary">No activity events in period</TableCell></TableRow>
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
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon color="primary" />
          Aggregated platform data
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Combined counts from managers, mentors, and PECC tiers across the platform.
        </Typography>
        {aggregatedError && (
          <Alert severity="error" sx={{ mb: 2 }} action={
            <Button color="inherit" size="small" onClick={() => { setAggregatedError(null); setRetryCount(c => c + 1); }}>
              Retry
            </Button>
          }>
            {aggregatedError}
          </Alert>
        )}
        {aggregatedLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">Loading platform metrics...</Typography>
          </Box>
        ) : aggregated ? (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <PeopleIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>Managers</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{aggregated.managers}</Typography>
                  <Typography variant="caption" color="text.secondary">Platform-wide</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AssignmentIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>Mentors</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{aggregated.mentors}</Typography>
                  <Typography variant="caption" color="text.secondary">Platform-wide</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <GroupIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>PECCs</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{aggregated.peccs}</Typography>
                  <Typography variant="caption" color="text.secondary">At assigned sites</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <LocalHospitalIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>Sites</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{aggregated.sites}</Typography>
                  <Typography variant="caption" color="text.secondary">Assigned to mentors</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <PeopleIcon color="secondary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>Contacts</Typography>
                  </Box>
                  <Typography variant="h4" color="secondary.main">{aggregated.contacts}</Typography>
                  <Typography variant="caption" color="text.secondary">Hospital CRM contacts</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4} lg={2}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <TimelineIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>PECC progress</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{aggregated.avgPeccProgress}%</Typography>
                  <Typography variant="caption" color="text.secondary">Avg checklist completion</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <WorkIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={600}>Mentor hours (this month)</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">{aggregated.mentorHoursThisMonth.toFixed(1)}h</Typography>
                  <Typography variant="caption" color="text.secondary">{aggregated.mentorActivitiesThisMonth} activities logged</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Paper>
    </Box>
  );
}
