import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  Alert,
  Grid,
  FormLabel,
  OutlinedInput,
  ListItemText,
  SelectChangeEvent,
  Stack,
  alpha
} from '@mui/material';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useMentorWorkRoutes } from '../../hooks/useMentorWorkRoutes';
import { fetchMergedMentorHospitals, mergedRowsToHospitalOptions } from '../../utils/mentorHospitalScope';
import { getManagedHospitalScopeKeysForManager } from '../../utils/managerTeamScope';
import { buildHospitalsTableOrClause } from '../../utils/hospitalId';
import { supabase } from '../../supabase';
import { usePhiGuard, PHI_SCAN_HINT } from '../../components/PhiGuard';
import { getUserData, setUserData, migrateFromLocalStorage } from '../../utils/userData';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';
import { DEFAULT_ACTIVITY_CATEGORIES, SIMULATION_CASE_OPTIONS, UserRole } from '../../types/database';

// Consistent chip colors per category (PE, TR, SC, etc.)
const CATEGORY_CHIP_COLOR: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'default'> = {
  PE: 'primary',
  TR: 'info',
  AD: 'default',
  RA: 'warning',
  SC: 'secondary',
  DM: 'success'
};
const getCategoryChipColor = (value: string) => CATEGORY_CHIP_COLOR[value] ?? 'default';

// Hours options (0-10 in 15 min increments)
const HOURS_OPTIONS = Array.from({ length: 41 }, (_, i) => i * 0.25);

// Activity interface
interface MentorActivity {
  id: string;
  date: string;
  activityName: string;
  category: string;
  hours: number;
  description: string;
  hospitalIds: string[];
  readinessDomains?: string[]; // Domains of pediatric readiness (multiple)
  simulationCase: string | null;
  simParticipants: number | null;
  facilitatorFeedbackSubmitted: boolean;
  participantFeedbackSubmitted: boolean;
  createdAt: string;
}

const READINESS_DOMAINS = [
  'Administration & Coordination',
  'Care Team Competencies',
  'Policies, Procedures, & Protocols',
  'Equipment, Supplies, & Medication',
  'Pediatric Patient & Medication Safety',
  'Quality & Process Improvement',
  'Support Services'
];

// Hospital interface (for dropdown)
interface Hospital {
  id: string;
  name: string;
}

type SortField = 'date' | 'activityName' | 'category' | 'hours';
type SortOrder = 'asc' | 'desc';

const MentorActivitiesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { effectiveUserId, userRole } = useUserProfile();
  const { runWithPhiGuard } = usePhiGuard();
  const navigate = useNavigate();
  const mentorRoutes = useMentorWorkRoutes();
  
  // State
  const [activities, setActivities] = useState<MentorActivity[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>(DEFAULT_ACTIVITY_CATEGORIES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState<MentorActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<MentorActivity | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [hospitalFilter, setHospitalFilter] = useState<string[]>([]);
  const [readinessDomainFilter, setReadinessDomainFilter] = useState<string[]>([]);
  const [simulationTypeFilter, setSimulationTypeFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date(),
    activityName: '',
    category: '',
    hours: 0,
    description: '',
    hospitalIds: [] as string[],
    readinessDomains: [] as string[],
    simulationCase: '',
    simParticipants: 1,
    facilitatorFeedbackSubmitted: false,
    participantFeedbackSubmitted: false
  });
  
  const [error, setError] = useState<string | null>(null);

  const userId = effectiveUserId ?? currentUser?.id ?? (currentUser as { uid?: string })?.uid;
  // Load mentor activities, hospitals from Supabase (user_data); migrate from localStorage if needed
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const [activitiesVal, hospitalsVal, categoriesRes] = await Promise.all([
        getUserData<MentorActivity[]>(userId, 'mentorActivities'),
        getUserData<any[]>(userId, 'mentorHospitals'),
        supabase.from('app_settings').select('value').eq('key', 'mentor_activity_categories').maybeSingle()
      ]);
      if (!mounted) return;
      if (activitiesVal != null && Array.isArray(activitiesVal)) setActivities(activitiesVal);
      else migrateFromLocalStorage(userId, 'mentorActivities', `mentorActivities_${userId}`, (v) => setActivities(Array.isArray(v) ? v : []));
      const storedArr = Array.isArray(hospitalsVal) ? hospitalsVal : [];
      const storedById = new Map(storedArr.map((h: { id: string }) => [h.id, h]));
      let list: Hospital[] = [];
      try {
        if (userRole === UserRole.MANAGER) {
          const scopeKeys = await getManagedHospitalScopeKeysForManager(userId);
          const managed = new Map<string, Hospital>();
          for (let i = 0; i < scopeKeys.length; i += 40) {
            const orClause = buildHospitalsTableOrClause(scopeKeys.slice(i, i + 40));
            if (!orClause || orClause.includes('__no_match__')) continue;
            const { data, error } = await supabase.from('hospitals').select('id, name').or(orClause);
            if (error) throw error;
            (data || []).forEach((h: { id: string; name: string }) => managed.set(h.id, h));
          }
          list = [...managed.values()];
        } else {
          const merged = await fetchMergedMentorHospitals(userId);
          const opts = mergedRowsToHospitalOptions(merged);
          list = opts.map((m) => {
            const s = storedById.get(m.id) as { name?: string } | undefined;
            return { id: m.id, name: s?.name ?? m.name };
          });
        }
      } catch {
        list = storedArr.map((h: { id: string; name?: string }) => ({ id: h.id, name: h.name || 'Hospital' }));
      }
      if (list.length === 0) {
        if (mounted) setHospitals([]);
        await migrateFromLocalStorage(userId, 'mentorHospitals', `mentorHospitals_${userId}`, (v) => {
          const arr = Array.isArray(v) ? v : [];
          if (mounted) setHospitals([...arr].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })));
        });
      } else {
        const sorted = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
        if (mounted) setHospitals(sorted);
      }
      const parsed = (categoriesRes.data as { value?: unknown } | null)?.value;
      if (parsed != null && Array.isArray(parsed) && parsed.length > 0) setCategories(parsed as Array<{ value: string; label: string }>);
    })();
    return () => { mounted = false; };
  }, [userId, effectiveUserId, userRole]);

  const saveActivities = async (newActivities: MentorActivity[]) => {
    setActivities(newActivities);
    if (userId) await setUserData(userId, 'mentorActivities', newActivities);
  };

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let result = [...activities];
    
    // Apply category filter
    if (categoryFilter.length > 0) {
      result = result.filter(a => categoryFilter.includes(a.category));
    }
    
    // Apply hospital filter
    if (hospitalFilter.length > 0) {
      result = result.filter(a => 
        a.hospitalIds.some(hid => hospitalFilter.includes(hid))
      );
    }
    
    // Apply readiness domain filter
    if (readinessDomainFilter.length > 0) {
      result = result.filter(a => 
        a.readinessDomains && a.readinessDomains.some(domain => readinessDomainFilter.includes(domain))
      );
    }
    
    // Apply simulation type filter
    if (simulationTypeFilter.length > 0) {
      result = result.filter(a => 
        a.simulationCase && simulationTypeFilter.includes(a.simulationCase)
      );
    }
    
    // Apply date filter
    if (dateFilter.start) {
      result = result.filter(a => new Date(a.date) >= dateFilter.start!);
    }
    if (dateFilter.end) {
      result = result.filter(a => new Date(a.date) <= dateFilter.end!);
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'activityName':
          comparison = a.activityName.localeCompare(b.activityName);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'hours':
          comparison = a.hours - b.hours;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [activities, categoryFilter, hospitalFilter, readinessDomainFilter, simulationTypeFilter, dateFilter, sortField, sortOrder]);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Open dialog for new activity
  const handleAddNew = () => {
    setEditingActivity(null);
    setFormData({
      date: new Date(),
      activityName: '',
      category: '',
      hours: 0,
      description: '',
      hospitalIds: [],
      readinessDomains: [],
      simulationCase: '',
      simParticipants: 1,
      facilitatorFeedbackSubmitted: false,
      participantFeedbackSubmitted: false
    });
    setError(null);
    setDialogOpen(true);
  };

  // Open dialog for editing
  const handleEdit = (activity: MentorActivity) => {
    setEditingActivity(activity);
    setFormData({
      date: parseISO(activity.date),
      activityName: activity.activityName,
      category: activity.category,
      hours: activity.hours,
      description: activity.description,
      hospitalIds: activity.hospitalIds,
      readinessDomains: activity.readinessDomains || [],
      simulationCase: activity.simulationCase || '',
      simParticipants: activity.simParticipants || 1,
      facilitatorFeedbackSubmitted: activity.facilitatorFeedbackSubmitted,
      participantFeedbackSubmitted: activity.participantFeedbackSubmitted
    });
    setError(null);
    setDialogOpen(true);
  };

  // Save activity
  const handleSave = () => {
    // Validation
    if (!formData.activityName.trim()) {
      setError('Activity name is required');
      return;
    }
    if (!formData.category) {
      setError('Category is required');
      return;
    }
    if (formData.hours <= 0) {
      setError('Hours must be greater than 0');
      return;
    }
    
    // For simulation activities, additional validation
    if (formData.category === 'SC') {
      if (!formData.simulationCase) {
        setError('Please select a simulation case');
        return;
      }
    }

    const activityData: MentorActivity = {
      id: editingActivity?.id || `activity_${Date.now()}`,
      date: format(formData.date, 'yyyy-MM-dd'),
      activityName: formData.activityName.trim(),
      category: formData.category,
      hours: formData.hours,
      description: formData.description.trim(),
      hospitalIds: formData.hospitalIds,
      readinessDomains: formData.readinessDomains.length > 0 ? formData.readinessDomains : undefined,
      simulationCase: formData.category === 'SC' ? formData.simulationCase : null,
      simParticipants: formData.category === 'SC' ? formData.simParticipants : null,
      facilitatorFeedbackSubmitted: formData.category === 'SC' ? formData.facilitatorFeedbackSubmitted : false,
      participantFeedbackSubmitted: formData.category === 'SC' ? formData.participantFeedbackSubmitted : false,
      createdAt: editingActivity?.createdAt || new Date().toISOString()
    };

    void runWithPhiGuard({
      surface: 'mentorActivities',
      texts: [activityData.activityName, activityData.description],
      payload: activityData,
      onSave: () => {
        let newActivities: MentorActivity[];
        if (editingActivity) {
          newActivities = activities.map(a => a.id === editingActivity.id ? activityData : a);
        } else {
          newActivities = [...activities, activityData];
        }

        newActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        saveActivities(newActivities);
        setError(null);
        setEditingActivity(null);
        setDialogOpen(false);

        setTimeout(() => {
          setFormData({
            date: new Date(),
            activityName: '',
            category: '',
            hours: 0,
            description: '',
            hospitalIds: [],
            readinessDomains: [],
            simulationCase: '',
            simParticipants: 1,
            facilitatorFeedbackSubmitted: false,
            participantFeedbackSubmitted: false
          });
        }, 100);
      },
    });
  };

  // Handle hospital selection
  const handleHospitalChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      hospitalIds: typeof value === 'string' ? value.split(',') : value
    }));
  };

  // Get category label
  const getCategoryLabel = (value: string) => {
    return categories.find(c => c.value === value)?.label || value;
  };

  // Get hospital names
  const getHospitalNames = (ids: string[]) => {
    return ids.map(id => normalizeHospitalOrOrgName(hospitals.find(h => h.id === id)?.name) || id).join(', ');
  };

  // Calculate statistics
  const calculateStats = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    const thisMonth = activities.filter(a => new Date(a.date) >= startOfMonth);
    const thisYear = activities.filter(a => new Date(a.date) >= startOfYear);
    
    return {
      thisMonth: {
        count: thisMonth.length,
        hours: thisMonth.reduce((sum, a) => sum + a.hours, 0)
      },
      thisYear: {
        count: thisYear.length,
        hours: thisYear.reduce((sum, a) => sum + a.hours, 0)
      },
      allTime: {
        count: activities.length,
        hours: activities.reduce((sum, a) => sum + a.hours, 0)
      }
    };
  };

  const stats = calculateStats();

  // Handle row click to view details
  const handleRowClick = (activity: MentorActivity) => {
    setViewingActivity(activity);
    setDetailDialogOpen(true);
  };

  // Handle edit from detail view
  const handleEditFromDetail = () => {
    if (viewingActivity) {
      setDetailDialogOpen(false);
      handleEdit(viewingActivity);
    }
  };

  // Handle delete from detail view
  const handleDeleteFromDetail = () => {
    if (viewingActivity) {
      if (window.confirm('Are you sure you want to delete this activity?')) {
        const newActivities = activities.filter(a => a.id !== viewingActivity.id);
        saveActivities(newActivities);
        setDetailDialogOpen(false);
        setViewingActivity(null);
      }
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Activity', 'Category', 'Description', 'Hours', 'Hospitals', 'Readiness Domain(s)', 'Simulation Case', 'Participants'];
    const rows = filteredActivities.map(activity => [
      format(parseISO(activity.date), 'yyyy-MM-dd'),
      activity.activityName,
      getCategoryLabel(activity.category),
      activity.description || '',
      activity.hours.toString(),
      activity.hospitalIds.length > 0 ? getHospitalNames(activity.hospitalIds) : '',
      activity.readinessDomains?.join('; ') || '',
      activity.simulationCase || '',
      activity.simParticipants?.toString() || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `activities_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <AdminPageShell>
        <Alert
          severity="info"
          variant="outlined"
          icon={false}
          sx={{ bgcolor: (t) => alpha(t.palette.secondary.main, 0.04) }}
        >
          <strong>No PHI.</strong> Do not include Protected Health Information or real patient data in activities,
          descriptions, or notes. {PHI_SCAN_HINT}
        </Alert>

        <AdminHero
          overline="Time tracking"
          title={userRole === UserRole.MANAGER ? 'Activities' : 'My Activities'}
          description={
            userRole === UserRole.MANAGER
              ? 'Log your management and direct mentoring work by site. These entries feed Manager Snapshot and reports.'
              : 'Log PRISM activities and simulations by hospital. Link activities to hospitals so they appear in Site Milestones and Snapshot.'
          }
          actions={
            <>
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
                Export CSV
              </Button>
              <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleAddNew}>
                Add activity
              </Button>
            </>
          }
        />

        {activities.length === 0 && (
          <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 5, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
              No activities yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 520, mx: 'auto' }}>
              {userRole === UserRole.MANAGER
                ? 'Log your first management or direct mentoring activity and associate it with a site in your scope.'
                : 'Add hospitals from the Hospitals page, then log your first activity and associate it with a hospital so it counts toward Site Milestones and reporting.'}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleAddNew}>
                Add your first activity
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate(userRole === UserRole.MANAGER ? '/manager/team?tab=sites' : mentorRoutes.hospitals)}
              >
                {userRole === UserRole.MANAGER ? 'View Sites' : 'Go to Hospitals'}
              </Button>
            </Stack>
          </Paper>
        )}

        {activities.length > 0 && (
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
                {activities.length} activit{activities.length === 1 ? 'y' : 'ies'} logged
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                '& > *': {
                  borderRight: { xs: 'none', sm: '1px solid' },
                  borderBottom: { xs: '1px solid', sm: 'none' },
                  borderColor: 'divider',
                },
                '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
              }}
            >
              {[
                {
                  label: 'This month',
                  count: stats.thisMonth.count,
                  hours: stats.thisMonth.hours,
                },
                {
                  label: 'This year',
                  count: stats.thisYear.count,
                  hours: stats.thisYear.hours,
                },
                {
                  label: 'All time',
                  count: stats.allTime.count,
                  hours: stats.allTime.hours,
                },
              ].map((item) => (
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
                    {item.count}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                    {item.count === 1 ? 'activity' : 'activities'} · {item.hours.toFixed(2)}h
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        <AdminSection
          overline="Narrow results"
          title="Filters"
          actions={
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setCategoryFilter([]);
                setHospitalFilter([]);
                setReadinessDomainFilter([]);
                setSimulationTypeFilter([]);
                setDateFilter({ start: null, end: null });
              }}
            >
              Clear all
            </Button>
          }
        >
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  multiple
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as string[])}
                  input={<OutlinedInput label="Category" />}
                  renderValue={(selected) => (selected.length > 0 ? `${selected.length} selected` : 'All')}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      <Checkbox checked={categoryFilter.includes(cat.value)} />
                      <ListItemText primary={cat.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Hospital</InputLabel>
                <Select
                  multiple
                  value={hospitalFilter}
                  onChange={(e) => setHospitalFilter(e.target.value as string[])}
                  input={<OutlinedInput label="Hospital" />}
                  renderValue={(selected) => (selected.length > 0 ? `${selected.length} selected` : 'All')}
                >
                  {hospitals.map((hospital) => (
                    <MenuItem key={hospital.id} value={hospital.id}>
                      <Checkbox checked={hospitalFilter.includes(hospital.id)} />
                      <ListItemText primary={normalizeHospitalOrOrgName(hospital.name)} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Readiness Domain</InputLabel>
                <Select
                  multiple
                  value={readinessDomainFilter}
                  onChange={(e) => setReadinessDomainFilter(e.target.value as string[])}
                  input={<OutlinedInput label="Readiness Domain" />}
                  renderValue={(selected) => (selected.length > 0 ? `${selected.length} selected` : 'All')}
                >
                  {READINESS_DOMAINS.map((domain) => (
                    <MenuItem key={domain} value={domain}>
                      <Checkbox checked={readinessDomainFilter.includes(domain)} />
                      <ListItemText primary={domain} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Simulation Type</InputLabel>
                <Select
                  multiple
                  value={simulationTypeFilter}
                  onChange={(e) => setSimulationTypeFilter(e.target.value as string[])}
                  input={<OutlinedInput label="Simulation Type" />}
                  renderValue={(selected) => (selected.length > 0 ? `${selected.length} selected` : 'All')}
                >
                  {SIMULATION_CASE_OPTIONS.map((simCase) => (
                    <MenuItem key={simCase} value={simCase}>
                      <Checkbox checked={simulationTypeFilter.includes(simCase)} />
                      <ListItemText primary={simCase} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="Start Date"
                value={dateFilter.start}
                onChange={(date) => setDateFilter((prev) => ({ ...prev, start: date }))}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="End Date"
                value={dateFilter.end}
                onChange={(date) => setDateFilter((prev) => ({ ...prev, end: date }))}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
          </Grid>
        </AdminSection>

        <AdminSection
          overline="Log"
          title="Activities"
          description={`${filteredActivities.length} shown`}
          disableBodyPadding
        >
          <TableContainer sx={{ maxHeight: 600, overflowX: 'auto', overflowY: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1000 }}>
              <TableHead>
                <TableRow
                  sx={{
                    '& .MuiTableCell-head': {
                      bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableCell sx={{ minWidth: 120 }}>
                    <TableSortLabel
                      active={sortField === 'date'}
                      direction={sortField === 'date' ? sortOrder : 'asc'}
                      onClick={() => handleSort('date')}
                    >
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ minWidth: 200 }}>
                    <TableSortLabel
                      active={sortField === 'activityName'}
                      direction={sortField === 'activityName' ? sortOrder : 'asc'}
                      onClick={() => handleSort('activityName')}
                    >
                      Activity
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ minWidth: 100 }}>
                    <TableSortLabel
                      active={sortField === 'category'}
                      direction={sortField === 'category' ? sortOrder : 'asc'}
                      onClick={() => handleSort('category')}
                    >
                      Category
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ minWidth: 80 }}>Hours</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Hospitals</TableCell>
                  <TableCell sx={{ minWidth: 250 }}>Description</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>Simulation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredActivities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary" gutterBottom>
                        {activities.length === 0
                          ? 'No activities recorded yet. Click "Add activity" to get started.'
                          : 'No activities match your current filters.'}
                      </Typography>
                      {activities.length > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setCategoryFilter([]);
                            setHospitalFilter([]);
                            setReadinessDomainFilter([]);
                            setSimulationTypeFilter([]);
                            setDateFilter({ start: null, end: null });
                          }}
                          sx={{ mt: 1 }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActivities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      onClick={() => handleRowClick(activity)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: (t) => alpha(t.palette.secondary.main, 0.04),
                        },
                      }}
                    >
                      <TableCell>{format(parseISO(activity.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {activity.activityName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getCategoryLabel(activity.category)}
                          size="small"
                          color={getCategoryChipColor(activity.category)}
                        />
                      </TableCell>
                      <TableCell>{activity.hours}</TableCell>
                      <TableCell>
                        {activity.hospitalIds.length > 0 ? getHospitalNames(activity.hospitalIds) : '-'}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: 'pre-wrap', maxWidth: 250 }}
                        >
                          {activity.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {activity.simulationCase ? (
                          <Typography variant="body2">{activity.simulationCase}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </AdminSection>

        {/* Activity Detail Dialog */}
        <Dialog 
          open={detailDialogOpen} 
          onClose={() => {
            setDetailDialogOpen(false);
            setViewingActivity(null);
          }} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>
            Activity Details
          </DialogTitle>
          <DialogContent>
            {viewingActivity && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Date</Typography>
                  <Typography>{format(parseISO(viewingActivity.date), 'MMM d, yyyy')}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Category</Typography>
<Chip 
                    label={getCategoryLabel(viewingActivity.category)} 
                    size="small"
                    color={getCategoryChipColor(viewingActivity.category)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Activity</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewingActivity.activityName}</Typography>
                </Grid>
                {viewingActivity.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>{viewingActivity.description}</Typography>
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Hours</Typography>
                  <Typography>{viewingActivity.hours}</Typography>
                </Grid>
                {viewingActivity.hospitalIds.length > 0 && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="textSecondary">Hospitals</Typography>
                    <Typography>{getHospitalNames(viewingActivity.hospitalIds)}</Typography>
                  </Grid>
                )}
                {viewingActivity.readinessDomains && viewingActivity.readinessDomains.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">Domain(s) of Pediatric Readiness</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      {viewingActivity.readinessDomains.map((domain, idx) => (
                        <Chip key={idx} label={domain} size="small" />
                      ))}
                    </Box>
                  </Grid>
                )}
                {viewingActivity.category === 'SC' && (
                  <>
                    {viewingActivity.simulationCase && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="textSecondary">Simulation Case</Typography>
                        <Typography>{viewingActivity.simulationCase}</Typography>
                      </Grid>
                    )}
                    {viewingActivity.simParticipants && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="textSecondary"># of Participants</Typography>
                        <Typography>{viewingActivity.simParticipants}</Typography>
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="textSecondary">Feedback Forms Submitted</Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        {viewingActivity.facilitatorFeedbackSubmitted && (
                          <Chip label="Facilitator" size="small" color="success" />
                        )}
                        {viewingActivity.participantFeedbackSubmitted && (
                          <Chip label="Participant" size="small" color="success" />
                        )}
                        {!viewingActivity.facilitatorFeedbackSubmitted && !viewingActivity.participantFeedbackSubmitted && (
                          <Typography variant="body2" color="textSecondary">None</Typography>
                        )}
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setDetailDialogOpen(false);
              setViewingActivity(null);
            }}>
              Close
            </Button>
            <Button onClick={handleEditFromDetail} variant="outlined" startIcon={<EditIcon />}>
              Edit
            </Button>
            <Button onClick={handleDeleteFromDetail} variant="outlined" color="error" startIcon={<DeleteIcon />}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Add/Edit Dialog */}
        <Dialog 
          open={dialogOpen} 
          onClose={() => {
            setDialogOpen(false);
            setEditingActivity(null);
            setError(null);
            // Reset form when closing
            setTimeout(() => {
              setFormData({
                date: new Date(),
                activityName: '',
                category: '',
                hours: 0,
                description: '',
                hospitalIds: [],
                readinessDomains: [],
                simulationCase: '',
                simParticipants: 1,
                facilitatorFeedbackSubmitted: false,
                participantFeedbackSubmitted: false
              });
            }, 100);
          }} 
          maxWidth="md" 
          fullWidth
          disableEnforceFocus
        >
          <DialogTitle>
            {editingActivity ? 'Edit Activity' : 'Add Activity'}
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <DatePicker
                  label="Date"
                  value={formData.date}
                  onChange={(date) => setFormData(prev => ({ ...prev, date: date || new Date() }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Activity (name of meeting or individual)"
                  value={formData.activityName}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
                  fullWidth
                  required
                  multiline
                  rows={3}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    label="Category"
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel># of Hours</InputLabel>
                  <Select
                    value={formData.hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value as number }))}
                    label="# of Hours"
                  >
                    {HOURS_OPTIONS.map((h) => (
                      <MenuItem key={h} value={h}>
                        {h === 0 ? '0' : h.toFixed(2)} hours
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Which of your hospital(s) was this with?</InputLabel>
                  <Select
                    multiple
                    value={formData.hospitalIds}
                    onChange={handleHospitalChange}
                    input={<OutlinedInput label="Which of your hospital(s) was this with?" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((id) => (
                          <Chip key={id} label={normalizeHospitalOrOrgName(hospitals.find(h => h.id === id)?.name) || id} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {hospitals.map((hospital) => (
                      <MenuItem key={hospital.id} value={hospital.id}>
                        <Checkbox checked={formData.hospitalIds.includes(hospital.id)} />
                        <ListItemText primary={normalizeHospitalOrOrgName(hospital.name)} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {hospitals.length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {userRole === UserRole.MANAGER
                      ? 'No managed sites are available yet. Ask an administrator to link your mentors, PECCs, or cohorts.'
                      : <>Add hospitals on the <strong>Hospitals</strong> page first so you can link activities to sites for Site Milestones and reporting.</>}
                  </Typography>
                )}
              </Grid>
              
              {/* Description - for all categories */}
              <Grid item xs={12}>
                <TextField
                  label="Description (outcomes of meetings, next steps, deliverables)"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  fullWidth
                  multiline
                  rows={4}
                />
              </Grid>
              
              {/* Readiness Domain - for all categories */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Which domain(s) of pediatric readiness does this apply to? (select all that apply)</InputLabel>
                  <Select
                    multiple
                    value={formData.readinessDomains}
                    onChange={(e) => setFormData(prev => ({ ...prev, readinessDomains: e.target.value as string[] }))}
                    input={<OutlinedInput label="Which domain(s) of pediatric readiness does this apply to? (select all that apply)" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((domain) => (
                          <Chip key={domain} label={domain} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {READINESS_DOMAINS.map((domain) => (
                      <MenuItem key={domain} value={domain}>
                        <Checkbox checked={formData.readinessDomains.includes(domain)} />
                        <ListItemText primary={domain} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Simulation-specific fields */}
              {formData.category === 'SC' && (
                <>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                      Simulation Details
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Which simulation was it?</InputLabel>
                      <Select
                        value={formData.simulationCase}
                        onChange={(e) => setFormData(prev => ({ ...prev, simulationCase: e.target.value }))}
                        label="Which simulation was it?"
                      >
                        {SIMULATION_CASE_OPTIONS.map((sim) => (
                          <MenuItem key={sim} value={sim}>
                            {sim}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="textSecondary">
                      *If more than one case was conducted, please separate onto the next line
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel># of Sim Participants</InputLabel>
                      <Select
                        value={formData.simParticipants}
                        onChange={(e) => setFormData(prev => ({ ...prev, simParticipants: e.target.value as number }))}
                        label="# of Sim Participants"
                      >
                        {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                          <MenuItem key={n} value={n}>
                            {n}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormLabel component="legend">Facilitator & Participant Feedback Forms Submitted?</FormLabel>
                    <FormGroup row>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.facilitatorFeedbackSubmitted}
                            onChange={(e) => setFormData(prev => ({ ...prev, facilitatorFeedbackSubmitted: e.target.checked }))}
                          />
                        }
                        label="Yes, Facilitator"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.participantFeedbackSubmitted}
                            onChange={(e) => setFormData(prev => ({ ...prev, participantFeedbackSubmitted: e.target.checked }))}
                          />
                        }
                        label="Yes, Participant"
                      />
                    </FormGroup>
                  </Grid>
                </>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">
              {editingActivity ? 'Update' : 'Add'} Activity
            </Button>
          </DialogActions>
        </Dialog>
      </AdminPageShell>
    </LocalizationProvider>
  );

};

export default MentorActivitiesPage;
