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
import { supabase } from '../../supabase';
import type { ProgramChecklist, ProgramChecklistStage, ProgramChecklistTask, ProgramChecklistTaskLink } from '../../types/database';
import RichTextEditor, { sanitizeHtml, stripHtmlToText } from '../../components/cohorts/RichTextEditor';

type ChecklistEntryType = 'task' | 'banner' | 'footnote' | 'subnote' | 'divider';
const ENTRY_PREFIX = '[[ENTRY:';
const DEFAULT_STAGE_PALETTE: Record<'stage1' | 'stage2' | 'stage3' | 'stage4', string> = {
  stage1: '#2196F3',
  stage2: '#4CAF50',
  stage3: '#FF9800',
  stage4: '#9C27B0'
};

function decodeEntry(text: string): { type: ChecklistEntryType; content: string } {
  const m = String(text || '').match(/^\[\[ENTRY:(task|banner|footnote|subnote|divider)\]\]/i);
  if (!m) return { type: 'task', content: text || '' };
  const type = m[1].toLowerCase() as ChecklistEntryType;
  return {
    type,
    content: String(text || '').slice(m[0].length)
  };
}

function encodeEntry(type: ChecklistEntryType, content: string): string {
  if (type === 'task') return content;
  return `${ENTRY_PREFIX}${type}]]${content}`;
}

function normalizeChecklistHtml(html: string): string {
  // Prevent accidental multi-empty-line growth after save cycles.
  return sanitizeHtml(html)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>){2,}/gi, '<p><br></p>');
}

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
  const [taskForm, setTaskForm] = useState({ text_content: '', task_id_suffix: '', links: [] as ProgramChecklistTaskLink[], entry_type: 'task' as ChecklistEntryType });
  const [stageChecklistId, setStageChecklistId] = useState<string | null>(null);
  const [stagePalette, setStagePalette] = useState(DEFAULT_STAGE_PALETTE);
  const [paletteSaving, setPaletteSaving] = useState(false);

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

  const loadStagePalette = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'milestone_stage_palette').maybeSingle();
    const saved = (data?.value ?? null) as Record<string, unknown> | null;
    if (!saved || typeof saved !== 'object') return;
    setStagePalette({
      stage1: typeof saved.stage1 === 'string' ? saved.stage1 : DEFAULT_STAGE_PALETTE.stage1,
      stage2: typeof saved.stage2 === 'string' ? saved.stage2 : DEFAULT_STAGE_PALETTE.stage2,
      stage3: typeof saved.stage3 === 'string' ? saved.stage3 : DEFAULT_STAGE_PALETTE.stage3,
      stage4: typeof saved.stage4 === 'string' ? saved.stage4 : DEFAULT_STAGE_PALETTE.stage4
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadPrograms();
        await loadChecklists();
        await loadStagePalette();
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [loadPrograms, loadChecklists, loadStagePalette]);

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
    setTaskForm({ text_content: '', task_id_suffix: '1', links: [], entry_type: 'task' });
    setExpandedChecklistId(checklistId);
    setTaskDialogOpen(true);
  };

  const openEditTask = (t: ProgramChecklistTask, checklistId: string) => {
    const decoded = decodeEntry(t.text_content || '');
    setEditingTask(t);
    setTaskStageId(t.stage_id);
    setTaskForm({
      text_content: decoded.content,
      task_id_suffix: t.task_id_suffix,
      links: t.links && Array.isArray(t.links) ? t.links : [],
      entry_type: decoded.type
    });
    setExpandedChecklistId(checklistId);
    setTaskDialogOpen(true);
  };

  const handleSaveTask = async () => {
    const textTrim = normalizeChecklistHtml(taskForm.text_content).trim();
    if (!stripHtmlToText(textTrim).trim() || !taskStageId) return;
    const encodedText = encodeEntry(taskForm.entry_type, textTrim);
    setSaving(true);
    setError(null);
    try {
      if (editingTask) {
        const { error: e } = await supabase
          .from('program_checklist_tasks')
          .update({
            text_content: encodedText,
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
          text_content: encodedText,
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

  const handleSavePalette = async () => {
    setPaletteSaving(true);
    setError(null);
    try {
      const { error: e } = await supabase.from('app_settings').upsert(
        {
          key: 'milestone_stage_palette',
          value: stagePalette as any,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );
      if (e) throw e;
    } catch (e: any) {
      setError(e?.message || 'Failed to save stage palette');
    } finally {
      setPaletteSaving(false);
    }
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
      <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Default Stage Accordion Palette</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          These colors control Stage 1-4 accordion headers in the PECC checklist pages.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 1 }}>
          {(['stage1', 'stage2', 'stage3', 'stage4'] as const).map((k) => (
            <TextField
              key={k}
              label={k.toUpperCase()}
              size="small"
              value={stagePalette[k]}
              onChange={(e) => setStagePalette((prev) => ({ ...prev, [k]: e.target.value }))}
            />
          ))}
        </Box>
        <Button sx={{ mt: 1.5 }} size="small" variant="outlined" onClick={handleSavePalette} disabled={paletteSaving}>
          {paletteSaving ? 'Saving…' : 'Save stage palette'}
        </Button>
      </Box>
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
                    <Button size="small" startIcon={<AddIcon />} onClick={() => openAddTask(stage.id, c.id)}>Add item</Button>
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
                        {(() => {
                          const decoded = decodeEntry(t.text_content || '');
                          const plain = stripHtmlToText(decoded.content).trim();
                          return (
                            <Typography variant="body2">
                              {decoded.type !== 'task' ? `[${decoded.type.toUpperCase()}] ` : ''}
                              {plain.slice(0, 80)}{plain.length > 80 ? '…' : ''}
                            </Typography>
                          );
                        })()}
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
        <DialogTitle>{editingTask ? 'Edit checklist item' : 'New checklist item'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense" sx={{ mb: 1 }}>
            <InputLabel>Item type</InputLabel>
            <Select
              value={taskForm.entry_type}
              label="Item type"
              onChange={(e) => setTaskForm((f) => ({ ...f, entry_type: e.target.value as ChecklistEntryType }))}
            >
              <MenuItem value="task">Checklist item (checkbox)</MenuItem>
              <MenuItem value="banner">Banner text block</MenuItem>
              <MenuItem value="subnote">Subnote text block</MenuItem>
              <MenuItem value="footnote">Footnote text block</MenuItem>
              <MenuItem value="divider">Divider text block</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth label="Step ID (e.g. 1)" value={taskForm.task_id_suffix} onChange={(e) => setTaskForm((f) => ({ ...f, task_id_suffix: e.target.value }))} margin="dense" sx={{ mb: 1 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Content *</Typography>
          <RichTextEditor
            value={taskForm.text_content}
            onChange={(html) => setTaskForm((f) => ({ ...f, text_content: html }))}
            placeholder="Enter content…"
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
