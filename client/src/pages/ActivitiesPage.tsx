import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  AppBar,
  Toolbar,
  Fab
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  FilterList as FilterIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import TableChartIcon from '@mui/icons-material/TableChart';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

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
  const { trackClick, trackActivity } = useUsageAnalytics();
  useEffect(() => {
    trackActivity('view');
  }, [trackActivity]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [gapPlans, setGapPlans] = useState<GapPlan[]>([]);
  const [simulationGaps, setSimulationGaps] = useState<any[]>([]);
  const [activityCategories, setActivityCategories] = useState<string[]>(DEFAULT_ACTIVITY_CATEGORIES);
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

  // Load activities from localStorage
  useEffect(() => {
    if (currentUser?.uid) {
      // Load activities
      const savedActivities = localStorage.getItem(`activities_${currentUser.uid}`);
      if (savedActivities) {
        setActivities(JSON.parse(savedActivities));
      }
      
      // Load gap plans for the associated gaps dropdown
      const savedGapPlans = localStorage.getItem(`gapPlans_${currentUser.uid}`);
      if (savedGapPlans) {
        setGapPlans(JSON.parse(savedGapPlans));
      }

      // Load simulation gaps for the associated simulation gaps dropdown
      const savedSimulationGaps = localStorage.getItem(`simulation_gaps_${currentUser.uid}`);
      if (savedSimulationGaps) {
        setSimulationGaps(JSON.parse(savedSimulationGaps));
      }
    }
    
    // Load activity categories from localStorage (managed in Admin Settings)
    const savedCategories = localStorage.getItem('pecc_activity_categories');
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActivityCategories(parsed);
        }
      } catch (e) {
        console.error('Error loading activity categories:', e);
      }
    }
  }, [currentUser]);


  const saveActivities = (newActivities: Activity[]) => {
    try {
      setActivities(newActivities);
      if (currentUser?.uid) {
        // Add timestamps to activities before saving
        const uid = currentUser.uid ?? (currentUser as { id?: string }).id;
        const timestampedActivities = newActivities.map(activity => ({
          ...activity,
          created_at: activity.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          submitted_by: activity.submitted_by ?? uid
        }));
        
        localStorage.setItem(`activities_${currentUser.uid}`, JSON.stringify(timestampedActivities));

        // Update bidirectional linking with simulation gaps
        const simulationGaps = JSON.parse(localStorage.getItem(`simulation_gaps_${currentUser.uid}`) || '[]');
        let gapsUpdated = false;

        timestampedActivities.forEach(activity => {
          if (activity.associatedSimulationGaps && activity.associatedSimulationGaps.length > 0) {
            activity.associatedSimulationGaps.forEach(gapId => {
              const gapIndex = simulationGaps.findIndex((gap: any) => gap.id === gapId);
              if (gapIndex !== -1) {
                const gap = simulationGaps[gapIndex];
                if (!gap.linkedActivities) {
                  gap.linkedActivities = [];
                }
                if (!gap.linkedActivities.includes(activity.id)) {
                  gap.linkedActivities.push(activity.id);
                  gapsUpdated = true;
                }
              }
            });
          }
        });

        // Remove activities from gaps that are no longer linked
        simulationGaps.forEach((gap: any) => {
          if (gap.linkedActivities) {
            const originalLength = gap.linkedActivities.length;
            gap.linkedActivities = gap.linkedActivities.filter((activityId: string) => {
              const activity = timestampedActivities.find(a => a.id === activityId);
              return activity && activity.associatedSimulationGaps && activity.associatedSimulationGaps.includes(gap.id);
            });
            if (gap.linkedActivities.length !== originalLength) {
              gapsUpdated = true;
            }
          }
        });

        if (gapsUpdated) {
          localStorage.setItem(`simulation_gaps_${currentUser.uid}`, JSON.stringify(simulationGaps));
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
        const uid = currentUser?.uid ?? (currentUser as { id?: string })?.id;
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

      // Close dialog and reset form
      handleClose();
      setError(null);
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
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!currentUser) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="text.secondary">
            Please log in to view activities.
          </Typography>
        </Box>
      </Container>
    );
  }

  // Mobile Filter Drawer Component
  const MobileFilterDrawer = () => (
    <Drawer
      anchor="bottom"
      open={mobileFilterOpen}
      onClose={() => setMobileFilterOpen(false)}
      PaperProps={{
        sx: { 
          borderTopLeftRadius: 16, 
          borderTopRightRadius: 16,
          maxHeight: '80vh'
        }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Filters & Sort</Typography>
          <IconButton onClick={() => setMobileFilterOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Date Range</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Category</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Category"
            >
              <MenuItem value="">All Categories</MenuItem>
              <MenuItem value="education">Education</MenuItem>
              <MenuItem value="training">Training</MenuItem>
              <MenuItem value="simulation">Simulation</MenuItem>
              <MenuItem value="quality">Quality Improvement</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Sort By</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="date">Date</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                  <MenuItem value="hours">Hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  label="Order"
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            onClick={clearFilters}
            sx={{ flex: 1 }}
          >
            Clear Filters
          </Button>
          <Button
            variant="contained"
            onClick={() => setMobileFilterOpen(false)}
            sx={{ flex: 1 }}
          >
            Apply Filters
          </Button>
        </Box>
      </Box>
    </Drawer>
  );

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, mt: 3 }}>
        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in activities or notes.
        </Alert>
        {/* Mobile Header */}
        {isMobile ? (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1" color="primary">
                Activities ({activities.length})
              </Typography>
              <IconButton
                onClick={() => setMobileFilterOpen(true)}
                sx={{ bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }}
              >
                <FilterIcon />
              </IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Track your pediatric readiness activities and time spent on various initiatives.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleDialogOpen}
              fullWidth
              sx={{ mb: 2 }}
            >
              ADD ACTIVITY
            </Button>
          </Box>
        ) : (
          /* Desktop Header */
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h3" component="h1" gutterBottom color="primary">
              Activities ({activities.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleDialogOpen}
                sx={{ minWidth: 150 }}
              >
                ADD ACTIVITY
              </Button>
            </Box>
          </Box>
        )}

        {!isMobile && (
          <Typography variant="h6" gutterBottom sx={{ mb: 4, color: 'text.secondary' }}>
            Track your pediatric readiness activities and time spent on various initiatives.
          </Typography>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filters, Sorting, and Export Section - Desktop Only */}
        {!isMobile && (
          <Card sx={{ mb: 3, p: 1.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ mr: 1.5, display: 'flex', alignItems: 'center' }}>
                <FilterIcon sx={{ mr: 0.5 }} />
                Filters & Sorting
              </Typography>
            
            {/* Date Range Filters */}
            <TextField
              label="Start Date"
              type="date"
              value={filterDateStart}
              onChange={(e) => setFilterDateStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ minWidth: 130 }}
            />
            <TextField
              label="End Date"
              type="date"
              value={filterDateEnd}
              onChange={(e) => setFilterDateEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              sx={{ minWidth: 130 }}
            />
            
            {/* Category Filter */}
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={filterCategory}
                label="Category"
                onChange={(e: SelectChangeEvent) => setFilterCategory(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {activityCategories.map(category => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Sort Options */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                label="Sort By"
                onChange={(e: SelectChangeEvent) => setSortBy(e.target.value)}
              >
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
            
            <Button
              variant="outlined"
              onClick={clearFilters}
              size="small"
              sx={{ px: 1.5 }}
            >
              Clear
            </Button>
          </Box>
          
          {/* Export Section */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
              Export:
            </Typography>
            <Button
              variant="outlined"
              startIcon={<TableChartIcon />}
              onClick={exportToExcel}
              sx={{ borderColor: 'success.main', color: 'success.main', '&:hover': { borderColor: 'success.dark', bgcolor: 'success.light' } }}
            >
              Export to Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportToPDF}
              sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
            >
              Export to PDF
            </Button>
          </Box>
        </Card>
        )}

        {/* Results Count */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredAndSortedActivities.length} of {activities.length} activities
          </Typography>
        </Box>

        {/* Activities List */}
        {filteredAndSortedActivities.length === 0 ? (
          <Card sx={{ boxShadow: 2 }}>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {activities.length === 0 ? 'No Activities Yet' : 'No Activities Match Filters'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {activities.length === 0 ? 'Add your first activity to get started.' : 'Try adjusting your filters or date range.'}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 1 : 2 }}>
            {filteredAndSortedActivities.map((activity) => (
              <Card key={activity.id} sx={{
                width: '100%',
                boxShadow: 2,
                border: '1px solid',
                borderColor: 'grey.200',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.3s ease-in-out',
                  borderColor: 'primary.light'
                }
              }}>
                <CardContent sx={{ p: 0 }}>
                  {/* Header Section */}
                  <Box sx={{
                    p: 1.5,
                    pb: 1,
                    backgroundColor: 'grey.50',
                    borderBottom: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 1
                    }}>
                      {/* Left Side - Date, Category, Hours Row */}
                      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mr: 0.5 }}>
                            Date:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                            {formatDate(activity.date)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mr: 0.5 }}>
                            Category:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                            {getActivityCategories(activity).join(', ')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mr: 0.5 }}>
                            Hours:
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                            {activity.hours}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Right Side - Edit Button */}
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(activity)}
                        sx={{ color: 'primary.main' }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Content Section */}
                  <Box sx={{ p: 1.5 }}>
                    {/* Activity Description */}
                    <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.4 }}>
                      {activity.activity}
                    </Typography>

                    {/* Associated PRS Gaps */}
                    {activity.associatedGaps && activity.associatedGaps.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                          Associated PRS Gaps:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {activity.associatedGaps.map((gapId) => {
                            const gapPlan = gapPlans.find(gp => gp.id === gapId);
                            return (
                              <Box key={gapId} sx={{ 
                                p: 1, 
                                bgcolor: 'primary.50', 
                                borderRadius: 1, 
                                border: '1px solid',
                                borderColor: 'primary.200'
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                                  Q{gapPlan ? gapPlan.questionId : gapId}
                                </Typography>
                                {gapPlan && (
                                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                                    {gapPlan.questionText}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}

                    {/* Associated Simulation Gaps */}
                    {activity.associatedSimulationGaps && activity.associatedSimulationGaps.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                          Associated Simulation Gaps:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {activity.associatedSimulationGaps.map((gapId) => {
                            const simulationGap = simulationGaps.find(sg => sg.id === gapId);
                            return (
                              <Box key={gapId} sx={{ 
                                p: 1, 
                                bgcolor: 'warning.50', 
                                borderRadius: 1, 
                                border: '1px solid',
                                borderColor: 'warning.200'
                              }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                                  {simulationGap ? simulationGap.description : gapId}
                                </Typography>
                                {simulationGap && (
                                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                                    {simulationGap.category} • {simulationGap.severity}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}

                    {/* Simulation Details */}
                    {activity.simulation && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                          Simulation Details:
                        </Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                          Type: {activity.simulation}
                          {activity.simulationOther && activity.simulation === 'Other' && ` - ${activity.simulationOther}`}
                          {activity.participants && ` | Participants: ${activity.participants}`}
                        </Typography>
                      </Box>
                    )}

                    {/* Notes */}
                    {activity.notes && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.25 }}>
                          Notes:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', lineHeight: 1.3 }}>
                          {activity.notes}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>

        {/* Add/Edit Activity Dialog */}
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
        <DialogTitle>
          {editingActivity ? 'Edit Activity' : 'Add New Activity'}
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
                            label={gapPlan ? `Q${gapPlan.questionId}` : value}
                            size="small"
                            title={gapPlan ? gapPlan.questionText : value}
                          />
                        );
                      })}
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
                  {gapPlans.map((gapPlan) => (
                    <MenuItem key={gapPlan.id} value={gapPlan.id} sx={{ whiteSpace: 'normal', py: 1.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                          Q{gapPlan.questionId}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                          {gapPlan.questionText}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
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
                      style: {
                        maxHeight: 400,
                        width: 'auto',
                        minWidth: '100%'
                      }
                    }
                  }}
                >
                  {simulationGaps.map((simulationGap) => (
                    <MenuItem key={simulationGap.id} value={simulationGap.id} sx={{ whiteSpace: 'normal', py: 1.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                          {simulationGap.description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
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
      
      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer />
      
      {/* Mobile Floating Action Button */}
      {isMobile && (
        <Fab
          color="primary"
          aria-label="add activity"
          onClick={handleDialogOpen}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Container>
  );
};

export default ActivitiesPage;

