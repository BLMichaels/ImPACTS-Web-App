import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
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
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { batchGetHospitalDataForKey, mapSiteRefsToHospitalRowIds } from '../../utils/userData';

const CHECKLIST_STEPS = [
  { num: 1, title: 'Identify & Engage Stakeholders', description: 'Identify key system-level stakeholders; appoint system-wide Peds Ready Project Lead; support identifying local hospital PECCs and champions.' },
  { num: 2, title: 'Decide Governance and Structure', description: 'Create Pediatric Readiness Steering Committee; establish system-wide roles and protected time.' },
  { num: 3, title: 'Develop Project Charter', description: 'Develop charter with objectives: assign PECCs, conduct NPRP assessment, gap plans, simulation strategy, QI projects, disaster preparedness, PECC training, meeting cadence.' },
  { num: 4, title: 'Standardize Assessment and Training', description: 'Peds Ready Project Lead meets with hospital PECCs; deploy core PECC training; all sites complete NPRP assessment at pedsready.org.' },
  { num: 5, title: 'Gap Analysis & Action Planning & Sim Program', description: 'Review assessment findings; determine system-level vs local gap closure; develop simulation plan; schedule simulations; provide resources for action plans.' },
  { num: 6, title: 'Meeting Cadence, Deliverable Tracking, and Reporting', description: 'Track gap closure, simulation, QI milestones; monthly PECC check-ins; report-outs to ED staff, leadership, quality committee, executive leadership.' },
  { num: 7, title: 'Continuous Review & Integration for Sustainability', description: 'Annually reassess; embed readiness and simulation into policy, EMR, competency; consider Peds Ready Facility Recognition.' },
];

interface HospitalRow {
  id: string;
  name: string;
  facility_id?: string | null;
  city?: string | null;
  state?: string | null;
}

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

const HospitalSystemDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const actorUserId = currentUser?.id ?? (currentUser as { uid?: string })?.uid ?? null;
  const [systemNames, setSystemNames] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [metricsByHospital, setMetricsByHospital] = useState<Record<string, HospitalMetric>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [savingStep, setSavingStep] = useState<number | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!actorUserId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: assignments, error: assignErr } = await supabase
          .from('hospital_system_assignments')
          .select('hospital_system_name')
          .eq('user_id', actorUserId);
        if (assignErr) throw assignErr;
        const names = [
          ...new Set(
            (assignments || [])
              .map((a: { hospital_system_name: string }) => a.hospital_system_name)
              .filter(Boolean)
          ),
        ];
        setSystemNames(names);
        setSelectedSystem((prev) => (names.length > 0 && (!prev || !names.includes(prev)) ? names[0] : prev));
      } catch (e: any) {
        setError(e?.message || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [actorUserId, retryCount]);

  useEffect(() => {
    if (!selectedSystem) {
      setHospitals([]);
      setChecklist([]);
      setMetricsByHospital({});
      return;
    }
    let cancelled = false;
    (async () => {
      const [hospRes, checklistRes] = await Promise.all([
        supabase
          .from('hospitals')
          .select('id, name, facility_id, city, state')
          .eq('hospital_system', selectedSystem)
          .order('name'),
        supabase
          .from('hospital_system_checklist')
          .select('hospital_system_name, step_number, status, notes, updated_at')
          .eq('hospital_system_name', selectedSystem)
          .order('step_number'),
      ]);
      if (cancelled) return;
      if (hospRes.error) {
        setError(hospRes.error.message);
        return;
      }
      const rows = (hospRes.data as HospitalRow[]) || [];
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
        const scores = Array.isArray(prsReadiness) ? prsReadiness : readiness;
        const stats = canonicalId ? checklistStats.get(canonicalId) : undefined;
        const checklistProgress = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const activityList = Array.isArray(activities) ? activities : [];
        const lastActivity = activityList.length
          ? activityList
              .map((a: any) => (a?.date ? String(a.date) : null))
              .filter(Boolean)
              .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null
          : null;
        nextMetrics[h.id] = {
          activityCount: activityList.length,
          gapPlanCount: Array.isArray(gapPlans) ? gapPlans.length : 0,
          readinessCount: Array.isArray(scores) ? scores.length : 0,
          checklistProgress,
          lastActivity,
        };
      });
      setMetricsByHospital(nextMetrics);
    })();
    return () => { cancelled = true; };
  }, [selectedSystem]);

  const totalActivities = Object.values(metricsByHospital).reduce((sum, m) => sum + m.activityCount, 0);
  const totalGapPlans = Object.values(metricsByHospital).reduce((sum, m) => sum + m.gapPlanCount, 0);
  const avgChecklistProgress = hospitals.length
    ? Math.round(Object.values(metricsByHospital).reduce((sum, m) => sum + m.checklistProgress, 0) / hospitals.length)
    : 0;

  const getStepStatus = (stepNum: number): 'not_started' | 'in_progress' | 'completed' => {
    const row = checklist.find((c) => c.step_number === stepNum);
    return (row?.status as 'not_started' | 'in_progress' | 'completed') || 'not_started';
  };

  const handleStepStatusChange = async (stepNum: number, status: 'not_started' | 'in_progress' | 'completed') => {
    if (!selectedSystem || !currentUser?.id) return;
    setSavingStep(stepNum);
    const existing = checklist.find((c) => c.step_number === stepNum);
    const payload = {
      hospital_system_name: selectedSystem,
      step_number: stepNum,
      status,
      notes: existing?.notes ?? null,
      updated_at: new Date().toISOString(),
      updated_by: currentUser.id,
    };
    try {
      await supabase.from('hospital_system_checklist').upsert(payload, {
        onConflict: 'hospital_system_name,step_number',
      });
      setChecklist((prev) => {
        const rest = prev.filter((c) => c.step_number !== stepNum);
        return [...rest, { hospital_system_name: selectedSystem, step_number: stepNum, status, notes: payload.notes, updated_at: payload.updated_at }];
      });
    } finally {
      setSavingStep(null);
    }
  };

  if (loading && systemNames.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 200, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">Loading Support Tool...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom color="error">Error Loading Support Tool</Typography>
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
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          You are not assigned to any hospital system yet. An admin can assign you via the CRM (Team tab) by setting your role to Hospital System and selecting one or more systems.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Hospital System Support Tool
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        View hospital-scoped PECC continuity data and track pediatric readiness progress for your assigned system(s).
      </Typography>

      <FormControl size="small" sx={{ minWidth: 280, mb: 2 }}>
        <InputLabel>Hospital system</InputLabel>
        <Select
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sites in this system
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                All hospitals with the same Hospital system in the CRM are connected here.
              </Typography>
              {hospitals.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No hospitals found for this system. Ensure each hospital has the correct Hospital system name set in the CRM.
                </Typography>
              ) : (
                <List dense>
                  {hospitals.map((h) => (
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
                  ))}
                </List>
              )}
              {hospitals.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Total: {hospitals.length} site(s). Metrics are hospital-scoped for PECC continuity across staff turnover.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Aggregated summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip icon={<HospitalIcon />} label={`${hospitals.length} hospitals`} />
                <Chip label={`${totalActivities} activities`} />
                <Chip label={`${totalGapPlans} gap plans`} />
                <Chip label={`${avgChecklistProgress}% avg checklist`} />
                <Chip
                  label={`${checklist.filter((c) => c.status === 'completed').length} of 7 steps completed`}
                  color={checklist.filter((c) => c.status === 'completed').length === 7 ? 'success' : 'default'}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              System checklist
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Track progress for this hospital system. Only your assigned system(s) are shown.
            </Typography>
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
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: status === 'completed' ? 'action.selected' : undefined,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <IconButton size="small" onClick={() => setExpandedStep(isExpanded ? null : step.num)}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Typography variant="subtitle2">
                        Step {step.num}: {step.title}
                      </Typography>
                      <Chip
                        size="small"
                        label={status.replace('_', ' ')}
                        color={status === 'completed' ? 'success' : status === 'in_progress' ? 'primary' : 'default'}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {(['not_started', 'in_progress', 'completed'] as const).map((s) => (
                        <Button
                          key={s}
                          size="small"
                          variant={status === s ? 'contained' : 'outlined'}
                          disabled={savingStep === step.num}
                          onClick={() => handleStepStatusChange(step.num, s)}
                        >
                          {s === 'not_started' ? 'Not started' : s === 'in_progress' ? 'In progress' : 'Done'}
                        </Button>
                      ))}
                    </Box>
                  </Paper>
                  <Collapse in={isExpanded}>
                    <Box sx={{ pl: 5, pr: 2, py: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {step.description}
                      </Typography>
                    </Box>
                  </Collapse>
                </Box>
              );
            })}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HospitalSystemDashboardPage;
