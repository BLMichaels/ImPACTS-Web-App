import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import { supabase } from '../../supabase';
import type { ProgramChecklist, ProgramChecklistStage, ProgramChecklistTask, ProgramChecklistTaskLink } from '../../types/database';
import RichTextEditor, { sanitizeHtml, stripHtmlToText } from '../../components/cohorts/RichTextEditor';

export default function AdminProgramChecklistsTab() {
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [checklists, setChecklists] = useState<(ProgramChecklist & { stages?: ProgramChecklistStage[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ProgramChecklist | null>(null);
  const [formName, setFormName] = useState('');
  const [formProgramId, setFormProgramId] = useState('');
  const [formShowBeforeDefault, setFormShowBeforeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProgramChecklistStage | null>(null);
  const [stageForm, setStageForm] = useState({ title: '', subtitle: '', color_hex: '#2196F3', goal: '', objectives: '' });
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProgramChecklistTask | null>(null);
  const [taskStageId, setTaskStageId] = useState('');
  const [taskForm, setTaskForm] = useState({ text_content: '', task_id_suffix: '', links: [] as ProgramChecklistTaskLink[] });
  const [stageChecklistId, setStageChecklistId] = useState<string | null>(null);

  const loadPrograms = useCallback(async () => {
    const { data, error: err } = await supabase.from('programs').select('id, name').eq('is_active', true).order('name');
    if (err) throw err;
    setPrograms(data || []);
  }, []);

  const loadChecklists = useCallback(async () => {
    const { data: list, error: listErr } = await supabase
      .from('program_checklists')
      .select('*')
      .order('sort_order')
      .order('name');
    if (listErr) throw listErr;
    const withStages = await Promise.all(
      (list || []).map(async (c) => {
        const { data: stages } = await supabase
          .from('program_checklist_stages')
          .select('*')
          .eq('checklist_id', c.id)
          .order('sort_order');
        const stagesWithTasks = await Promise.all(
          (stages || []).map(async (s) => {
            const { data: tasks } = await supabase
              .from('program_checklist_tasks')
              .select('*')
              .eq('stage_id', s.id)
              .order('sort_order');
            return { ...s, tasks: tasks || [] };
          })
        );
        return { ...c, stages: stagesWithTasks };
      })
    );
    setChecklists(withStages);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadPrograms();
        await loadChecklists();
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [loadPrograms, loadChecklists]);

  const openAddChecklist = () => {
    setEditingChecklist(null);
    setFormName('');
    setFormProgramId(programs[0]?.id || '');
    setFormShowBeforeDefault(false);
    setDialogOpen(true);
  };

  const openEditChecklist = (c: ProgramChecklist) => {
    setEditingChecklist(c);
    setFormName(c.name);
    setFormProgramId(c.program_id);
    setFormShowBeforeDefault(c.show_before_default);
    setDialogOpen(true);
  };

  const handleSaveChecklist = async () => {
    if (!formName.trim() || !formProgramId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingChecklist) {
        const { error: e } = await supabase
          .from('program_checklists')
          .update({
            name: formName.trim(),
            program_id: formProgramId,
            show_before_default: formShowBeforeDefault,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingChecklist.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase
          .from('program_checklists')
          .insert({
            name: formName.trim(),
            program_id: formProgramId,
            show_before_default: formShowBeforeDefault,
            sort_order: checklists.length
          });
        if (e) throw e;
      }
      await loadChecklists();
      setDialogOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChecklist = async (id: string) => {
    if (!window.confirm('Delete this checklist and all its stages and steps?')) return;
    try {
      const { error: e } = await supabase.from('program_checklists').delete().eq('id', id);
      if (e) throw e;
      await loadChecklists();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const openAddStage = (checklistId: string) => {
    setEditingStage(null);
    setStageChecklistId(checklistId);
    setStageForm({ title: '', subtitle: '', color_hex: '#2196F3', goal: '', objectives: '' });
    setExpandedChecklistId(checklistId);
    setStageDialogOpen(true);
  };

  const openEditStage = (s: ProgramChecklistStage) => {
    setEditingStage(s);
    setStageChecklistId(s.checklist_id);
    setStageForm({
      title: s.title,
      subtitle: s.subtitle || '',
      color_hex: s.color_hex || '#2196F3',
      goal: s.goal || '',
      objectives: Array.isArray(s.objectives) ? s.objectives.join('\n') : ''
    });
    setStageDialogOpen(true);
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!window.confirm('Delete this stage and all its steps?')) return;
    try {
      const { error: e } = await supabase.from('program_checklist_stages').delete().eq('id', stageId);
      if (e) throw e;
      await loadChecklists();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this step?')) return;
    try {
      const { error: e } = await supabase.from('program_checklist_tasks').delete().eq('id', taskId);
      if (e) throw e;
      await loadChecklists();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const handleSaveStage = async () => {
    const checklistId = stageChecklistId || (editingStage && (checklists.find((c) => c.stages?.some((s) => s.id === editingStage.id))?.id));
    if (!checklistId) return;
    if (!stageForm.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const objectivesArr = stageForm.objectives.split('\n').map((o) => o.trim()).filter(Boolean);
      if (editingStage) {
        const { error: e } = await supabase
          .from('program_checklist_stages')
          .update({
            title: stageForm.title.trim(),
            subtitle: stageForm.subtitle.trim() || null,
            color_hex: stageForm.color_hex || null,
            goal: stageForm.goal.trim() || null,
            objectives: objectivesArr,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingStage.id);
        if (e) throw e;
      } else {
        const { data: stages } = await supabase.from('program_checklist_stages').select('id').eq('checklist_id', checklistId);
        const { error: e } = await supabase.from('program_checklist_stages').insert({
          checklist_id: checklistId,
          sort_order: (stages?.length ?? 0),
          title: stageForm.title.trim(),
          subtitle: stageForm.subtitle.trim() || null,
          color_hex: stageForm.color_hex || null,
          goal: stageForm.goal.trim() || null,
          objectives: objectivesArr
        });
        if (e) throw e;
      }
      await loadChecklists();
      setStageDialogOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const openAddTask = (stageId: string, checklistId: string) => {
    setEditingTask(null);
    setTaskStageId(stageId);
    setTaskForm({ text_content: '', task_id_suffix: '1', links: [] });
    setExpandedChecklistId(checklistId);
    setTaskDialogOpen(true);
  };

  const openEditTask = (t: ProgramChecklistTask, checklistId: string) => {
    setEditingTask(t);
    setTaskStageId(t.stage_id);
    setTaskForm({
      text_content: t.text_content,
      task_id_suffix: t.task_id_suffix,
      links: t.links && Array.isArray(t.links) ? t.links : []
    });
    setExpandedChecklistId(checklistId);
    setTaskDialogOpen(true);
  };

  const handleSaveTask = async () => {
    const textTrim = sanitizeHtml(taskForm.text_content).trim();
    if (!stripHtmlToText(textTrim).trim() || !taskStageId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingTask) {
        const { error: e } = await supabase
          .from('program_checklist_tasks')
          .update({
            text_content: textTrim,
            task_id_suffix: taskForm.task_id_suffix.trim() || '1',
            links: [],
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTask.id);
        if (e) throw e;
      } else {
        const { data: tasks } = await supabase.from('program_checklist_tasks').select('id').eq('stage_id', taskStageId);
        const { error: e } = await supabase.from('program_checklist_tasks').insert({
          stage_id: taskStageId,
          sort_order: (tasks?.length ?? 0),
          task_id_suffix: taskForm.task_id_suffix.trim() || '1',
          text_content: textTrim,
          links: []
        });
        if (e) throw e;
      }
      await loadChecklists();
      setTaskDialogOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addTaskLink = () => {
    setTaskForm((prev) => ({ ...prev, links: [...prev.links, { text: '', url: '' }] }));
  };

  const updateTaskLink = (index: number, field: 'text' | 'url', value: string) => {
    setTaskForm((prev) => ({
      ...prev,
      links: prev.links.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    }));
  };

  const removeTaskLink = (index: number) => {
    setTaskForm((prev) => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 3 }}>
        <CircularProgress size={24} />
        <Typography>Loading program checklists…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Program Checklists</Typography>
      <Typography color="textSecondary" sx={{ mb: 2 }}>
        Create checklists per program for PECCs. Each checklist can appear before or after the default checklist. PECC primary program determines which program checklist they see.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Button variant="contained" startIcon={<AddIcon />} onClick={openAddChecklist} sx={{ mb: 2 }} aria-label="Add program checklist">
        Add checklist
      </Button>

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Program</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Order</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {checklists.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{programs.find((p) => p.id === c.program_id)?.name ?? c.program_id}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.show_before_default ? 'Before default' : 'After default'} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEditChecklist(c)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDeleteChecklist(c.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {checklists.length > 0 && (
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Stages & steps (expand to edit)</Typography>
      )}
      {checklists.map((c) => (
        <Accordion
          key={c.id}
          expanded={expandedChecklistId === c.id}
          onChange={() => setExpandedChecklistId(expandedChecklistId === c.id ? null : c.id)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>{c.name}</Typography>
            <Chip size="small" sx={{ ml: 1 }} label={`${c.stages?.length ?? 0} stages`} />
          </AccordionSummary>
          <AccordionDetails>
            {(c.stages ?? []).map((stage) => (
              <Box key={stage.id} sx={{ mb: 2, pl: 2, borderLeft: 2, borderColor: stage.color_hex || 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>{stage.title}</Typography>
                  <Box>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => openAddTask(stage.id, c.id)}>Add step</Button>
                    <IconButton size="small" onClick={() => openEditStage(stage)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteStage(stage.id)}><DeleteIcon /></IconButton>
                  </Box>
                </Box>
                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                  {(() => {
                    const tasks = (stage as ProgramChecklistStage & { tasks?: ProgramChecklistTask[] }).tasks;
                    if (!tasks?.length) return <Typography variant="body2" color="text.secondary">No steps yet</Typography>;
                    return tasks.map((t) => (
                      <li key={t.id}>
                        <Typography variant="body2">{stripHtmlToText(t.text_content).trim().slice(0, 80)}{stripHtmlToText(t.text_content).trim().length > 80 ? '…' : ''}</Typography>
                        <IconButton size="small" onClick={() => openEditTask(t, c.id)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteTask(t.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </li>
                    ));
                  })()}
                </Box>
                <Button size="small" startIcon={<AddIcon />} onClick={() => { openAddStage(c.id); setTaskStageId(''); }} sx={{ mt: 1 }}>
                  Add stage
                </Button>
              </Box>
            ))}
            {(!c.stages || c.stages.length === 0) && (
              <Button size="small" startIcon={<AddIcon />} onClick={() => openAddStage(c.id)}>Add first stage</Button>
            )}
          </AccordionDetails>
        </Accordion>
      ))}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingChecklist ? 'Edit checklist' : 'New checklist'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Checklist name" value={formName} onChange={(e) => setFormName(e.target.value)} margin="dense" />
          <FormControl fullWidth margin="dense">
            <InputLabel>Program</InputLabel>
            <Select value={formProgramId} onChange={(e) => setFormProgramId(e.target.value)} label="Program">
              {programs.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={formShowBeforeDefault} onChange={(e) => setFormShowBeforeDefault(e.target.checked)} />}
            label="Show before default checklist"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveChecklist} disabled={saving || !formName.trim() || !formProgramId}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={stageDialogOpen} onClose={() => setStageDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingStage ? 'Edit stage' : 'New stage'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Stage title" value={stageForm.title} onChange={(e) => setStageForm((f) => ({ ...f, title: e.target.value }))} margin="dense" required />
          <TextField fullWidth label="Subtitle" value={stageForm.subtitle} onChange={(e) => setStageForm((f) => ({ ...f, subtitle: e.target.value }))} margin="dense" />
          <TextField fullWidth label="Color (hex)" value={stageForm.color_hex} onChange={(e) => setStageForm((f) => ({ ...f, color_hex: e.target.value }))} margin="dense" placeholder="#2196F3" />
          <TextField fullWidth label="Goal" value={stageForm.goal} onChange={(e) => setStageForm((f) => ({ ...f, goal: e.target.value }))} margin="dense" multiline />
          <TextField fullWidth label="Objectives (one per line)" value={stageForm.objectives} onChange={(e) => setStageForm((f) => ({ ...f, objectives: e.target.value }))} margin="dense" multiline rows={3} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStageDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => handleSaveStage()} disabled={saving || !stageForm.title.trim()}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTask ? 'Edit step' : 'New step'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Step ID (e.g. 1)" value={taskForm.task_id_suffix} onChange={(e) => setTaskForm((f) => ({ ...f, task_id_suffix: e.target.value }))} margin="dense" sx={{ mb: 1 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Step text *</Typography>
          <RichTextEditor
            value={taskForm.text_content}
            onChange={(html) => setTaskForm((f) => ({ ...f, text_content: html }))}
            placeholder="Enter step content…"
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTask} disabled={saving || !stripHtmlToText(taskForm.text_content).trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
