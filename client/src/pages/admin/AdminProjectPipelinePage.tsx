import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  IconButton,
  Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

// SimBox status options
const SIMBOX_STATUSES = [
  'Unable to Start',
  'Not Started',
  'Started',
  'Ongoing',
  'Complete',
  'Needs Updating'
];

// SimBox Case Development Stage options
const SIMBOX_DEVELOPMENT_STAGES = [
  'Intake Form Received',
  'Meeting with External Stakeholder Group',
  'Prioritization Meeting (internal or external)',
  'If Needed, Confirming Simulation Case Objectives (could be done in prior meeting)',
  'Case Role Assignment & Planning Session',
  'Building Case Booklet',
  'Infographic Creation',
  'Brief Internal Group Review of Case Booklet',
  'Presenting Case to External Stakeholder Group',
  'Pre-Video Development Plan for Implementation',
  'If Needed, Gather Videos & Vital Signs',
  'Case Video Creation',
  'Team Review of Video Case',
  'Revisions based on Team Review Feedback',
  'Comprehensive Final Review of Case Booklet and Video',
  'Revisions based on Team Comprehensive Final Review Feedback',
  'Run Simulation',
  'Upload to Website',
  'Maintenance'
];

// Team Members (for dropdowns)
const TEAM_MEMBERS = [
  'Allie Brenner',
  'Amy Reiland',
  'Anne Adema',
  'Becca Mielke',
  'Benjamin Michaels',
  'Cage Cochran',
  'Cam Brandt',
  'Daniel Ebbs',
  'Elizabeth Sanseau',
  'Erin Montgromery',
  'Kamal Abulebda',
  'Lauren Simpson',
  'Marc Auerbach',
  'Maybelle Kou',
  'Sally Snow',
  'Sofia Athansopoulou'
];

// Time commitment options
const TIME_COMMITMENT_OPTIONS = [
  '1 Day or Less',
  '2-3 Days',
  '1 Week',
  '2 Weeks',
  '3-4 Weeks',
  '>4 Weeks',
  'Ongoing - Time Intensive',
  'Ongoing - Little time required'
];

const PIPELINE_STORAGE_KEY = 'admin_project_pipeline_simbox';

export interface SimBoxCase {
  id: string;
  status: string;
  order: number;
  categoryTopic: string;
  notes: string;
  dueDate: string | null;
  projectDevelopmentStatus: string;
  projectSponsor: string;
  projectLead: string;
  teamMembers: string[];
  projectAdmin: string;
  consulted: string[];
  informed: string[];
  timeCommitment: string;
}

const defaultSimBoxCase = (): SimBoxCase => ({
  id: '',
  status: 'Not Started',
  order: 0,
  categoryTopic: '',
  notes: '',
  dueDate: null,
  projectDevelopmentStatus: '',
  projectSponsor: '',
  projectLead: '',
  teamMembers: [],
  projectAdmin: '',
  consulted: [],
  informed: [],
  timeCommitment: ''
});

const AdminProjectPipelinePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [simboxCases, setSimboxCases] = useState<SimBoxCase[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<SimBoxCase | null>(null);
  const [form, setForm] = useState<SimBoxCase>(defaultSimBoxCase());

  useEffect(() => {
    if (currentUser?.id) {
      const saved = localStorage.getItem(`${PIPELINE_STORAGE_KEY}_${currentUser.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSimboxCases(Array.isArray(parsed) ? parsed : []);
        } catch {
          setSimboxCases([]);
        }
      }
    }
  }, [currentUser]);

  const saveSimboxCases = (cases: SimBoxCase[]) => {
    setSimboxCases(cases);
    if (currentUser?.id) {
      localStorage.setItem(`${PIPELINE_STORAGE_KEY}_${currentUser.id}`, JSON.stringify(cases));
    }
  };

  const handleAdd = () => {
    setEditingCase(null);
    const nextOrder = simboxCases.length > 0
      ? Math.max(...simboxCases.map(c => c.order), 0) + 1
      : 1;
    setForm({
      ...defaultSimBoxCase(),
      id: `simbox_${Date.now()}`,
      order: nextOrder
    });
    setDialogOpen(true);
  };

  const handleEdit = (row: SimBoxCase) => {
    setEditingCase(row);
    setForm({ ...row });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingCase) {
      const updated = simboxCases.map(c => (c.id === editingCase.id ? { ...form } : c));
      saveSimboxCases(updated);
    } else {
      saveSimboxCases([...simboxCases, { ...form }]);
    }
    setDialogOpen(false);
    setForm(defaultSimBoxCase());
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this SimBox case?')) {
      saveSimboxCases(simboxCases.filter(c => c.id !== id));
    }
  };

  const sortedCases = [...simboxCases].sort((a, b) => a.order - b.order);

  const sectionLabels = [
    'SimBox Cases',
    'Scholarship/Publications',
    'Research Dissemination Ideas',
    'Abstracts/Presentations',
    'Program',
    'Administrative',
    'Archive',
    'Team Members'
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>
          Project Pipeline
        </Typography>
        <Typography color="textSecondary" sx={{ mb: 2 }}>
          Manage project pipeline sections. SimBox Cases are built out below; other sections will be expanded later.
        </Typography>

        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          {sectionLabels.map((label, idx) => (
            <Tab key={idx} label={label} />
          ))}
        </Tabs>

        {tabValue === 0 && (
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">SimBox Cases</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
                Add Case
              </Button>
            </Box>
            <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Order</strong></TableCell>
                    <TableCell><strong>Category/Topic</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                    <TableCell><strong>Due Date</strong></TableCell>
                    <TableCell><strong>Dev Status</strong></TableCell>
                    <TableCell><strong>Sponsor</strong></TableCell>
                    <TableCell><strong>Lead</strong></TableCell>
                    <TableCell><strong>Team</strong></TableCell>
                    <TableCell><strong>Admin</strong></TableCell>
                    <TableCell><strong>Time</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedCases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                        No SimBox cases yet. Click &quot;Add Case&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCases.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell><Chip size="small" label={row.status} /></TableCell>
                        <TableCell>{row.order}</TableCell>
                        <TableCell>{row.categoryTopic || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.notes || '-'}</TableCell>
                        <TableCell>{row.dueDate ? format(parseISO(row.dueDate), 'MM/dd/yyyy') : '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 180 }}>{row.projectDevelopmentStatus || '-'}</TableCell>
                        <TableCell>{row.projectSponsor || '-'}</TableCell>
                        <TableCell>{row.projectLead || '-'}</TableCell>
                        <TableCell>{row.teamMembers?.length ? row.teamMembers.join(', ') : '-'}</TableCell>
                        <TableCell>{row.projectAdmin || '-'}</TableCell>
                        <TableCell>{row.timeCommitment || '-'}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleEdit(row)}><EditIcon /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tabValue > 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">
              {sectionLabels[tabValue]} — Coming soon. This section will be built out later.
            </Typography>
          </Paper>
        )}

        {/* Add/Edit SimBox Case Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingCase ? 'Edit SimBox Case' : 'Add SimBox Case'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  {SIMBOX_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                type="number"
                label="Order"
                value={form.order}
                onChange={(e) => setForm(f => ({ ...f, order: Number(e.target.value) || 0 }))}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="Category/Topic"
                value={form.categoryTopic}
                onChange={(e) => setForm(f => ({ ...f, categoryTopic: e.target.value }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              <DatePicker
                label="Due Date"
                value={form.dueDate ? parseISO(form.dueDate) : null}
                onChange={(d) => setForm(f => ({ ...f, dueDate: d ? format(d, 'yyyy-MM-dd') : null }))}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
              />
              <FormControl size="small" sx={{ minWidth: 280 }}>
                <InputLabel>Project Development Status</InputLabel>
                <Select
                  value={form.projectDevelopmentStatus}
                  label="Project Development Status"
                  onChange={(e) => setForm(f => ({ ...f, projectDevelopmentStatus: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {SIMBOX_DEVELOPMENT_STAGES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Project Sponsor</InputLabel>
                <Select
                  value={form.projectSponsor}
                  label="Project Sponsor"
                  onChange={(e) => setForm(f => ({ ...f, projectSponsor: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Project Lead</InputLabel>
                <Select
                  value={form.projectLead}
                  label="Project Lead"
                  onChange={(e) => setForm(f => ({ ...f, projectLead: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Project Admin</InputLabel>
                <Select
                  value={form.projectAdmin}
                  label="Project Admin"
                  onChange={(e) => setForm(f => ({ ...f, projectAdmin: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Time Commitment</InputLabel>
                <Select
                  value={form.timeCommitment}
                  label="Time Commitment"
                  onChange={(e) => setForm(f => ({ ...f, timeCommitment: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TIME_COMMITMENT_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Team Member(s)</InputLabel>
                <Select
                  multiple
                  value={form.teamMembers}
                  label="Team Member(s)"
                  onChange={(e) => setForm(f => ({ ...f, teamMembers: e.target.value as string[] }))}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Consulted</InputLabel>
                <Select
                  multiple
                  value={form.consulted}
                  label="Consulted"
                  onChange={(e) => setForm(f => ({ ...f, consulted: e.target.value as string[] }))}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Informed</InputLabel>
                <Select
                  multiple
                  value={form.informed}
                  label="Informed"
                  onChange={(e) => setForm(f => ({ ...f, informed: e.target.value as string[] }))}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AdminProjectPipelinePage;
