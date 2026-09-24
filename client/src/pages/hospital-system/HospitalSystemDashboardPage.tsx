import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Button,
  Collapse,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  Assignment as AssignmentIcon,
  Checklist as ChecklistIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { useUserProfile } from '../../context/UserProfileContext';
import { UserRole } from '../../types/database';
import { supabase } from '../../supabase';
import { batchGetHospitalDataForKey, mapSiteRefsToHospitalRowIds } from '../../utils/userData';
import { parseActivityDate } from '../../utils/snapshotActivityDate';
import {
  fetchAssignedHospitalSystemNames,
  listHospitalSystemNames,
  resolveHospitalsForSystem,
  type HospitalSystemSite,
} from '../../utils/hospitalSystemScope';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';

const CHECKLIST_STEPS = [
  { num: 1, title: 'Identify & Engage Stakeholders', description: 'Identify key system-level stakeholders; appoint system-wide Peds Ready Project Lead; support identifying local hospital PECCs and champions.' },
  { num: 2, title: 'Decide Governance and Structure', description: 'Create Pediatric Readiness Steering Committee; establish system-wide roles and protected time.' },
  { num: 3, title: 'Develop Project Charter', description: 'Develop charter with objectives: assign PECCs, conduct NPRP assessment, gap plans, simulation strategy, QI projects, disaster preparedness, PECC training, meeting cadence.' },
  { num: 4, title: 'Standardize Assessment and Training', description: 'Peds Ready Project Lead meets with hospital PECCs; deploy core PECC training; all sites complete NPRP assessment at pedsready.org.' },
  { num: 5, title: 'Gap Analysis & Action Planning & Sim Program', description: 'Review assessment findings; determine system-level vs local gap closure; develop simulation plan; schedule simulations; provide resources for action plans.' },
  { num: 6, title: 'Meeting Cadence, Deliverable Tracking, and Reporting', description: 'Track gap closure, simulation, QI milestones; monthly PECC check-ins; report-outs to ED staff, leadership, quality committee, executive leadership.' },
  { num: 7, title: 'Continuous Review & Integration for Sustainability', description: 'Annually reassess; embed readiness and simulation into policy, EMR, competency; consider Peds Ready Facility Recognition.' },
];

interface ChecklistRow {
  hospital_system_name: string;
  step_number: number;
  status: 'not_started' | 'in_progress' | 'completed';
  notes: string | null;
  updated_at: string;
}

interface HospitalMetric {
  activityCount: number;
  gapPlanCount: number;
  readinessCount: number;
  checklistProgress: number;
  lastActivity: string | null;
}

const kpiCardSx = {
  p: 2.25,
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  height: '100%',
  transition: 'transform 180ms ease, box-shadow 180ms ease',
  '@media (prefers-reduced-motion: no-preference)': {
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: (t: { shadows: string[] }) => t.shadows[2],
    },
  },
} as const;

const HospitalSystemDashboardPage: React.FC = () => {
  const theme = useTheme();
  const { effectiveUserId, hasAdminAccess, viewAsRole, viewAsUserId } = useUserProfile();
  const actorUserId = effectiveUserId ?? null;

  const [systemNames, setSystemNames] = useState<string[]>([]);
  const [adminPreview, setAdminPreview] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [hospitals, setHospitals] = useState<HospitalSystemSite[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [metricsByHospital, setMetricsByHospital] = useState<Record<string, HospitalMetric>>({});
  const [loading, setLoading] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!actorUserId && !hasAdminAccess) return;
      setLoading(true);
      setError(null);
      setAdminPreview(false);
      try {
        let names: string[] = [];
        if (actorUserId) {
          names = await fetchAssignedHospitalSystemNames(actorUserId);
        }
        // Admins using Account "View as Hospital System" (role-only) or with no personal
        // assignments need a full system list to review aggregated hospital work.
        const roleOnlyPreview =
          hasAdminAccess &&
          !viewAsUserId &&
          (viewAsRole === UserRole.HOSPITAL_SYSTEM || names.length === 0);
        if (names.length === 0 && hasAdminAccess && (roleOnlyPreview || !viewAsUserId)) {
          names = await listHospitalSystemNames();
          setAdminPreview(true);
        }
        setSystemNames(names);
        setSelectedSystem((prev) => (names.length > 0 && (!prev || !names.includes(prev)) ? names[0] : prev));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load assignments';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [actorUserId, hasAdminAccess, viewAsRole, viewAsUserId, retryCount]);

  useEffect(() => {
    if (!selectedSystem) {
      setHospitals([]);
      setChecklist([]);
      setMetricsByHospital({});
      return;
    }
    let cancelled = false;
    (async () => {
      setSitesLoading(true);
      try {
        const [rows, checklistRes] = await Promise.all([
          resolveHospitalsForSystem(selectedSystem),
          supabase
            .from('hospital_system_checklist')
            .select('hospital_system_name, step_number, status, notes, updated_at')
            .eq('hospital_system_name', selectedSystem)
            .order('step_number'),
        ]);
        if (cancelled) return;
        setHospitals(rows);
        if (!checklistRes.error) setChecklist((checklistRes.data as ChecklistRow[]) || []);

        const refs = rows.flatMap((h) => [h.id, h.facility_id]).filter(Boolean) as string[];
        const refToHospitalId = await mapSiteRefsToHospitalRowIds(refs);
        const canonicalHospitalIds = [...new Set([...refToHospitalId.values()])];

        const [activityMap, gapPlansMap, readinessMap, prsReadinessMap, checklistRowsRes] = await Promise.all([
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'activities'),
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'gapPlans'),
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'readinessScores'),
          batchGetHospitalDataForKey<unknown[]>(canonicalHospitalIds, 'prsReadinessScores'),
          canonicalHospitalIds.length > 0
            ? supabase.from('site_checklist_progress').select('hospital_id, completed').in('hospital_id', canonicalHospitalIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (cancelled) return;
        if (checklistRowsRes.error) {
          setError(checklistRowsRes.error.message);
          return;
        }

        const checklistStats = new Map<string, { total: number; completed: number }>();
        (checklistRowsRes.data || []).forEach((row: { hospital_id: string; completed: boolean }) => {
          const prev = checklistStats.get(row.hospital_id) || { total: 0, completed: 0 };
          prev.total += 1;
          if (row.completed) prev.completed += 1;
          checklistStats.set(row.hospital_id, prev);
        });

        const nextMetrics: Record<string, HospitalMetric> = {};
        rows.forEach((h) => {
          const canonicalId = refToHospitalId.get(h.id) || (h.facility_id ? refToHospitalId.get(h.facility_id) : undefined);
          const activities = canonicalId ? activityMap.get(canonicalId) : null;
          const gapPlans = canonicalId ? gapPlansMap.get(canonicalId) : null;
          const prsReadiness = canonicalId ? prsReadinessMap.get(canonicalId) : null;
          const readiness = canonicalId ? readinessMap.get(canonicalId) : null;
          const scores =
            Array.isArray(prsReadiness) && prsReadiness.length > 0 ? prsReadiness : readiness;
          const stats = canonicalId ? checklistStats.get(canonicalId) : undefined;
          const checklistProgress = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
          const activityList = Array.isArray(activities) ? activities : [];
          const lastActivity = activityList.reduce<string | null>((latest, a: unknown) => {
            const raw = a && typeof a === 'object' && 'date' in a && (a as { date?: unknown }).date
              ? String((a as { date: unknown }).date)
              : null;
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
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load system hospitals');
        }
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSystem]);

  const totalActivities = Object.values(metricsByHospital).reduce((sum, m) => sum + m.activityCount, 0);
  const totalGapPlans = Object.values(metricsByHospital).reduce((sum, m) => sum + m.gapPlanCount, 0);
  const totalReadiness = Object.values(metricsByHospital).reduce((sum, m) => sum + m.readinessCount, 0);
  const avgChecklistProgress = hospitals.length
    ? Math.round(Object.values(metricsByHospital).reduce((sum, m) => sum + m.checklistProgress, 0) / hospitals.length)
    : 0;
  const completedSteps = checklist.filter((c) => c.status === 'completed').length;
  const systemChecklistPct = Math.round((completedSteps / CHECKLIST_STEPS.length) * 100);

  const sortedHospitals = useMemo(() => {
    return [...hospitals].sort((a, b) => {
      const ma = metricsByHospital[a.id]?.checklistProgress ?? 0;
      const mb = metricsByHospital[b.id]?.checklistProgress ?? 0;
      if (mb !== ma) return mb - ma;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [hospitals, metricsByHospital]);

  const getStepStatus = (stepNum: number): 'not_started' | 'in_progress' | 'completed' => {
    const row = checklist.find((c) => c.step_number === stepNum);
    return (row?.status as 'not_started' | 'in_progress' | 'completed') || 'not_started';
  };

  const handleStepStatusChange = async (stepNum: number, status: 'not_started' | 'in_progress' | 'completed') => {
    if (!selectedSystem || !actorUserId) return;
    setSavingStep(stepNum);
    const existing = checklist.find((c) => c.step_number === stepNum);
    const payload = {
      hospital_system_name: selectedSystem,
      step_number: stepNum,
      status,
      notes: existing?.notes ?? null,
      updated_at: new Date().toISOString(),
      updated_by: actorUserId,
    };
    try {
      const { error: upsertErr } = await supabase.from('hospital_system_checklist').upsert(payload, {
        onConflict: 'hospital_system_name,step_number',
      });
      if (upsertErr) throw upsertErr;
      setChecklist((prev) => {
        const rest = prev.filter((c) => c.step_number !== stepNum);
        return [
          ...rest,
          {
            hospital_system_name: selectedSystem,
            step_number: stepNum,
            status,
            notes: payload.notes,
            updated_at: payload.updated_at,
          },
        ];
      });
    } catch (err) {
      console.error('hospital_system_checklist upsert failed:', err);
      setError('Could not save checklist step. Please retry.');
    } finally {
      setSavingStep(null);
    }
  };

  if (loading && systemNames.length === 0) {
    return (
      <AdminPageShell>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 280, gap: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading system leadership view…
          </Typography>
        </Box>
      </AdminPageShell>
    );
  }

  if (error && systemNames.length === 0) {
    return (
      <AdminPageShell>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount((c) => c + 1); }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </AdminPageShell>
    );
  }

  if (systemNames.length === 0) {
    return (
      <AdminPageShell>
        <AdminHero
          overline="Hospital System"
          title="Support Tool"
          description="System-level pediatric readiness for your assigned health systems."
        />
        <Alert severity="info">
          You are not assigned to any hospital system yet. An admin can assign you via the CRM (Team tab) by setting
          your role to Hospital System and selecting one or more systems. Linking yourself to a hospital alone does
          not grant system access — the Team tab assignment is required.
        </Alert>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminHero
        overline="Hospital System"
        title={selectedSystem || 'Support Tool'}
        description="Executive view of PECC activity, readiness, and site checklist progress across hospitals in this system."
        actions={
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 280 } }}>
            <InputLabel id="hs-system-select-label">Hospital system</InputLabel>
            <Select
              labelId="hs-system-select-label"
              value={selectedSystem}
              label="Hospital system"
              onChange={(e: SelectChangeEvent<string>) => setSelectedSystem(e.target.value)}
            >
              {systemNames.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      {adminPreview && (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Admin preview — showing all hospital systems. Assign systems on CRM → Team for a Hospital System user to
          scope this view.
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* KPI strip — leadership scan */}
      <Grid container spacing={2}>
        {[
          {
            label: 'Hospitals',
            value: String(hospitals.length),
            icon: <HospitalIcon fontSize="small" />,
            hint: 'Sites in this system',
          },
          {
            label: 'Activities',
            value: String(totalActivities),
            icon: <TimelineIcon fontSize="small" />,
            hint: 'Logged PECC / site work',
          },
          {
            label: 'Gap plans',
            value: String(totalGapPlans),
            icon: <AssignmentIcon fontSize="small" />,
            hint: 'Active improvement plans',
          },
          {
            label: 'Avg checklist',
            value: `${avgChecklistProgress}%`,
            icon: <ChecklistIcon fontSize="small" />,
            hint: 'Mean site checklist completion',
          },
          {
            label: 'System roadmap',
            value: `${completedSteps}/7`,
            icon: <TrendingUpIcon fontSize="small" />,
            hint: `${systemChecklistPct}% of system steps done`,
          },
        ].map((kpi) => (
          <Grid item xs={6} sm={4} md key={kpi.label}>
            <Paper elevation={0} sx={kpiCardSx}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, color: 'secondary.dark' }}>
                {kpi.icon}
                <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 0.08, lineHeight: 1.2 }}>
                  {kpi.label}
                </Typography>
              </Stack>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.75rem', md: '2.05rem' },
                  letterSpacing: -0.5,
                  lineHeight: 1.1,
                  color: 'text.primary',
                }}
              >
                {sitesLoading ? '—' : kpi.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                {kpi.hint}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <AdminSection
        title="Site performance"
        description="Hospital-scoped PECC continuity data for every site linked to this system (CRM links and hospital system field)."
      >
        {sitesLoading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : hospitals.length === 0 ? (
          <Alert severity="info">
            No hospitals found for this system. In CRM, set each hospital&apos;s &quot;Part of system&quot; (or Hospital
            system text) to match this system name, or add hospitals on the System contact.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="Hospital performance in this system">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Hospital</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Activities
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Gap plans
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Readiness
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Checklist</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Last activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedHospitals.map((h) => {
                  const m = metricsByHospital[h.id];
                  const pct = m?.checklistProgress ?? 0;
                  return (
                    <TableRow key={h.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {h.name || 'Unnamed'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[h.city, h.state].filter(Boolean).join(', ') || (h.facility_id ? `Facility ${h.facility_id}` : '—')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{m?.activityCount ?? 0}</TableCell>
                      <TableCell align="right">{m?.gapPlanCount ?? 0}</TableCell>
                      <TableCell align="right">{m?.readinessCount ?? 0}</TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ flex: 1, minWidth: 72 }}>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{
                                height: 8,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.secondary.main, 0.12),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 1,
                                  bgcolor: pct >= 70 ? 'success.main' : pct >= 35 ? 'secondary.main' : 'warning.main',
                                  transition: 'transform 400ms ease',
                                },
                              }}
                            />
                          </Box>
                          <Typography variant="caption" fontWeight={700} sx={{ minWidth: 36 }}>
                            {pct}%
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {m?.lastActivity
                            ? new Date(m.lastActivity).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {hospitals.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            {hospitals.length} site{hospitals.length === 1 ? '' : 's'} · {totalReadiness} readiness score
            {totalReadiness === 1 ? '' : 's'} on file · metrics stay with the hospital across PECC turnover
          </Typography>
        )}
      </AdminSection>

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
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
            System checklist
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Seven-step pediatric readiness roadmap for {selectedSystem}. {completedSteps} of 7 complete.
          </Typography>
          <LinearProgress
            variant="determinate"
            value={systemChecklistPct}
            sx={{
              mt: 1.5,
              height: 6,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': { borderRadius: 1, bgcolor: 'secondary.main' },
            }}
          />
        </Box>
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: { xs: 1.5, md: 2 } }}>
          {CHECKLIST_STEPS.map((step) => {
            const status = getStepStatus(step.num);
            const isExpanded = expandedStep === step.num;
            return (
              <Box key={step.num} sx={{ mb: 1 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 1,
                    bgcolor:
                      status === 'completed'
                        ? alpha(theme.palette.success.main, 0.06)
                        : status === 'in_progress'
                          ? alpha(theme.palette.secondary.main, 0.05)
                          : undefined,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                    <IconButton
                      size="small"
                      aria-label={isExpanded ? 'Collapse step' : 'Expand step'}
                      onClick={() => setExpandedStep(isExpanded ? null : step.num)}
                    >
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Step {step.num}: {step.title}
                    </Typography>
                    <Chip
                      size="small"
                      label={status.replace('_', ' ')}
                      color={status === 'completed' ? 'success' : status === 'in_progress' ? 'primary' : 'default'}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', pl: { xs: 5, sm: 0 } }}>
                    {(['not_started', 'in_progress', 'completed'] as const).map((s) => (
                      <Button
                        key={s}
                        size="small"
                        variant={status === s ? 'contained' : 'outlined'}
                        color={s === 'completed' ? 'success' : 'primary'}
                        disabled={savingStep === step.num || !actorUserId}
                        onClick={() => handleStepStatusChange(step.num, s)}
                      >
                        {s === 'not_started' ? 'Not started' : s === 'in_progress' ? 'In progress' : 'Done'}
                      </Button>
                    ))}
                  </Box>
                </Paper>
                <Collapse in={isExpanded}>
                  <Box sx={{ pl: { xs: 2, sm: 5 }, pr: 2, py: 1.25 }}>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </AdminPageShell>
  );
};

export default HospitalSystemDashboardPage;
