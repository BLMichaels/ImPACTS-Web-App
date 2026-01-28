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
  IconButton,
  Alert,
  Grid,
  Collapse,
  FormLabel,
  OutlinedInput,
  ListItemText,
  SelectChangeEvent
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

// Activity categories with labels
const CATEGORIES = [
  { value: 'PE', label: 'PE - PRISM Education & Training' },
  { value: 'TR', label: 'TR - Training with PECC' },
  { value: 'AD', label: 'AD - General Administration Tasks' },
  { value: 'RA', label: 'RA - Readiness Assessment' },
  { value: 'SC', label: 'SC - Simulation Case Facilitation' },
  { value: 'DM', label: 'DM - Domain Implementation' }
];

// Simulation cases
const SIMULATION_CASES = [
  'Bronchiolitis/Respiratory Distress',
  'Severe Head Trauma',
  'Asthma/Child with a Wheeze',
  'Newborn Resuscitation',
  'Postpartum Hemorrhage',
  'Scald Burn',
  'Agitation',
  'Vomiting Infant',
  'Fussy Baby',
  'Pediatric Trauma/Abdominal',
  'Sick Neonate',
  'Seizing Infant',
  'Seizing Child',
  'Anaphylaxis',
  'Altered Mental Status',
  'Other'
];

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
  readinessDomain?: string; // Domain of pediatric readiness
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
  
  // State
  const [activities, setActivities] = useState<MentorActivity[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [viewingActivity, setViewingActivity] = useState<MentorActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<MentorActivity | null>(null);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [hospitalFilter, setHospitalFilter] = useState<string[]>([]);
  const [readinessDomainFilter, setReadinessDomainFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  
  // Form state
  const [formData, setFormData] = useState({
    date: new Date(),
    activityName: '',
    category: '',
    hours: 0,
    description: '',
    hospitalIds: [] as string[],
    readinessDomain: '',
    simulationCase: '',
    simParticipants: 1,
    facilitatorFeedbackSubmitted: false,
    participantFeedbackSubmitted: false
  });
  
  const [error, setError] = useState<string | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    if (currentUser) {
      const savedActivities = localStorage.getItem(`mentorActivities_${currentUser.id}`);
      if (savedActivities) {
        setActivities(JSON.parse(savedActivities));
      }
      
      // Load hospitals from localStorage or Supabase assignments; start empty if none
      const savedHospitals = localStorage.getItem(`mentorHospitals_${currentUser.id}`);
      if (savedHospitals) {
        setHospitals(JSON.parse(savedHospitals));
      } else {
        setHospitals([]);
      }
    }
  }, [currentUser]);

  // Save activities to localStorage
  const saveActivities = (newActivities: MentorActivity[]) => {
    if (currentUser) {
      localStorage.setItem(`mentorActivities_${currentUser.id}`, JSON.stringify(newActivities));
    }
    setActivities(newActivities);
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
        a.readinessDomain && readinessDomainFilter.includes(a.readinessDomain)
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
  }, [activities, categoryFilter, hospitalFilter, readinessDomainFilter, dateFilter, sortField, sortOrder]);

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
      readinessDomain: '',
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
      readinessDomain: activity.readinessDomain || '',
      simulationCase: activity.simulationCase || '',
      simParticipants: activity.simParticipants || 1,
      facilitatorFeedbackSubmitted: activity.facilitatorFeedbackSubmitted,
      participantFeedbackSubmitted: activity.participantFeedbackSubmitted
    });
    setError(null);
    setDialogOpen(true);
  };

  // Delete activity
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this activity?')) {
      const newActivities = activities.filter(a => a.id !== id);
      saveActivities(newActivities);
    }
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
      readinessDomain: formData.hospitalIds.length > 0 && formData.readinessDomain ? formData.readinessDomain : undefined,
      simulationCase: formData.category === 'SC' ? formData.simulationCase : null,
      simParticipants: formData.category === 'SC' ? formData.simParticipants : null,
      facilitatorFeedbackSubmitted: formData.category === 'SC' ? formData.facilitatorFeedbackSubmitted : false,
      participantFeedbackSubmitted: formData.category === 'SC' ? formData.participantFeedbackSubmitted : false,
      createdAt: editingActivity?.createdAt || new Date().toISOString()
    };

    let newActivities: MentorActivity[];
    if (editingActivity) {
      newActivities = activities.map(a => a.id === editingActivity.id ? activityData : a);
    } else {
      newActivities = [...activities, activityData];
    }
    
    // Sort by date (newest first)
    newActivities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    saveActivities(newActivities);
    setError(null);
    setDialogOpen(false);
    
    // Reset form after a brief delay to ensure state updates
    setTimeout(() => {
      setFormData({
        date: new Date(),
        activityName: '',
        category: '',
        hours: 0,
        description: '',
        hospitalIds: [],
        readinessDomain: '',
        simulationCase: '',
        simParticipants: 1,
        facilitatorFeedbackSubmitted: false,
        participantFeedbackSubmitted: false
      });
    }, 100);
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
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  // Get hospital names
  const getHospitalNames = (ids: string[]) => {
    return ids.map(id => hospitals.find(h => h.id === id)?.name || id).join(', ');
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
    const headers = ['Date', 'Activity', 'Category', 'Description', 'Hours', 'Hospitals', 'Readiness Domain', 'Simulation Case', 'Participants'];
    const rows = filteredActivities.map(activity => [
      format(parseISO(activity.date), 'yyyy-MM-dd'),
      activity.activityName,
      getCategoryLabel(activity.category),
      activity.description || '',
      activity.hours.toString(),
      activity.hospitalIds.length > 0 ? getHospitalNames(activity.hospitalIds) : '',
      activity.readinessDomain || '',
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
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">My Activities</Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportCSV}
              sx={{ mr: 2 }}
            >
              Export CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddNew}
            >
              Add Activity
            </Button>
          </Box>
        </Box>

        {/* Summary Statistics */}
        {activities.length > 0 && (
          <Paper sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Summary</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>This Month</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {stats.thisMonth.count}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {stats.thisMonth.count === 1 ? 'activity' : 'activities'}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {stats.thisMonth.hours.toFixed(2)} hours
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>This Year</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {stats.thisYear.count}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {stats.thisYear.count === 1 ? 'activity' : 'activities'}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {stats.thisYear.hours.toFixed(2)} hours
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 2, minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>All Time</Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {stats.allTime.count}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {stats.allTime.count === 1 ? 'activity' : 'activities'}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {stats.allTime.hours.toFixed(2)} hours
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Filters - Always Visible */}
        <Paper sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Filters</Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setCategoryFilter([]);
                setHospitalFilter([]);
                setReadinessDomainFilter([]);
                setDateFilter({ start: null, end: null });
              }}
            >
              Clear All
            </Button>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  multiple
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as string[])}
                  input={<OutlinedInput label="Category" />}
                  renderValue={(selected) => selected.length > 0 ? `${selected.length} selected` : 'All'}
                >
                  {CATEGORIES.map((cat) => (
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
                  renderValue={(selected) => selected.length > 0 ? `${selected.length} selected` : 'All'}
                >
                  {hospitals.map((hospital) => (
                    <MenuItem key={hospital.id} value={hospital.id}>
                      <Checkbox checked={hospitalFilter.includes(hospital.id)} />
                      <ListItemText primary={hospital.name} />
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
                  renderValue={(selected) => selected.length > 0 ? `${selected.length} selected` : 'All'}
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
              <DatePicker
                label="Start Date"
                value={dateFilter.start}
                onChange={(date) => setDateFilter(prev => ({ ...prev, start: date }))}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <DatePicker
                label="End Date"
                value={dateFilter.end}
                onChange={(date) => setDateFilter(prev => ({ ...prev, end: date }))}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Activities Table */}
        <TableContainer component={Paper} sx={{ maxHeight: 600, overflow: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'date'}
                    direction={sortField === 'date' ? sortOrder : 'asc'}
                    onClick={() => handleSort('date')}
                  >
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'activityName'}
                    direction={sortField === 'activityName' ? sortOrder : 'asc'}
                    onClick={() => handleSort('activityName')}
                  >
                    Activity
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'category'}
                    direction={sortField === 'category' ? sortOrder : 'asc'}
                    onClick={() => handleSort('category')}
                  >
                    Category
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortField === 'hours'}
                    direction={sortField === 'hours' ? sortOrder : 'asc'}
                    onClick={() => handleSort('hours')}
                  >
                    Hours
                  </TableSortLabel>
                </TableCell>
                <TableCell>Hospitals</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="textSecondary" sx={{ py: 4 }}>
                      No activities recorded yet. Click "Add Activity" to get started.
                    </Typography>
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
                        backgroundColor: 'action.hover' 
                      }
                    }}
                  >
                    <TableCell>{format(parseISO(activity.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {activity.activityName}
                      {activity.category === 'SC' && activity.simulationCase && (
                        <Typography variant="caption" display="block" color="textSecondary">
                          Sim: {activity.simulationCase}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={activity.category} 
                        size="small" 
                        color={activity.category === 'SC' ? 'secondary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{activity.hours}</TableCell>
                    <TableCell>
                      {activity.hospitalIds.length > 0 
                        ? getHospitalNames(activity.hospitalIds)
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

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
                    color={viewingActivity.category === 'SC' ? 'secondary' : 'default'}
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
                {viewingActivity.readinessDomain && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary">Domain of Pediatric Readiness</Typography>
                    <Typography>{viewingActivity.readinessDomain}</Typography>
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
            setError(null);
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
                    {CATEGORIES.map((cat) => (
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
                          <Chip key={id} label={hospitals.find(h => h.id === id)?.name || id} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {hospitals.map((hospital) => (
                      <MenuItem key={hospital.id} value={hospital.id}>
                        <Checkbox checked={formData.hospitalIds.includes(hospital.id)} />
                        <ListItemText primary={hospital.name} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
              
              {/* Readiness Domain - only shown when hospitals are selected */}
              {formData.hospitalIds.length > 0 && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Which domain of pediatric readiness does this apply to? *only for activities with hospital PECCs</InputLabel>
                    <Select
                      value={formData.readinessDomain}
                      onChange={(e) => setFormData(prev => ({ ...prev, readinessDomain: e.target.value }))}
                      label="Which domain of pediatric readiness does this apply to? *only for activities with hospital PECCs"
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {READINESS_DOMAINS.map((domain) => (
                        <MenuItem key={domain} value={domain}>
                          {domain}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
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
                        {SIMULATION_CASES.map((sim) => (
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
      </Box>
    </LocalizationProvider>
  );
};

export default MentorActivitiesPage;
