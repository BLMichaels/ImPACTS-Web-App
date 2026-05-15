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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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

type DefaultTemplateStage = {
  id: 'stage1' | 'stage2' | 'stage3' | 'stage4';
  title: string;
  subtitle: string;
  objectives: string[];
  goal: string;
  tasks: Array<{ text: string; links?: ProgramChecklistTaskLink[] }>;
};

const DEFAULT_MILESTONE_TEMPLATE_STAGES: DefaultTemplateStage[] = [
  {
    id: 'stage1',
    title: 'Stage 1: Establish',
    subtitle: 'Build core knowledge, connect with PRISM, and prepare for simulation.',
    objectives: [
      'Develop foundational knowledge of Pediatric Readiness and the PECC Role',
      'Establish connection with PRISM mentor and peer PECCs',
      'Begin exploring simulation resources'
    ],
    goal: ' Build a strong foundation of knowledge, tools, and peer support',
    tasks: [
      { text: 'Review the role responsibilities for Nurse PECC or Physician PECC', links: [
        { text: 'Nurse PECC', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/role-of-the-nursing-pecc-in-the-ed/' },
        { text: 'Physician PECC', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/md-pecc/' }
      ] },
      { text: 'Complete the Emergency Medical Services for Children (EMSC) PECC Modules', links: [
        { text: 'PECC Modules', url: 'https://emscimprovement.center/domains/pecc/pecc-module-ed/' }
      ] },
      { text: 'Contact your emergency department (ED) nursing leadership and/or physician partners with the following email template', links: [
        { text: 'email template', url: 'https://docs.google.com/document/d/14QcAO6S8llniLOKo-NoIuwDpYgo63GCN/edit' }
      ] },
      { text: 'Share Pediatric Readiness resources with ED leadership:\n• Joint Policy Statement\n• How Pediatric Readiness Saves Lives\n• The National Pediatric Readiness Project Assessment\n• Importance of a PECC', links: [
        { text: 'Joint Policy Statement', url: 'https://publications.aap.org/pediatrics/article/142/5/e20182459/38608/Pediatric-Readiness-in-the-Emergency-Department' },
        { text: 'How Pediatric Readiness Saves Lives', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/' },
        { text: 'The National Pediatric Readiness Project Assessment', url: 'https://www.pedsready.org/' },
        { text: 'Importance of a PECC', url: 'https://emscimprovement.center/domains/pecc/' }
      ] },
      { text: 'Meet your PRISM mentor (virtual or in-person) and schedule monthly check-ins' },
      { text: 'Join the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', links: [
        { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
      ] },
      { text: 'Review the National Pediatric Readiness Project assessment with your PRISM' },
      { text: 'Work with your PRISM to attend an in-person PECC training event' },
      { text: 'Review SimBox How-To Video and Simulation/Education Guide', links: [
        { text: 'How-To Video', url: 'https://www.emergencysimbox.com/how-to-use' },
        { text: 'Simulation/Education Guide', url: 'https://www.emergencysimbox.com/respiratory-distress' }
      ] },
      { text: 'Plan your in-person simulation with your PRISM by selecting a simulation case, assigning roles, and setting up technology to run during Stage 2', links: [
        { text: 'simulation case', url: 'https://www.emergencysimbox.com/' }
      ] },
      { text: 'Communicate to leadership your progress' }
    ]
  },
  {
    id: 'stage2',
    title: 'Stage 2: Implement',
    subtitle: 'Apply knowledge, complete assessments, and facilitate first simulation.',
    objectives: [
      'Complete Stage 1 objectives',
      'Complete the National Pediatric Readiness Assessment with PRISM',
      'Identify readiness gaps with PRISM',
      'Facilitate simulation in the ED with PRISM'
    ],
    goal: ' Apply skills in real settings and begin leading improvement efforts',
    tasks: [
      { text: 'Complete Stage 1 objectives' },
      { text: 'After completing Stage 1 objectives, re-evaluate your available time commitment to Pediatric Readiness' },
      { text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', links: [
        { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
      ] },
      { text: 'Complete your National Pediatric Readiness Project assessment and review score with your PRISM' },
      { text: 'Review, prioritize, and address one ongoing gap utilizing resources from ImPACTS with your PRISM' },
      { text: 'Create a SMART aim goal to address the prioritized gap with support from your PRISM' },
      { text: 'Schedule your first simulation with an ED team with support from your PRISM' },
      { text: 'Run and complete your first simulation with support from your PRISM' },
      { text: 'Complete the associated Facilitator Checklist with that scenario', links: [
        { text: 'Facilitator Checklist', url: 'https://yalesurvey.ca1.qualtrics.com/jfe/form/SV_2i2AQF9Lq5ixm6i' }
      ] },
      { text: 'Ask all participants to complete the Participant Survey to access the simulation report', links: [
        { text: 'Participant Survey', url: 'https://yalesurvey.ca1.qualtrics.com/jfe/form/SV_3vXMUgYvIPFWKUK' }
      ] },
      { text: 'Communicate to leadership your progress' }
    ]
  },
  {
    id: 'stage3',
    title: 'Stage 3: Lead',
    subtitle: 'Take independent leadership in gaps and simulations.',
    objectives: [
      'Complete Stage 2 objectives',
      'Independently address Pediatric Readiness gaps',
      'Lead simulation activities with virtual PRISM support'
    ],
    goal: ' Take ownership of simulation, action planning, and peer learning',
    tasks: [
      { text: 'Complete Stage 2 objectives' },
      { text: 'After completing Stage 2 objectives, re-evaluate your available time commitment to Pediatric Readiness' },
      { text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', links: [
        { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
      ] },
      { text: 'Continue addressing prioritized gaps from Stage 2 with virtual support and consultation from your PRISM' },
      { text: 'Review the "Gap Analysis" tab on your PECC Support Tool with your PRISM' },
      { text: 'Begin logging activities in your PECC Support Tool' },
      { text: 'Independently create a SMART aim goal to address ongoing gaps, with consultation and feedback from your PRISM' },
      { text: 'Schedule and facilitate quarterly simulations with an ED team with virtual support from your PRISM', links: [
        { text: 'simulations', url: 'https://www.emergencysimbox.com/' }
      ] },
      { text: 'Communicate to leadership your progress' }
    ]
  },
  {
    id: 'stage4',
    title: 'Stage 4: Sustain',
    subtitle: 'Maintain improvements and serve as a champion.',
    objectives: [
      'Complete Stage 3 objectives',
      'Engage senior leadership and other ED departments in Pediatric Readiness improvements',
      'Continue simulation, tracking, and peer leadership'
    ],
    goal: ' Sustain improvements and serve as a Pediatric Readiness champion within the ED and broader network',
    tasks: [
      { text: 'Complete Stage 3 objectives' },
      { text: 'After completing Stage 3 objectives, re-evaluate your available time commitment to Pediatric Readiness' },
      { text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', links: [
        { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
      ] },
      { text: 'Review and update the status of the current "Gap Analysis" on your PECC Support Tool' },
      { text: 'Log monthly activities on your PECC Support Tool' },
      { text: 'Present your PECC Support Tool snapshots to ED and hospital leadership' },
      { text: 'Each year, complete the National Pediatric Readiness Project assessment, address new or ongoing gaps utilizing resources from ImPACTS, and create a SMART aim goal to tackle the next identified gap', links: [
        { text: 'National Pediatric Readiness Project assessment', url: 'https://www.pedsready.org/' }
      ] },
      { text: 'Facilitate, independently, ongoing quarterly simulations in the ED', links: [
        { text: 'simulations', url: 'https://www.emergencysimbox.com/' }
      ] },
      { text: 'Fill out the ImPACTS Program Evaluation Survey to share your feedback and indicate interest in becoming a PRISM' }
    ]
  }
];

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

function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value || '').trim());
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  const valid = isValidHexColor(color);
  return (
    <Box
      title={`${label}: ${valid ? color : 'Invalid hex'}`}
      aria-label={`${label} preview`}
      sx={{
        width: 26,
        height: 26,
        borderRadius: '6px',
        border: '1px solid',
        borderColor: valid ? 'divider' : 'error.main',
        bgcolor: valid ? color : 'grey.100',
        backgroundImage: valid ? 'none' : 'linear-gradient(45deg, transparent 42%, #ef5350 42%, #ef5350 58%, transparent 58%)',
        flexShrink: 0
      }}
    />
  );
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
  const [checklistVisibility, setChecklistVisibility] = useState<Record<string, boolean>>({});
  const [paletteSaving, setPaletteSaving] = useState(false);
  const [templateSeeding, setTemplateSeeding] = useState(false);

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

  const loadChecklistVisibility = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'program_checklist_enabled_overrides')
      .maybeSingle();
    const raw = (data?.value ?? null) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      setChecklistVisibility({});
      return;
    }
    const map: Record<string, boolean> = {};
    Object.entries(raw).forEach(([key, value]) => {
      map[key] = value !== false;
    });
    setChecklistVisibility(map);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadPrograms();
        await loadChecklists();
        await loadStagePalette();
        await loadChecklistVisibility();
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [loadPrograms, loadChecklists, loadStagePalette, loadChecklistVisibility]);

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

  const isChecklistEnabled = (checklistId: string): boolean => checklistVisibility[checklistId] !== false;

  const handleToggleChecklistEnabled = async (checklistId: string, enabled: boolean) => {
    const next = { ...checklistVisibility, [checklistId]: enabled };
    setChecklistVisibility(next);
    const { error: e } = await supabase.from('app_settings').upsert(
      {
        key: 'program_checklist_enabled_overrides',
        value: next as any,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    );
    if (e) {
      setError(e.message || 'Failed to update checklist visibility');
      await loadChecklistVisibility();
    }
  };

  const handleMoveStage = async (checklistId: string, stageId: string, direction: 'up' | 'down') => {
    const checklist = checklists.find((c) => c.id === checklistId);
    const stages = [...(checklist?.stages || [])].sort((a, b) => a.sort_order - b.sort_order);
    const index = stages.findIndex((s) => s.id === stageId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    const current = stages[index];
    const target = stages[targetIndex];
    try {
      const now = new Date().toISOString();
      const { error: e1 } = await supabase
        .from('program_checklist_stages')
        .update({ sort_order: target.sort_order, updated_at: now })
        .eq('id', current.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('program_checklist_stages')
        .update({ sort_order: current.sort_order, updated_at: now })
        .eq('id', target.id);
      if (e2) throw e2;
      await loadChecklists();
    } catch (e: any) {
      setError(e?.message || 'Failed to reorder stage');
    }
  };

  const handleMoveTask = async (stageId: string, taskId: string, direction: 'up' | 'down') => {
    const parentChecklist = checklists.find((c) => c.stages?.some((s) => s.id === stageId));
    const stage = parentChecklist?.stages?.find((s) => s.id === stageId) as (ProgramChecklistStage & { tasks?: ProgramChecklistTask[] }) | undefined;
    const tasks = [...(stage?.tasks || [])].sort((a, b) => a.sort_order - b.sort_order);
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index < 0) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;
    const current = tasks[index];
    const target = tasks[targetIndex];
    try {
      const now = new Date().toISOString();
      const { error: e1 } = await supabase
        .from('program_checklist_tasks')
        .update({ sort_order: target.sort_order, updated_at: now })
        .eq('id', current.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from('program_checklist_tasks')
        .update({ sort_order: current.sort_order, updated_at: now })
        .eq('id', target.id);
      if (e2) throw e2;
      await loadChecklists();
    } catch (e: any) {
      setError(e?.message || 'Failed to reorder item');
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

  const handleSeedDefaultTemplate = async () => {
    if (!programs.length) return;
    if (!window.confirm('Create editable default 4-stage checklists for all active programs that do not already have one?')) return;
    setTemplateSeeding(true);
    setError(null);
    try {
      let createdCount = 0;
      for (const program of programs) {
        const existing = checklists.find((c) => c.program_id === program.id && c.name.toLowerCase() === 'default 4-stage checklist');
        if (existing) continue;
        const currentForProgram = checklists.filter((c) => c.program_id === program.id).length;
        const { data: insertedChecklist, error: checklistErr } = await supabase
          .from('program_checklists')
          .insert({
            program_id: program.id,
            name: 'Default 4-Stage Checklist',
            show_before_default: false,
            sort_order: currentForProgram
          })
          .select('id')
          .single();
        if (checklistErr || !insertedChecklist?.id) throw checklistErr || new Error(`Failed to create checklist for ${program.name}`);

        const stagePayload = DEFAULT_MILESTONE_TEMPLATE_STAGES.map((stage, idx) => ({
          checklist_id: insertedChecklist.id,
          sort_order: idx,
          title: stage.title,
          subtitle: stage.subtitle,
          color_hex: stagePalette[stage.id],
          objectives: stage.objectives,
          goal: stage.goal
        }));
        const { data: insertedStages, error: stageErr } = await supabase
          .from('program_checklist_stages')
          .insert(stagePayload)
          .select('id, title');
        if (stageErr || !insertedStages?.length) throw stageErr || new Error(`Failed to create stages for ${program.name}`);

        const stageIdByTitle = new Map(insertedStages.map((s: { id: string; title: string }) => [s.title, s.id]));
        const taskPayload: Array<{
          stage_id: string;
          sort_order: number;
          task_id_suffix: string;
          text_content: string;
          links: ProgramChecklistTaskLink[];
        }> = [];
        DEFAULT_MILESTONE_TEMPLATE_STAGES.forEach((stageTemplate) => {
          const stageId = stageIdByTitle.get(stageTemplate.title);
          if (!stageId) return;
          stageTemplate.tasks.forEach((task, taskIndex) => {
            taskPayload.push({
              stage_id: stageId,
              sort_order: taskIndex,
              task_id_suffix: String(taskIndex + 1),
              text_content: task.text,
              links: task.links || []
            });
          });
        });
        if (taskPayload.length) {
          const { error: taskErr } = await supabase.from('program_checklist_tasks').insert(taskPayload);
          if (taskErr) throw taskErr;
        }
        createdCount += 1;
      }
      await loadChecklists();
      if (createdCount === 0) {
        setError('Default template already exists for all active programs.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to seed default template');
    } finally {
      setTemplateSeeding(false);
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
        Checklist content is editable here. Templates can be seeded for all programs, and each checklist can be toggled on/off and reordered.
      </Typography>
      <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Default Stage Accordion Palette</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          These colors control Stage 1-4 accordion headers in the PECC checklist pages.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 1 }}>
          {(['stage1', 'stage2', 'stage3', 'stage4'] as const).map((k) => (
            <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                label={k.toUpperCase()}
                size="small"
                value={stagePalette[k]}
                onChange={(e) => setStagePalette((prev) => ({ ...prev, [k]: e.target.value }))}
                sx={{ flex: 1 }}
              />
              <ColorSwatch color={stagePalette[k]} label={k.toUpperCase()} />
            </Box>
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
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Button
          variant="outlined"
          onClick={handleSeedDefaultTemplate}
          disabled={templateSeeding || programs.length === 0}
        >
          {templateSeeding ? 'Creating templates…' : 'Load default 4-stage template for all programs'}
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Program</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Enabled</TableCell>
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
                <TableCell>
                  <Switch
                    size="small"
                    checked={isChecklistEnabled(c.id)}
                    onChange={(e) => { void handleToggleChecklistEnabled(c.id, e.target.checked); }}
                  />
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
                    <IconButton size="small" onClick={() => { void handleMoveStage(c.id, stage.id, 'up'); }} title="Move stage up">
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => { void handleMoveStage(c.id, stage.id, 'down'); }} title="Move stage down">
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
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
                        <IconButton size="small" onClick={() => { void handleMoveTask(stage.id, t.id, 'up'); }} title="Move item up">
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => { void handleMoveTask(stage.id, t.id, 'down'); }} title="Move item down">
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              fullWidth
              label="Color (hex)"
              value={stageForm.color_hex}
              onChange={(e) => setStageForm((f) => ({ ...f, color_hex: e.target.value }))}
              margin="dense"
              placeholder="#2196F3"
            />
            <ColorSwatch color={stageForm.color_hex} label="Stage color" />
          </Box>
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
