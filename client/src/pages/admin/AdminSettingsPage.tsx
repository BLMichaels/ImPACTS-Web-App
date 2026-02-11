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
    'education': 8
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
    8: 'education'
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
  
  // PECC Dashboard Section Visibility state
  const [peccUsers, setPeccUsers] = useState<Array<{ id: string; email: string; firstName: string; lastName: string; prsSectionVisible: boolean }>>([]);
  const [loadingPeccUsers, setLoadingPeccUsers] = useState(false);
  
  // Education Questions state
  interface EducationQuestion {
    questionId: string;
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
    question: '',
    why: '',
    background: '',
    example: '',
    sustainability: '',
    resources: []
  });
  const [newResource, setNewResource] = useState('');
  
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
          display_condition: dc && typeof dc === 'object' && dc.question_id ? dc : null
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
  
  // Load email settings
  useEffect(() => {
    const saved = localStorage.getItem('email_confirmation_message');
    if (saved) {
      setEmailConfirmationMessage(saved);
    }
  }, []);
  
  // Load activity categories
  useEffect(() => {
    // Load PECC categories
    const savedPeccCategories = localStorage.getItem('pecc_activity_categories');
    if (savedPeccCategories) {
      setPeccCategories(JSON.parse(savedPeccCategories));
    } else {
      // Default PECC categories
      const defaultPecc = [
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
      setPeccCategories(defaultPecc);
      localStorage.setItem('pecc_activity_categories', JSON.stringify(defaultPecc));
    }
    
    // Load Mentor categories
    const savedMentorCategories = localStorage.getItem('mentor_activity_categories');
    if (savedMentorCategories) {
      setMentorCategories(JSON.parse(savedMentorCategories));
    } else {
      // Default Mentor categories
      const defaultMentor = [
        { value: 'PE', label: 'PE - PRISM Education & Training' },
        { value: 'TR', label: 'TR - Training with PECC' },
        { value: 'AD', label: 'AD - General Administration Tasks' },
        { value: 'RA', label: 'RA - Readiness Assessment' },
        { value: 'SC', label: 'SC - Simulation Case Facilitation' },
        { value: 'DM', label: 'DM - Domain Implementation' }
      ];
      setMentorCategories(defaultMentor);
      localStorage.setItem('mentor_activity_categories', JSON.stringify(defaultMentor));
    }
  }, []);
  
  // Load PECC users for PRS section toggle
  useEffect(() => {
    const loadPeccUsers = async () => {
      setLoadingPeccUsers(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .eq('role', 'pecc')
          .order('email');
        
        if (error) throw error;
        
        if (data) {
          const usersWithSettings = await Promise.all(
            data.map(async (user) => {
              // Check localStorage for PRS section visibility (default to true)
              const prsVisible = localStorage.getItem(`pecc_prs_section_visible_${user.id}`);
              return {
                id: user.id,
                email: user.email || '',
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                prsSectionVisible: prsVisible === null ? true : prsVisible === 'true'
              };
            })
          );
          setPeccUsers(usersWithSettings);
        }
      } catch (error) {
        console.error('Error loading PECC users:', error);
      } finally {
        setLoadingPeccUsers(false);
      }
    };
    
    loadPeccUsers();
  }, []);
  
  // Load Education Questions
  useEffect(() => {
    const saved = localStorage.getItem('education_questions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEducationQuestions(parsed);
        } else {
          // Default: load question 22
          const defaultQuestion: EducationQuestion = {
            questionId: '22',
            question: 'Does your ED have a physician/APP coordinator—sometimes referred to as a pediatric emergency care coordinator (PECC) or pediatric champion—who is assigned the role of overseeing various administrative aspects of pediatric emergency care (e.g., oversees quality improvement, collaborates with nursing, ensures pediatric skills of staff, develops and periodically reviews policies)?',
            why: 'A PECC ensures the ED maintains a consistent focus on pediatric-specific needs, promoting high quality and safe emergency care for children. PECCs drive system-wide improvements, protocol compliance, and advocacy for children at all care stages.',
            background: 'A PECC, often a physician champion, acts as a central figure driving pediatric quality and systems integration. Research demonstrates that EDs with a PECC achieve significantly higher pediatric readiness scores, which correlate with reduced pediatric mortality and better patient outcomes. The PECC role is endorsed by national organizations and is considered the foundation of a robust pediatric emergency care structure. The PECC facilitates multidisciplinary collaboration, supports ongoing education, and sustains improvement by coordinating QI projects, reviewing standards, and serving as a pediatric advocate within the ED and hospital.',
            example: 'The ED\'s physician PECC organizes pediatric simulation drills, reviews pediatric protocols regularly, and ensures ongoing pediatric staff training.',
            sustainability: 'Establish regular meetings with ED leadership and pediatric staff to align goals and review progress. Champion ongoing training and competency assessments for all staff. Develop a system for periodic review and updates of policies and pediatric guidelines. Foster collaboration with regional pediatric centers and networks for shared resources and mentorship.',
            resources: [
              'EIIC PECC Toolkit (https://emscimprovement.center/domains/pecc/)',
              'JAMA - PECC National Impact Study (https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828228)',
              'LA Peds Ready Facility Guide (https://partnersforfamilyhealth.org/wp-content/uploads/2023/03/EMSC_PedReadyFacilityGuide-3_2023-3.pdf)'
            ]
          };
          setEducationQuestions([defaultQuestion]);
          localStorage.setItem('education_questions', JSON.stringify([defaultQuestion]));
        }
      } catch (e) {
        console.error('Error loading education questions:', e);
      }
    } else {
      // Default: load question 22
      const defaultQuestion: EducationQuestion = {
        questionId: '22',
        question: 'Does your ED have a physician/APP coordinator—sometimes referred to as a pediatric emergency care coordinator (PECC) or pediatric champion—who is assigned the role of overseeing various administrative aspects of pediatric emergency care (e.g., oversees quality improvement, collaborates with nursing, ensures pediatric skills of staff, develops and periodically reviews policies)?',
        why: 'A PECC ensures the ED maintains a consistent focus on pediatric-specific needs, promoting high quality and safe emergency care for children. PECCs drive system-wide improvements, protocol compliance, and advocacy for children at all care stages.',
        background: 'A PECC, often a physician champion, acts as a central figure driving pediatric quality and systems integration. Research demonstrates that EDs with a PECC achieve significantly higher pediatric readiness scores, which correlate with reduced pediatric mortality and better patient outcomes. The PECC role is endorsed by national organizations and is considered the foundation of a robust pediatric emergency care structure. The PECC facilitates multidisciplinary collaboration, supports ongoing education, and sustains improvement by coordinating QI projects, reviewing standards, and serving as a pediatric advocate within the ED and hospital.',
        example: 'The ED\'s physician PECC organizes pediatric simulation drills, reviews pediatric protocols regularly, and ensures ongoing pediatric staff training.',
        sustainability: 'Establish regular meetings with ED leadership and pediatric staff to align goals and review progress. Champion ongoing training and competency assessments for all staff. Develop a system for periodic review and updates of policies and pediatric guidelines. Foster collaboration with regional pediatric centers and networks for shared resources and mentorship.',
        resources: [
          'EIIC PECC Toolkit (https://emscimprovement.center/domains/pecc/)',
          'JAMA - PECC National Impact Study (https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828228)',
          'LA Peds Ready Facility Guide (https://partnersforfamilyhealth.org/wp-content/uploads/2023/03/EMSC_PedReadyFacilityGuide-3_2023-3.pdf)'
        ]
      };
      setEducationQuestions([defaultQuestion]);
      localStorage.setItem('education_questions', JSON.stringify([defaultQuestion]));
    }
  }, []);
  
  const handleOpenEducationDialog = (question?: EducationQuestion) => {
    if (question) {
      setEditingEducationId(question.questionId);
      setEducationForm({ ...question });
    } else {
      setEditingEducationId(null);
      setEducationForm({
        questionId: '',
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
  
  const handleSaveEducationQuestion = () => {
    if (!educationForm.questionId.trim() || !educationForm.question.trim()) {
      setSnackbar({ open: true, message: 'Question ID and Question text are required', severity: 'error' });
      return;
    }
    
    const updated = editingEducationId
      ? educationQuestions.map(q => q.questionId === editingEducationId ? educationForm : q)
      : [...educationQuestions, educationForm];
    
    setEducationQuestions(updated);
    localStorage.setItem('education_questions', JSON.stringify(updated));
    setEducationDialogOpen(false);
    setSnackbar({ open: true, message: 'Education question saved successfully', severity: 'success' });
  };
  
  const handleDeleteEducationQuestion = (questionId: string) => {
    if (!window.confirm(`Delete education content for Question ${questionId}?`)) return;
    const updated = educationQuestions.filter(q => q.questionId !== questionId);
    setEducationQuestions(updated);
    localStorage.setItem('education_questions', JSON.stringify(updated));
    setSnackbar({ open: true, message: 'Education question deleted', severity: 'success' });
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
  
  const handleTogglePRSSection = async (userId: string, visible: boolean) => {
    localStorage.setItem(`pecc_prs_section_visible_${userId}`, String(visible));
    setPeccUsers(prev => prev.map(u => u.id === userId ? { ...u, prsSectionVisible: visible } : u));
    setSnackbar({ open: true, message: 'PRS section visibility updated', severity: 'success' });
  };
  
  const handleSaveEmailSettings = () => {
    localStorage.setItem('email_confirmation_message', emailConfirmationMessage);
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
    const targetRoles = formTargetRoles.length ? formTargetRoles : ['pecc', 'mentor', 'manager'];
    const displayCondition: RegistrationQuestionDisplayCondition | null = formShowWhenQuestionId
      ? {
          question_id: formShowWhenQuestionId,
          operator: formShowWhenOperator,
          ...(formShowWhenOperator === 'equals' && formShowWhenValue.trim() ? { value: formShowWhenValue.trim() } : {}),
          ...(formShowWhenOperator === 'in' && formShowWhenValue.trim() ? { value: formShowWhenValue.split(',').map(s => s.trim()).filter(Boolean) } : {})
        }
      : null;
    const payload = {
      label: formLabel.trim(),
      question_type: formType,
      required: formRequired,
      options,
      sort_order: formSortOrder,
      is_active: true,
      updated_at: new Date().toISOString(),
      target_roles: targetRoles,
      display_condition: displayCondition
    };
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

      <Tabs value={tabIndex} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab label="Registration Questions" />
        <Tab label="Permissions" />
        <Tab label="Granular Permissions" />
        <Tab label="Email Settings" />
        <Tab label="Learning Modules" />
        <Tab label="Programs" />
        <Tab label="Cohorts" />
        <Tab label="Activity Categories" />
        <Tab label="Education" />
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
          
          {/* PECC Dashboard Section Visibility */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>PECC Dashboard Section Visibility</Typography>
            <Typography color="textSecondary" sx={{ mb: 2 }}>
              Control which PECC users see the "Pediatric Readiness Scores" section on their dashboard. When disabled, the section will be hidden from both the Dashboard and Snapshot pages.
            </Typography>
            {loadingPeccUsers ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>PECC User</TableCell>
                      <TableCell align="center">Pediatric Readiness Scores Section</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {peccUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} align="center">
                          <Typography color="textSecondary">No PECC users found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      peccUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Typography variant="body2">
                              {user.firstName} {user.lastName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {user.email}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={user.prsSectionVisible}
                              onChange={(e) => handleTogglePRSSection(user.id, e.target.checked)}
                              color="primary"
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
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
          <GranularPermissionsManager mode="admin" />
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
                                localStorage.setItem('pecc_activity_categories', JSON.stringify(updated));
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
                                localStorage.setItem('mentor_activity_categories', JSON.stringify(updated));
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
                          Question {eq.questionId}
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
                          {eq.question}
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

      {/* Education Question Edit Dialog */}
      <Dialog open={educationDialogOpen} onClose={() => setEducationDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingEducationId ? `Edit Question ${editingEducationId}` : 'Add Education Question'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Question ID"
              value={educationForm.questionId}
              onChange={(e) => setEducationForm(prev => ({ ...prev, questionId: e.target.value }))}
              margin="normal"
              required
              helperText="The question number (e.g., 22, 23, etc.)"
            />
            <TextField
              fullWidth
              label="Question"
              value={educationForm.question}
              onChange={(e) => setEducationForm(prev => ({ ...prev, question: e.target.value }))}
              margin="normal"
              required
              multiline
              rows={3}
              helperText="The full question text"
            />
            <TextField
              fullWidth
              label="Why"
              value={educationForm.why}
              onChange={(e) => setEducationForm(prev => ({ ...prev, why: e.target.value }))}
              margin="normal"
              required
              multiline
              rows={3}
              helperText="Why this question is important"
            />
            <TextField
              fullWidth
              label="Background"
              value={educationForm.background}
              onChange={(e) => setEducationForm(prev => ({ ...prev, background: e.target.value }))}
              margin="normal"
              required
              multiline
              rows={4}
              helperText="Background information and context"
            />
            <TextField
              fullWidth
              label="Example"
              value={educationForm.example}
              onChange={(e) => setEducationForm(prev => ({ ...prev, example: e.target.value }))}
              margin="normal"
              required
              multiline
              rows={2}
              helperText="Example implementation or scenario"
            />
            <TextField
              fullWidth
              label="Sustainability Practices for PECC"
              value={educationForm.sustainability}
              onChange={(e) => setEducationForm(prev => ({ ...prev, sustainability: e.target.value }))}
              margin="normal"
              required
              multiline
              rows={3}
              helperText="Best practices for maintaining this aspect"
            />
            
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
        <DialogContent>
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
                localStorage.setItem('pecc_activity_categories', JSON.stringify(updated));
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
                localStorage.setItem('mentor_activity_categories', JSON.stringify(updated));
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
