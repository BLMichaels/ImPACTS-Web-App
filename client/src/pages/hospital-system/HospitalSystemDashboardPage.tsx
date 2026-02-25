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
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';

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

const HospitalSystemDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const [systemNames, setSystemNames] = useState<string[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [hospitals, setHospitals] = useState<HospitalRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [savingStep, setSavingStep] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) return;
      setLoading(true);
      setError(null);
      try {
        const { data: assignments, error: assignErr } = await supabase
          .from('hospital_system_assignments')
          .select('hospital_system_name')
          .eq('user_id', currentUser.id);
        if (assignErr) throw assignErr;
        const names = (assignments || []).map((a: { hospital_system_name: string }) => a.hospital_system_name).filter(Boolean);
        setSystemNames(names);
        if (names.length > 0 && !selectedSystem) setSelectedSystem(names[0]);
      } catch (e: any) {
        setError(e?.message || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selectedSystem) {
      setHospitals([]);
      setChecklist([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: hospData, error: hospErr } = await supabase
        .from('hospitals')
        .select('id, name, facility_id, city, state')
        .eq('hospital_system', selectedSystem)
        .order('name');
      if (cancelled) return;
      if (hospErr) {
        setError(hospErr.message);
        return;
      }
      setHospitals((hospData as HospitalRow[]) || []);

      const { data: checkData, error: checkErr } = await supabase
        .from('hospital_system_checklist')
        .select('hospital_system_name, step_number, status, notes, updated_at')
        .eq('hospital_system_name', selectedSystem)
        .order('step_number');
      if (cancelled) return;
      if (!checkErr) setChecklist((checkData as ChecklistRow[]) || []);
    })();
    return () => { cancelled = true; };
  }, [selectedSystem]);

  const getStepStatus = (stepNum: number): 'not_started' | 'in_progress' | 'completed' => {
    const row = checklist.find((c) => c.step_number === stepNum);
    return (row?.status as 'not_started' | 'in_progress' | 'completed') || 'not_started';
  };

  const handleStepStatusChange = async (stepNum: number, status: 'not_started' | 'in_progress' | 'completed') => {
    if (!selectedSystem || !currentUser?.id) return;
    setSavingStep(stepNum);
    try {
      await supabase.from('hospital_system_checklist').upsert(
        {
          hospital_system_name: selectedSystem,
          step_number: stepNum,
          status,
          updated_at: new Date().toISOString(),
          updated_by: currentUser.id,
        },
        { onConflict: 'hospital_system_name,step_number' }
      );
      setChecklist((prev) => {
        const rest = prev.filter((c) => c.step_number !== stepNum);
        return [...rest, { hospital_system_name: selectedSystem, step_number: stepNum, status, notes: null, updated_at: new Date().toISOString() }];
      });
    } finally {
      setSavingStep(null);
    }
  };

  if (loading && systemNames.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
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
        Hospital System Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        View PECC data and track pediatric readiness progress for your assigned system(s).
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
                        secondary={[h.city, h.state].filter(Boolean).join(', ') || (h.facility_id ? `Facility ID: ${h.facility_id}` : undefined)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
              {hospitals.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Total: {hospitals.length} site(s). PECC-entered data (readiness, gap plans, milestones) for these sites is visible to your system.
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
