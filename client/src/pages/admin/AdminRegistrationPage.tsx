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
  Chip,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../../supabase';
import type { RegistrationQuestion, RegistrationQuestionType } from '../../types/database';

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

export default function AdminRegistrationPage() {
  const [questions, setQuestions] = useState<RegistrationQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<RegistrationQuestionType>('short_answer');
  const [formRequired, setFormRequired] = useState(false);
  const [formOptionsText, setFormOptionsText] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('registration_questions')
        .select('*')
        .order('sort_order', { ascending: true });
      if (err) throw err;
      const rows = (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        label: String(r.label),
        question_type: (r.question_type as RegistrationQuestionType) || 'short_answer',
        required: Boolean(r.required),
        options: Array.isArray(r.options) ? (r.options as unknown[]).map((x) => String(x)) : [],
        sort_order: Number(r.sort_order) || 0,
        is_active: Boolean(r.is_active),
        created_at: r.created_at as string | undefined,
        updated_at: r.updated_at as string | undefined
      }));
      setQuestions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
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

  const handleSave = async () => {
    if (!formLabel.trim()) {
      setError('Label is required.');
      return;
    }
    const options = formOptionsText.trim() ? formOptionsText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    if ((formType === 'radio' || formType === 'select') && options.length === 0) {
      setError('Radio and Select questions need at least one option (one per line).');
      return;
    }
    setError('');
    const payload = {
      label: formLabel.trim(),
      question_type: formType,
      required: formRequired,
      options,
      sort_order: formSortOrder,
      is_active: true,
      updated_at: new Date().toISOString()
    };
    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('registration_questions')
          .update(payload)
          .eq('id', editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('registration_questions').insert(payload);
        if (err) throw err;
      }
      setDialogOpen(false);
      loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this question from the registration form? It will be deactivated.')) return;
    try {
      const { error: err } = await supabase
        .from('registration_questions')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate');
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Registration Questions</Typography>
      <Typography color="textSecondary" sx={{ mb: 2 }}>
        Add, edit, or remove questions shown on the PECC registration form. New registrants will see these after contact info and hospital.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add question
        </Button>
      </Box>

      {loading ? (
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
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell>{q.sort_order}</TableCell>
                  <TableCell>{q.label}</TableCell>
                  <TableCell>{QUESTION_TYPES.find((t) => t.value === q.question_type)?.label ?? q.question_type}</TableCell>
                  <TableCell>{q.required ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{(q.options || []).length ? (q.options as string[]).join(', ') : '—'}</TableCell>
                  <TableCell>
                    <Chip label={q.is_active ? 'Active' : 'Inactive'} size="small" color={q.is_active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(q)} aria-label="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {q.is_active && (
                      <IconButton size="small" color="error" onClick={() => handleDelete(q.id)} aria-label="Remove">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {questions.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              No registration questions yet. Add one to show custom fields on the sign-up form.
            </Box>
          )}
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit question' : 'Add question'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Label" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} required />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select value={formType} label="Type" onChange={(e) => setFormType(e.target.value as RegistrationQuestionType)}>
              {QUESTION_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel control={<Checkbox checked={formRequired} onChange={(e) => setFormRequired(e.target.checked)} />} label="Required" />
          {(formType === 'radio' || formType === 'select') && (
            <TextField
              fullWidth
              margin="normal"
              label="Options (one per line)"
              value={formOptionsText}
              onChange={(e) => setFormOptionsText(e.target.value)}
              multiline
              rows={4}
              placeholder="One option per line"
              helperText="One option per line. Shown as choices for Radio or Dropdown."
            />
          )}
          <TextField fullWidth margin="normal" type="number" label="Sort order" value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value) || 0)} inputProps={{ min: 0 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
