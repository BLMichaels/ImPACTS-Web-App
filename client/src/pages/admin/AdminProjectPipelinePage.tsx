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
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '../../context/AuthContext';

/** Safely format a date; returns null if the date is invalid */
const safeFormatDate = (d: Date | null | undefined, fmt: string): string | null => {
  if (!d || !isValid(d)) return null;
  try {
    return format(d, fmt);
  } catch {
    return null;
  }
};

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

// Research Dissemination: manuscript/abstract type and reach-out Y/N
const MANUSCRIPT_ABSTRACT_OPTIONS = ['Manuscript', 'Abstract', 'Both', 'Other'];
const REACH_OUT_YN = ['Y', 'N'];

// Research Dissemination category/section options
const RESEARCH_DISSEMINATION_CATEGORIES = [
  'Protocol/Implementation',
  'Methods',
  'Effectiveness',
  'Mechanisms',
  'Practice Experience with Delivering SMAs',
  'Cost and Resources',
  'Invested clinical organization/providers dissemination',
  'Other'
];

const PIPELINE_STORAGE_KEY = 'admin_project_pipeline_simbox';
const PIPELINE_SCHOLARSHIP_KEY = 'admin_project_pipeline_scholarship';
const PIPELINE_RESEARCH_DISSEMINATION_KEY = 'admin_project_pipeline_research_dissemination';
const PIPELINE_ABSTRACTS_KEY = 'admin_project_pipeline_abstracts';

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

const defaultScholarship = (): ScholarshipPublication => ({
  id: '',
  status: 'Not Started',
  order: 0,
  categoryTopic: '',
  dueDate: null,
  projectSponsor: '',
  projectLead: '',
  teamMembers: [],
  projectAdmin: '',
  consulted: [],
  informed: [],
  timeCommitment: ''
});

// Abstracts/Presentations — same shape as Scholarship/Publications
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

const defaultAbstractsPresentation = (): AbstractsPresentation => ({
  id: '',
  status: 'Not Started',
  order: 0,
  categoryTopic: '',
  dueDate: null,
  projectSponsor: '',
  projectLead: '',
  teamMembers: [],
  projectAdmin: '',
  consulted: [],
  informed: [],
  timeCommitment: ''
});

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

const defaultResearchDissemination = (): ResearchDisseminationIdea => ({
  id: '',
  topic: '',
  summaryBriefOverview: '',
  dataSource: '',
  leadSenior: '',
  interestedCoAuthors: [],
  manuscriptAbstractOrBoth: '',
  timingConferenceDeadlines: '',
  status: 'Not Started',
  publicationYear: '',
  reachOutToLeadAuthor: '',
  notes: '',
  category: ''
});

const AdminProjectPipelinePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [simboxCases, setSimboxCases] = useState<SimBoxCase[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<SimBoxCase | null>(null);
  const [form, setForm] = useState<SimBoxCase>(defaultSimBoxCase());

  const [scholarshipItems, setScholarshipItems] = useState<ScholarshipPublication[]>([]);
  const [scholarshipDialogOpen, setScholarshipDialogOpen] = useState(false);
  const [editingScholarship, setEditingScholarship] = useState<ScholarshipPublication | null>(null);
  const [scholarshipForm, setScholarshipForm] = useState<ScholarshipPublication>(defaultScholarship());

  const [researchDisseminationItems, setResearchDisseminationItems] = useState<ResearchDisseminationIdea[]>([]);
  const [researchDisseminationDialogOpen, setResearchDisseminationDialogOpen] = useState(false);
  const [editingResearchDissemination, setEditingResearchDissemination] = useState<ResearchDisseminationIdea | null>(null);
  const [researchDisseminationForm, setResearchDisseminationForm] = useState<ResearchDisseminationIdea>(defaultResearchDissemination());

  const [abstractsItems, setAbstractsItems] = useState<AbstractsPresentation[]>([]);
  const [abstractsDialogOpen, setAbstractsDialogOpen] = useState(false);
  const [editingAbstracts, setEditingAbstracts] = useState<AbstractsPresentation | null>(null);
  const [abstractsForm, setAbstractsForm] = useState<AbstractsPresentation>(defaultAbstractsPresentation());

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
      const savedSch = localStorage.getItem(`${PIPELINE_SCHOLARSHIP_KEY}_${currentUser.id}`);
      if (savedSch) {
        try {
          const parsed = JSON.parse(savedSch);
          setScholarshipItems(Array.isArray(parsed) ? parsed : []);
        } catch {
          setScholarshipItems([]);
        }
      }
      const savedRd = localStorage.getItem(`${PIPELINE_RESEARCH_DISSEMINATION_KEY}_${currentUser.id}`);
      if (savedRd) {
        try {
          const parsed = JSON.parse(savedRd);
          setResearchDisseminationItems(Array.isArray(parsed) ? parsed : []);
        } catch {
          setResearchDisseminationItems([]);
        }
      }
      const savedAbs = localStorage.getItem(`${PIPELINE_ABSTRACTS_KEY}_${currentUser.id}`);
      if (savedAbs) {
        try {
          const parsed = JSON.parse(savedAbs);
          setAbstractsItems(Array.isArray(parsed) ? parsed : []);
        } catch {
          setAbstractsItems([]);
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

  const saveScholarship = (items: ScholarshipPublication[]) => {
    setScholarshipItems(items);
    if (currentUser?.id) {
      localStorage.setItem(`${PIPELINE_SCHOLARSHIP_KEY}_${currentUser.id}`, JSON.stringify(items));
    }
  };

  const handleScholarshipAdd = () => {
    setEditingScholarship(null);
    const nextOrder = scholarshipItems.length > 0
      ? Math.max(...scholarshipItems.map(c => c.order), 0) + 1
      : 1;
    setScholarshipForm({
      ...defaultScholarship(),
      id: `scholarship_${Date.now()}`,
      order: nextOrder
    });
    setScholarshipDialogOpen(true);
  };

  const handleScholarshipEdit = (row: ScholarshipPublication) => {
    setEditingScholarship(row);
    setScholarshipForm({ ...row });
    setScholarshipDialogOpen(true);
  };

  const handleScholarshipSave = () => {
    if (editingScholarship) {
      const updated = scholarshipItems.map(c => (c.id === editingScholarship.id ? { ...scholarshipForm } : c));
      saveScholarship(updated);
    } else {
      saveScholarship([...scholarshipItems, { ...scholarshipForm }]);
    }
    setScholarshipDialogOpen(false);
    setScholarshipForm(defaultScholarship());
  };

  const handleScholarshipDelete = (id: string) => {
    if (window.confirm('Delete this scholarship/publication entry?')) {
      saveScholarship(scholarshipItems.filter(c => c.id !== id));
    }
  };

  const saveResearchDissemination = (items: ResearchDisseminationIdea[]) => {
    setResearchDisseminationItems(items);
    if (currentUser?.id) {
      localStorage.setItem(`${PIPELINE_RESEARCH_DISSEMINATION_KEY}_${currentUser.id}`, JSON.stringify(items));
    }
  };

  const handleResearchDisseminationAdd = () => {
    setEditingResearchDissemination(null);
    setResearchDisseminationForm({
      ...defaultResearchDissemination(),
      id: `research_${Date.now()}`
    });
    setResearchDisseminationDialogOpen(true);
  };

  const handleResearchDisseminationEdit = (row: ResearchDisseminationIdea) => {
    setEditingResearchDissemination(row);
    setResearchDisseminationForm({ ...row });
    setResearchDisseminationDialogOpen(true);
  };

  const handleResearchDisseminationSave = () => {
    if (editingResearchDissemination) {
      const updated = researchDisseminationItems.map(c =>
        c.id === editingResearchDissemination.id ? { ...researchDisseminationForm } : c
      );
      saveResearchDissemination(updated);
    } else {
      saveResearchDissemination([...researchDisseminationItems, { ...researchDisseminationForm }]);
    }
    setResearchDisseminationDialogOpen(false);
    setResearchDisseminationForm(defaultResearchDissemination());
  };

  const handleResearchDisseminationDelete = (id: string) => {
    if (window.confirm('Delete this research dissemination idea?')) {
      saveResearchDissemination(researchDisseminationItems.filter(c => c.id !== id));
    }
  };

  const saveAbstracts = (items: AbstractsPresentation[]) => {
    setAbstractsItems(items);
    if (currentUser?.id) {
      localStorage.setItem(`${PIPELINE_ABSTRACTS_KEY}_${currentUser.id}`, JSON.stringify(items));
    }
  };

  const handleAbstractsAdd = () => {
    setEditingAbstracts(null);
    const nextOrder = abstractsItems.length > 0
      ? Math.max(...abstractsItems.map(c => c.order), 0) + 1
      : 1;
    setAbstractsForm({
      ...defaultAbstractsPresentation(),
      id: `abstracts_${Date.now()}`,
      order: nextOrder
    });
    setAbstractsDialogOpen(true);
  };

  const handleAbstractsEdit = (row: AbstractsPresentation) => {
    setEditingAbstracts(row);
    setAbstractsForm({ ...row });
    setAbstractsDialogOpen(true);
  };

  const handleAbstractsSave = () => {
    if (editingAbstracts) {
      const updated = abstractsItems.map(c => (c.id === editingAbstracts.id ? { ...abstractsForm } : c));
      saveAbstracts(updated);
    } else {
      saveAbstracts([...abstractsItems, { ...abstractsForm }]);
    }
    setAbstractsDialogOpen(false);
    setAbstractsForm(defaultAbstractsPresentation());
  };

  const handleAbstractsDelete = (id: string) => {
    if (window.confirm('Delete this abstracts/presentation entry?')) {
      saveAbstracts(abstractsItems.filter(c => c.id !== id));
    }
  };

  const sortedCases = [...simboxCases].sort((a, b) => a.order - b.order);
  const sortedScholarship = [...scholarshipItems].sort((a, b) => a.order - b.order);
  const sortedAbstracts = [...abstractsItems].sort((a, b) => a.order - b.order);
  const sortedResearchDissemination = [...researchDisseminationItems].sort((a, b) =>
    a.topic.localeCompare(b.topic, undefined, { sensitivity: 'base' })
  );

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

        {tabValue === 1 && (
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Scholarship/Publications</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleScholarshipAdd}>
                Add Entry
              </Button>
            </Box>
            <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Order</strong></TableCell>
                    <TableCell><strong>Category / Topic</strong></TableCell>
                    <TableCell><strong>Due Date</strong></TableCell>
                    <TableCell><strong>Project Sponsor</strong></TableCell>
                    <TableCell><strong>Project Lead</strong></TableCell>
                    <TableCell><strong>Team Member(s)</strong></TableCell>
                    <TableCell><strong>Project Admin</strong></TableCell>
                    <TableCell><strong>Consulted</strong></TableCell>
                    <TableCell><strong>Informed</strong></TableCell>
                    <TableCell><strong>Time Commitment Needed to Complete</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedScholarship.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                        No scholarship/publication entries yet. Click &quot;Add Entry&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedScholarship.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell><Chip size="small" label={row.status} /></TableCell>
                        <TableCell>{row.order}</TableCell>
                        <TableCell>{row.categoryTopic || '-'}</TableCell>
                        <TableCell>{row.dueDate ? format(parseISO(row.dueDate), 'MM/dd/yyyy') : '-'}</TableCell>
                        <TableCell>{row.projectSponsor || '-'}</TableCell>
                        <TableCell>{row.projectLead || '-'}</TableCell>
                        <TableCell>{row.teamMembers?.length ? row.teamMembers.join(', ') : '-'}</TableCell>
                        <TableCell>{row.projectAdmin || '-'}</TableCell>
                        <TableCell>{row.consulted?.length ? row.consulted.join(', ') : '-'}</TableCell>
                        <TableCell>{row.informed?.length ? row.informed.join(', ') : '-'}</TableCell>
                        <TableCell>{row.timeCommitment || '-'}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleScholarshipEdit(row)}><EditIcon /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleScholarshipDelete(row.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tabValue === 2 && (
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Research Dissemination Ideas</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleResearchDisseminationAdd}>
                Add Idea
              </Button>
            </Box>
            <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Topic</strong></TableCell>
                    <TableCell><strong>Summary/Brief Overview</strong></TableCell>
                    <TableCell><strong>Data Source</strong></TableCell>
                    <TableCell><strong>Lead (Senior)</strong></TableCell>
                    <TableCell><strong>Interested/Co-Authors</strong></TableCell>
                    <TableCell><strong>Manuscript, abstract, or both/other</strong></TableCell>
                    <TableCell><strong>Timing (include conference deadlines)</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Publication Year</strong></TableCell>
                    <TableCell><strong>Reach out to lead author (Y/N)</strong></TableCell>
                    <TableCell><strong>Notes</strong></TableCell>
                    <TableCell><strong>Category</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedResearchDissemination.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                        No research dissemination ideas yet. Click &quot;Add Idea&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedResearchDissemination.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.topic || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.summaryBriefOverview || '-'}</TableCell>
                        <TableCell>{row.dataSource || '-'}</TableCell>
                        <TableCell>{row.leadSenior || '-'}</TableCell>
                        <TableCell>{row.interestedCoAuthors?.length ? row.interestedCoAuthors.join(', ') : '-'}</TableCell>
                        <TableCell>{row.manuscriptAbstractOrBoth || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.timingConferenceDeadlines || '-'}</TableCell>
                        <TableCell><Chip size="small" label={row.status} /></TableCell>
                        <TableCell>{row.publicationYear || '-'}</TableCell>
                        <TableCell>{row.reachOutToLeadAuthor || '-'}</TableCell>
                        <TableCell sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.notes || '-'}</TableCell>
                        <TableCell>{row.category || '-'}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleResearchDisseminationEdit(row)}><EditIcon /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleResearchDisseminationDelete(row.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tabValue === 3 && (
          <Paper>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Abstracts/Presentations</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAbstractsAdd}>
                Add Entry
              </Button>
            </Box>
            <TableContainer sx={{ maxHeight: 600, overflow: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Order</strong></TableCell>
                    <TableCell><strong>Category / Topic</strong></TableCell>
                    <TableCell><strong>Due Date</strong></TableCell>
                    <TableCell><strong>Project Sponsor</strong></TableCell>
                    <TableCell><strong>Project Lead</strong></TableCell>
                    <TableCell><strong>Team Member(s)</strong></TableCell>
                    <TableCell><strong>Project Admin</strong></TableCell>
                    <TableCell><strong>Consulted</strong></TableCell>
                    <TableCell><strong>Informed</strong></TableCell>
                    <TableCell><strong>Time Commitment Needed to Complete</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedAbstracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4 }}>
                        No abstracts/presentation entries yet. Click &quot;Add Entry&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAbstracts.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell><Chip size="small" label={row.status} /></TableCell>
                        <TableCell>{row.order}</TableCell>
                        <TableCell>{row.categoryTopic || '-'}</TableCell>
                        <TableCell>{row.dueDate ? format(parseISO(row.dueDate), 'MM/dd/yyyy') : '-'}</TableCell>
                        <TableCell>{row.projectSponsor || '-'}</TableCell>
                        <TableCell>{row.projectLead || '-'}</TableCell>
                        <TableCell>{row.teamMembers?.length ? row.teamMembers.join(', ') : '-'}</TableCell>
                        <TableCell>{row.projectAdmin || '-'}</TableCell>
                        <TableCell>{row.consulted?.length ? row.consulted.join(', ') : '-'}</TableCell>
                        <TableCell>{row.informed?.length ? row.informed.join(', ') : '-'}</TableCell>
                        <TableCell>{row.timeCommitment || '-'}</TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleAbstractsEdit(row)}><EditIcon /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleAbstractsDelete(row.id)}><DeleteIcon /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tabValue > 3 && (
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
                onChange={(d) => setForm(f => ({ ...f, dueDate: safeFormatDate(d, 'yyyy-MM-dd') }))}
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

        {/* Add/Edit Scholarship/Publication Dialog */}
        <Dialog open={scholarshipDialogOpen} onClose={() => setScholarshipDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingScholarship ? 'Edit Scholarship/Publication' : 'Add Scholarship/Publication'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={scholarshipForm.status}
                  label="Status"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, status: e.target.value }))}
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
                value={scholarshipForm.order}
                onChange={(e) => setScholarshipForm(f => ({ ...f, order: Number(e.target.value) || 0 }))}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="Category / Topic"
                value={scholarshipForm.categoryTopic}
                onChange={(e) => setScholarshipForm(f => ({ ...f, categoryTopic: e.target.value }))}
                fullWidth
              />
              <DatePicker
                label="Due Date"
                value={scholarshipForm.dueDate ? parseISO(scholarshipForm.dueDate) : null}
                onChange={(d) => setScholarshipForm(f => ({ ...f, dueDate: safeFormatDate(d, 'yyyy-MM-dd') }))}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Project Sponsor</InputLabel>
                <Select
                  value={scholarshipForm.projectSponsor}
                  label="Project Sponsor"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, projectSponsor: e.target.value }))}
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
                  value={scholarshipForm.projectLead}
                  label="Project Lead"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, projectLead: e.target.value }))}
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
                  value={scholarshipForm.projectAdmin}
                  label="Project Admin"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, projectAdmin: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Time Commitment Needed to Complete</InputLabel>
                <Select
                  value={scholarshipForm.timeCommitment}
                  label="Time Commitment Needed to Complete"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, timeCommitment: e.target.value }))}
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
                  value={scholarshipForm.teamMembers}
                  label="Team Member(s)"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, teamMembers: e.target.value as string[] }))}
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
                  value={scholarshipForm.consulted}
                  label="Consulted"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, consulted: e.target.value as string[] }))}
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
                  value={scholarshipForm.informed}
                  label="Informed"
                  onChange={(e) => setScholarshipForm(f => ({ ...f, informed: e.target.value as string[] }))}
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
            <Button onClick={() => setScholarshipDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleScholarshipSave}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Add/Edit Research Dissemination Idea Dialog */}
        <Dialog open={researchDisseminationDialogOpen} onClose={() => setResearchDisseminationDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingResearchDissemination ? 'Edit Research Dissemination Idea' : 'Add Research Dissemination Idea'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>Category (Section)</InputLabel>
                <Select
                  value={researchDisseminationForm.category}
                  label="Category (Section)"
                  onChange={(e) => setResearchDisseminationForm(f => ({ ...f, category: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {RESEARCH_DISSEMINATION_CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Topic"
                value={researchDisseminationForm.topic}
                onChange={(e) => setResearchDisseminationForm(f => ({ ...f, topic: e.target.value }))}
                fullWidth
              />
              <TextField
                size="small"
                label="Summary/Brief Overview"
                value={researchDisseminationForm.summaryBriefOverview}
                onChange={(e) => setResearchDisseminationForm(f => ({ ...f, summaryBriefOverview: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              <TextField
                size="small"
                label="Data Source"
                value={researchDisseminationForm.dataSource}
                onChange={(e) => setResearchDisseminationForm(f => ({ ...f, dataSource: e.target.value }))}
                fullWidth
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Lead (Senior)</InputLabel>
                <Select
                  value={researchDisseminationForm.leadSenior}
                  label="Lead (Senior)"
                  onChange={(e) => setResearchDisseminationForm(f => ({ ...f, leadSenior: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Interested/Co-Authors</InputLabel>
                <Select
                  multiple
                  value={researchDisseminationForm.interestedCoAuthors}
                  label="Interested/Co-Authors"
                  onChange={(e) => setResearchDisseminationForm(f => ({ ...f, interestedCoAuthors: e.target.value as string[] }))}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 260 }}>
                <InputLabel>Manuscript, abstract, or both/other</InputLabel>
                <Select
                  value={researchDisseminationForm.manuscriptAbstractOrBoth}
                  label="Manuscript, abstract, or both/other"
                  onChange={(e) => setResearchDisseminationForm(f => ({ ...f, manuscriptAbstractOrBoth: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {MANUSCRIPT_ABSTRACT_OPTIONS.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Timing (include conference deadlines)"
                value={researchDisseminationForm.timingConferenceDeadlines}
                onChange={(e) => setResearchDisseminationForm(f => ({ ...f, timingConferenceDeadlines: e.target.value }))}
                fullWidth
                placeholder="e.g. conference deadline May 2025"
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={researchDisseminationForm.status}
                  label="Status"
                  onChange={(e) => setResearchDisseminationForm(f => ({ ...f, status: e.target.value }))}
                >
                  {SIMBOX_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Publication Year"
                value={researchDisseminationForm.publicationYear}
                onChange={(e) => setResearchDisseminationForm(f => ({ ...f, publicationYear: e.target.value }))}
                placeholder="e.g. 2025"
                sx={{ width: 140 }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Reach out to lead author (Y/N)</InputLabel>
                <Select
                  value={researchDisseminationForm.reachOutToLeadAuthor}
                  label="Reach out to lead author (Y/N)"
                  onChange={(e) => setResearchDisseminationForm(f => ({ ...f, reachOutToLeadAuthor: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {REACH_OUT_YN.map((opt) => (
                    <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Notes"
                value={researchDisseminationForm.notes}
                onChange={(e) => setResearchDisseminationForm(f => ({ ...f, notes: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResearchDisseminationDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleResearchDisseminationSave}>Save</Button>
          </DialogActions>
        </Dialog>

        {/* Add/Edit Abstracts/Presentation Dialog — same columns as Scholarship */}
        <Dialog open={abstractsDialogOpen} onClose={() => setAbstractsDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editingAbstracts ? 'Edit Abstracts/Presentation' : 'Add Abstracts/Presentation'}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={abstractsForm.status}
                  label="Status"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, status: e.target.value }))}
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
                value={abstractsForm.order}
                onChange={(e) => setAbstractsForm(f => ({ ...f, order: Number(e.target.value) || 0 }))}
                sx={{ width: 100 }}
              />
              <TextField
                size="small"
                label="Category / Topic"
                value={abstractsForm.categoryTopic}
                onChange={(e) => setAbstractsForm(f => ({ ...f, categoryTopic: e.target.value }))}
                fullWidth
              />
              <DatePicker
                label="Due Date"
                value={abstractsForm.dueDate ? parseISO(abstractsForm.dueDate) : null}
                onChange={(d) => setAbstractsForm(f => ({ ...f, dueDate: safeFormatDate(d, 'yyyy-MM-dd') }))}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 160 } } }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Project Sponsor</InputLabel>
                <Select
                  value={abstractsForm.projectSponsor}
                  label="Project Sponsor"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, projectSponsor: e.target.value }))}
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
                  value={abstractsForm.projectLead}
                  label="Project Lead"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, projectLead: e.target.value }))}
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
                  value={abstractsForm.projectAdmin}
                  label="Project Admin"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, projectAdmin: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  {TEAM_MEMBERS.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Time Commitment Needed to Complete</InputLabel>
                <Select
                  value={abstractsForm.timeCommitment}
                  label="Time Commitment Needed to Complete"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, timeCommitment: e.target.value }))}
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
                  value={abstractsForm.teamMembers}
                  label="Team Member(s)"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, teamMembers: e.target.value as string[] }))}
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
                  value={abstractsForm.consulted}
                  label="Consulted"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, consulted: e.target.value as string[] }))}
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
                  value={abstractsForm.informed}
                  label="Informed"
                  onChange={(e) => setAbstractsForm(f => ({ ...f, informed: e.target.value as string[] }))}
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
            <Button onClick={() => setAbstractsDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAbstractsSave}>Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default AdminProjectPipelinePage;
