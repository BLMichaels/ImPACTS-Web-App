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
  ExpandLess as ExpandLessIcon
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
  const [editingActivity, setEditingActivity] = useState<MentorActivity | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
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
  }, [activities, categoryFilter, dateFilter, sortField, sortOrder]);

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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">My Activities</Typography>
          <Box>
            <Button
              startIcon={<FilterIcon />}
              onClick={() => setFilterOpen(!filterOpen)}
              sx={{ mr: 2 }}
            >
              Filters
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

        {/* Filters */}
        <Collapse in={filterOpen}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category Filter</InputLabel>
                  <Select
                    multiple
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as string[])}
                    input={<OutlinedInput label="Category Filter" />}
                    renderValue={(selected) => selected.map(s => CATEGORIES.find(c => c.value === s)?.value).join(', ')}
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
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setCategoryFilter([]);
                    setDateFilter({ start: null, end: null });
                  }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Collapse>

        {/* Activities Table */}
        <TableContainer component={Paper}>
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
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="textSecondary" sx={{ py: 4 }}>
                      No activities recorded yet. Click "Add Activity" to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredActivities.map((activity) => (
                  <TableRow key={activity.id}>
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
                    <TableCell>
                      <IconButton size="small" onClick={() => handleEdit(activity)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(activity.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Summary */}
        {activities.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Chip label={`Total Activities: ${filteredActivities.length}`} />
            <Chip label={`Total Hours: ${filteredActivities.reduce((sum, a) => sum + a.hours, 0).toFixed(2)}`} color="primary" />
          </Box>
        )}

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
