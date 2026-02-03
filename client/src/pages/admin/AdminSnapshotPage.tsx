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
import { supabase } from '../../supabase';

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
  metadata: { time_spent_seconds?: number; target?: string };
  created_at: string;
}

export default function AdminSnapshotPage() {
  const [periodValue, setPeriodValue] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [periodValue, customFrom, customTo]);

  const metrics = useMemo(() => {
    const logins = events.filter((e) => e.event_type === 'login');
    const pageViews = events.filter((e) => e.event_type === 'page_view');
    const clicks = events.filter((e) => e.event_type === 'click');

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

    return {
      totalLogins: logins.length,
      uniqueLoginsByRole,
      mostUsedPages,
      avgTimeByPath,
      topClicks,
      totalPageViews: pageViews.length,
      totalClicks: clicks.length,
      clickCountByRole,
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
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
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
                    Buttons/links that use trackClick() appear here. Add more over time to see which actions are used most.
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
          </Grid>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Cross-site summaries (placeholder)</Typography>
        <Typography color="text.secondary">
          Snapshot content such as aggregate readiness, activities, and site progress can be added here (e.g. cross-site summaries, exports, dashboards).
        </Typography>
      </Paper>
    </Box>
  );
}
