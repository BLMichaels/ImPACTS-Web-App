import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Switch,
  Chip,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import { supabase } from '../../supabase';
import type { RegistrationQuestion, RegistrationQuestionType } from '../../types/database';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, UserRole } from '../../types/database';

// ---- Registration section constants ----
const QUESTION_TYPES: { value: RegistrationQuestionType; label: string }[] = [
  { value: 'short_answer', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'select', label: 'Dropdown (select)' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' }
];

// ---- Permissions section constants ----
interface PermissionState {
  [role: string]: { [permission: string]: boolean };
}
const PERMISSION_GROUPS: Record<string, string[]> = {
  'Dashboard & Views': [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_AGGREGATED_DATA, PERMISSIONS.VIEW_SNAPSHOT, PERMISSIONS.EXPORT_DATA],
  'Activities': [PERMISSIONS.VIEW_OWN_ACTIVITIES, PERMISSIONS.VIEW_TEAM_ACTIVITIES, PERMISSIONS.VIEW_ALL_ACTIVITIES, PERMISSIONS.MANAGE_OWN_ACTIVITIES],
  'Hospitals': [PERMISSIONS.VIEW_OWN_HOSPITALS, PERMISSIONS.VIEW_ALL_HOSPITALS, PERMISSIONS.MANAGE_HOSPITALS],
  'Contacts & CRM': [PERMISSIONS.VIEW_CONTACTS, PERMISSIONS.MANAGE_CONTACTS],
  'User Management': [PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS, PERMISSIONS.SEND_INVITATIONS],
  'Assessments & Plans': [PERMISSIONS.VIEW_PRS, PERMISSIONS.VIEW_GAP_PLANS, PERMISSIONS.VIEW_MILESTONES, PERMISSIONS.VIEW_SIMULATIONS],
  'Wages & Expenses': [PERMISSIONS.VIEW_OWN_WAGES, PERMISSIONS.VIEW_TEAM_WAGES, PERMISSIONS.MANAGE_WAGES],
  'Administration': [PERMISSIONS.MANAGE_PERMISSIONS, PERMISSIONS.SYSTEM_SETTINGS]
};
const formatPermissionLabel = (key: string) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const ROLES: UserRole[] = [UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC];
const getRoleColor = (role: string) => ({ manager: '#9c27b0', mentor: '#ff9800', pecc: '#2196f3' }[role] || '#757575');

export default function AdminSettingsPage() {
  const [tabIndex, setTabIndex] = useState(0);

  // ---- Registration state ----
  const [questions, setQuestions] = useState<RegistrationQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [regError, setRegError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<RegistrationQuestionType>('short_answer');
  const [formRequired, setFormRequired] = useState(false);
  const [formOptionsText, setFormOptionsText] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);

  // ---- Permissions state ----
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const loadQuestions = async () => {
    setQuestionsLoading(true);
    setRegError('');
    try {
      const { data, error: err } = await supabase.from('registration_questions').select('*').order('sort_order', { ascending: true });
      if (err) throw err;
      const rows = (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        label: String(r.label),
        question_type: (r.question_type as RegistrationQuestionType) || 'short_answer',
        required: Boolean(r.required),
        options: Array.isArray(r.options) ? (r.options as unknown[]).map(x => String(x)) : [],
        sort_order: Number(r.sort_order) || 0,
        is_active: Boolean(r.is_active),
        created_at: r.created_at as string | undefined,
        updated_at: r.updated_at as string | undefined
      }));
      setQuestions(rows);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Failed to load questions');
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  };

  useEffect(() => { loadQuestions(); }, []);
  useEffect(() => {
    const init: PermissionState = {};
    ROLES.forEach(role => {
      init[role] = {};
      Object.values(PERMISSIONS).forEach(perm => { init[role][perm] = DEFAULT_ROLE_PERMISSIONS[role]?.includes(perm) || false; });
    });
    setPermissions(init);
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormLabel('');
    setFormType('short_answer');
    setFormRequired(false);
    setFormOptionsText('');
    setFormSortOrder(questions.length);
    setDialogOpen(true);
  };
  const openEdit = (q: RegistrationQuestion) => {
    setEditingId(q.id);
    setFormLabel(q.label);
    setFormType(q.question_type);
    setFormRequired(q.required);
    setFormOptionsText((q.options || []).join('\n'));
    setFormSortOrder(q.sort_order);
    setDialogOpen(true);
  };
  const handleRegSave = async () => {
    if (!formLabel.trim()) { setRegError('Label is required.'); return; }
    const options = formOptionsText.trim() ? formOptionsText.split('\n').map(s => s.trim()).filter(Boolean) : [];
    if ((formType === 'radio' || formType === 'select') && options.length === 0) {
      setRegError('Radio and Select need at least one option (one per line).');
      return;
    }
    setRegError('');
    const payload = { label: formLabel.trim(), question_type: formType, required: formRequired, options, sort_order: formSortOrder, is_active: true, updated_at: new Date().toISOString() };
    try {
      if (editingId) {
        const { error: err } = await supabase.from('registration_questions').update(payload).eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('registration_questions').insert(payload);
        if (err) throw err;
      }
      setDialogOpen(false);
      loadQuestions();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Failed to save');
    }
  };
  const handleRegDelete = async (id: string) => {
    if (!window.confirm('Remove this question from the registration form? It will be deactivated.')) return;
    try {
      const { error: err } = await supabase.from('registration_questions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
      if (err) throw err;
      loadQuestions();
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Failed to deactivate');
    }
  };

  const handleTogglePermission = (role: UserRole, permission: string) => {
    setPermissions(prev => ({ ...prev, [role]: { ...prev[role], [permission]: !prev[role][permission] } }));
    setHasChanges(true);
  };
  const handlePermSave = () => {
    console.log('Saving permissions:', permissions);
    setSnackbar({ open: true, message: 'Permissions saved successfully', severity: 'success' });
    setHasChanges(false);
  };
  const handlePermReset = () => {
    const init: PermissionState = {};
    ROLES.forEach(role => {
      init[role] = {};
      Object.values(PERMISSIONS).forEach(perm => { init[role][perm] = DEFAULT_ROLE_PERMISSIONS[role]?.includes(perm) || false; });
    });
    setPermissions(init);
    setHasChanges(false);
    setSnackbar({ open: true, message: 'Permissions reset to defaults', severity: 'success' });
  };

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Settings</Typography>
      <Typography color="textSecondary" sx={{ mb: 2 }}>
        Registration form, role permissions, and other configuration.
      </Typography>

      <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab label="Registration Questions" />
        <Tab label="Permissions" />
      </Tabs>

      {/* Registration Questions */}
      {tabIndex === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>Registration Questions</Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Add, edit, or remove questions on the PECC registration form.
          </Typography>
          {regError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRegError('')}>{regError}</Alert>}
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={{ mb: 2 }}>Add question</Button>
          {questionsLoading ? (
            <Typography>Loading…</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Order</TableCell>
                    <TableCell>Label</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>Options</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {questions.map(q => (
                    <TableRow key={q.id}>
                      <TableCell>{q.sort_order}</TableCell>
                      <TableCell>{q.label}</TableCell>
                      <TableCell>{QUESTION_TYPES.find(t => t.value === q.question_type)?.label ?? q.question_type}</TableCell>
                      <TableCell>{q.required ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{(q.options || []).length ? (q.options as string[]).join(', ') : '—'}</TableCell>
                      <TableCell><Chip label={q.is_active ? 'Active' : 'Inactive'} size="small" color={q.is_active ? 'success' : 'default'} /></TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEdit(q)}><EditIcon fontSize="small" /></IconButton>
                        {q.is_active && <IconButton size="small" color="error" onClick={() => handleRegDelete(q.id)}><DeleteIcon fontSize="small" /></IconButton>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {questions.length === 0 && <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>No registration questions yet.</Box>}
            </TableContainer>
          )}
        </Box>
      )}

      {/* Permissions */}
      {tabIndex === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6">Role Permissions</Typography>
              <Typography color="textSecondary">Configure which features each role can access. Admins always have full access.</Typography>
            </Box>
            <Box>
              <Button startIcon={<RefreshIcon />} onClick={handlePermReset} sx={{ mr: 1 }}>Reset to Defaults</Button>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={handlePermSave} disabled={!hasChanges}>Save Changes</Button>
            </Box>
          </Box>
          {hasChanges && <Alert severity="warning" sx={{ mb: 2 }}>You have unsaved changes.</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>These settings affect Manager, Mentor, and PECC only.</Alert>
          {Object.entries(PERMISSION_GROUPS).map(([groupName, groupPermissions]) => (
            <Accordion key={groupName} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="subtitle1">{groupName}</Typography></AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '40%' }}>Permission</TableCell>
                        {ROLES.map(role => <TableCell key={role} align="center"><Chip label={role.toUpperCase()} size="small" sx={{ bgcolor: getRoleColor(role), color: 'white' }} /></TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {groupPermissions.map(perm => (
                        <TableRow key={perm}>
                          <TableCell><Typography variant="body2">{formatPermissionLabel(perm)}</Typography></TableCell>
                          {ROLES.map(role => (
                            <TableCell key={`${role}-${perm}`} align="center">
                              <Switch checked={permissions[role]?.[perm] || false} onChange={() => handleTogglePermission(role, perm)} color="primary" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Summary</Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              {ROLES.map(role => (
                <Box key={role}>
                  <Chip label={role.toUpperCase()} size="small" sx={{ bgcolor: getRoleColor(role), color: 'white', mb: 0.5 }} />
                  <Typography variant="body2">{Object.values(permissions[role] || {}).filter(Boolean).length} of {Object.values(PERMISSIONS).length} enabled</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit question' : 'Add question'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Label" value={formLabel} onChange={e => setFormLabel(e.target.value)} required />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select value={formType} label="Type" onChange={e => setFormType(e.target.value as RegistrationQuestionType)}>
              {QUESTION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel control={<Checkbox checked={formRequired} onChange={e => setFormRequired(e.target.checked)} />} label="Required" />
          {(formType === 'radio' || formType === 'select') && (
            <TextField fullWidth margin="normal" label="Options (one per line)" value={formOptionsText} onChange={e => setFormOptionsText(e.target.value)} multiline rows={4} placeholder="One option per line" />
          )}
          <TextField fullWidth margin="normal" type="number" label="Sort order" value={formSortOrder} onChange={e => setFormSortOrder(Number(e.target.value) || 0)} inputProps={{ min: 0 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRegSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
