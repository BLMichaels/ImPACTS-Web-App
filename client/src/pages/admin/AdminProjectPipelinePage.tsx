import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
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
  Chip,
  Grid,
  Divider,
  InputAdornment,
  Collapse,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  CircularProgress,
  Autocomplete,
  Menu,
  Tooltip,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Sort as SortIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { getUserData, setUserData } from '../../utils/userData';

/** Safely format a date; returns null if the date is invalid */
const safeFormatDate = (d: Date | null | undefined, fmt: string): string | null => {
  if (!d || !isValid(d)) return null;
  try {
    return format(d, fmt);
  } catch {
    return null;
  }
};

// Status options with colors
const STATUS_OPTIONS = [
  { value: 'Unable to Start', color: '#FFB74D', textColor: '#000' },
  { value: 'Not Started', color: '#BDBDBD', textColor: '#000' },
  { value: 'Started', color: '#81C784', textColor: '#000' },
  { value: 'Ongoing', color: '#4FC3F7', textColor: '#000' },
  { value: 'Complete', color: '#BA68C8', textColor: '#fff' },
  { value: 'Needs Updating', color: '#FFF176', textColor: '#000' }
];

const getStatusColor = (status: string) => {
  const found = STATUS_OPTIONS.find(s => s.value === status);
  return found ? { bgcolor: found.color, color: found.textColor } : {};
};

// Development Stage options with colors
const DEVELOPMENT_STAGES = [
  { value: 'Intake Form Received', color: '#4FC3F7', textColor: '#fff' },
  { value: 'Meeting with External Stakeholder Group', color: '#4FC3F7', textColor: '#fff' },
  { value: 'Prioritization Meeting (internal or external)', color: '#4FC3F7', textColor: '#fff' },
  { value: 'If Needed, Confirming Simulation Case Objectives (could be done in prior meeting)', color: '#4FC3F7', textColor: '#fff' },
  { value: 'Case Role Assignment & Planning Session', color: '#4FC3F7', textColor: '#fff' },
  { value: 'Building Case Booklet', color: '#1565C0', textColor: '#fff' },
  { value: 'Infographic Creation', color: '#1565C0', textColor: '#fff' },
  { value: 'Brief Internal Group Review of Case Booklet', color: '#2E7D32', textColor: '#fff' },
  { value: 'Presenting Case to External Stakeholder Group', color: '#2E7D32', textColor: '#fff' },
  { value: 'Pre-Video Development Plan for Implementation', color: '#1565C0', textColor: '#fff' },
  { value: 'If Needed, Gather Videos & Vital Signs', color: '#1565C0', textColor: '#fff' },
  { value: 'Case Video Creation', color: '#1565C0', textColor: '#fff' },
  { value: 'Team Review of Video Case', color: '#2E7D32', textColor: '#fff' },
  { value: 'Revisions based on Team Review Feedback', color: '#2E7D32', textColor: '#fff' },
  { value: 'Comprehensive Final Review of Case Booklet and Video', color: '#C62828', textColor: '#fff' },
  { value: 'Revisions based on Team Comprehensive Final Review Feedback', color: '#C62828', textColor: '#fff' },
  { value: 'Run Simulation', color: '#FFB300', textColor: '#fff' },
  { value: 'Upload to Website', color: '#FFB300', textColor: '#fff' },
  { value: 'Maintenance', color: '#FFB300', textColor: '#fff' }
];

const getDevStageColor = (stage: string) => {
  const found = DEVELOPMENT_STAGES.find(s => s.value === stage);
  return found ? { bgcolor: found.color, color: found.textColor } : {};
};

// Default team members (fallback)
const DEFAULT_TEAM_MEMBERS = [
  'Allie Brenner', 'Amy Reiland', 'Anne Adema', 'Becca Mielke', 'Benjamin Michaels',
  'Cage Cochran', 'Cam Brandt', 'Daniel Ebbs', 'Elizabeth Sanseau', 'Erin Montgromery',
  'Kamal Abulebda', 'Lauren Simpson', 'Marc Auerbach', 'Maybelle Kou', 'Sally Snow', 'Sofia Athansopoulou'
];

// Time commitment options
const TIME_COMMITMENT_OPTIONS = [
  '1 Day or Less', '2-3 Days', '1 Week', '2 Weeks', '3-4 Weeks', '>4 Weeks',
  'Ongoing - Time Intensive', 'Ongoing - Little time required'
];

// Research Dissemination options
const MANUSCRIPT_ABSTRACT_OPTIONS = ['Manuscript', 'Abstract', 'Both', 'Other'];
const REACH_OUT_YN = ['Y', 'N'];
const RESEARCH_DISSEMINATION_CATEGORIES = [
  'Protocol/Implementation', 'Methods', 'Effectiveness', 'Mechanisms',
  'Practice Experience with Delivering SMAs', 'Cost and Resources',
  'Invested clinical organization/providers dissemination', 'Other'
];

// Storage keys
const PIPELINE_STORAGE_KEY = 'admin_project_pipeline_simbox';
const PIPELINE_SCHOLARSHIP_KEY = 'admin_project_pipeline_scholarship';
const PIPELINE_RESEARCH_DISSEMINATION_KEY = 'admin_project_pipeline_research_dissemination';
const PIPELINE_ABSTRACTS_KEY = 'admin_project_pipeline_abstracts';
const PIPELINE_TEAM_MEMBERS_KEY = 'admin_project_pipeline_team_members';
const PIPELINE_COAUTHORS_KEY = 'admin_project_pipeline_coauthors';

// Interfaces
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

export interface ScholarshipPublication {
  id: string;
  status: string;
  order: number;
  categoryTopic: string;
  dueDate: string | null;
  projectSponsor: string;
  projectLead: string;
  teamMembers: string[];
  projectAdmin: string;
  consulted: string[];
  informed: string[];
  timeCommitment: string;
}

export interface AbstractsPresentation {
  id: string;
  status: string;
  order: number;
  categoryTopic: string;
  dueDate: string | null;
  projectSponsor: string;
  projectLead: string;
  teamMembers: string[];
  projectAdmin: string;
  consulted: string[];
  informed: string[];
  timeCommitment: string;
}

export interface ResearchDisseminationIdea {
  id: string;
  topic: string;
  summaryBriefOverview: string;
  dataSource: string;
  leadSenior: string;
  interestedCoAuthors: string[];
  manuscriptAbstractOrBoth: string;
  timingConferenceDeadlines: string;
  status: string;
  publicationYear: string;
  reachOutToLeadAuthor: string;
  notes: string;
  category: string;
}

interface CRMContact {
  id: string;
  name: string;
  email?: string;
}

const defaultSimBoxCase = (): SimBoxCase => ({
  id: '', status: 'Not Started', order: 0, categoryTopic: '', notes: '', dueDate: null,
  projectDevelopmentStatus: '', projectSponsor: '', projectLead: '', teamMembers: [],
  projectAdmin: '', consulted: [], informed: [], timeCommitment: ''
});

const defaultScholarship = (): ScholarshipPublication => ({
  id: '', status: 'Not Started', order: 0, categoryTopic: '', dueDate: null,
  projectSponsor: '', projectLead: '', teamMembers: [], projectAdmin: '',
  consulted: [], informed: [], timeCommitment: ''
});

const defaultAbstractsPresentation = (): AbstractsPresentation => ({
  id: '', status: 'Not Started', order: 0, categoryTopic: '', dueDate: null,
  projectSponsor: '', projectLead: '', teamMembers: [], projectAdmin: '',
  consulted: [], informed: [], timeCommitment: ''
});

const defaultResearchDissemination = (): ResearchDisseminationIdea => ({
  id: '', topic: '', summaryBriefOverview: '', dataSource: '', leadSenior: '',
  interestedCoAuthors: [], manuscriptAbstractOrBoth: '', timingConferenceDeadlines: '',
  status: 'Not Started', publicationYear: '', reachOutToLeadAuthor: '', notes: '', category: ''
});

// Role legend component
const RoleLegend: React.FC = () => (
  <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      <strong>Project Sponsor (S)</strong> - Ultimately accountable, but is not actively leading the work<br />
      <strong>Project Lead (L)</strong> - Leading the work, but reports to Project Sponsor<br />
      <strong>Team Member (T)</strong> - Assisting to help execute work. Reports to the Project Lead.<br />
      <strong>Project Admin (A)</strong> - Holds all who engage in the project to adhere to timelines.<br />
      <strong>Consulted (C)</strong> - Needs to be a part of initial discussions to get their input.<br />
      <strong>Informed (I)</strong> - Needs to provide updates of when the project has started and completed with occasional status updates.
    </Typography>
  </Box>
);

// Status chip component
const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const colors = getStatusColor(status);
  return <Chip size="small" label={status} sx={{ ...colors, fontWeight: 500 }} />;
};

// Dev stage chip component
const DevStageChip: React.FC<{ stage: string }> = ({ stage }) => {
  const colors = getDevStageColor(stage);
  return stage ? (
    <Chip 
      size="small" 
      label={stage} 
      sx={{ 
        ...colors, 
        fontWeight: 500, 
        height: 'auto',
        '& .MuiChip-label': { 
          whiteSpace: 'normal', 
          lineHeight: 1.3,
          py: 0.5,
          display: 'block'
        } 
      }} 
    />
  ) : <span>-</span>;
};

const AdminProjectPipelinePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);

  // Team members lists (editable)
  const [teamMembersList, setTeamMembersList] = useState<string[]>(DEFAULT_TEAM_MEMBERS);
  const [coAuthorsList, setCoAuthorsList] = useState<string[]>(DEFAULT_TEAM_MEMBERS);

  // CRM search state
  const [crmSearchQuery, setCrmSearchQuery] = useState('');
  const [crmSearchResults, setCrmSearchResults] = useState<CRMContact[]>([]);
  const [crmSearchLoading, setCrmSearchLoading] = useState(false);

  // Data states
  const [simboxCases, setSimboxCases] = useState<SimBoxCase[]>([]);
  const [scholarshipItems, setScholarshipItems] = useState<ScholarshipPublication[]>([]);
  const [researchDisseminationItems, setResearchDisseminationItems] = useState<ResearchDisseminationIdea[]>([]);
  const [abstractsItems, setAbstractsItems] = useState<AbstractsPresentation[]>([]);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<SimBoxCase | null>(null);
  const [form, setForm] = useState<SimBoxCase>(defaultSimBoxCase());

  // Inline editing states for quick status/dev stage changes
  const [inlineMenuAnchor, setInlineMenuAnchor] = useState<null | HTMLElement>(null);
  const [inlineEditingRow, setInlineEditingRow] = useState<string | null>(null);
  const [inlineEditingField, setInlineEditingField] = useState<'status' | 'devStatus' | null>(null);

  const [scholarshipDialogOpen, setScholarshipDialogOpen] = useState(false);
  const [editingScholarship, setEditingScholarship] = useState<ScholarshipPublication | null>(null);
  const [scholarshipForm, setScholarshipForm] = useState<ScholarshipPublication>(defaultScholarship());

  const [researchDisseminationDialogOpen, setResearchDisseminationDialogOpen] = useState(false);
  const [editingResearchDissemination, setEditingResearchDissemination] = useState<ResearchDisseminationIdea | null>(null);
  const [researchDisseminationForm, setResearchDisseminationForm] = useState<ResearchDisseminationIdea>(defaultResearchDissemination());

  const [abstractsDialogOpen, setAbstractsDialogOpen] = useState(false);
  const [editingAbstracts, setEditingAbstracts] = useState<AbstractsPresentation | null>(null);
  const [abstractsForm, setAbstractsForm] = useState<AbstractsPresentation>(defaultAbstractsPresentation());

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [leadFilter, setLeadFilter] = useState<string>('');
  const [devStatusFilter, setDevStatusFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // All view collapse states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    simbox: true, scholarship: true, research: true, abstracts: true
  });

  // Sort state
  const [sortField, setSortField] = useState<string>('order');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [restoreSnack, setRestoreSnack] = useState<string | null>(null);

  // Try a specific localStorage key; if valid, save to Supabase and update state
  const tryLocalStorageThenSave = async <T,>(uid: string, dataKey: string, setState: (v: T) => void, validator: (v: unknown) => v is T, lsKey: string): Promise<boolean> => {
    try {
      const s = localStorage.getItem(lsKey);
      if (!s) return false;
      const p = JSON.parse(s) as unknown;
      if (!validator(p)) return false;
      setState(p);
      await setUserData(uid, dataKey, p);
      localStorage.removeItem(lsKey);
      return true;
    } catch {
      return false;
    }
  };

  // Scan ALL localStorage keys for anything that looks like pipeline data (handles unknown/legacy key names)
  const loadPipelineFromLocal = useCallback(async () => {
    const uid = currentUser?.id;
    if (!uid) return 0;
    let restored = 0;

    const tryKeys = (dataKey: string, setState: (v: unknown) => void, validator: (v: unknown) => boolean, keys: string[]) => {
      return (async () => {
        for (const lsKey of keys) {
          const ok = await tryLocalStorageThenSave(uid, dataKey, setState as (v: never) => void, validator as (v: unknown) => v is never, lsKey);
          if (ok) return true;
        }
        return false;
      })();
    };

    const isSimbox = (v: unknown): v is SimBoxCase[] => Array.isArray(v) && (v.length === 0 || (typeof (v[0] as any)?.categoryTopic === 'string' && typeof (v[0] as any)?.projectDevelopmentStatus === 'string'));
    const isScholarship = (v: unknown): v is ScholarshipPublication[] => Array.isArray(v) && (v.length === 0 || typeof (v[0] as any)?.categoryTopic === 'string');
    const isResearch = (v: unknown): v is ResearchDisseminationIdea[] => Array.isArray(v) && (v.length === 0 || typeof (v[0] as any)?.categoryTopic === 'string');
    const isAbstracts = (v: unknown): v is AbstractsPresentation[] => Array.isArray(v) && (v.length === 0 || typeof (v[0] as any)?.categoryTopic === 'string');
    const isStringArr = (v: unknown): v is string[] => Array.isArray(v) && (v.length === 0 || typeof v[0] === 'string');

    const knownKeys = [
      [PIPELINE_STORAGE_KEY, setSimboxCases, isSimbox, [`${PIPELINE_STORAGE_KEY}_${uid}`, PIPELINE_STORAGE_KEY, 'project_pipeline_simbox', 'pipeline_simbox']],
      [PIPELINE_SCHOLARSHIP_KEY, setScholarshipItems, isScholarship, [`${PIPELINE_SCHOLARSHIP_KEY}_${uid}`, PIPELINE_SCHOLARSHIP_KEY, 'project_pipeline_scholarship', 'pipeline_scholarship']],
      [PIPELINE_RESEARCH_DISSEMINATION_KEY, setResearchDisseminationItems, isResearch, [`${PIPELINE_RESEARCH_DISSEMINATION_KEY}_${uid}`, PIPELINE_RESEARCH_DISSEMINATION_KEY, 'project_pipeline_research_dissemination', 'pipeline_research_dissemination']],
      [PIPELINE_ABSTRACTS_KEY, setAbstractsItems, isAbstracts, [`${PIPELINE_ABSTRACTS_KEY}_${uid}`, PIPELINE_ABSTRACTS_KEY, 'project_pipeline_abstracts', 'pipeline_abstracts']],
      [PIPELINE_TEAM_MEMBERS_KEY, setTeamMembersList, isStringArr, [`${PIPELINE_TEAM_MEMBERS_KEY}_${uid}`, PIPELINE_TEAM_MEMBERS_KEY, 'project_pipeline_team_members', 'pipeline_team_members']],
      [PIPELINE_COAUTHORS_KEY, setCoAuthorsList, isStringArr, [`${PIPELINE_COAUTHORS_KEY}_${uid}`, PIPELINE_COAUTHORS_KEY, 'project_pipeline_coauthors', 'pipeline_coauthors']]
    ] as const;

    for (const [dataKey, setState, validator, keys] of knownKeys) {
      if (Array.isArray(await getUserData(uid, dataKey))) continue;
      if (await tryKeys(dataKey, setState as (v: unknown) => void, validator, [...keys])) restored++;
    }

    if (restored > 0) return restored;

    for (let i = 0; i < localStorage.length; i++) {
      const lsKey = localStorage.key(i);
      if (!lsKey || !/pipeline|simbox|scholarship|abstracts|research_dissemination|team_member|coauthor/i.test(lsKey)) continue;
      try {
        const s = localStorage.getItem(lsKey);
        if (!s) continue;
        const p = JSON.parse(s) as unknown;
        if (!Array.isArray(p)) continue;
        if (p.length > 0 && typeof p[0] === 'string') {
          if (!Array.isArray(await getUserData(uid, PIPELINE_TEAM_MEMBERS_KEY)) && await tryLocalStorageThenSave(uid, PIPELINE_TEAM_MEMBERS_KEY, setTeamMembersList, (v): v is string[] => Array.isArray(v), lsKey)) restored++;
        } else if (p.length > 0 && typeof (p[0] as any)?.categoryTopic === 'string') {
          const hasDev = typeof (p[0] as any)?.projectDevelopmentStatus === 'string';
          if (hasDev && !Array.isArray(await getUserData(uid, PIPELINE_STORAGE_KEY))) {
            if (await tryLocalStorageThenSave(uid, PIPELINE_STORAGE_KEY, setSimboxCases, (v): v is SimBoxCase[] => Array.isArray(v), lsKey)) restored++;
          } else if (!Array.isArray(await getUserData(uid, PIPELINE_SCHOLARSHIP_KEY))) {
            if (await tryLocalStorageThenSave(uid, PIPELINE_SCHOLARSHIP_KEY, setScholarshipItems, (v): v is ScholarshipPublication[] => Array.isArray(v), lsKey)) restored++;
          }
        }
      } catch {}
    }
    return restored;
  }, [currentUser?.id]);

  // Load data from user_data, then try localStorage (with uid and legacy global keys)
  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) return;
    let mounted = true;
    (async () => {
      const [simbox, scholarship, research, abstracts, team, coAuthors] = await Promise.all([
        getUserData<SimBoxCase[]>(uid, PIPELINE_STORAGE_KEY),
        getUserData<ScholarshipPublication[]>(uid, PIPELINE_SCHOLARSHIP_KEY),
        getUserData<ResearchDisseminationIdea[]>(uid, PIPELINE_RESEARCH_DISSEMINATION_KEY),
        getUserData<AbstractsPresentation[]>(uid, PIPELINE_ABSTRACTS_KEY),
        getUserData<string[]>(uid, PIPELINE_TEAM_MEMBERS_KEY),
        getUserData<string[]>(uid, PIPELINE_COAUTHORS_KEY)
      ]);
      if (!mounted) return;
      const tryKeys = async (dataKey: string, setState: (v: unknown) => void, validator: (v: unknown) => boolean, keys: string[]) => {
        for (const lsKey of keys) {
          const ok = await tryLocalStorageThenSave(uid, dataKey, setState as (v: never) => void, validator as (v: unknown) => v is never, lsKey);
          if (ok) return;
        }
      };
      if (Array.isArray(simbox)) setSimboxCases(simbox);
      else await tryKeys(PIPELINE_STORAGE_KEY, setSimboxCases, (v): boolean => Array.isArray(v), [`${PIPELINE_STORAGE_KEY}_${uid}`, PIPELINE_STORAGE_KEY, 'project_pipeline_simbox', 'pipeline_simbox']);
      if (Array.isArray(scholarship)) setScholarshipItems(scholarship);
      else await tryKeys(PIPELINE_SCHOLARSHIP_KEY, setScholarshipItems, (v): boolean => Array.isArray(v), [`${PIPELINE_SCHOLARSHIP_KEY}_${uid}`, PIPELINE_SCHOLARSHIP_KEY, 'project_pipeline_scholarship', 'pipeline_scholarship']);
      if (Array.isArray(research)) setResearchDisseminationItems(research);
      else await tryKeys(PIPELINE_RESEARCH_DISSEMINATION_KEY, setResearchDisseminationItems, (v): boolean => Array.isArray(v), [`${PIPELINE_RESEARCH_DISSEMINATION_KEY}_${uid}`, PIPELINE_RESEARCH_DISSEMINATION_KEY, 'project_pipeline_research_dissemination', 'pipeline_research_dissemination']);
      if (Array.isArray(abstracts)) setAbstractsItems(abstracts);
      else await tryKeys(PIPELINE_ABSTRACTS_KEY, setAbstractsItems, (v): boolean => Array.isArray(v), [`${PIPELINE_ABSTRACTS_KEY}_${uid}`, PIPELINE_ABSTRACTS_KEY, 'project_pipeline_abstracts', 'pipeline_abstracts']);
      if (Array.isArray(team)) setTeamMembersList(team);
      else await tryKeys(PIPELINE_TEAM_MEMBERS_KEY, setTeamMembersList, (v): boolean => Array.isArray(v), [`${PIPELINE_TEAM_MEMBERS_KEY}_${uid}`, PIPELINE_TEAM_MEMBERS_KEY, 'project_pipeline_team_members', 'pipeline_team_members']);
      if (Array.isArray(coAuthors)) setCoAuthorsList(coAuthors);
      else await tryKeys(PIPELINE_COAUTHORS_KEY, setCoAuthorsList, (v): boolean => Array.isArray(v), [`${PIPELINE_COAUTHORS_KEY}_${uid}`, PIPELINE_COAUTHORS_KEY, 'project_pipeline_coauthors', 'pipeline_coauthors']);
    })();
    return () => { mounted = false; };
  }, [currentUser?.id]);

  const saveSimboxCases = (cases: SimBoxCase[]) => {
    setSimboxCases(cases);
    if (currentUser?.id) setUserData(currentUser.id, PIPELINE_STORAGE_KEY, cases);
  };
  const saveScholarship = (items: ScholarshipPublication[]) => {
    setScholarshipItems(items);
    if (currentUser?.id) setUserData(currentUser.id, PIPELINE_SCHOLARSHIP_KEY, items);
  };
  const saveResearchDissemination = (items: ResearchDisseminationIdea[]) => {
    setResearchDisseminationItems(items);
    if (currentUser?.id) setUserData(currentUser.id, PIPELINE_RESEARCH_DISSEMINATION_KEY, items);
  };
  const saveAbstracts = (items: AbstractsPresentation[]) => {
    setAbstractsItems(items);
    if (currentUser?.id) setUserData(currentUser.id, PIPELINE_ABSTRACTS_KEY, items);
  };
  const saveTeamMembersList = (list: string[]) => {
    setTeamMembersList(list);
    if (currentUser?.id) setUserData(currentUser.id, PIPELINE_TEAM_MEMBERS_KEY, list);
  };
  const saveCoAuthorsList = (list: string[]) => {
    setCoAuthorsList(list);
    if (currentUser?.id) setUserData(currentUser.id, PIPELINE_COAUTHORS_KEY, list);
  };

  // CRM search function
  const searchCRM = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setCrmSearchResults([]);
      return;
    }
    setCrmSearchLoading(true);
    try {
      // Search users table
      const { data: users } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20);

      const results: CRMContact[] = (users || []).map((u: { id: string; email?: string; first_name?: string; last_name?: string }) => ({
        id: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown',
        email: u.email
      }));
      setCrmSearchResults(results);
    } catch (err) {
      console.error('CRM search error:', err);
      setCrmSearchResults([]);
    } finally {
      setCrmSearchLoading(false);
    }
  }, []);

  // Debounced CRM search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (crmSearchQuery) searchCRM(crmSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [crmSearchQuery, searchCRM]);

  // Add to team members
  const addToTeamMembers = (name: string) => {
    if (!teamMembersList.includes(name)) {
      saveTeamMembersList([...teamMembersList, name].sort());
    }
  };

  const removeFromTeamMembers = (name: string) => {
    saveTeamMembersList(teamMembersList.filter(n => n !== name));
  };

  // Add to co-authors
  const addToCoAuthors = (name: string) => {
    if (!coAuthorsList.includes(name)) {
      saveCoAuthorsList([...coAuthorsList, name].sort());
    }
  };

  const removeFromCoAuthors = (name: string) => {
    saveCoAuthorsList(coAuthorsList.filter(n => n !== name));
  };

  // Priority validation - check if order is unique per lead
  const validatePriority = (items: Array<{ order: number; projectLead: string }>, newOrder: number, newLead: string, excludeId?: string) => {
    return !items.some(item => 
      item.order === newOrder && 
      item.projectLead === newLead && 
      (excludeId ? (item as { id?: string }).id !== excludeId : true)
    );
  };

  // SimBox handlers
  const handleAdd = () => {
    setEditingCase(null);
    const nextOrder = simboxCases.length > 0 ? Math.max(...simboxCases.map(c => c.order), 0) + 1 : 1;
    setForm({ ...defaultSimBoxCase(), id: `simbox_${Date.now()}`, order: nextOrder });
    setDialogOpen(true);
  };

  const handleEdit = (row: SimBoxCase) => {
    setEditingCase(row);
    setForm({ ...row });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const isValid = validatePriority(
      simboxCases.filter(c => c.id !== editingCase?.id),
      form.order, form.projectLead, editingCase?.id
    );
    if (!isValid && form.projectLead) {
      if (!window.confirm(`Priority ${form.order} is already assigned to another item with the same lead (${form.projectLead}). Continue anyway?`)) {
        return;
      }
    }
    if (editingCase) {
      saveSimboxCases(simboxCases.map(c => c.id === editingCase.id ? { ...form } : c));
    } else {
      saveSimboxCases([...simboxCases, { ...form }]);
    }
    setDialogOpen(false);
    setForm(defaultSimBoxCase());
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this SimBox case?')) saveSimboxCases(simboxCases.filter(c => c.id !== id));
  };

  // Inline editing handlers for quick status/dev stage changes
  const handleInlineEditClick = (event: React.MouseEvent<HTMLElement>, rowId: string, field: 'status' | 'devStatus') => {
    event.stopPropagation();
    event.preventDefault();
    // Use the target element directly to ensure proper anchor positioning
    const target = event.currentTarget as HTMLElement;
    setInlineMenuAnchor(target);
    setInlineEditingRow(rowId);
    setInlineEditingField(field);
  };

  const handleInlineEditClose = () => {
    setInlineMenuAnchor(null);
    setInlineEditingRow(null);
    setInlineEditingField(null);
  };

  const handleInlineStatusChange = (newValue: string) => {
    if (inlineEditingRow) {
      saveSimboxCases(simboxCases.map(c => c.id === inlineEditingRow ? { ...c, status: newValue } : c));
    }
    handleInlineEditClose();
  };

  const handleInlineDevStatusChange = (newValue: string) => {
    if (inlineEditingRow) {
      saveSimboxCases(simboxCases.map(c => c.id === inlineEditingRow ? { ...c, projectDevelopmentStatus: newValue } : c));
    }
    handleInlineEditClose();
  };

  // Scholarship handlers
  const handleScholarshipAdd = () => {
    setEditingScholarship(null);
    const nextOrder = scholarshipItems.length > 0 ? Math.max(...scholarshipItems.map(c => c.order), 0) + 1 : 1;
    setScholarshipForm({ ...defaultScholarship(), id: `scholarship_${Date.now()}`, order: nextOrder });
    setScholarshipDialogOpen(true);
  };

  const handleScholarshipEdit = (row: ScholarshipPublication) => {
    setEditingScholarship(row);
    setScholarshipForm({ ...row });
    setScholarshipDialogOpen(true);
  };

  const handleScholarshipSave = () => {
    if (editingScholarship) {
      saveScholarship(scholarshipItems.map(c => c.id === editingScholarship.id ? { ...scholarshipForm } : c));
    } else {
      saveScholarship([...scholarshipItems, { ...scholarshipForm }]);
    }
    setScholarshipDialogOpen(false);
    setScholarshipForm(defaultScholarship());
  };

  const handleScholarshipDelete = (id: string) => {
    if (window.confirm('Delete this entry?')) saveScholarship(scholarshipItems.filter(c => c.id !== id));
  };

  // Research Dissemination handlers
  const handleResearchDisseminationAdd = () => {
    setEditingResearchDissemination(null);
    setResearchDisseminationForm({ ...defaultResearchDissemination(), id: `research_${Date.now()}` });
    setResearchDisseminationDialogOpen(true);
  };

  const handleResearchDisseminationEdit = (row: ResearchDisseminationIdea) => {
    setEditingResearchDissemination(row);
    setResearchDisseminationForm({ ...row });
    setResearchDisseminationDialogOpen(true);
  };

  const handleResearchDisseminationSave = () => {
    if (editingResearchDissemination) {
      saveResearchDissemination(researchDisseminationItems.map(c => c.id === editingResearchDissemination.id ? { ...researchDisseminationForm } : c));
    } else {
      saveResearchDissemination([...researchDisseminationItems, { ...researchDisseminationForm }]);
    }
    setResearchDisseminationDialogOpen(false);
    setResearchDisseminationForm(defaultResearchDissemination());
  };

  const handleResearchDisseminationDelete = (id: string) => {
    if (window.confirm('Delete this idea?')) saveResearchDissemination(researchDisseminationItems.filter(c => c.id !== id));
  };

  // Abstracts handlers
  const handleAbstractsAdd = () => {
    setEditingAbstracts(null);
    const nextOrder = abstractsItems.length > 0 ? Math.max(...abstractsItems.map(c => c.order), 0) + 1 : 1;
    setAbstractsForm({ ...defaultAbstractsPresentation(), id: `abstracts_${Date.now()}`, order: nextOrder });
    setAbstractsDialogOpen(true);
  };

  const handleAbstractsEdit = (row: AbstractsPresentation) => {
    setEditingAbstracts(row);
    setAbstractsForm({ ...row });
    setAbstractsDialogOpen(true);
  };

  const handleAbstractsSave = () => {
    if (editingAbstracts) {
      saveAbstracts(abstractsItems.map(c => c.id === editingAbstracts.id ? { ...abstractsForm } : c));
    } else {
      saveAbstracts([...abstractsItems, { ...abstractsForm }]);
    }
    setAbstractsDialogOpen(false);
    setAbstractsForm(defaultAbstractsPresentation());
  };

  const handleAbstractsDelete = (id: string) => {
    if (window.confirm('Delete this entry?')) saveAbstracts(abstractsItems.filter(c => c.id !== id));
  };

  // Sorting helper
  const sortItems = <T,>(items: T[], field: string, dir: 'asc' | 'desc'): T[] => {
    return [...items].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[field] ?? '';
      const bVal = (b as Record<string, unknown>)[field] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return dir === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  // Filtering helper
  const filterItems = <T extends { status?: string; projectLead?: string; leadSenior?: string; categoryTopic?: string; topic?: string; projectDevelopmentStatus?: string }>(
    items: T[]
  ): T[] => {
    return items.filter(item => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (leadFilter && item.projectLead !== leadFilter && item.leadSenior !== leadFilter) return false;
      if (devStatusFilter && 'projectDevelopmentStatus' in item && item.projectDevelopmentStatus !== devStatusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [item.categoryTopic, item.topic, item.projectLead, item.leadSenior].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  };

  // Filtered and sorted data
  const sortedSimbox = useMemo(() => sortItems(filterItems(simboxCases), sortField, sortDir), [simboxCases, sortField, sortDir, searchQuery, statusFilter, leadFilter, devStatusFilter]);
  const sortedScholarship = useMemo(() => sortItems(filterItems(scholarshipItems), sortField, sortDir), [scholarshipItems, sortField, sortDir, searchQuery, statusFilter, leadFilter, devStatusFilter]);
  const sortedAbstracts = useMemo(() => sortItems(filterItems(abstractsItems), sortField, sortDir), [abstractsItems, sortField, sortDir, searchQuery, statusFilter, leadFilter, devStatusFilter]);
  const sortedResearch = useMemo(() => sortItems(filterItems(researchDisseminationItems), 'topic', sortDir), [researchDisseminationItems, sortDir, searchQuery, statusFilter, leadFilter, devStatusFilter]);

  // Archive: completed items from all tabs
  const archivedItems = useMemo(() => {
    const completed: Array<{ type: string; item: SimBoxCase | ScholarshipPublication | AbstractsPresentation | ResearchDisseminationIdea }> = [];
    simboxCases.filter(c => c.status === 'Complete').forEach(item => completed.push({ type: 'SimBox Cases', item }));
    scholarshipItems.filter(c => c.status === 'Complete').forEach(item => completed.push({ type: 'Scholarship/Publications', item }));
    abstractsItems.filter(c => c.status === 'Complete').forEach(item => completed.push({ type: 'Abstracts/Presentations', item }));
    researchDisseminationItems.filter(c => c.status === 'Complete').forEach(item => completed.push({ type: 'Research Dissemination', item }));
    return completed;
  }, [simboxCases, scholarshipItems, abstractsItems, researchDisseminationItems]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortableHeader: React.FC<{ field: string; label: string }> = ({ field, label }) => (
    <TableCell 
      onClick={() => handleSort(field)} 
      sx={{ cursor: 'pointer', userSelect: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {label}
      {sortField === field && <SortIcon sx={{ fontSize: 14, ml: 0.5, transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none' }} />}
    </TableCell>
  );

  // Tab order: Master Priorities List first, Team Members last
  const sectionLabels = [
    'Master Priorities List',
    'SimBox Cases', 
    'Scholarship/Publications', 
    'Research Dissemination Ideas',
    'Abstracts/Presentations', 
    'Program', 
    'Administrative', 
    'Archive',
    'Team Members'
  ];

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter bar JSX - memoized to prevent re-creation on each render (fixes focus loss issue)
  const filterBarJSX = useMemo(() => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
          sx={{ minWidth: 200 }}
        />
        <Button
          size="small"
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'contained' : 'outlined'}
        >
          Filters
        </Button>
        {(statusFilter || leadFilter || devStatusFilter) && (
          <Button size="small" onClick={() => { setStatusFilter(''); setLeadFilter(''); setDevStatusFilter(''); }}>Clear Filters</Button>
        )}
      </Box>
      <Collapse in={showFilters}>
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Lead</InputLabel>
            <Select value={leadFilter} label="Lead" onChange={(e) => setLeadFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Development Status</InputLabel>
            <Select value={devStatusFilter} label="Development Status" onChange={(e) => setDevStatusFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {DEVELOPMENT_STAGES.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
      </Collapse>
    </Box>
  ), [searchQuery, statusFilter, leadFilter, devStatusFilter, showFilters, teamMembersList]);

  // SimBox table component
  const SimBoxTable: React.FC<{ data: SimBoxCase[]; showAddButton?: boolean }> = ({ data, showAddButton = true }) => (
    <Box sx={{ mb: 4 }}>
      {showAddButton && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">SimBox Cases</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>Add Case</Button>
        </Box>
      )}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1400 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <SortableHeader field="status" label="Status" />
              <SortableHeader field="order" label="Priority" />
              <SortableHeader field="categoryTopic" label="Category/Topic" />
              <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
              <SortableHeader field="dueDate" label="Due Date" />
              <TableCell sx={{ fontWeight: 600 }}>Dev Status</TableCell>
              <SortableHeader field="projectSponsor" label="Sponsor (S)" />
              <SortableHeader field="projectLead" label="Lead (L)" />
              <TableCell sx={{ fontWeight: 600 }}>Team (T)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Admin (A)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4 }}>No items found.</TableCell></TableRow>
            ) : data.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Tooltip title="Click to change status" arrow>
                    <Chip 
                      size="small" 
                      label={row.status} 
                      onClick={(e) => handleInlineEditClick(e, row.id, 'status')}
                      sx={{ 
                        ...getStatusColor(row.status), 
                        fontWeight: 500,
                        cursor: 'pointer',
                        '&:hover': { filter: 'brightness(0.9)' }
                      }} 
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>{row.order}</TableCell>
                <TableCell>{row.categoryTopic || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 150 }}>{row.notes || '-'}</TableCell>
                <TableCell>{row.dueDate ? format(parseISO(row.dueDate), 'MM/dd/yyyy') : '-'}</TableCell>
                <TableCell>
                  <Tooltip title="Click to change development status" arrow>
                    <Chip 
                      size="small" 
                      label={row.projectDevelopmentStatus || '-'} 
                      onClick={(e) => handleInlineEditClick(e, row.id, 'devStatus')}
                      sx={{ 
                        ...getDevStageColor(row.projectDevelopmentStatus), 
                        fontWeight: 500,
                        cursor: 'pointer',
                        height: 'auto',
                        '& .MuiChip-label': { whiteSpace: 'normal', lineHeight: 1.3, py: 0.5, display: 'block' },
                        '&:hover': { filter: 'brightness(0.9)' }
                      }} 
                    />
                  </Tooltip>
                </TableCell>
                <TableCell>{row.projectSponsor || '-'}</TableCell>
                <TableCell>{row.projectLead || '-'}</TableCell>
                <TableCell>{row.teamMembers?.join(', ') || '-'}</TableCell>
                <TableCell>{row.projectAdmin || '-'}</TableCell>
                <TableCell>{row.timeCommitment || '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEdit(row)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Generic table for Scholarship/Abstracts
  const GenericTable: React.FC<{
    title: string;
    data: Array<ScholarshipPublication | AbstractsPresentation>;
    onAdd: () => void;
    onEdit: (row: ScholarshipPublication | AbstractsPresentation) => void;
    onDelete: (id: string) => void;
    showAddButton?: boolean;
  }> = ({ title, data, onAdd, onEdit, onDelete, showAddButton = true }) => (
    <Box sx={{ mb: 4 }}>
      {showAddButton && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{title}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Add Entry</Button>
        </Box>
      )}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1200 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <SortableHeader field="status" label="Status" />
              <SortableHeader field="order" label="Priority" />
              <SortableHeader field="categoryTopic" label="Category/Topic" />
              <SortableHeader field="dueDate" label="Due Date" />
              <SortableHeader field="projectSponsor" label="Sponsor (S)" />
              <SortableHeader field="projectLead" label="Lead (L)" />
              <TableCell sx={{ fontWeight: 600 }}>Team (T)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Admin (A)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Consulted (C)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Informed (I)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4 }}>No items found.</TableCell></TableRow>
            ) : data.map(row => (
              <TableRow key={row.id} hover>
                <TableCell><StatusChip status={row.status} /></TableCell>
                <TableCell>{row.order}</TableCell>
                <TableCell>{row.categoryTopic || '-'}</TableCell>
                <TableCell>{row.dueDate ? format(parseISO(row.dueDate), 'MM/dd/yyyy') : '-'}</TableCell>
                <TableCell>{row.projectSponsor || '-'}</TableCell>
                <TableCell>{row.projectLead || '-'}</TableCell>
                <TableCell>{row.teamMembers?.join(', ') || '-'}</TableCell>
                <TableCell>{row.projectAdmin || '-'}</TableCell>
                <TableCell>{row.consulted?.join(', ') || '-'}</TableCell>
                <TableCell>{row.informed?.join(', ') || '-'}</TableCell>
                <TableCell>{row.timeCommitment || '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => onEdit(row)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => onDelete(row.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Research Dissemination table
  const ResearchTable: React.FC<{ data: ResearchDisseminationIdea[]; showAddButton?: boolean }> = ({ data, showAddButton = true }) => (
    <Box sx={{ mb: 4 }}>
      {showAddButton && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Research Dissemination Ideas</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleResearchDisseminationAdd}>Add Idea</Button>
        </Box>
      )}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1600 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 600 }}>Topic</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Summary</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Data Source</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Lead (Senior)</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Co-Authors</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Timing</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Pub Year</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Reach Out?</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={13} align="center" sx={{ py: 4 }}>No items found.</TableCell></TableRow>
            ) : data.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>{row.topic || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 160 }}>{row.summaryBriefOverview || '-'}</TableCell>
                <TableCell>{row.dataSource || '-'}</TableCell>
                <TableCell>{row.leadSenior || '-'}</TableCell>
                <TableCell>{row.interestedCoAuthors?.join(', ') || '-'}</TableCell>
                <TableCell>{row.manuscriptAbstractOrBoth || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 140 }}>{row.timingConferenceDeadlines || '-'}</TableCell>
                <TableCell><StatusChip status={row.status} /></TableCell>
                <TableCell>{row.publicationYear || '-'}</TableCell>
                <TableCell>{row.reachOutToLeadAuthor || '-'}</TableCell>
                <TableCell sx={{ maxWidth: 120 }}>{row.notes || '-'}</TableCell>
                <TableCell>{row.category || '-'}</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleResearchDisseminationEdit(row)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleResearchDisseminationDelete(row.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  // Team Members Management Component
  const TeamMembersManagement = () => (
    <Box>
      <Typography variant="h6" gutterBottom>Manage Team Members &amp; Co-Authors</Typography>
      <Typography color="textSecondary" sx={{ mb: 3 }}>
        Search the CRM to add people to your Team Members or Interested/Co-Authors lists. These lists are used in the dropdowns when creating pipeline items.
      </Typography>

      {/* CRM Search */}
      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>Search CRM</Typography>
        <Autocomplete
          freeSolo
          options={crmSearchResults}
          getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
          loading={crmSearchLoading}
          inputValue={crmSearchQuery}
          onInputChange={(_, value) => setCrmSearchQuery(value)}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="Search by name or email..."
              InputProps={{
                ...params.InputProps,
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                endAdornment: (
                  <>
                    {crmSearchLoading ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                )
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Box>
                <Typography variant="body2">{option.name}</Typography>
                {option.email && <Typography variant="caption" color="textSecondary">{option.email}</Typography>}
              </Box>
              <Box>
                <Button 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); addToTeamMembers(option.name); }}
                  disabled={teamMembersList.includes(option.name)}
                >
                  + Team
                </Button>
                <Button 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); addToCoAuthors(option.name); }}
                  disabled={coAuthorsList.includes(option.name)}
                >
                  + Co-Author
                </Button>
              </Box>
            </Box>
          )}
        />
      </Paper>

      <Grid container spacing={3}>
        {/* Team Members List */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Team Members ({teamMembersList.length})
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
              Used for: Project Sponsor, Project Lead, Team Members, Project Admin, Consulted, Informed
            </Typography>
            <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
              {teamMembersList.map((name) => (
                <ListItem key={name} sx={{ bgcolor: 'grey.50', mb: 0.5, borderRadius: 1 }}>
                  <ListItemText primary={name} />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" color="error" onClick={() => removeFromTeamMembers(name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Box sx={{ mt: 2 }}>
              <TextField
                size="small"
                placeholder="Add manually..."
                fullWidth
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      addToTeamMembers(input.value.trim());
                      input.value = '';
                    }
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small">
                        <PersonAddIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Co-Authors List */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Interested/Co-Authors ({coAuthorsList.length})
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary" sx={{ mb: 2, display: 'block' }}>
              Used for: Research Dissemination - Interested/Co-Authors field
            </Typography>
            <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
              {coAuthorsList.map((name) => (
                <ListItem key={name} sx={{ bgcolor: 'grey.50', mb: 0.5, borderRadius: 1 }}>
                  <ListItemText primary={name} />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" color="error" onClick={() => removeFromCoAuthors(name)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
            <Box sx={{ mt: 2 }}>
              <TextField
                size="small"
                placeholder="Add manually..."
                fullWidth
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      addToCoAuthors(input.value.trim());
                      input.value = '';
                    }
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small">
                        <PersonAddIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ 
        py: 3, 
        px: 3,
        // Break out of parent Container to use full viewport width
        width: '100vw',
        position: 'relative',
        left: '50%',
        right: '50%',
        marginLeft: '-50vw',
        marginRight: '-50vw',
        boxSizing: 'border-box'
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom>Project Pipeline</Typography>
            <Typography color="textSecondary">
              Manage project pipeline sections. Use &quot;Master Priorities List&quot; to view all sections stacked.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              const n = await loadPipelineFromLocal();
              setRestoreSnack(n > 0 ? `Restored ${n} pipeline section(s) from this device.` : 'No pipeline data found in this browser. If you used a different device or cleared site data, that data cannot be recovered from here.');
            }}
          >
            Restore from this device
          </Button>
        </Box>
        <Snackbar open={!!restoreSnack} autoHideDuration={6000} onClose={() => setRestoreSnack(null)} message={restoreSnack} sx={{ bottom: 24 }} />

        <RoleLegend />

        <Tabs 
          value={tabValue} 
          onChange={(_, v) => setTabValue(v)} 
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          variant="scrollable"
          scrollButtons="auto"
        >
          {sectionLabels.map((label, idx) => <Tab key={idx} label={label} />)}
        </Tabs>

        {/* Master Priorities List (Tab 0) - was "All" */}
        {tabValue === 0 && (
          <Box>
            {filterBarJSX}
            {/* SimBox */}
            <Box sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box 
                sx={{ p: 2, bgcolor: 'grey.50', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleSection('simbox')}
              >
                <Typography variant="h6">SimBox Cases ({sortedSimbox.filter(c => c.status !== 'Complete').length})</Typography>
                {expandedSections.simbox ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={expandedSections.simbox}>
                <Box sx={{ p: 2 }}>
                  <SimBoxTable data={sortedSimbox.filter(c => c.status !== 'Complete')} showAddButton={false} />
                </Box>
              </Collapse>
            </Box>

            {/* Scholarship */}
            <Box sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box 
                sx={{ p: 2, bgcolor: 'grey.50', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleSection('scholarship')}
              >
                <Typography variant="h6">Scholarship/Publications ({sortedScholarship.filter(c => c.status !== 'Complete').length})</Typography>
                {expandedSections.scholarship ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={expandedSections.scholarship}>
                <Box sx={{ p: 2 }}>
                  <GenericTable
                    title=""
                    data={sortedScholarship.filter(c => c.status !== 'Complete')}
                    onAdd={handleScholarshipAdd}
                    onEdit={handleScholarshipEdit as (row: ScholarshipPublication | AbstractsPresentation) => void}
                    onDelete={handleScholarshipDelete}
                    showAddButton={false}
                  />
                </Box>
              </Collapse>
            </Box>

            {/* Research Dissemination */}
            <Box sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box 
                sx={{ p: 2, bgcolor: 'grey.50', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleSection('research')}
              >
                <Typography variant="h6">Research Dissemination ({sortedResearch.filter(c => c.status !== 'Complete').length})</Typography>
                {expandedSections.research ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={expandedSections.research}>
                <Box sx={{ p: 2 }}>
                  <ResearchTable data={sortedResearch.filter(c => c.status !== 'Complete')} showAddButton={false} />
                </Box>
              </Collapse>
            </Box>

            {/* Abstracts */}
            <Box sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box 
                sx={{ p: 2, bgcolor: 'grey.50', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => toggleSection('abstracts')}
              >
                <Typography variant="h6">Abstracts/Presentations ({sortedAbstracts.filter(c => c.status !== 'Complete').length})</Typography>
                {expandedSections.abstracts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
              <Collapse in={expandedSections.abstracts}>
                <Box sx={{ p: 2 }}>
                  <GenericTable
                    title=""
                    data={sortedAbstracts.filter(c => c.status !== 'Complete')}
                    onAdd={handleAbstractsAdd}
                    onEdit={handleAbstractsEdit as (row: ScholarshipPublication | AbstractsPresentation) => void}
                    onDelete={handleAbstractsDelete}
                    showAddButton={false}
                  />
                </Box>
              </Collapse>
            </Box>
          </Box>
        )}

        {/* SimBox Cases Tab (Tab 1) */}
        {tabValue === 1 && (
          <>
            {filterBarJSX}
            <SimBoxTable data={sortedSimbox} />
          </>
        )}

        {/* Scholarship/Publications Tab (Tab 2) */}
        {tabValue === 2 && (
          <>
            {filterBarJSX}
            <GenericTable
              title="Scholarship/Publications"
              data={sortedScholarship}
              onAdd={handleScholarshipAdd}
              onEdit={handleScholarshipEdit as (row: ScholarshipPublication | AbstractsPresentation) => void}
              onDelete={handleScholarshipDelete}
            />
          </>
        )}

        {/* Research Dissemination Tab (Tab 3) */}
        {tabValue === 3 && (
          <>
            {filterBarJSX}
            <ResearchTable data={sortedResearch} />
          </>
        )}

        {/* Abstracts/Presentations Tab (Tab 4) */}
        {tabValue === 4 && (
          <>
            {filterBarJSX}
            <GenericTable
              title="Abstracts/Presentations"
              data={sortedAbstracts}
              onAdd={handleAbstractsAdd}
              onEdit={handleAbstractsEdit as (row: ScholarshipPublication | AbstractsPresentation) => void}
              onDelete={handleAbstractsDelete}
            />
          </>
        )}

        {/* Placeholder tabs (Program, Administrative) */}
        {(tabValue === 5 || tabValue === 6) && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">{sectionLabels[tabValue]} — Coming soon.</Typography>
          </Box>
        )}

        {/* Archive Tab (Tab 7) - shows completed items */}
        {tabValue === 7 && (
          <Box>
            {filterBarJSX}
            <Typography variant="h6" gutterBottom>Archive (Completed Items)</Typography>
            {archivedItems.length === 0 ? (
              <Alert severity="info">No completed items yet. Items marked &quot;Complete&quot; will appear here.</Alert>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 800 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Section</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Topic/Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Lead</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {archivedItems.map((entry, idx) => {
                      const item = entry.item as SimBoxCase & ResearchDisseminationIdea;
                      return (
                        <TableRow key={idx} hover>
                          <TableCell><Chip size="small" label={entry.type} /></TableCell>
                          <TableCell>{item.categoryTopic || item.topic || '-'}</TableCell>
                          <TableCell>{item.projectLead || item.leadSenior || '-'}</TableCell>
                          <TableCell><StatusChip status={item.status} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Team Members Tab (Tab 8) */}
        {tabValue === 8 && <TeamMembersManagement />}

        {/* SimBox Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingCase ? 'Edit SimBox Case' : 'Add SimBox Case'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              {/* Basic Info Section */}
              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Basic Information</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <TextField size="small" label="Category/Topic" value={form.categoryTopic} onChange={(e) => setForm(f => ({ ...f, categoryTopic: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={form.status} label="Status" onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField size="small" type="number" label="Priority" value={form.order} onChange={(e) => setForm(f => ({ ...f, order: Number(e.target.value) || 0 }))} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Due Date"
                  value={form.dueDate ? parseISO(form.dueDate) : null}
                  onChange={(d) => setForm(f => ({ ...f, dueDate: safeFormatDate(d, 'yyyy-MM-dd') }))}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Development Status</InputLabel>
                  <Select 
                    value={form.projectDevelopmentStatus} 
                    label="Development Status" 
                    onChange={(e) => setForm(f => ({ ...f, projectDevelopmentStatus: e.target.value }))}
                    renderValue={(selected) => {
                      if (!selected) return '—';
                      const stage = DEVELOPMENT_STAGES.find(s => s.value === selected);
                      return stage ? (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: stage.color, mr: 1, flexShrink: 0 }} />
                          <Typography variant="body2" noWrap>{selected}</Typography>
                        </Box>
                      ) : selected;
                    }}
                  >
                    <MenuItem value="">—</MenuItem>
                    {DEVELOPMENT_STAGES.map(s => (
                      <MenuItem 
                        key={s.value} 
                        value={s.value}
                        sx={{ 
                          bgcolor: s.color, 
                          color: s.textColor, 
                          my: 0.25,
                          mx: 0.5,
                          borderRadius: 1,
                          '&:hover': { bgcolor: s.color, filter: 'brightness(0.9)' },
                          '&.Mui-selected': { bgcolor: s.color, '&:hover': { bgcolor: s.color, filter: 'brightness(0.85)' } }
                        }}
                      >
                        {s.value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField size="small" label="Notes" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
              </Grid>

              {/* Team Section */}
              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Team Assignment</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Sponsor (S)</InputLabel>
                  <Select value={form.projectSponsor} label="Project Sponsor (S)" onChange={(e) => setForm(f => ({ ...f, projectSponsor: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Lead (L)</InputLabel>
                  <Select value={form.projectLead} label="Project Lead (L)" onChange={(e) => setForm(f => ({ ...f, projectLead: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Team Member(s) (T)</InputLabel>
                  <Select multiple value={form.teamMembers} label="Team Member(s) (T)" onChange={(e) => setForm(f => ({ ...f, teamMembers: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Admin (A)</InputLabel>
                  <Select value={form.projectAdmin} label="Project Admin (A)" onChange={(e) => setForm(f => ({ ...f, projectAdmin: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Consulted (C)</InputLabel>
                  <Select multiple value={form.consulted} label="Consulted (C)" onChange={(e) => setForm(f => ({ ...f, consulted: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Informed (I)</InputLabel>
                  <Select multiple value={form.informed} label="Informed (I)" onChange={(e) => setForm(f => ({ ...f, informed: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              {/* Time Section */}
              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Time Estimate</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Time Commitment</InputLabel>
                  <Select value={form.timeCommitment} label="Time Commitment" onChange={(e) => setForm(f => ({ ...f, timeCommitment: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {TIME_COMMITMENT_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Scholarship Dialog */}
        <Dialog open={scholarshipDialogOpen} onClose={() => setScholarshipDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingScholarship ? 'Edit Scholarship/Publication' : 'Add Scholarship/Publication'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Basic Information</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <TextField size="small" label="Category/Topic" value={scholarshipForm.categoryTopic} onChange={(e) => setScholarshipForm(f => ({ ...f, categoryTopic: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={scholarshipForm.status} label="Status" onChange={(e) => setScholarshipForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField size="small" type="number" label="Priority" value={scholarshipForm.order} onChange={(e) => setScholarshipForm(f => ({ ...f, order: Number(e.target.value) || 0 }))} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Due Date"
                  value={scholarshipForm.dueDate ? parseISO(scholarshipForm.dueDate) : null}
                  onChange={(d) => setScholarshipForm(f => ({ ...f, dueDate: safeFormatDate(d, 'yyyy-MM-dd') }))}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Team Assignment</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Sponsor (S)</InputLabel>
                  <Select value={scholarshipForm.projectSponsor} label="Project Sponsor (S)" onChange={(e) => setScholarshipForm(f => ({ ...f, projectSponsor: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Lead (L)</InputLabel>
                  <Select value={scholarshipForm.projectLead} label="Project Lead (L)" onChange={(e) => setScholarshipForm(f => ({ ...f, projectLead: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Team Member(s) (T)</InputLabel>
                  <Select multiple value={scholarshipForm.teamMembers} label="Team Member(s) (T)" onChange={(e) => setScholarshipForm(f => ({ ...f, teamMembers: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Admin (A)</InputLabel>
                  <Select value={scholarshipForm.projectAdmin} label="Project Admin (A)" onChange={(e) => setScholarshipForm(f => ({ ...f, projectAdmin: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Consulted (C)</InputLabel>
                  <Select multiple value={scholarshipForm.consulted} label="Consulted (C)" onChange={(e) => setScholarshipForm(f => ({ ...f, consulted: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Informed (I)</InputLabel>
                  <Select multiple value={scholarshipForm.informed} label="Informed (I)" onChange={(e) => setScholarshipForm(f => ({ ...f, informed: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Time Estimate</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Time Commitment</InputLabel>
                  <Select value={scholarshipForm.timeCommitment} label="Time Commitment" onChange={(e) => setScholarshipForm(f => ({ ...f, timeCommitment: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {TIME_COMMITMENT_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setScholarshipDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleScholarshipSave}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Research Dissemination Dialog */}
        <Dialog open={researchDisseminationDialogOpen} onClose={() => setResearchDisseminationDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingResearchDissemination ? 'Edit Research Dissemination Idea' : 'Add Research Dissemination Idea'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Basic Information</Typography></Divider></Grid>
              <Grid item xs={12} sm={8}>
                <TextField size="small" label="Topic" value={researchDisseminationForm.topic} onChange={(e) => setResearchDisseminationForm(f => ({ ...f, topic: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select value={researchDisseminationForm.category} label="Category" onChange={(e) => setResearchDisseminationForm(f => ({ ...f, category: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {RESEARCH_DISSEMINATION_CATEGORIES.map(cat => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField size="small" label="Summary/Brief Overview" value={researchDisseminationForm.summaryBriefOverview} onChange={(e) => setResearchDisseminationForm(f => ({ ...f, summaryBriefOverview: e.target.value }))} fullWidth multiline rows={2} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField size="small" label="Data Source" value={researchDisseminationForm.dataSource} onChange={(e) => setResearchDisseminationForm(f => ({ ...f, dataSource: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={researchDisseminationForm.status} label="Status" onChange={(e) => setResearchDisseminationForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Team &amp; Publication</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Lead (Senior)</InputLabel>
                  <Select value={researchDisseminationForm.leadSenior} label="Lead (Senior)" onChange={(e) => setResearchDisseminationForm(f => ({ ...f, leadSenior: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Co-Authors</InputLabel>
                  <Select multiple value={researchDisseminationForm.interestedCoAuthors} label="Co-Authors" onChange={(e) => setResearchDisseminationForm(f => ({ ...f, interestedCoAuthors: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {coAuthorsList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select value={researchDisseminationForm.manuscriptAbstractOrBoth} label="Type" onChange={(e) => setResearchDisseminationForm(f => ({ ...f, manuscriptAbstractOrBoth: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {MANUSCRIPT_ABSTRACT_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField size="small" label="Publication Year" value={researchDisseminationForm.publicationYear} onChange={(e) => setResearchDisseminationForm(f => ({ ...f, publicationYear: e.target.value }))} fullWidth placeholder="e.g. 2025" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Reach out to lead?</InputLabel>
                  <Select value={researchDisseminationForm.reachOutToLeadAuthor} label="Reach out to lead?" onChange={(e) => setResearchDisseminationForm(f => ({ ...f, reachOutToLeadAuthor: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {REACH_OUT_YN.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField size="small" label="Timing (conference deadlines)" value={researchDisseminationForm.timingConferenceDeadlines} onChange={(e) => setResearchDisseminationForm(f => ({ ...f, timingConferenceDeadlines: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={12}>
                <TextField size="small" label="Notes" value={researchDisseminationForm.notes} onChange={(e) => setResearchDisseminationForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResearchDisseminationDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleResearchDisseminationSave}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Abstracts Dialog - same as Scholarship */}
        <Dialog open={abstractsDialogOpen} onClose={() => setAbstractsDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingAbstracts ? 'Edit Abstracts/Presentation' : 'Add Abstracts/Presentation'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Basic Information</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <TextField size="small" label="Category/Topic" value={abstractsForm.categoryTopic} onChange={(e) => setAbstractsForm(f => ({ ...f, categoryTopic: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={abstractsForm.status} label="Status" onChange={(e) => setAbstractsForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.value}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField size="small" type="number" label="Priority" value={abstractsForm.order} onChange={(e) => setAbstractsForm(f => ({ ...f, order: Number(e.target.value) || 0 }))} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Due Date"
                  value={abstractsForm.dueDate ? parseISO(abstractsForm.dueDate) : null}
                  onChange={(d) => setAbstractsForm(f => ({ ...f, dueDate: safeFormatDate(d, 'yyyy-MM-dd') }))}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Team Assignment</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Sponsor (S)</InputLabel>
                  <Select value={abstractsForm.projectSponsor} label="Project Sponsor (S)" onChange={(e) => setAbstractsForm(f => ({ ...f, projectSponsor: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Lead (L)</InputLabel>
                  <Select value={abstractsForm.projectLead} label="Project Lead (L)" onChange={(e) => setAbstractsForm(f => ({ ...f, projectLead: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Team Member(s) (T)</InputLabel>
                  <Select multiple value={abstractsForm.teamMembers} label="Team Member(s) (T)" onChange={(e) => setAbstractsForm(f => ({ ...f, teamMembers: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Project Admin (A)</InputLabel>
                  <Select value={abstractsForm.projectAdmin} label="Project Admin (A)" onChange={(e) => setAbstractsForm(f => ({ ...f, projectAdmin: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Consulted (C)</InputLabel>
                  <Select multiple value={abstractsForm.consulted} label="Consulted (C)" onChange={(e) => setAbstractsForm(f => ({ ...f, consulted: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Informed (I)</InputLabel>
                  <Select multiple value={abstractsForm.informed} label="Informed (I)" onChange={(e) => setAbstractsForm(f => ({ ...f, informed: e.target.value as string[] }))} renderValue={sel => sel.join(', ')}>
                    {teamMembersList.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><Divider><Typography variant="caption" color="textSecondary">Time Estimate</Typography></Divider></Grid>
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Time Commitment</InputLabel>
                  <Select value={abstractsForm.timeCommitment} label="Time Commitment" onChange={(e) => setAbstractsForm(f => ({ ...f, timeCommitment: e.target.value }))}>
                    <MenuItem value="">—</MenuItem>
                    {TIME_COMMITMENT_OPTIONS.map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAbstractsDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAbstractsSave}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Inline Status Edit Menu */}
        <Menu
          anchorEl={inlineMenuAnchor}
          open={Boolean(inlineMenuAnchor) && inlineEditingField === 'status'}
          onClose={handleInlineEditClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ sx: { maxHeight: 300 } }}
        >
          {STATUS_OPTIONS.map(opt => (
            <MenuItem 
              key={opt.value} 
              onClick={() => handleInlineStatusChange(opt.value)}
              sx={{ 
                bgcolor: opt.color, 
                color: opt.textColor, 
                my: 0.25,
                mx: 0.5,
                borderRadius: 1,
                '&:hover': { bgcolor: opt.color, filter: 'brightness(0.9)' }
              }}
            >
              {opt.value}
            </MenuItem>
          ))}
        </Menu>

        {/* Inline Development Status Edit Menu */}
        <Menu
          anchorEl={inlineMenuAnchor}
          open={Boolean(inlineMenuAnchor) && inlineEditingField === 'devStatus'}
          onClose={handleInlineEditClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ sx: { maxHeight: 400, maxWidth: 500 } }}
        >
          <MenuItem onClick={() => handleInlineDevStatusChange('')}>
            <em>— Clear —</em>
          </MenuItem>
          {DEVELOPMENT_STAGES.map(s => (
            <MenuItem 
              key={s.value} 
              onClick={() => handleInlineDevStatusChange(s.value)}
              sx={{ 
                bgcolor: s.color, 
                color: s.textColor, 
                my: 0.25,
                mx: 0.5,
                borderRadius: 1,
                whiteSpace: 'normal',
                lineHeight: 1.3,
                '&:hover': { bgcolor: s.color, filter: 'brightness(0.9)' }
              }}
            >
              {s.value}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </LocalizationProvider>
  );
};

export default AdminProjectPipelinePage;
