import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Collapse,
  IconButton,
  Container,
} from '@mui/material';
import {
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { batchGetHospitalDataForKey, mapSiteRefsToHospitalRowIds } from '../../utils/userData';
import { parseActivityDate } from '../../utils/snapshotActivityDate';

interface HospitalRow {
  id: string;
  name: string;
  facility_id?: string | null;
  city?: string | null;
  state?: string | null;
  hospital_system?: string | null;
}

interface HospitalMetric {
  activityCount: number;
  gapPlanCount: number;
  readinessCount: number;
  checklistProgress: number;
  lastActivity: string | null;
}

const HiringGroupSnapshotPage: React.FC = () => {
  const { currentUser } = useAuth();
  const hiringGroupUserId = currentUser?.id ?? (currentUser as { uid?: string })?.uid ?? null;
  const [systemNames, setSystemNames] = useState<string[]>([]);
  const [hospitalsBySystem, setHospitalsBySystem] = useState<Record<string, HospitalRow[]>>({});
  const [metricsByHospital, setMetricsByHospital] = useState<Record<string, HospitalMetric>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSystem, setExpandedSystem] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!hiringGroupUserId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: assignments, error: assignErr } = await supabase
          .from('hiring_group_assignments')
          .select('hospital_system_name')
          .eq('user_id', hiringGroupUserId);
        if (assignErr) throw assignErr;
        const names = [
          ...new Set(
            (assignments || [])
              .map((a: { hospital_system_name: string }) => a.hospital_system_name)
              .filter(Boolean)
          ),
        ];
        setSystemNames(names);
        if (names.length > 0) setExpandedSystem((prev) => (prev == null ? names[0] : prev));

        if (names.length === 0) {
          setHospitalsBySystem({});
          setMetricsByHospital({});
          return;
        }

        const { data: hospData, error: hospErr } = await supabase
          .from('hospitals')
          .select('id, name, facility_id, city, state, hospital_system')
          .in('hospital_system', names)
          .order('name');
        if (hospErr) throw hospErr;

        const hospitals = (hospData || []) as HospitalRow[];
        const bySystem: Record<string, HospitalRow[]> = {};
        names.forEach((sys) => {
          bySystem[sys] = hospitals.filter((h) => h.hospital_system === sys);
        });
        setHospitalsBySystem(bySystem);

        const refs = hospitals.flatMap((h) => [h.id, h.facility_id]).filter(Boolean) as string[];
        const refToHospitalId = await mapSiteRefsToHospitalRowIds(refs);
        const canonicalHospitalIds = [...new Set([...refToHospitalId.values()])];

        const [activityMap, gapPlansMap, readinessMap, prsReadinessMap, checklistRowsRes] = await Promise.all([
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'activities'),
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'gapPlans'),
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'readinessScores'),
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'prsReadinessScores'),
          canonicalHospitalIds.length > 0
            ? supabase
                .from('site_checklist_progress')
                .select('hospital_id, completed')
                .in('hospital_id', canonicalHospitalIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (checklistRowsRes.error) throw checklistRowsRes.error;

        const checklistStats = new Map<string, { total: number; completed: number }>();
        (checklistRowsRes.data || []).forEach((row: { hospital_id: string; completed: boolean }) => {
          const prev = checklistStats.get(row.hospital_id) || { total: 0, completed: 0 };
          prev.total += 1;
          if (row.completed) prev.completed += 1;
          checklistStats.set(row.hospital_id, prev);
        });

        const nextMetrics: Record<string, HospitalMetric> = {};
        hospitals.forEach((h) => {
          const canonicalId = refToHospitalId.get(h.id) || (h.facility_id ? refToHospitalId.get(h.facility_id) : undefined);
          const activities = canonicalId ? activityMap.get(canonicalId) : null;
          const gapPlans = canonicalId ? gapPlansMap.get(canonicalId) : null;
          const prsReadiness = canonicalId ? prsReadinessMap.get(canonicalId) : null;
          const readiness = canonicalId ? readinessMap.get(canonicalId) : null;
          const scores =
            Array.isArray(prsReadiness) && prsReadiness.length > 0
              ? prsReadiness
              : readiness;
          const stats = canonicalId ? checklistStats.get(canonicalId) : undefined;
          const checklistProgress = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          const activityList = Array.isArray(activities) ? activities : [];
          const lastActivity = activityList.reduce<string | null>((latest, a: any) => {
            const raw = a?.date ? String(a.date) : null;
            if (!raw) return latest;
            const next = parseActivityDate(raw);
            if (!next) return latest;
            if (!latest) return raw;
            const prev = parseActivityDate(latest);
            return prev && prev >= next ? latest : raw;
          }, null);
          nextMetrics[h.id] = {
            activityCount: activityList.length,
            gapPlanCount: Array.isArray(gapPlans) ? gapPlans.length : 0,
            readinessCount: Array.isArray(scores) ? scores.length : 0,
            checklistProgress,
            lastActivity,
          };
        });
        setMetricsByHospital(nextMetrics);
      } catch (e: any) {
        setError(e?.message || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hiringGroupUserId, retryCount]);

  const totalHospitals = Object.values(hospitalsBySystem).reduce((sum, list) => sum + list.length, 0);
  const totalActivities = Object.values(metricsByHospital).reduce((sum, m) => sum + m.activityCount, 0);
  const totalGapPlans = Object.values(metricsByHospital).reduce((sum, m) => sum + m.gapPlanCount, 0);
  const avgChecklist = totalHospitals
    ? Math.round(Object.values(metricsByHospital).reduce((sum, m) => sum + m.checklistProgress, 0) / totalHospitals)
    : 0;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 200, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">Loading snapshot...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom color="error">Error Loading Snapshot</Typography>
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }} action={
          <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount(c => c + 1); }}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (systemNames.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom color="text.secondary">No systems assigned</Typography>
        <Alert severity="info" sx={{ textAlign: 'left' }}>
          You are not assigned to any hospital system yet. An admin can assign you via the CRM (Team tab) by setting your role to Hiring Group and selecting one or more systems.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
        Snapshot – Hiring Group
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Read-only, hospital-based view of your assigned systems. Metrics below are loaded from hospital continuity data and checklist progress.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Chip size="small" label={`${systemNames.length} system(s)`} />
        <Chip size="small" label={`${totalHospitals} hospital(s)`} />
        <Chip size="small" label={`${totalActivities} activities`} />
        <Chip size="small" label={`${totalGapPlans} gap plans`} />
        <Chip size="small" label={`${avgChecklist}% avg checklist`} />
      </Box>

      <Grid container spacing={2}>
        {systemNames.map((sysName) => {
          const hospitals = hospitalsBySystem[sysName] || [];
          const isExpanded = expandedSystem === sysName;
          return (
            <Grid item xs={12} key={sysName}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton size="small" onClick={() => setExpandedSystem(isExpanded ? null : sysName)} aria-label={isExpanded ? `Collapse ${sysName}` : `Expand ${sysName}`}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <BusinessIcon color="action" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {sysName}
                      </Typography>
                      <Chip size="small" label={`${hospitals.length} hospital(s)`} />
                    </Box>
                  </Box>
                  <Collapse in={isExpanded}>
                    <List dense sx={{ pl: 4, pt: 1 }}>
                      {hospitals.length === 0 ? (
                        <ListItem>
                          <ListItemText primary="No hospitals in this system" secondary="Ensure Hospital system is set in the CRM for each site." />
                        </ListItem>
                      ) : (
                        hospitals.map((h) => (
                          <ListItem key={h.id}>
                            <ListItemText
                              primary={h.name || 'Unnamed'}
                              secondary={
                                [
                                  [h.city, h.state].filter(Boolean).join(', '),
                                  `Activities: ${metricsByHospital[h.id]?.activityCount ?? 0}`,
                                  `Gap plans: ${metricsByHospital[h.id]?.gapPlanCount ?? 0}`,
                                  `Readiness: ${metricsByHospital[h.id]?.readinessCount ?? 0}`,
                                  `Checklist: ${metricsByHospital[h.id]?.checklistProgress ?? 0}%`,
                                  metricsByHospital[h.id]?.lastActivity
                                    ? `Last activity: ${new Date(metricsByHospital[h.id].lastActivity as string).toLocaleDateString()}`
                                    : undefined,
                                  h.facility_id ? `Facility ID: ${h.facility_id}` : undefined,
                                ]
                                  .filter(Boolean)
                                  .join(' • ')
                              }
                            />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        Metrics are hospital-scoped (not user-scoped) to align with PECC continuity across staff turnover.
      </Alert>
    </Container>
  );
};

export default HiringGroupSnapshotPage;
