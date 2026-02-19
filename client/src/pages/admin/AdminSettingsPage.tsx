import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  AccordionDetails,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import { supabase } from '../../supabase';
import type { RegistrationQuestion, RegistrationQuestionType, RegistrationQuestionDisplayCondition } from '../../types/database';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, UserRole } from '../../types/database';
import ScormPackagesSection from '../../components/ScormPackagesSection';
import { useAuth } from '../../context/AuthContext';
import EducationRichTextEditor from '../../components/admin/EducationRichTextEditor';

// Lazy load Programs and Cohorts pages to embed in settings
const AdminProgramsContent = lazy(() => import('./AdminProgramsPage'));
const AdminCohortsContent = lazy(() => import('./AdminCohortsPage'));
const GranularPermissionsManager = lazy(() => import('../../components/admin/GranularPermissionsManager'));

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

const CRM_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'department', label: 'Department' },
  { value: 'hospital_system', label: 'Hospital System' },
  { value: 'nprqi_participant', label: 'NPRQI Participant' },
  { value: 'additional_contact_name', label: 'Additional Contact Name' },
  { value: 'additional_contact_email', label: 'Additional Contact Email' },
  { value: 'additional_contact_job_title', label: 'Additional Contact Job Title' },
  { value: 'hospital', label: 'Hospital (State, City, Name from CRM)' }
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
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Map tab query param to index
  const tabParamToIndex: Record<string, number> = useMemo(() => ({
    'registration': 0,
    'permissions': 1,
    'granular-permissions': 2,
    'email-settings': 3,
    'modules': 4,
    'programs': 5,
    'cohorts': 6,
    'activity-categories': 7,
    'education': 8,
    'simulations': 9
  }), []);

  const tabIndexToParam: Record<number, string> = useMemo(() => ({
    0: 'registration',
    1: 'permissions',
    2: 'granular-permissions',
    3: 'email-settings',
    4: 'modules',
    5: 'programs',
    6: 'cohorts',
    7: 'activity-categories',
    8: 'education',
    9: 'simulations'
  }), []);

  // Initialize tab from URL or default to 0
  const initialTab = tabParamToIndex[searchParams.get('tab') || ''] ?? 0;
  const [tabIndex, setTabIndex] = useState(initialTab);

  // Update URL when tab changes
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
    const tabParam = tabIndexToParam[newValue];
    if (tabParam && tabParam !== 'registration') {
      setSearchParams({ tab: tabParam });
    } else {
      setSearchParams({});
    }
  };

  // ---- Registration state ----
  const [questions, setQuestions] = useState<RegistrationQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [regError, setRegError] = useState('');
  const [regRoleFilter, setRegRoleFilter] = useState<string>('all');
  
  // Email settings
  const [emailConfirmationMessage, setEmailConfirmationMessage] = useState(
    'After completing registration, you will receive an email to confirm your account. Please check your inbox and click the confirmation link before logging in.'
  );
  
  // Activity Categories state
  const [peccCategories, setPeccCategories] = useState<string[]>([]);
  const [mentorCategories, setMentorCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [newCategoryValue, setNewCategoryValue] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryType, setCategoryType] = useState<'pecc' | 'mentor'>('pecc');
  
  
  // Education Questions state
  interface EducationQuestion {
    questionId: string;
    category: string;
    question: string;
    why: string;
    background: string;
    example: string;
    sustainability: string;
    resources: string[]; // Format: "Title (URL)" or just "URL"
  }
  const [educationQuestions, setEducationQuestions] = useState<EducationQuestion[]>([]);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [educationForm, setEducationForm] = useState<EducationQuestion>({
    questionId: '',
    category: '',
    question: '',
    why: '',
    background: '',
    example: '',
    sustainability: '',
    resources: []
  });
  const [newResource, setNewResource] = useState('');

  // PECC Simulations (Simulation tab list) - all fields optional
  interface PeccSimulation {
    id: string;
    name: string | null;
    url: string | null;
    learning_objectives: string | null;
    additional_resources: { name: string; url: string }[];
    display_order: number;
  }
  const [simulationsList, setSimulationsList] = useState<PeccSimulation[]>([]);
  const [simulationsLoading, setSimulationsLoading] = useState(false);
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const [editingSimId, setEditingSimId] = useState<string | null>(null);
  const [simForm, setSimForm] = useState<{
    name: string;
    url: string;
    learning_objectives: string;
    additional_resources: { name: string; url: string }[];
  }>({ name: '', url: '', learning_objectives: '', additional_resources: [] });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<RegistrationQuestionType>('short_answer');
  const [formRequired, setFormRequired] = useState(false);
  const [formOptionsText, setFormOptionsText] = useState('');
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formTargetRoles, setFormTargetRoles] = useState<string[]>(['pecc', 'mentor', 'manager']);
  const [formShowWhenQuestionId, setFormShowWhenQuestionId] = useState<string>('');
  const [formShowWhenOperator, setFormShowWhenOperator] = useState<'equals' | 'not_empty' | 'in'>('equals');
  const [formShowWhenValue, setFormShowWhenValue] = useState('');
  const [formLinkedCrmField, setFormLinkedCrmField] = useState<string>('');
  const [formTargetProgramIds, setFormTargetProgramIds] = useState<string[]>([]);
  const [formTargetCohortIds, setFormTargetCohortIds] = useState<string[]>([]);
  const [formDisplayInCrm, setFormDisplayInCrm] = useState(false);
  const [programsList, setProgramsList] = useState<{ id: string; name: string }[]>([]);
  const [cohortsList, setCohortsList] = useState<{ id: string; name: string }[]>([]);

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
      const rows = (data || []).map((r: Record<string, unknown>) => {
        const targetRoles = r.target_roles != null && Array.isArray(r.target_roles) ? (r.target_roles as unknown[]).map(x => String(x)) : null;
        const dc = r.display_condition as RegistrationQuestionDisplayCondition | null | undefined;
        const targetProgramIds = r.target_program_ids != null && Array.isArray(r.target_program_ids) ? (r.target_program_ids as unknown[]).map(x => String(x)) : null;
        const targetCohortIds = r.target_cohort_ids != null && Array.isArray(r.target_cohort_ids) ? (r.target_cohort_ids as unknown[]).map(x => String(x)) : null;
        return {
          id: String(r.id),
          label: String(r.label),
          question_type: (r.question_type as RegistrationQuestionType) || 'short_answer',
          required: Boolean(r.required),
          options: Array.isArray(r.options) ? (r.options as unknown[]).map(x => String(x)) : [],
          sort_order: Number(r.sort_order) || 0,
          is_active: Boolean(r.is_active),
          created_at: r.created_at as string | undefined,
          updated_at: r.updated_at as string | undefined,
          target_roles: targetRoles,
          display_condition: dc && typeof dc === 'object' && dc.question_id ? dc : null,
          linked_crm_field: r.linked_crm_field != null ? String(r.linked_crm_field) : null,
          target_program_ids: targetProgramIds,
          target_cohort_ids: targetCohortIds,
          display_in_crm: Boolean(r.display_in_crm)
        };
      });
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
    (async () => {
      const [pRes, cRes] = await Promise.all([
        supabase.from('programs').select('id, name').order('name'),
        supabase.from('cohorts').select('id, name').order('name')
      ]);
      setProgramsList((pRes.data || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name || '' })));
      setCohortsList((cRes.data || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name || '' })));
    })();
  }, []);

  const loadSimulations = async () => {
    setSimulationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pecc_simulations')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setSimulationsList((data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: r.name != null ? String(r.name) : null,
        url: r.url != null ? String(r.url) : null,
        learning_objectives: r.learning_objectives != null ? String(r.learning_objectives) : null,
        additional_resources: Array.isArray(r.additional_resources)
          ? (r.additional_resources as { name?: string; url?: string }[]).map(x => ({
              name: x?.name ?? '',
              url: x?.url ?? ''
            }))
          : [],
        display_order: Number(r.display_order) ?? 0
      })));
    } catch (e) {
      console.error('Load pecc_simulations:', e);
      setSimulationsList([]);
    } finally {
      setSimulationsLoading(false);
    }
  };
  useEffect(() => { loadSimulations(); }, []);
  
  // Default PECC/Mentor categories (used when no value in DB)
  const DEFAULT_PECC_CATEGORIES = [
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
  const DEFAULT_MENTOR_CATEGORIES = [
    { value: 'PE', label: 'PE - PRISM Education & Training' },
    { value: 'TR', label: 'TR - Training with PECC' },
    { value: 'AD', label: 'AD - General Administration Tasks' },
    { value: 'RA', label: 'RA - Readiness Assessment' },
    { value: 'SC', label: 'SC - Simulation Case Facilitation' },
    { value: 'DM', label: 'DM - Domain Implementation' }
  ];

  // Load all app settings from Supabase (syncs across devices)
  const loadAppSettings = async () => {
    const keys = ['email_confirmation_message', 'pecc_activity_categories', 'mentor_activity_categories', 'education_questions'];
    const { data: rows } = await supabase.from('app_settings').select('key, value').in('key', keys);
    const byKey = new Map((rows || []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
    if (byKey.has('email_confirmation_message') && byKey.get('email_confirmation_message') != null) {
      setEmailConfirmationMessage(String(byKey.get('email_confirmation_message')));
    }
    const peccVal = byKey.get('pecc_activity_categories');
    if (peccVal != null && Array.isArray(peccVal)) {
      setPeccCategories(peccVal as string[]);
    } else {
      setPeccCategories(DEFAULT_PECC_CATEGORIES);
    }
    const mentorVal = byKey.get('mentor_activity_categories');
    if (mentorVal != null && Array.isArray(mentorVal)) {
      setMentorCategories(mentorVal as Array<{ value: string; label: string }>);
    } else {
      setMentorCategories(DEFAULT_MENTOR_CATEGORIES);
    }
    const eduVal = byKey.get('education_questions');
    if (eduVal != null && Array.isArray(eduVal)) {
      setEducationQuestions((eduVal as any[]).map((q: any) => ({ ...q, category: q.category ?? '' })));
    } else {
      setEducationQuestions([]);
    }
  };

  useEffect(() => {
    loadAppSettings();
  }, []);

  const saveAppSetting = async (key: string, value: unknown) => {
    await supabase.from('app_settings').upsert(
      { key, value: value as any, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  };
  
  const handleOpenEducationDialog = (question?: EducationQuestion) => {
    if (question) {
      setEditingEducationId(question.questionId);
      setEducationForm({ ...question, category: question.category ?? '' });
    } else {
      setEditingEducationId(null);
      setEducationForm({
        questionId: '',
        category: '',
        question: '',
        why: '',
        background: '',
        example: '',
        sustainability: '',
        resources: []
      });
    }
    setNewResource('');
    setEducationDialogOpen(true);
  };
  
  const handleSaveEducationQuestion = async () => {
    const form = { ...educationForm };
    if (!form.questionId.trim()) {
      form.questionId = `_${Date.now()}`;
    }
    const updated = editingEducationId
      ? educationQuestions.map(q => q.questionId === editingEducationId ? form : q)
      : [...educationQuestions, form];
    setEducationQuestions(updated);
    await saveAppSetting('education_questions', updated);
    setEducationDialogOpen(false);
    setSnackbar({ open: true, message: 'Education question saved', severity: 'success' });
  };
  
  const handleDeleteEducationQuestion = async (questionId: string) => {
    if (!window.confirm(`Delete education content for Question ${questionId}?`)) return;
    const updated = educationQuestions.filter(q => q.questionId !== questionId);
    setEducationQuestions(updated);
    await saveAppSetting('education_questions', updated);
    setSnackbar({ open: true, message: 'Education question deleted', severity: 'success' });
  };

  const openSimDialog = (sim?: PeccSimulation) => {
    if (sim) {
      setEditingSimId(sim.id);
      setSimForm({
        name: sim.name ?? '',
        url: sim.url ?? '',
        learning_objectives: sim.learning_objectives ?? '',
        additional_resources: (sim.additional_resources || []).length ? sim.additional_resources : [{ name: '', url: '' }]
      });
    } else {
      setEditingSimId(null);
      setSimForm({ name: '', url: '', learning_objectives: '', additional_resources: [] });
    }
    setSimDialogOpen(true);
  };
  const handleSaveSim = async () => {
    const payload = {
      name: simForm.name.trim() || null,
      url: simForm.url.trim() || null,
      learning_objectives: simForm.learning_objectives.trim() || null,
      additional_resources: simForm.additional_resources
        .filter(r => (r.name && r.name.trim()) || (r.url && r.url.trim()))
        .map(r => ({ name: (r.name || '').trim(), url: (r.url || '').trim() })),
      updated_at: new Date().toISOString()
    };
    try {
      if (editingSimId) {
        const { error } = await supabase.from('pecc_simulations').update(payload).eq('id', editingSimId);
        if (error) throw error;
      } else {
        const maxOrder = simulationsList.length ? Math.max(...simulationsList.map(s => s.display_order), 0) : 0;
        const { error } = await supabase.from('pecc_simulations').insert({
          ...payload,
          display_order: maxOrder + 1
        });
        if (error) throw error;
      }
      setSimDialogOpen(false);
      loadSimulations();
      setSnackbar({ open: true, message: 'Simulation saved', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'Failed to save simulation', severity: 'error' });
    }
  };
  const handleDeleteSim = async (id: string) => {
    if (!window.confirm('Remove this simulation from the list?')) return;
    try {
      const { error } = await supabase.from('pecc_simulations').delete().eq('id', id);
      if (error) throw error;
      loadSimulations();
      setSnackbar({ open: true, message: 'Simulation removed', severity: 'success' });
    } catch (e) {
      setSnackbar({ open: true, message: e instanceof Error ? e.message : 'Failed to delete', severity: 'error' });
    }
  };

  const handleAddResource = () => {
    if (newResource.trim()) {
      setEducationForm(prev => ({
        ...prev,
        resources: [...prev.resources, newResource.trim()]
      }));
      setNewResource('');
    }
  };
  
  const handleRemoveResource = (index: number) => {
    setEducationForm(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }));
  };
  
  const handleSaveEmailSettings = async () => {
    await saveAppSetting('email_confirmation_message', emailConfirmationMessage);
    setSnackbar({ open: true, message: 'Email settings saved successfully', severity: 'success' });
  };
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
    setFormTargetRoles(['pecc', 'mentor', 'manager']);
    setFormShowWhenQuestionId('');
    setFormShowWhenOperator('equals');
    setFormShowWhenValue('');
    setFormLinkedCrmField('');
    setFormTargetProgramIds([]);
    setFormTargetCohortIds([]);
    setFormDisplayInCrm(false);
    setDialogOpen(true);
  };
  const openEdit = (q: RegistrationQuestion) => {
    setEditingId(q.id);
    setFormLabel(q.label);
    setFormType(q.question_type);
    setFormRequired(q.required);
    setFormOptionsText((q.options || []).join('\n'));
    setFormSortOrder(q.sort_order);
    setFormTargetRoles((q.target_roles?.length ? q.target_roles : ['pecc', 'mentor', 'manager']).slice());
    const dc = q.display_condition;
    setFormShowWhenQuestionId(dc?.question_id ?? '');
    setFormShowWhenOperator(dc?.operator ?? 'equals');
    setFormShowWhenValue(Array.isArray(dc?.value) ? ((dc?.value) as string[]).join(', ') : (dc?.value ?? ''));
    setFormLinkedCrmField(q.linked_crm_field ?? '');
    setFormTargetProgramIds(Array.isArray(q.target_program_ids) ? q.target_program_ids.slice() : []);
    setFormTargetCohortIds(Array.isArray(q.target_cohort_ids) ? q.target_cohort_ids.slice() : []);
    setFormDisplayInCrm(Boolean(q.display_in_crm));
    setDialogOpen(true);
  };
  const handleRegSave = async () => {
    if (!formLabel.trim()) { setRegError('Label is required.'); return; }
    const options = formOptionsText.trim() ? formOptionsText.split('\n').map(s => s.trim()).filter(Boolean) : [];
    const linkedHospital = formLinkedCrmField === 'hospital';
    if ((formType === 'radio' || formType === 'select') && options.length === 0 && !linkedHospital) {
      setRegError('Radio and Select need at least one option (one per line).');
      return;
    }
    setRegError('');
    const targetRoles = formTargetRoles.length ? formTargetRoles : ['pecc', 'mentor', 'manager'];
    const displayCondition: RegistrationQuestionDisplayCondition | null = formShowWhenQuestionId
      ? {
          question_id: formShowWhenQuestionId,
          operator: formShowWhenOperator,
          ...(formShowWhenOperator === 'equals' && formShowWhenValue.trim() ? { value: formShowWhenValue.trim() } : {}),
          ...(formShowWhenOperator === 'in' && formShowWhenValue.trim() ? { value: formShowWhenValue.split(',').map(s => s.trim()).filter(Boolean) } : {})
        }
      : null;
    const basePayload = {
      label: formLabel.trim(),
      question_type: formType,
      required: formRequired,
      options,
      sort_order: formSortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
      linked_crm_field: formLinkedCrmField.trim() || null,
      target_program_ids: formTargetProgramIds.length ? formTargetProgramIds : null,
      target_cohort_ids: formTargetCohortIds.length ? formTargetCohortIds : null,
      display_in_crm: formDisplayInCrm
    };
    const fullPayload = { ...basePayload, target_roles: targetRoles, display_condition: displayCondition };
    try {
      if (editingId) {
        const { error: err } = await supabase.from('registration_questions').update(fullPayload).eq('id', editingId);
        if (err) throw err;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('registration_questions')
          .insert(basePayload)
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        if (inserted?.id && (targetRoles?.length > 0 || displayCondition != null)) {
          await supabase
            .from('registration_questions')
            .update({ target_roles: targetRoles, display_condition: displayCondition, updated_at: new Date().toISOString() })
            .eq('id', inserted.id);
        }
        // target_program_ids, target_cohort_ids, display_in_crm are in basePayload
      }
      setDialogOpen(false);
      loadQuestions();
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string };
      const msg = err?.message || (e instanceof Error ? e.message : 'Failed to save');
      setRegError(msg);
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

      <Tabs 
        value={tabIndex} 
        onChange={handleTabChange} 
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        <Tab label="Registration Questions" />
        <Tab label="Permissions" />
        <Tab label="Granular Permissions" />
        <Tab label="Email Settings" />
        <Tab label="Learning Modules" />
        <Tab label="Programs" />
        <Tab label="Cohorts" />
        <Tab label="Activity Categories" />
        <Tab label="Education" />
        <Tab label="Simulations" />
      </Tabs>

      {/* Registration Questions */}
      {tabIndex === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>Registration Questions</Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Add, edit, or remove questions on the registration form. Questions can be targeted to specific user roles (PECC, Mentor, Manager, Admin).
          </Typography>
          {regError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRegError('')}>{regError}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add question</Button>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by role</InputLabel>
              <Select
                value={regRoleFilter}
                onChange={(e) => setRegRoleFilter(e.target.value)}
                label="Filter by role"
              >
                <MenuItem value="all">All roles</MenuItem>
                <MenuItem value="pecc">PECC</MenuItem>
                <MenuItem value="mentor">Mentor</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>
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
                    <TableCell>CRM field</TableCell>
                    <TableCell>Programs / Cohorts</TableCell>
                    <TableCell>In CRM</TableCell>
                    <TableCell>Target Roles</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>Options</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {questions
                    .filter(q => {
                      if (regRoleFilter === 'all') return true;
                      return q.target_roles?.includes(regRoleFilter) || (!q.target_roles && regRoleFilter === 'pecc');
                    })
                    .map(q => (
                    <TableRow key={q.id}>
                      <TableCell>{q.sort_order}</TableCell>
                      <TableCell>{q.label}</TableCell>
                      <TableCell>{QUESTION_TYPES.find(t => t.value === q.question_type)?.label ?? q.question_type}</TableCell>
                      <TableCell>{q.linked_crm_field ? (CRM_FIELD_OPTIONS.find(o => o.value === q.linked_crm_field)?.label ?? q.linked_crm_field) : (q.display_in_crm ? '—' : '—')}</TableCell>
                      <TableCell>
                        {((q.target_program_ids?.length ?? 0) + (q.target_cohort_ids?.length ?? 0)) > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 160 }}>
                            {(q.target_program_ids || []).map(pid => (
                              <Chip key={pid} label={programsList.find(p => p.id === pid)?.name || pid} size="small" variant="outlined" />
                            ))}
                            {(q.target_cohort_ids || []).map(cid => (
                              <Chip key={cid} label={cohortsList.find(c => c.id === cid)?.name || cid} size="small" variant="outlined" color="primary" />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">All</Typography>
                        )}
                      </TableCell>
                      <TableCell>{q.display_in_crm ? 'Yes' : '—'}</TableCell>
                      <TableCell>
                        {q.target_roles && q.target_roles.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {q.target_roles.map(role => (
                              <Chip key={role} label={role.toUpperCase()} size="small" variant="outlined" />
                            ))}
                          </Box>
                        ) : (
                          <Chip label="All" size="small" variant="outlined" color="default" />
                        )}
                      </TableCell>
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

      {/* Granular Permissions */}
      {tabIndex === 2 && (
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}>
          <GranularPermissionsManager mode="admin" initialSelectedUserId={searchParams.get('userId') || undefined} />
        </Suspense>
      )}

      {/* Email Settings */}
      {tabIndex === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>Email Settings</Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Customize email messages sent to users during account creation and invitation acceptance.
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Note:</strong> Email templates are managed through Supabase Dashboard → Authentication → Email Templates.
            </Typography>
            <Typography variant="body2">
              However, you can customize the notification message shown to users after they create an account below.
            </Typography>
          </Alert>
          
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Account Confirmation Message</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This message is shown to users after they complete registration via an invitation link. It informs them about the email confirmation step.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={emailConfirmationMessage}
              onChange={(e) => setEmailConfirmationMessage(e.target.value)}
              placeholder="After completing registration, you will receive an email to confirm your account. Please check your inbox and click the confirmation link before logging in."
              sx={{ mb: 2 }}
            />
            <Button variant="contained" onClick={handleSaveEmailSettings} startIcon={<SaveIcon />}>
              Save Email Settings
            </Button>
          </Paper>
          
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Invitation Email Preview</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              When you send an invitation, the user receives an email with a link to complete registration. The email template can be customized in Supabase Dashboard.
            </Typography>
            <Alert severity="warning">
              To customize the actual email template, go to Supabase Dashboard → Authentication → Email Templates → Confirm signup.
            </Alert>
          </Paper>
        </Box>
      )}

      {/* Learning Modules (SCORM) */}
      {tabIndex === 4 && (
        <Box>
          <Typography variant="h6" gutterBottom>Learning Modules</Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Upload and manage SCORM learning modules. Only Admins can add modules; all users can launch any modules that apply to their hospital/program.
          </Typography>
          <ScormPackagesSection title="Learning Modules" />
        </Box>
      )}

      {/* Programs */}
      {tabIndex === 5 && (
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}>
          <AdminProgramsContent />
        </Suspense>
      )}

      {/* Cohorts */}
      {tabIndex === 6 && (
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}>
          <AdminCohortsContent />
        </Suspense>
      )}

      {/* Activity Categories */}
      {tabIndex === 7 && (
        <Box>
          <Typography variant="h6" gutterBottom>Activity Categories</Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            Manage activity categories for PECC and Mentor activity logging. Changes will be reflected immediately in the Activities pages.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant={categoryType === 'pecc' ? 'contained' : 'outlined'}
              onClick={() => setCategoryType('pecc')}
            >
              PECC Categories
            </Button>
            <Button
              variant={categoryType === 'mentor' ? 'contained' : 'outlined'}
              onClick={() => setCategoryType('mentor')}
            >
              Mentor Categories
            </Button>
          </Box>

          {/* PECC Categories */}
          {categoryType === 'pecc' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">PECC Activity Categories</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingCategoryIndex(null);
                    setNewCategoryValue('');
                    setCategoryDialogOpen(true);
                  }}
                >
                  Add Category
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Category Name</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {peccCategories.map((category, index) => (
                      <TableRow key={index}>
                        <TableCell>{category}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingCategoryIndex(index);
                              setNewCategoryValue(category);
                              setCategoryDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (window.confirm(`Delete "${category}"?`)) {
                                const updated = peccCategories.filter((_, i) => i !== index);
                                setPeccCategories(updated);
                                saveAppSetting('pecc_activity_categories', updated);
                                setSnackbar({ open: true, message: 'Category deleted', severity: 'success' });
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Mentor Categories */}
          {categoryType === 'mentor' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">Mentor Activity Categories</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingCategoryIndex(null);
                    setNewCategoryValue('');
                    setNewCategoryLabel('');
                    setCategoryDialogOpen(true);
                  }}
                >
                  Add Category
                </Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Value</TableCell>
                      <TableCell>Label</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mentorCategories.map((category, index) => (
                      <TableRow key={index}>
                        <TableCell>{category.value}</TableCell>
                        <TableCell>{category.label}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingCategoryIndex(index);
                              setNewCategoryValue(category.value);
                              setNewCategoryLabel(category.label);
                              setCategoryDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              if (window.confirm(`Delete "${category.label}"?`)) {
                                const updated = mentorCategories.filter((_, i) => i !== index);
                                setMentorCategories(updated);
                                saveAppSetting('mentor_activity_categories', updated);
                                setSnackbar({ open: true, message: 'Category deleted', severity: 'success' });
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Box>
      )}

      {/* Education Questions */}
      {tabIndex === 8 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6">Education Questions</Typography>
              <Typography color="textSecondary">
                Manage educational content for PRS questions. Each question can have a template with Question, Why, Background, Example, Sustainability Practices, and Additional Resources.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenEducationDialog()}
            >
              Add Question
            </Button>
          </Box>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Question ID</TableCell>
                  <TableCell>Question Preview</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {educationQuestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography color="textSecondary">No education questions yet. Add your first question.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  educationQuestions.map((eq) => (
                    <TableRow key={eq.questionId}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {eq.category?.trim() ? `Question ${eq.questionId}: ${eq.category}` : `Question ${eq.questionId}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {eq.question || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEducationDialog(eq)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEducationQuestion(eq.questionId)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Simulations (PECC Simulation tab list) */}
      {tabIndex === 9 && (
        <Box>
          <Typography variant="h6" gutterBottom>Simulations</Typography>
          <Typography color="textSecondary" sx={{ mb: 2 }}>
            Manage the list of simulations shown on the PECC Simulation tab. All fields are optional.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openSimDialog()} sx={{ mb: 2 }}>
            Add simulation
          </Button>
          {simulationsLoading ? (
            <Typography>Loading…</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>URL</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {simulationsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography color="textSecondary">No simulations yet. Add one to show on the Simulation tab.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    simulationsList.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.name || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.url || '—'}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openSimDialog(s)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleDeleteSim(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Simulation Add/Edit Dialog */}
      <Dialog open={simDialogOpen} onClose={() => setSimDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSimId ? 'Edit simulation' : 'Add simulation'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Name" value={simForm.name} onChange={e => setSimForm(prev => ({ ...prev, name: e.target.value }))} margin="normal" placeholder="Optional" />
          <TextField fullWidth label="URL" value={simForm.url} onChange={e => setSimForm(prev => ({ ...prev, url: e.target.value }))} margin="normal" placeholder="Optional — name will link here" />
          <TextField fullWidth label="Learning objectives" value={simForm.learning_objectives} onChange={e => setSimForm(prev => ({ ...prev, learning_objectives: e.target.value }))} margin="normal" multiline rows={4} placeholder="Optional — one per line (shown as bullets)" />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Additional resources (optional)</Typography>
          {simForm.additional_resources.map((res, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <TextField size="small" label="Name" value={res.name} onChange={e => setSimForm(prev => ({ ...prev, additional_resources: prev.additional_resources.map((r, i) => i === idx ? { ...r, name: e.target.value } : r) }))} placeholder="Label" sx={{ flex: 1 }} />
              <TextField size="small" label="URL" value={res.url} onChange={e => setSimForm(prev => ({ ...prev, additional_resources: prev.additional_resources.map((r, i) => i === idx ? { ...r, url: e.target.value } : r) }))} placeholder="https://…" sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => setSimForm(prev => ({ ...prev, additional_resources: prev.additional_resources.filter((_, i) => i !== idx) }))}><DeleteIcon fontSize="small" /></IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={() => setSimForm(prev => ({ ...prev, additional_resources: [...prev.additional_resources, { name: '', url: '' }] }))}>
            Add resource
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSimDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveSim} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Education Question Edit Dialog */}
      <Dialog open={educationDialogOpen} onClose={() => setEducationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingEducationId ? `Edit Question ${editingEducationId}` : 'Add Education Question'}
        </DialogTitle>
        <DialogContent aria-describedby={undefined}>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Question ID"
              value={educationForm.questionId}
              onChange={(e) => setEducationForm(prev => ({ ...prev, questionId: e.target.value }))}
              margin="normal"
              helperText="Question number (e.g., 22, 23). Shown next to category on the Gaps & Education tab."
            />
            <TextField
              fullWidth
              label="Category"
              value={educationForm.category}
              onChange={(e) => setEducationForm(prev => ({ ...prev, category: e.target.value }))}
              margin="normal"
              placeholder="e.g., Coordination, Staffing"
              helperText="Shown next to the question number on the Gaps & Education tab."
            />
            <TextField
              fullWidth
              label="Assessment question (Learn more page)"
              value={educationForm.question}
              onChange={(e) => setEducationForm(prev => ({ ...prev, question: e.target.value }))}
              margin="normal"
              multiline
              rows={3}
              helperText="The actual question from the assessment. Shown at the top when users click Learn more."
            />
            <Box sx={{ mt: 2, mb: 1 }}>
              <EducationRichTextEditor
                value={educationForm.why}
                onChange={(value) => setEducationForm(prev => ({ ...prev, why: value }))}
                placeholder="Why this question is important..."
                minHeight={100}
                label="Why"
              />
            </Box>
            <Box sx={{ mt: 2, mb: 1 }}>
              <EducationRichTextEditor
                value={educationForm.background}
                onChange={(value) => setEducationForm(prev => ({ ...prev, background: value }))}
                placeholder="Background information and context..."
                minHeight={120}
                label="Background"
              />
            </Box>
            <Box sx={{ mt: 2, mb: 1 }}>
              <EducationRichTextEditor
                value={educationForm.example}
                onChange={(value) => setEducationForm(prev => ({ ...prev, example: value }))}
                placeholder="Example implementation or scenario..."
                minHeight={80}
                label="Example"
              />
            </Box>
            <Box sx={{ mt: 2, mb: 1 }}>
              <EducationRichTextEditor
                value={educationForm.sustainability}
                onChange={(value) => setEducationForm(prev => ({ ...prev, sustainability: value }))}
                placeholder="Best practices for maintaining this aspect..."
                minHeight={100}
                label="Sustainability Practices for PECC"
              />
            </Box>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Additional Resources
              </Typography>
              <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
                Format: "Resource Title (https://url.com)" or just "https://url.com"
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder='e.g., "EIIC PECC Toolkit (https://emscimprovement.center/domains/pecc/)"'
                  value={newResource}
                  onChange={(e) => setNewResource(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddResource();
                    }
                  }}
                />
                <Button variant="outlined" onClick={handleAddResource}>
                  Add
                </Button>
              </Box>
              {educationForm.resources.map((resource, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={resource}
                    onDelete={() => handleRemoveResource(index)}
                    sx={{ flex: 1, justifyContent: 'flex-start' }}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEducationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEducationQuestion} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Edit Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCategoryIndex !== null ? 'Edit Category' : 'Add Category'}
        </DialogTitle>
        <DialogContent aria-describedby={undefined}>
          {categoryType === 'pecc' ? (
            <TextField
              fullWidth
              label="Category Name"
              value={newCategoryValue}
              onChange={(e) => setNewCategoryValue(e.target.value)}
              margin="normal"
              required
            />
          ) : (
            <>
              <TextField
                fullWidth
                label="Value (Code)"
                value={newCategoryValue}
                onChange={(e) => setNewCategoryValue(e.target.value.toUpperCase())}
                margin="normal"
                required
                helperText="Short code (e.g., PE, TR, SC)"
              />
              <TextField
                fullWidth
                label="Label (Display Name)"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                margin="normal"
                required
                helperText="Full display name (e.g., PE - PRISM Education & Training)"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (categoryType === 'pecc') {
                if (!newCategoryValue.trim()) {
                  setSnackbar({ open: true, message: 'Category name is required', severity: 'error' });
                  return;
                }
                let updated: string[];
                if (editingCategoryIndex !== null) {
                  updated = [...peccCategories];
                  updated[editingCategoryIndex] = newCategoryValue.trim();
                } else {
                  updated = [...peccCategories, newCategoryValue.trim()];
                }
                setPeccCategories(updated);
                saveAppSetting('pecc_activity_categories', updated);
                setSnackbar({ open: true, message: 'Category saved', severity: 'success' });
              } else {
                if (!newCategoryValue.trim() || !newCategoryLabel.trim()) {
                  setSnackbar({ open: true, message: 'Both value and label are required', severity: 'error' });
                  return;
                }
                let updated: Array<{ value: string; label: string }>;
                if (editingCategoryIndex !== null) {
                  updated = [...mentorCategories];
                  updated[editingCategoryIndex] = { value: newCategoryValue.trim().toUpperCase(), label: newCategoryLabel.trim() };
                } else {
                  updated = [...mentorCategories, { value: newCategoryValue.trim().toUpperCase(), label: newCategoryLabel.trim() }];
                }
                setMentorCategories(updated);
                saveAppSetting('mentor_activity_categories', updated);
                setSnackbar({ open: true, message: 'Category saved', severity: 'success' });
              }
              setCategoryDialogOpen(false);
              setEditingCategoryIndex(null);
              setNewCategoryValue('');
              setNewCategoryLabel('');
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit question' : 'Add question'}</DialogTitle>
        <DialogContent aria-describedby={undefined}>
          <TextField fullWidth margin="normal" label="Label" value={formLabel} onChange={e => setFormLabel(e.target.value)} required />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select value={formType} label="Type" onChange={e => setFormType(e.target.value as RegistrationQuestionType)}>
              {QUESTION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel control={<Checkbox checked={formRequired} onChange={e => setFormRequired(e.target.checked)} />} label="Required" />
          {(formType === 'radio' || formType === 'select') && formLinkedCrmField !== 'hospital' && (
            <TextField fullWidth margin="normal" label="Options (one per line)" value={formOptionsText} onChange={e => setFormOptionsText(e.target.value)} multiline rows={4} placeholder="One option per line" />
          )}
          {formLinkedCrmField === 'hospital' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Registrants will choose from CRM hospitals: State → City → Hospital name. No options needed.</Typography>
          )}
          <TextField fullWidth margin="normal" type="number" label="Sort order" value={formSortOrder} onChange={e => setFormSortOrder(Number(e.target.value) || 0)} inputProps={{ min: 0 }} />

          <FormControl fullWidth margin="normal">
            <InputLabel>Link to CRM / User field</InputLabel>
            <Select value={formLinkedCrmField} label="Link to CRM / User field" onChange={e => setFormLinkedCrmField(e.target.value)}>
              {CRM_FIELD_OPTIONS.map(opt => (
                <MenuItem key={opt.value || 'none'} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>Answer is saved to the user profile and CRM. Use &quot;Hospital&quot; for state/city/hospital picker from CRM.</Typography>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={formDisplayInCrm} onChange={e => setFormDisplayInCrm(e.target.checked)} />}
            label="Create new CRM field (show this question's answer in CRM contact view)"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Use when the question is not linked to an existing user/CRM column above. Answer is stored and shown in the contact detail view.</Typography>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Show only for programs (optional)</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Programs</InputLabel>
            <Select
              multiple
              value={formTargetProgramIds}
              label="Programs"
              onChange={e => setFormTargetProgramIds(typeof e.target.value === 'string' ? [] : e.target.value)}
              renderValue={selected => (selected as string[]).map(id => programsList.find(p => p.id === id)?.name || id).join(', ')}
            >
              {programsList.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">Leave empty to show for all. When set, only users invited to one of these programs see this question.</Typography>
          </FormControl>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Show only for cohorts (optional)</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
            <InputLabel>Cohorts</InputLabel>
            <Select
              multiple
              value={formTargetCohortIds}
              label="Cohorts"
              onChange={e => setFormTargetCohortIds(typeof e.target.value === 'string' ? [] : e.target.value)}
              renderValue={selected => (selected as string[]).map(id => cohortsList.find(c => c.id === id)?.name || id).join(', ')}
            >
              {cohortsList.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary">Leave empty to show for all. When set, only users invited to one of these cohorts see this question (e.g. LA Peds Ready).</Typography>
          </FormControl>

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Show for roles (select all that apply)</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(['pecc', 'mentor', 'manager', 'admin'] as const).map(role => (
              <FormControlLabel
                key={role}
                control={<Checkbox checked={formTargetRoles.includes(role)} onChange={e => setFormTargetRoles(prev => e.target.checked ? [...prev, role] : prev.filter(r => r !== role))} />}
                label={role.charAt(0).toUpperCase() + role.slice(1)}
              />
            ))}
          </Box>
          {formTargetRoles.length === 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>Please select at least one role. If none are selected, the question will be shown to all roles.</Alert>
          )}

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Show only when (optional)</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>When this question...</InputLabel>
              <Select value={formShowWhenQuestionId} label="When this question..." onChange={e => setFormShowWhenQuestionId(e.target.value)}>
                <MenuItem value="">— Always show</MenuItem>
                {questions.filter(q => q.id !== editingId).map(q => (
                  <MenuItem key={q.id} value={q.id}>{q.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {formShowWhenQuestionId && (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>…is</InputLabel>
                  <Select value={formShowWhenOperator} label="…is" onChange={e => setFormShowWhenOperator(e.target.value as 'equals' | 'not_empty' | 'in')}>
                    <MenuItem value="equals">equals</MenuItem>
                    <MenuItem value="not_empty">not empty</MenuItem>
                    <MenuItem value="in">one of (comma-separated)</MenuItem>
                  </Select>
                </FormControl>
                {formShowWhenOperator !== 'not_empty' && (
                  <TextField size="small" label={formShowWhenOperator === 'in' ? 'Values (comma-separated)' : 'Value'} value={formShowWhenValue} onChange={e => setFormShowWhenValue(e.target.value)} placeholder={formShowWhenOperator === 'in' ? 'A, B, C' : 'e.g. Yes'} />
                )}
              </>
            )}
          </Box>
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
