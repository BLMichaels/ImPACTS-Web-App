import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
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
  Grid,
  IconButton,
  Container,
  Chip,
  Alert,
  CircularProgress,
  FormGroup,
  FormLabel,
  SelectChangeEvent,
  OutlinedInput,
  useMediaQuery,
  useTheme,
  Drawer,
  Fab,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  alpha,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  FilterList as FilterIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { usePhiGuard, PHI_SCAN_HINT } from '../components/PhiGuard';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { supabase } from '../supabase';
import {
  setUserData,
  migrateFromLocalStorage,
  resolveHospitalUuid,
  writeContinuityData,
  getContinuityData,
} from '../utils/userData';
import { computeWorkHours } from '../utils/snapshotMetrics';
import { GAP_PLANS_UPDATED_EVENT } from './EducationPage';

const sectionShellSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  overflow: 'hidden',
} as const;

interface Activity {
  id: string;
  date: string;
  activity: string;
  /** Single category (legacy); prefer categories when present */
  category?: string;
  /** Multiple categories (current) */
  categories?: string[];
  hours: number;
  simulation?: string;
  simulationOther?: string;
  participants?: number;
  feedbackForms?: string[];
  associatedGaps?: string[]; // Array of gap plan IDs
  associatedSimulationGaps?: string[]; // Array of simulation gap IDs
  notes?: string;
  created_at?: string;
  updated_at?: string;
  last_sync_at?: string;
  submitted_by?: string; // User id who submitted (for shared-site per-person hours)
}

/** Normalize activity to categories array (supports legacy single category) */
function getActivityCategories(a: Activity): string[] {
  if (a.categories && a.categories.length > 0) return a.categories;
  if (a.category) return [a.category];
  return [];
}

interface GapPlan {
  id: string;
  questionId: string;
  questionText: string;
  action: string;
  owner: string;
  status: string;
  priority: string;
  difficulty: string;
  notes: string;
  dueDate: string;
  completionDate: string;
  rank: number | '';
  attachments: any[];
}

// Default PECC categories - will be overridden by localStorage if available
const DEFAULT_ACTIVITY_CATEGORIES = [
  'General Administration Tasks',
  'PECC role education and advancement',
  'Meeting with Pediatric Readiness Mentor',
  'Simulation Case Preparations',
  'Simulation Facilitation',
  'Simulation Debrief & Gap Analysis',
  'Hospital-based Pediatric Educational Activities (NOT including simulation)',
  'Ensuring all Pediatric Policies and Procedures are implemented and updated',
  'Facilitating and participating in ED pediatric QI/PI activities',
  'Collaborative work with PECC counterpart, EMS, or other EDs',
  'Staffing competency evaluations',
  'Promoting pediatric disaster preparedness',
  'Promoting patient and family education in injury prevention',
  'Ensuring equipment, medication, and supplies are available to all ED staff',
  'Ensuring ED staff are prepared to care for all children, including those with special health needs'
];

const SIMULATION_TYPES = [
  'Diabetic Ketoacidosis (DKA)',
  'Bronchiolitis',
  'Asthma',
  'Traumatic Brain Injury',
  'Non-Accidental Trauma',
  'Pediatric Tracheostomy Emergency',
  'Newborn Resuscitation',
  'Postpartum Hemorrhage',
  'A Scald Burn',
  'Agitation',
  'A Seizing Infant',
  'Supraventricular Tachycardia',
  'Blunt Abdominal Trauma',
  'Neonatal Sepsis',
  'A Seizing Child',
  'Pediatric Anaphylaxis',
  'Altered Mental Status',
  'Other'
];

const HOURS_OPTIONS = Array.from({ length: 25 }, (_, i) => i * 0.25);
const PARTICIPANT_OPTIONS = Array.from({ length: 26 }, (_, i) => i);

const ActivitiesPage = () => {
  const { currentUser, loading } = useAuth();
  const { runWithPhiGuard } = usePhiGuard();
  const { effectiveUserId, siteId } = useUserProfile();
  const { trackClick, trackActivity } = useUsageAnalytics();
  useEffect(() => {
    trackActivity('view');
  }, [trackActivity]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [gapPlans, setGapPlans] = useState<GapPlan[]>([]);
  const [simulationGaps, setSimulationGaps] = useState<any[]>([]);
  const [activityCategories, setActivityCategories] = useState<string[]>(DEFAULT_ACTIVITY_CATEGORIES);
  const [educationCategories, setEducationCategories] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    activity: '',
    categories: [] as string[],
    hours: 0,
    simulation: '',
    simulationOther: '',
    participants: 0,
    feedbackForms: [] as string[],
    associatedGaps: [] as string[],
    associatedSimulationGaps: [] as string[],
    notes: ''
  });

  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Mobile-specific state
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [effectiveHospitalId, setEffectiveHospitalId] = useState<string | null>(null);
  const [activitySubmitterById, setActivitySubmitterById] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!siteId) {
        if (mounted) setEffectiveHospitalId(null);
        return;
      }
      const resolved = await resolveHospitalUuid(siteId);
      if (mounted) setEffectiveHospitalId(resolved);
    })();
    return () => {
      mounted = false;
    };
  }, [siteId]);

  // Load activities, gap plans, simulation gaps from Supabase (syncs across devices)
  const userId = effectiveUserId;
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const [activitiesVal, gapPlansVal, simGapsVal, categoriesRes] = await Promise.all([
        getContinuityData<Activity[]>(effectiveHospitalId, userId, 'activities'),
        getContinuityData<GapPlan[]>(effectiveHospitalId, userId, 'gapPlans'),
        getContinuityData<unknown[]>(effectiveHospitalId, userId, 'simulation_gaps'),
        supabase.from('app_settings').select('value').eq('key', 'pecc_activity_categories').maybeSingle(),
      ]);
      if (!mounted) return;
      if (activitiesVal != null && Array.isArray(activitiesVal)) setActivities(activitiesVal);
      else if (!effectiveHospitalId) migrateFromLocalStorage(userId, 'activities', `activities_${userId}`, (v) => setActivities(Array.isArray(v) ? v : []));

      if (gapPlansVal != null && Array.isArray(gapPlansVal)) setGapPlans(gapPlansVal);
      else if (!effectiveHospitalId) migrateFromLocalStorage(userId, 'gapPlans', `gapPlans_${userId}`, (v) => setGapPlans(Array.isArray(v) ? v : []));

      if (simGapsVal != null && Array.isArray(simGapsVal)) setSimulationGaps(simGapsVal);
      else if (!effectiveHospitalId) migrateFromLocalStorage(userId, 'simulation_gaps', `simulation_gaps_${userId}`, (v) => setSimulationGaps(Array.isArray(v) ? v : []));
      const parsed = (categoriesRes.data as { value?: unknown } | null)?.value;
      if (parsed != null && Array.isArray(parsed) && parsed.length > 0) setActivityCategories(parsed as string[]);
    })();
    return () => { mounted = false; };
  }, [userId, effectiveHospitalId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'education_questions').maybeSingle();
      if (!mounted) return;
      const parsed = (data as { value?: unknown } | null)?.value;
      if (parsed != null && Array.isArray(parsed)) {
        const map: Record<string, string> = {};
        (parsed as { questionId?: string; category?: string }[]).forEach((q) => {
          if (q.questionId != null) map[String(q.questionId)] = q.category || '';
        });
        setEducationCategories(map);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Refetch gap plans when they're updated elsewhere (e.g. Gap Plan or Assessment page)
  useEffect(() => {
    if (!userId) return;
    const onGapPlansUpdated = () => {
      const loadGapPlans = () => getContinuityData<GapPlan[]>(effectiveHospitalId, userId, 'gapPlans');
      loadGapPlans().then((v) => {
        if (v != null && Array.isArray(v)) setGapPlans(v);
      });
    };
    window.addEventListener(GAP_PLANS_UPDATED_EVENT, onGapPlansUpdated);
    return () => window.removeEventListener(GAP_PLANS_UPDATED_EVENT, onGapPlansUpdated);
  }, [userId, effectiveHospitalId]);

  // When add/edit activity dialog opens, refetch gap plans and simulation gaps so dropdowns are current
  useEffect(() => {
    if (!open || !userId) return;
    let mounted = true;
    (async () => {
      const [gapPlansVal, simGapsVal] = await Promise.all([
        getContinuityData<GapPlan[]>(effectiveHospitalId, userId, 'gapPlans'),
        getContinuityData<unknown[]>(effectiveHospitalId, userId, 'simulation_gaps'),
      ]);
      if (!mounted) return;
      if (gapPlansVal != null && Array.isArray(gapPlansVal)) setGapPlans(gapPlansVal);
      if (simGapsVal != null && Array.isArray(simGapsVal)) setSimulationGaps(simGapsVal);
    })();
    return () => { mounted = false; };
  }, [open, userId, effectiveHospitalId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const submitterIds = [...new Set(
        activities.map((a) => String(a.submitted_by || '').trim()).filter(Boolean)
      )];
      if (!submitterIds.length) {
        if (!cancelled) setActivitySubmitterById({});
        return;
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', submitterIds);
      if (cancelled || error) return;
      const next: Record<string, string> = {};
      ((data || []) as Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>).forEach((u) => {
        const label = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || String(u.email || u.id);
        next[u.id] = label;
      });
      if (!cancelled) setActivitySubmitterById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [activities]);

  const saveActivities = async (newActivities: Activity[]) => {
    try {
      setActivities(newActivities);
      if (userId) {
        const uid = userId;
        const timestampedActivities = newActivities.map(activity => ({
          ...activity,
          created_at: activity.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          submitted_by: activity.submitted_by ?? uid
        }));
        if (effectiveHospitalId) {
          await writeContinuityData(effectiveHospitalId, userId, 'activities', timestampedActivities);
        } else {
          await setUserData(userId, 'activities', timestampedActivities);
        }

        const simulationGaps = (await getContinuityData<unknown[]>(effectiveHospitalId, userId, 'simulation_gaps')) ?? [];
        let gapsUpdated = false;
        timestampedActivities.forEach(activity => {
          if (activity.associatedSimulationGaps?.length) {
            activity.associatedSimulationGaps.forEach(gapId => {
              const gapIndex = simulationGaps.findIndex((g: any) => g.id === gapId);
              if (gapIndex !== -1) {
                const gap = simulationGaps[gapIndex] as any;
                if (!gap.linkedActivities) gap.linkedActivities = [];
                if (!gap.linkedActivities.includes(activity.id)) {
                  gap.linkedActivities.push(activity.id);
                  gapsUpdated = true;
                }
              }
            });
          }
        });
        (simulationGaps as any[]).forEach((gap: any) => {
          if (gap.linkedActivities) {
            const orig = gap.linkedActivities.length;
            gap.linkedActivities = gap.linkedActivities.filter((activityId: string) => {
              const activity = timestampedActivities.find(a => a.id === activityId);
              return activity?.associatedSimulationGaps?.includes(gap.id);
            });
            if (gap.linkedActivities.length !== orig) gapsUpdated = true;
          }
        });
        if (gapsUpdated) {
          if (effectiveHospitalId) {
            await writeContinuityData(effectiveHospitalId, userId, 'simulation_gaps', simulationGaps);
          } else {
            await setUserData(userId, 'simulation_gaps', simulationGaps);
          }
        }
      }
    } catch (err) {
      console.error('Error saving activities:', err);
      setError('Error saving activities');
    }
  };

  const handleSubmit = () => {
    try {
      const hasCategories = formData.categories && formData.categories.length > 0;
      if (!formData.date || !formData.activity || !hasCategories || formData.hours === undefined || formData.hours === null) {
        setError('Please fill in all required fields (including at least one category)');
        return;
      }

      const isSimulation = formData.categories.includes('Simulation Facilitation');

      void runWithPhiGuard({
        surface: 'activities',
        fieldHint: 'activity/notes',
        texts: [formData.activity, formData.notes, formData.simulationOther],
        onSave: () => {
          if (editingActivity) {
            trackActivity('edit', { activity_id: editingActivity.id, name: formData.activity?.slice(0, 80) });
            const updatedActivity: Activity = {
              ...editingActivity,
              date: formData.date,
              activity: formData.activity,
              categories: formData.categories,
              category: formData.categories[0],
              hours: formData.hours,
              simulation: isSimulation ? formData.simulation : undefined,
              simulationOther: isSimulation && formData.simulation === 'Other' ? formData.simulationOther : undefined,
              participants: isSimulation ? formData.participants : undefined,
              feedbackForms: isSimulation ? formData.feedbackForms : undefined,
              associatedGaps: formData.associatedGaps.length > 0 ? formData.associatedGaps : undefined,
              associatedSimulationGaps: formData.associatedSimulationGaps.length > 0 ? formData.associatedSimulationGaps : undefined,
              notes: formData.notes || undefined
            };
            const updatedActivities = activities.map(activity =>
              activity.id === editingActivity.id ? updatedActivity : activity
            );
            saveActivities(updatedActivities);
          } else {
            trackActivity('create', { name: formData.activity?.slice(0, 80) });
            const uid = userId;
            const newActivity: Activity = {
              id: Date.now().toString(),
              date: formData.date,
              activity: formData.activity,
              categories: formData.categories,
              category: formData.categories[0],
              hours: formData.hours,
              simulation: isSimulation ? formData.simulation : undefined,
              simulationOther: isSimulation && formData.simulation === 'Other' ? formData.simulationOther : undefined,
              participants: isSimulation ? formData.participants : undefined,
              feedbackForms: isSimulation ? formData.feedbackForms : undefined,
              associatedGaps: formData.associatedGaps.length > 0 ? formData.associatedGaps : undefined,
              associatedSimulationGaps: formData.associatedSimulationGaps.length > 0 ? formData.associatedSimulationGaps : undefined,
              notes: formData.notes || undefined,
              submitted_by: uid ?? undefined
            };
            saveActivities([...activities, newActivity]);
          }

          handleClose();
          setError(null);
        },
      });
    } catch (err) {
      console.error('Error submitting activity:', err);
      setError('Error submitting activity');
    }
  };

  const handleEdit = (activity: Activity) => {
    try {
      setEditingActivity(activity);
      setFormData({
        date: activity.date,
        activity: activity.activity,
        categories: getActivityCategories(activity),
        hours: activity.hours,
        simulation: activity.simulation || '',
        simulationOther: activity.simulationOther || '',
        participants: activity.participants || 0,
        feedbackForms: activity.feedbackForms || [],
        associatedGaps: activity.associatedGaps || [],
        associatedSimulationGaps: activity.associatedSimulationGaps || [],
        notes: activity.notes || ''
      });
      handleDialogOpen();
    } catch (err) {
      console.error('Error editing activity:', err);
      setError('Error editing activity');
    }
  };

  const handleDelete = (id: string) => {
    try {
      trackActivity('delete', { activity_id: id });
      const updatedActivities = activities.filter(activity => activity.id !== id);
      saveActivities(updatedActivities);
    } catch (err) {
      console.error('Error deleting activity:', err);
      setError('Error deleting activity');
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingActivity(null);
    setError(null);
    // Reset form after dialog closes to ensure clean state
    setTimeout(() => {
      setFormData({
        date: '',
        activity: '',
        categories: [],
        hours: 0,
        simulation: '',
        simulationOther: '',
        participants: 0,
        feedbackForms: [],
        associatedGaps: [],
        associatedSimulationGaps: [],
        notes: ''
      });
    }, 100);
  };

  const handleDialogOpen = () => {
    trackClick?.('Add Activity');
    setOpen(true);
    // Prevent root from getting aria-hidden
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root) {
        root.removeAttribute('aria-hidden');
      }
    }, 0);
  };

  const handleFeedbackFormChange = (formType: string) => {
    setFormData(prev => ({
      ...prev,
      feedbackForms: prev.feedbackForms.includes(formType)
        ? prev.feedbackForms.filter(form => form !== formType)
        : [...prev.feedbackForms, formType]
    }));
  };

  const handleAssociatedGapsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setFormData(prev => ({
      ...prev,
      associatedGaps: typeof value === 'string' ? value.split(',') : value
    }));
  };

  const isSimulationCategory = formData.categories.includes('Simulation Facilitation');

  // Filter and sort activities
  const filteredAndSortedActivities = activities
    .filter(activity => {
      if (filterDateStart && activity.date < filterDateStart) return false;
      if (filterDateEnd && activity.date > filterDateEnd) return false;
      if (filterCategory && !getActivityCategories(activity).includes(filterCategory)) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          // Compare date strings directly to avoid timezone issues
          comparison = a.date.localeCompare(b.date);
          break;
        case 'category':
          comparison = (getActivityCategories(a).join(', ') || '').localeCompare(getActivityCategories(b).join(', ') || '');
          break;
        case 'hours':
          comparison = a.hours - b.hours;
          break;
        case 'activity':
          comparison = a.activity.localeCompare(b.activity);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const workHours = useMemo(() => computeWorkHours(activities), [activities]);
  const categoryStats = useMemo(() => {
    const stats = new Map<string, { count: number; hours: number }>();
    activities.forEach((activity) => {
      const cats = getActivityCategories(activity);
      const list = cats.length > 0 ? cats : ['Uncategorized'];
      list.forEach((category) => {
        const current = stats.get(category) || { count: 0, hours: 0 };
        current.count += 1;
        current.hours += Number(activity.hours) || 0;
        stats.set(category, current);
      });
    });
    return [...stats.entries()]
      .map(([label, value]) => ({ label, count: value.count, hours: value.hours }))
      .sort((a, b) => b.hours - a.hours || b.count - a.count);
  }, [activities]);
  const filteredHours = useMemo(
    () => filteredAndSortedActivities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0),
    [filteredAndSortedActivities]
  );

  const clearFilters = () => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterCategory('');
    setSortBy('date');
    setSortOrder('desc');
  };

  const formatDate = (dateString: string) => {
    try {
      // Parse date string directly to avoid timezone issues
      const [year, month, day] = dateString.split('-');
      return `${month}/${day}/${year}`;
    } catch (err) {
      return dateString;
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = filteredAndSortedActivities.map(activity => ({
        Date: formatDate(activity.date),
        Activity: activity.activity,
        SubmittedBy: activity.submitted_by ? (activitySubmitterById[activity.submitted_by] || activity.submitted_by) : '',
        Category: getActivityCategories(activity).join('; '),
        Hours: activity.hours,
        Simulation: activity.simulation || '',
        Participants: activity.participants || '',
        AssociatedGaps: activity.associatedGaps ? activity.associatedGaps.join(', ') : '',
        AssociatedSimulationGaps: activity.associatedSimulationGaps ? activity.associatedSimulationGaps.join(', ') : '',
        Notes: activity.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Activities');
      XLSX.writeFile(wb, `activities_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setError('Error exporting to Excel');
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Title
      doc.setFontSize(18);
      doc.text('Activities Report', 20, yPos);
      yPos += 20;

      // Date range
      doc.setFontSize(12);
      const startDate = filterDateStart ? formatDate(filterDateStart) : 'All time';
      const endDate = filterDateEnd ? formatDate(filterDateEnd) : 'All time';
      doc.text(`Date Range: ${startDate} to ${endDate}`, 20, yPos);
      yPos += 15;

      // Activities
      doc.setFontSize(10);
      filteredAndSortedActivities.forEach((activity, index) => {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(12);
        doc.text(`${index + 1}. ${activity.activity}`, 20, yPos);
        yPos += 8;

        doc.setFontSize(10);
        doc.text(`Date: ${formatDate(activity.date)} | Category: ${getActivityCategories(activity).join(', ')} | Hours: ${activity.hours}`, 20, yPos);
        yPos += 8;
        if (activity.submitted_by) {
          doc.text(`Entered by: ${activitySubmitterById[activity.submitted_by] || activity.submitted_by}`, 20, yPos);
          yPos += 8;
        }

        if (activity.simulation) {
          doc.text(`Simulation: ${activity.simulation}`, 20, yPos);
          yPos += 8;
        }

        if (activity.associatedGaps && activity.associatedGaps.length > 0) {
          const gapText = `Associated PRS Gaps: ${activity.associatedGaps.join(', ')}`;
          doc.text(gapText, 20, yPos);
          yPos += 8;
        }

        if (activity.associatedSimulationGaps && activity.associatedSimulationGaps.length > 0) {
          const simulationGapText = `Associated Simulation Gaps: ${activity.associatedSimulationGaps.join(', ')}`;
          doc.text(simulationGapText, 20, yPos);
          yPos += 8;
        }

        if (activity.notes) {
          doc.text(`Notes: ${activity.notes}`, 20, yPos);
          yPos += 8;
        }

        yPos += 5;
      });

      doc.save(`activities_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Error exporting to PDF:', err);
      setError('Error exporting to PDF');
    }
  };

  if (loading) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
        <Typography variant="h6" color="text.secondary">
          Please log in to view activities.
        </Typography>
      </Box>
    );
  }

  const filterControls = (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.25,
        alignItems: 'center',
      }}
    >
      <TextField
        label="Start date"
        type="date"
        value={filterDateStart}
        onChange={(e) => setFilterDateStart(e.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
        sx={{ minWidth: 140 }}
      />
      <TextField
        label="End date"
        type="date"
        value={filterDateEnd}
        onChange={(e) => setFilterDateEnd(e.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
        sx={{ minWidth: 140 }}
      />
      <FormControl size="small" sx={{ minWidth: 200, maxWidth: 320, flex: '1 1 200px' }}>
        <InputLabel>Category</InputLabel>
        <Select
          value={filterCategory}
          label="Category"
          onChange={(e: SelectChangeEvent) => setFilterCategory(e.target.value)}
        >
          <MenuItem value="">All categories</MenuItem>
          {activityCategories.map((category) => (
            <MenuItem key={category} value={category}>
              {category}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>Sort by</InputLabel>
        <Select value={sortBy} label="Sort by" onChange={(e: SelectChangeEvent) => setSortBy(e.target.value)}>
          <MenuItem value="date">Date</MenuItem>
          <MenuItem value="category">Category</MenuItem>
          <MenuItem value="hours">Hours</MenuItem>
          <MenuItem value="activity">Activity</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Order</InputLabel>
        <Select
          value={sortOrder}
          label="Order"
          onChange={(e: SelectChangeEvent) => setSortOrder(e.target.value as 'asc' | 'desc')}
        >
          <MenuItem value="asc">Asc</MenuItem>
          <MenuItem value="desc">Desc</MenuItem>
        </Select>
      </FormControl>
      <Button variant="outlined" size="small" onClick={clearFilters}>
        Clear
      </Button>
    </Box>
  );

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 10, md: 5 } }}>
      <Container
        maxWidth={false}
        sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4, lg: 5 }, width: '100%' }}
      >
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Alert severity="info" variant="outlined" icon={false} sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.04) }}>
            <strong>No PHI.</strong> Do not include Protected Health Information or real patient data in activities or
            notes. {PHI_SCAN_HINT}
          </Alert>

          {/* Hero */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.75 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: (t) =>
                `linear-gradient(120deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, ${t.palette.background.paper} 42%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ maxWidth: { md: 640 } }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
                >
                  PECC work log
                </Typography>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: -0.02,
                    mb: 0.75,
                    fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
                  }}
                >
                  Activities
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: { xs: '0.925rem', sm: '0.975rem' } }}>
                  Log readiness work, time, and linked gaps. Hours and categories here roll up on Snapshot.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                {isMobile && (
                  <IconButton
                    onClick={() => setMobileFilterOpen(true)}
                    aria-label="Open filters"
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      color: 'secondary.dark',
                    }}
                  >
                    <FilterIcon />
                  </IconButton>
                )}
                <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={exportToExcel}>
                  Excel
                </Button>
                <Button size="small" variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={exportToPDF}>
                  PDF
                </Button>
                {!isMobile && (
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      trackClick('Add Activity');
                      handleDialogOpen();
                    }}
                  >
                    Add activity
                  </Button>
                )}
              </Stack>
            </Box>
          </Paper>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Metrics — same rollups as Snapshot */}
          <Paper elevation={0} sx={sectionShellSx}>
            <Box
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.secondary.main, 0.04),
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
              >
                At a glance
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Same hour totals that appear on Snapshot · {activities.length} activit
                {activities.length === 1 ? 'y' : 'ies'} logged
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
                '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
              }}
            >
              {[
                { label: 'This month', value: `${Number(workHours.thisMonthHours).toFixed(1)}h` },
                { label: 'Last month', value: `${Number(workHours.lastMonthHours).toFixed(1)}h` },
                { label: 'This year', value: `${Number(workHours.thisYearHours).toFixed(1)}h` },
                { label: 'Total hours', value: `${Number(workHours.totalHours).toFixed(1)}h` },
                { label: 'Activities', value: String(activities.length) },
              ].map((item) => (
                <Box key={item.label} sx={{ px: { xs: 1.75, md: 2 }, py: 1.75 }}>
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
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Category summary + filters */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: categoryStats.length > 0 ? 'minmax(0, 1fr) minmax(0, 1.4fr)' : '1fr' },
              gap: 2,
              width: '100%',
            }}
          >
            {categoryStats.length > 0 && (
              <Paper elevation={0} sx={{ ...sectionShellSx, minWidth: 0 }}>
                <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                  >
                    By category
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hours invested across readiness work
                  </Typography>
                </Box>
                <TableContainer sx={{ maxHeight: 280 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow
                        sx={{
                          '& th': {
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                            bgcolor: alpha(theme.palette.primary.main, 0.03),
                          },
                        }}
                      >
                        <TableCell>Category</TableCell>
                        <TableCell align="right">#</TableCell>
                        <TableCell align="right">Hours</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {categoryStats.slice(0, 8).map((row) => (
                        <TableRow
                          key={row.label}
                          hover
                          onClick={() => setFilterCategory(row.label)}
                          sx={{ cursor: 'pointer', '& td': { borderBottomColor: 'divider' } }}
                        >
                          <TableCell sx={{ fontSize: '0.8125rem' }}>
                            <Tooltip title="Filter list by this category">
                              <span>{row.label}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {row.count}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'secondary.dark' }}>
                            {row.hours.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {categoryStats.length > 8 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1 }}>
                    Showing top 8 of {categoryStats.length} categories
                  </Typography>
                )}
              </Paper>
            )}

            <Paper elevation={0} sx={{ ...sectionShellSx, minWidth: 0 }}>
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                  >
                    Filters
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Showing {filteredAndSortedActivities.length} of {activities.length}
                    {filteredAndSortedActivities.length !== activities.length
                      ? ` · ${filteredHours.toFixed(1)}h in view`
                      : ''}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
                {!isMobile ? (
                  filterControls
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Use the filter button above to refine date, category, and sort.
                    {filterCategory ? (
                      <>
                        {' '}
                        Active category: <strong>{filterCategory}</strong>
                      </>
                    ) : null}
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>

          {/* Activity log table */}
          <Paper elevation={0} sx={sectionShellSx}>
            <Box
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                >
                  Activity log
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: '1.1rem' }}>
                  Logged work
                </Typography>
              </Box>
              {isMobile && (
                <Button size="small" variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleDialogOpen}>
                  Add
                </Button>
              )}
            </Box>

            {filteredAndSortedActivities.length === 0 ? (
              <Box sx={{ px: { xs: 2, md: 2.5 }, py: 4, textAlign: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {activities.length === 0 ? 'No activities yet' : 'No activities match filters'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {activities.length === 0
                    ? 'Add your first activity to start tracking PECC time.'
                    : 'Try adjusting your filters or date range.'}
                </Typography>
                {activities.length === 0 && (
                  <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleDialogOpen}>
                    Add activity
                  </Button>
                )}
              </Box>
            ) : (
              <TableContainer>
                <Table size="small" aria-label="Activities log">
                  <TableHead>
                    <TableRow
                      sx={{
                        '& th': {
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          letterSpacing: 0.04,
                          color: 'text.secondary',
                          textTransform: 'uppercase',
                          borderBottomColor: 'divider',
                          py: 1.1,
                          bgcolor: alpha(theme.palette.primary.main, 0.03),
                          whiteSpace: 'nowrap',
                        },
                      }}
                    >
                      <TableCell>Date</TableCell>
                      <TableCell>Activity</TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Categories</TableCell>
                      <TableCell align="right">Hours</TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Links</TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Entered by</TableCell>
                      <TableCell align="right" sx={{ width: 56 }}>
                        Edit
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAndSortedActivities.map((activity) => {
                      const cats = getActivityCategories(activity);
                      const gapCount =
                        (activity.associatedGaps?.length || 0) + (activity.associatedSimulationGaps?.length || 0);
                      return (
                        <TableRow
                          key={activity.id}
                          hover
                          sx={{
                            '& td': { borderBottomColor: 'divider', verticalAlign: 'top', py: 1.15 },
                            cursor: 'pointer',
                          }}
                          onClick={() => handleEdit(activity)}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem' }}>
                            {formatDate(activity.date)}
                          </TableCell>
                          <TableCell sx={{ minWidth: 180, maxWidth: 420 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                              {activity.activity}
                            </Typography>
                            {activity.notes ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  mt: 0.25,
                                }}
                              >
                                {activity.notes}
                              </Typography>
                            ) : null}
                            {activity.simulation ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                Sim: {activity.simulation}
                                {activity.participants ? ` · ${activity.participants} participants` : ''}
                              </Typography>
                            ) : null}
                            <Stack
                              direction="row"
                              spacing={0.5}
                              flexWrap="wrap"
                              useFlexGap
                              sx={{ mt: 0.75, display: { xs: 'flex', md: 'none' } }}
                            >
                              {cats.slice(0, 2).map((c) => (
                                <Chip key={c} label={c} size="small" variant="outlined" sx={{ maxWidth: 160, height: 22, fontSize: '0.65rem' }} />
                              ))}
                              {cats.length > 2 ? (
                                <Chip label={`+${cats.length - 2}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.65rem' }} />
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' }, maxWidth: 280 }}>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {cats.slice(0, 3).map((c) => (
                                <Chip
                                  key={c}
                                  label={c}
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilterCategory(c);
                                  }}
                                  sx={{ maxWidth: 200, height: 24, fontSize: '0.7rem' }}
                                />
                              ))}
                              {cats.length > 3 ? (
                                <Chip label={`+${cats.length - 3}`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.7rem' }} />
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'secondary.dark' }}>
                            {activity.hours}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                            {gapCount > 0 ? (
                              <Chip
                                size="small"
                                color="secondary"
                                variant="outlined"
                                label={`${gapCount} gap${gapCount === 1 ? '' : 's'}`}
                                sx={{ height: 24, fontWeight: 600 }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, fontSize: '0.8125rem', color: 'text.secondary' }}>
                            {activity.submitted_by
                              ? activitySubmitterById[activity.submitted_by] || activity.submitted_by
                              : '—'}
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <IconButton size="small" onClick={() => handleEdit(activity)} aria-label="Edit activity" color="secondary">
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>

        <Dialog 
                  open={open} 
                  onClose={handleClose} 
                  maxWidth="md" 
                  fullWidth 
                  disablePortal
                  disableEnforceFocus
                  disableAutoFocus
                  disableRestoreFocus
                  hideBackdrop={false}
                >
                <DialogTitle sx={{ fontWeight: 700, letterSpacing: -0.01, color: 'secondary.dark' }}>
                  {editingActivity ? 'Edit activity' : 'Add activity'}
                </DialogTitle>
                <DialogContent>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Hours</InputLabel>
                        <Select
                          value={formData.hours}
                          label="Hours"
                          onChange={(e) => setFormData({ ...formData, hours: e.target.value as number })}
                        >
                          {HOURS_OPTIONS.map(hour => (
                            <MenuItem key={hour} value={hour}>
                              {hour}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Activity"
                        value={formData.activity}
                        onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                        multiline
                        rows={2}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Categories</InputLabel>
                        <Select
                          multiple
                          value={formData.categories}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              categories: typeof value === 'string' ? value.split(',') : value
                            }));
                          }}
                          input={<OutlinedInput label="Categories" />}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(selected as string[]).map((cat) => (
                                <Chip key={cat} label={cat} size="small" />
                              ))}
                            </Box>
                          )}
                          MenuProps={{
                            PaperProps: {
                              style: {
                                maxHeight: 400,
                                width: 'auto',
                                minWidth: '100%'
                              }
                            }
                          }}
                        >
                          {activityCategories.map(category => (
                            <MenuItem key={category} value={category} sx={{ whiteSpace: 'normal', py: 1 }}>
                              {category}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Associated Gaps Field */}
                    <Grid item xs={12}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Associated Gaps</InputLabel>
                        <Select
                          multiple
                          value={formData.associatedGaps}
                          onChange={handleAssociatedGapsChange}
                          input={<OutlinedInput label="Associated Gaps" />}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((value) => {
                                const gapPlan = gapPlans.find(gp => gp.id === value);
                                return (
                                  <Chip
                                    key={value}
                                    label={gapPlan ? (educationCategories[gapPlan.questionId]?.trim() || `Q${gapPlan.questionId}`) : value}
                                    size="small"
                                    title={gapPlan ? `Question #${gapPlan.questionId}` : value}
                                  />
                                );
                              })}
                            </Box>
                          )}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                maxHeight: 400,
                                width: 'auto',
                                minWidth: 220,
                                maxWidth: 'min(380px, 90vw)'
                              }
                            }
                          }}
                        >
                          {gapPlans.map((gapPlan) => {
                            const category = educationCategories[gapPlan.questionId]?.trim() || `Q${gapPlan.questionId}`;
                            return (
                              <MenuItem key={gapPlan.id} value={gapPlan.id} sx={{ py: 0.5, minHeight: 36 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                    {category}
                                  </Typography>
                                  <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                    Question #{gapPlan.questionId}
                                  </Typography>
                                </Box>
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Associated Simulation Gaps Field */}
                    <Grid item xs={12}>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Associated Gaps from Simulation</InputLabel>
                        <Select
                          multiple
                          value={formData.associatedSimulationGaps}
                          onChange={(e) => {
                            const value = e.target.value;
                            setFormData(prev => ({
                              ...prev,
                              associatedSimulationGaps: typeof value === 'string' ? value.split(',') : value
                            }));
                          }}
                          input={<OutlinedInput label="Associated Gaps from Simulation" />}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((value) => {
                                const simulationGap = simulationGaps.find(sg => sg.id === value);
                                return (
                                  <Chip
                                    key={value}
                                    label={simulationGap ? simulationGap.description : value}
                                    size="small"
                                    color="warning"
                                    title={simulationGap ? `${simulationGap.category} • ${simulationGap.severity}` : value}
                                  />
                                );
                              })}
                            </Box>
                          )}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                maxHeight: 400,
                                width: 'auto',
                                minWidth: 220,
                                maxWidth: 'min(380px, 90vw)'
                              }
                            }
                          }}
                        >
                          {simulationGaps.map((simulationGap) => (
                            <MenuItem key={simulationGap.id} value={simulationGap.id} sx={{ py: 0.5, minHeight: 36 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                                  {simulationGap.description}
                                </Typography>
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                  {simulationGap.category} • {simulationGap.severity}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Simulation-specific fields - only show if category is "Simulation Facilitation" */}
                    {isSimulationCategory && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Which simulation was it?</InputLabel>
                            <Select
                              value={formData.simulation}
                              label="Which simulation was it?"
                              onChange={(e) => setFormData({ ...formData, simulation: e.target.value })}
                            >
                              {SIMULATION_TYPES.map(sim => (
                                <MenuItem key={sim} value={sim}>
                                  {sim}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        {formData.simulation === 'Other' && (
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Specify simulation type"
                              value={formData.simulationOther}
                              onChange={(e) => setFormData({ ...formData, simulationOther: e.target.value })}
                              sx={{ mb: 2 }}
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel># of Simulation Participants</InputLabel>
                            <Select
                              value={formData.participants}
                              label="# of Simulation Participants"
                              onChange={(e) => setFormData({ ...formData, participants: e.target.value as number })}
                            >
                              {PARTICIPANT_OPTIONS.map(num => (
                                <MenuItem key={num} value={num}>
                                  {num}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                          <FormControl component="fieldset" sx={{ mb: 2 }}>
                            <FormLabel component="legend">Feedback Forms</FormLabel>
                            <FormGroup>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={formData.feedbackForms.includes('Facilitator Feedback Form')}
                                    onChange={() => handleFeedbackFormChange('Facilitator Feedback Form')}
                                  />
                                }
                                label="Facilitator Feedback Form"
                              />
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={formData.feedbackForms.includes('Participant Feedback Form')}
                                    onChange={() => handleFeedbackFormChange('Participant Feedback Form')}
                                  />
                                }
                                label="Participant Feedback Form"
                              />
                            </FormGroup>
                          </FormControl>
                        </Grid>
                      </>
                    )}

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        multiline
                        rows={3}
                        sx={{ mb: 2 }}
                      />
                    </Grid>
                  </Grid>
                </DialogContent>
                <DialogActions>
                  {editingActivity && (
                    <Button 
                      onClick={() => handleDelete(editingActivity.id)} 
                      color="error" 
                      variant="outlined"
                      sx={{ mr: 'auto' }}
                    >
                      Delete
                    </Button>
                  )}
                  <Button onClick={handleClose}>Cancel</Button>
                  <Button onClick={handleSubmit} variant="contained">
                    {editingActivity ? 'Update' : 'Add'}
                  </Button>
                </DialogActions>
              </Dialog>

      </Container>

      <Drawer
        anchor="bottom"
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80vh',
          },
        }}
      >
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Filters &amp; sort
            </Typography>
            <IconButton onClick={() => setMobileFilterOpen(false)} aria-label="Close filters">
              <CloseIcon />
            </IconButton>
          </Box>
          {filterControls}
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            sx={{ mt: 2 }}
            onClick={() => setMobileFilterOpen(false)}
          >
            Done
          </Button>
        </Box>
      </Drawer>

      {isMobile && (
        <Fab
          color="secondary"
          aria-label="add activity"
          onClick={handleDialogOpen}
          sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default ActivitiesPage;

