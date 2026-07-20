import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useMediaQuery,
  useTheme,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  alpha,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useUserProfile } from '../context/UserProfileContext';
import { PhiBlockedError } from '../utils/phiScanner';
import { supabase } from '../supabase';
import {
  migrateFromLocalStorage,
  getContinuityData,
  resolveHospitalUuid,
  writeContinuityData,
} from '../utils/userData';
import { usePermission, usePrsSectionVisible } from '../hooks/usePermissions';
import { PERMISSIONS } from '../types/database';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import GapPlanReminderBanner from '../components/GapPlanReminderBanner';
import DashboardResources from '../components/DashboardResources';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';
import InsightsIcon from '@mui/icons-material/Insights';
import EventNoteIcon from '@mui/icons-material/EventNote';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import ScienceIcon from '@mui/icons-material/Science';
import GroupsIcon from '@mui/icons-material/Groups';
import type { SvgIconComponent } from '@mui/icons-material';

interface DepartmentContact {
  id: string;
  department: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
}

interface ReadinessScore {
  id: string;
  date: string;
  score: number;
}

const TOOL_AREAS: {
  title: string;
  path: string;
  Icon: SvgIconComponent;
  description: string;
}[] = [
  {
    title: 'Checklist',
    path: '/milestones',
    Icon: ChecklistRtlIcon,
    description:
      'Work through Establish, Implement, Lead, and Sustain. Complete milestones to advance your PECC journey.',
  },
  {
    title: 'Snapshot',
    path: '/snapshot',
    Icon: InsightsIcon,
    description:
      'Review Pediatric Readiness Score trends and progress metrics across checklist, gaps, activities, and simulations.',
  },
  {
    title: 'Activities',
    path: '/activities',
    Icon: EventNoteIcon,
    description:
      'Log PECC work, simulations, and training. Track time and impact on pediatric readiness.',
  },
  {
    title: 'Gap Plan',
    path: '/gap-plan',
    Icon: TrackChangesIcon,
    description:
      'Prioritize gap-reduction actions from your assessment and monitor progress toward readiness goals.',
  },
  {
    title: 'Simulation',
    path: '/simulation',
    Icon: ScienceIcon,
    description:
      'Document simulation exercises, care gaps, and outcomes to strengthen facility readiness.',
  },
  {
    title: 'Cohorts',
    path: '/cohorts',
    Icon: GroupsIcon,
    description:
      'Stay connected with peers—announcements, discussions, and collaboration within your cohort.',
  },
];

const sectionShellSx = {
  p: { xs: 2, md: 2.5 },
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
} as const;

  const DashboardPage = () => {
    const navigate = useNavigate();
    const { userProfile, navbarBrandProgramId, effectiveUserId, siteId } = useUserProfile();
    const [primaryProgramName, setPrimaryProgramName] = useState<string>('ImPACTS');
    /** Matches navbar branding: resolved primary or membership (see resolveNavbarProgramLogo). */
    const programIdForWelcome = navbarBrandProgramId
      ?? (userProfile as { primary_program_id?: string | null })?.primary_program_id
      ?? null;

    useEffect(() => {
      const pid = programIdForWelcome;
      if (!pid) {
        setPrimaryProgramName('ImPACTS');
        return;
      }
      let mounted = true;
      supabase.from('programs').select('name').eq('id', pid).maybeSingle().then(({ data }) => {
        if (mounted && data && typeof (data as { name?: string }).name === 'string') {
          setPrimaryProgramName((data as { name: string }).name);
        } else {
          setPrimaryProgramName('ImPACTS');
        }
      });
      return () => { mounted = false; };
    }, [userProfile?.id, programIdForWelcome]);

    // Mobile responsiveness
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    
    const [prsSectionVisible] = usePrsSectionVisible();
    const canViewPrs = usePermission(PERMISSIONS.VIEW_PRS);
    const showPrsSection = prsSectionVisible && canViewPrs;
    /** Same subject as Snapshot and PRS visibility (view-as aware). */
    const uid = effectiveUserId;

  const firstName =
    (userProfile as { firstName?: string; first_name?: string } | null)?.firstName ||
    (userProfile as { firstName?: string; first_name?: string } | null)?.first_name ||
    'PECC';

  const [readinessScores, setReadinessScores] = useState<ReadinessScore[]>([]);
  const [readinessScoreDialogOpen, setReadinessScoreDialogOpen] = useState(false);
  const [readinessScoreForm, setReadinessScoreForm] = useState({ date: new Date(), score: '' });
  const [editingReadinessScoreId, setEditingReadinessScoreId] = useState<string | null>(null);
  const [readinessDeleteConfirm, setReadinessDeleteConfirm] = useState<{ open: boolean; scoreId: string | null }>({
    open: false,
    scoreId: null
  });

  const [phiContactsBlocked, setPhiContactsBlocked] = useState(false);

  const [departmentContacts, setDepartmentContacts] = useState<DepartmentContact[]>([
    { id: '17', department: 'Pediatric Readiness Mentor', contactName: '', phone: '', email: '', notes: '' },
    { id: '1', department: 'Chief Nursing Officer', contactName: '', phone: '', email: '', notes: '' },
    { id: '2', department: 'Chief Medical Officer', contactName: '', phone: '', email: '', notes: '' },
    { id: '3', department: 'Trauma Coordinator', contactName: '', phone: '', email: '', notes: '' },
    { id: '4', department: 'Emergency Nursing Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '5', department: 'Emergency Medical Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '6', department: 'Emergency Manager(s)', contactName: '', phone: '', email: '', notes: '' },
    { id: '7', department: 'Pharmacy Director', contactName: '', phone: '', email: '', notes: '' },
    { id: '8', department: 'Respiratory Therapy Director or Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '9', department: 'Pediatric Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '10', department: 'Emergency Dept Educator', contactName: '', phone: '', email: '', notes: '' },
    { id: '11', department: 'Peds Social Worker', contactName: '', phone: '', email: '', notes: '' },
    { id: '12', department: 'PICU Manager', contactName: '', phone: '', email: '', notes: '' },
    { id: '13', department: 'Pediatric Unit Manager', contactName: '', phone: '', email: '', notes: '' },
    { id: '14', department: 'Information Systems Contact', contactName: '', phone: '', email: '', notes: '' },
    { id: '15', department: 'Pediatric Hospitalist (Point Person)', contactName: '', phone: '', email: '', notes: '' },
    { id: '16', department: 'Pediatric Intensivist (Point Person)', contactName: '', phone: '', email: '', notes: '' },
    { id: '18', department: 'Pediatric and/or Emergency Clinical Nurse Specialist', contactName: '', phone: '', email: '', notes: '' },
    { id: '19', department: 'OTHER CONTACT 1', contactName: '', phone: '', email: '', notes: '' },
    { id: '20', department: 'OTHER CONTACT 2', contactName: '', phone: '', email: '', notes: '' },
    { id: '21', department: 'OTHER CONTACT 3', contactName: '', phone: '', email: '', notes: '' },
    { id: '22', department: 'OTHER CONTACT 4', contactName: '', phone: '', email: '', notes: '' },
    { id: '23', department: 'OTHER CONTACT 5', contactName: '', phone: '', email: '', notes: '' },
    { id: '24', department: 'OTHER CONTACT 6', contactName: '', phone: '', email: '', notes: '' },
    { id: '25', department: 'OTHER CONTACT 7', contactName: '', phone: '', email: '', notes: '' },
    { id: '26', department: 'OTHER CONTACT 8', contactName: '', phone: '', email: '', notes: '' },
    { id: '27', department: 'OTHER CONTACT 9', contactName: '', phone: '', email: '', notes: '' },
    { id: '28', department: 'OTHER CONTACT 10', contactName: '', phone: '', email: '', notes: '' }
  ]);

  const [sortConfig, setSortConfig] = useState<{
    key: keyof DepartmentContact;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [effectiveHospitalId, setEffectiveHospitalId] = useState<string | null>(null);
  const [contactsHydrated, setContactsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!siteId) {
        if (mounted) setEffectiveHospitalId(null);
        return;
      }
      const resolved = await resolveHospitalUuid(siteId);
      if (mounted) setEffectiveHospitalId(resolved);
    })();
    return () => {
      mounted = false;
    };
  }, [siteId]);

  // Load readiness scores only when PRS section is visible (granular permission)
  useEffect(() => {
    if (!uid) return;
    if (!showPrsSection) {
      setReadinessScores([]);
      return;
    }
    let mounted = true;
    (async () => {
      let val = await getContinuityData<ReadinessScore[]>(effectiveHospitalId, uid, 'readinessScores');
      if (!mounted) return;
      if (val != null && Array.isArray(val)) setReadinessScores(val);
      else if (!effectiveHospitalId) {
        migrateFromLocalStorage(uid, 'readinessScores', `readinessScores_${uid}`, (v) => setReadinessScores(Array.isArray(v) ? v : []));
      }
    })();
    return () => { mounted = false; };
  }, [uid, showPrsSection, effectiveHospitalId]);

  const saveReadinessScores = async (scores: ReadinessScore[]) => {
    setReadinessScores(scores);
    if (!uid) return;
    await writeContinuityData(effectiveHospitalId, uid, 'readinessScores', scores);
  };

  // Hospital department contacts are hospital-owned for turnover continuity.
  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    (async () => {
      const contactsVal = await getContinuityData<DepartmentContact[]>(
        effectiveHospitalId,
        uid,
        'dashboard_department_contacts'
      );
      if (!mounted) return;
      if (Array.isArray(contactsVal) && contactsVal.length > 0) setDepartmentContacts(contactsVal);
      setContactsHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, [uid, effectiveHospitalId]);

  useEffect(() => {
    if (!uid || !contactsHydrated) return;
    void writeContinuityData(effectiveHospitalId, uid, 'dashboard_department_contacts', departmentContacts)
      .then(() => setPhiContactsBlocked(false))
      .catch((err) => {
        if (err instanceof PhiBlockedError) {
          setPhiContactsBlocked(true);
          return;
        }
        console.error('Failed to save department contacts', err);
      });
  }, [uid, effectiveHospitalId, contactsHydrated, departmentContacts]);

  // Handle add readiness score
  const handleAddReadinessScore = () => {
    setReadinessScoreForm({ date: new Date(), score: '' });
    setEditingReadinessScoreId(null);
    setReadinessScoreDialogOpen(true);
  };

  const handleEditReadinessScore = (score: ReadinessScore) => {
    const parsedDate = (() => {
      try {
        return parseISO(score.date);
      } catch {
        return new Date(score.date);
      }
    })();
    setReadinessScoreForm({
      date: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      score: String(score.score)
    });
    setEditingReadinessScoreId(score.id);
    setReadinessScoreDialogOpen(true);
  };

  const handleDeleteReadinessScore = (scoreId: string) => {
    setReadinessDeleteConfirm({ open: true, scoreId });
  };

  const confirmDeleteReadinessScore = () => {
    const targetId = readinessDeleteConfirm.scoreId;
    if (!targetId) {
      setReadinessDeleteConfirm({ open: false, scoreId: null });
      return;
    }
    const updated = readinessScores.filter((score) => score.id !== targetId);
    void saveReadinessScores(updated);
    setReadinessDeleteConfirm({ open: false, scoreId: null });
  };

  const handleSaveReadinessScore = () => {
    if (!readinessScoreForm.score || isNaN(parseFloat(readinessScoreForm.score))) {
      return;
    }

    const scorePayload: ReadinessScore = {
      id: editingReadinessScoreId ?? `score_${Date.now()}`,
      date: format(readinessScoreForm.date, 'yyyy-MM-dd'),
      score: parseFloat(readinessScoreForm.score)
    };

    const updated = editingReadinessScoreId
      ? readinessScores.map((existing) => (existing.id === editingReadinessScoreId ? scorePayload : existing))
      : [...readinessScores, scorePayload];
    const sorted = updated.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    void saveReadinessScores(sorted);
    setEditingReadinessScoreId(null);
    setReadinessScoreDialogOpen(false);
  };
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    contactId: string | null;
    contactName: string;
  }>({
    open: false,
    contactId: null,
    contactName: ''
  });

  const handleContactUpdate = (id: string, field: keyof DepartmentContact, value: string) => {
    setDepartmentContacts(prev => prev.map(contact => 
      contact.id === id ? { ...contact, [field]: value } : contact
    ));
  };

  const handleSort = (key: keyof DepartmentContact) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedContacts = () => {
    if (!sortConfig) return departmentContacts;
    
    return [...departmentContacts].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const addNewContact = () => {
    const newId = (Math.max(...departmentContacts.map(c => parseInt(c.id))) + 1).toString();
    const newContact: DepartmentContact = {
      id: newId,
      department: `NEW CONTACT ${newId}`,
      contactName: '',
      phone: '',
      email: '',
      notes: ''
    };
    setDepartmentContacts([...departmentContacts, newContact]);
  };

  const deleteContact = (id: string) => {
    setDepartmentContacts(prev => prev.filter(contact => contact.id !== id));
  };

  const handleDeleteContact = (contact: DepartmentContact) => {
    setDeleteConfirmDialog({
      open: true,
      contactId: contact.id,
      contactName: contact.department
    });
  };

  const confirmDeleteContact = () => {
    if (deleteConfirmDialog.contactId) {
      deleteContact(deleteConfirmDialog.contactId);
      setDeleteConfirmDialog({
        open: false,
        contactId: null,
        contactName: ''
      });
    }
  };

  const cancelDeleteContact = () => {
    setDeleteConfirmDialog({
      open: false,
      contactId: null,
      contactName: ''
    });
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        minHeight: '100%',
        pb: { xs: 4, md: 5 },
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          py: { xs: 2, md: 3 },
          px: { xs: 2, sm: 3, md: 4, lg: 5 },
          width: '100%',
        }}
      >
        <GapPlanReminderBanner />

        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {/* Welcome hero */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.75 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: (t) =>
                `linear-gradient(120deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, ${t.palette.background.paper} 42%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ maxWidth: { md: 640 } }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
                >
                  PECC Support Tool
                </Typography>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: -0.02,
                    mb: 0.75,
                    color: 'text.primary',
                    fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
                  }}
                >
                  Welcome back, {firstName}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6, fontSize: { xs: '0.925rem', sm: '0.975rem' } }}
                >
                  Your home base for readiness work—progress, hospital contacts, and the tools you use most.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Button size="small" variant="outlined" onClick={() => navigate('/milestones')}>
                  Checklist
                </Button>
                <Button size="small" variant="outlined" onClick={() => navigate('/snapshot')}>
                  Snapshot
                </Button>
                <Button size="small" variant="outlined" onClick={() => navigate('/activities')}>
                  Activities
                </Button>
              </Stack>
            </Box>
          </Paper>

          {/* How this tool works */}
          <Box sx={sectionShellSx}>
            <Typography
              variant="overline"
              sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
            >
              Getting started
            </Typography>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, letterSpacing: -0.015, mb: 0.5, fontSize: { xs: '1.2rem', md: '1.35rem' } }}>
              How this tool works
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 820, lineHeight: 1.6 }}>
              Your {primaryProgramName} PECC Tracker guides you through the Pediatric Emergency Care Coordinator
              journey. Start with Checklist and Snapshot, then use Gap Plan and Activities to close gaps and document
              your work.
            </Typography>

            <Grid container spacing={{ xs: 1.25, md: 1.5 }}>
              {TOOL_AREAS.map(({ title, path, Icon, description }) => (
                <Grid item xs={12} sm={6} md={4} lg={2} key={path}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => navigate(path)}
                    sx={{
                      width: '100%',
                      height: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.secondary.main, 0.03),
                      p: 1.75,
                      transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
                      '&:hover': {
                        borderColor: alpha(theme.palette.secondary.main, 0.4),
                        bgcolor: alpha(theme.palette.secondary.main, 0.07),
                        boxShadow: `0 4px 16px ${alpha(theme.palette.secondary.main, 0.1)}`,
                      },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.secondary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: 1,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(theme.palette.secondary.main, 0.12),
                          color: 'secondary.dark',
                          flexShrink: 0,
                        }}
                      >
                        <Icon sx={{ fontSize: 16 }} aria-hidden />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: -0.01, lineHeight: 1.2 }}>
                        {title}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, fontSize: '0.8125rem' }}>
                      {description}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 2,
                pt: 1.75,
                borderTop: '1px solid',
                borderColor: 'divider',
                lineHeight: 1.55,
              }}
            >
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Tip:{' '}
              </Box>
              Use Snapshot to review progress, build Gap Plans from assessment gaps, and log Activities as you
              go. Your pediatric readiness mentor can guide each stage.
            </Typography>
          </Box>

          {/* Pediatric Readiness Scores — dense full-width table */}
          {showPrsSection && (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                overflow: 'hidden',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={1.25}
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.secondary.main, 0.04),
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', lineHeight: 1.2 }}
                  >
                    Assessment
                  </Typography>
                  <Typography
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: { xs: '1.15rem', md: '1.25rem' } }}
                  >
                    Pediatric Readiness Scores
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<AddIcon />}
                  onClick={handleAddReadinessScore}
                  size="small"
                  sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
                >
                  Add Score
                </Button>
              </Stack>

              {readinessScores.length === 0 ? (
                <Typography color="text.secondary" sx={{ px: 2.5, py: 2.5, lineHeight: 1.55 }}>
                  No readiness scores yet. Add your first National Pediatric Readiness Project assessment score.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small" aria-label="Pediatric readiness scores">
                    <TableHead>
                      <TableRow
                        sx={{
                          '& th': {
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            letterSpacing: 0.04,
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            borderBottomColor: 'divider',
                            py: 1,
                            bgcolor: alpha(theme.palette.primary.main, 0.03),
                          },
                        }}
                      >
                        <TableCell sx={{ width: 120 }}>Score</TableCell>
                        <TableCell>Assessment date</TableCell>
                        <TableCell align="right" sx={{ width: 96 }}>
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {readinessScores.map((score, index) => (
                        <TableRow
                          key={score.id}
                          hover
                          sx={{
                            '& td': { borderBottomColor: 'divider', py: 1 },
                            bgcolor: index === 0 ? alpha(theme.palette.secondary.main, 0.05) : 'transparent',
                          }}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="baseline">
                              <Typography
                                component="span"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '1.25rem',
                                  letterSpacing: -0.02,
                                  color: 'secondary.dark',
                                  fontVariantNumeric: 'tabular-nums',
                                  lineHeight: 1,
                                }}
                              >
                                {score.score}
                              </Typography>
                              {index === 0 && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{
                                    fontWeight: 700,
                                    color: 'secondary.main',
                                    letterSpacing: 0.04,
                                    textTransform: 'uppercase',
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  Latest
                                </Typography>
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {format(parseISO(score.date), 'MMM d, yyyy')}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              onClick={() => handleEditReadinessScore(score)}
                              aria-label="Edit score"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteReadinessScore(score.id)}
                              aria-label="Delete score"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}

          {/* Hospital Department Contacts */}
          <Box>
            <Accordion
              defaultExpanded
              disableGutters
              elevation={0}
              sx={{
                borderRadius: '8px !important',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  px: { xs: 2, md: 3 },
                  py: 1,
                  '& .MuiAccordionSummary-content': {
                    my: 1.5,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1.5,
                  },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography
                    variant="overline"
                    sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                  >
                    Hospital directory
                  </Typography>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: { xs: '1.15rem', md: '1.25rem' } }}>
                    Department contacts
                  </Typography>
                </Box>
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  useFlexGap
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Button
                    size="small"
                    variant={isEditMode ? 'contained' : 'outlined'}
                    startIcon={<EditIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditMode(!isEditMode);
                    }}
                  >
                    {isEditMode ? 'Exit edit' : 'Edit'}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      addNewContact();
                    }}
                    sx={{ boxShadow: 'none' }}
                  >
                    Add contact
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ px: { xs: 2, md: 3 }, pt: 0, pb: { xs: 2.5, md: 3 } }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                  Sort by column headers. Edit fields inline. Staff and role names belong here—do not put patient names
                  or other patient PHI in Notes.
                </Typography>
                {phiContactsBlocked && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPhiContactsBlocked(false)}>
                    Save blocked: possible patient PHI was detected in department contact notes. Remove patient
                    identifiers and try again. Staff names in the Contact Name column are allowed.
                  </Alert>
                )}
                <TableContainer
                  sx={{
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    overflowX: 'auto',
                  }}
                >
                  <Table size="small" aria-label="Hospital department contacts">
                    <TableHead>
                      <TableRow
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          '& th': {
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            letterSpacing: 0.02,
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            borderBottomColor: 'divider',
                            whiteSpace: 'nowrap',
                            py: 1.25,
                          },
                        }}
                      >
                        {(
                          [
                            ['department', 'Department'],
                            ['contactName', 'Contact name'],
                            ['phone', 'Phone'],
                            ['email', 'Email'],
                            ['notes', 'Notes'],
                          ] as const
                        ).map(([key, label]) => (
                          <TableCell key={key} sortDirection={sortConfig?.key === key ? sortConfig.direction : false}>
                            <TableSortLabel
                              active={sortConfig?.key === key}
                              direction={sortConfig?.key === key ? sortConfig.direction : 'asc'}
                              onClick={() => handleSort(key)}
                            >
                              {label}
                            </TableSortLabel>
                          </TableCell>
                        ))}
                        {isEditMode && (
                          <TableCell align="center" sx={{ width: 72 }}>
                            Actions
                          </TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getSortedContacts().map((contact) => (
                        <TableRow
                          key={contact.id}
                          hover
                          sx={{
                            '& td': { borderBottomColor: 'divider', verticalAlign: 'middle', py: 0.75 },
                          }}
                        >
                          <TableCell
                            sx={{
                              fontWeight: 600,
                              bgcolor: alpha(theme.palette.grey[500], 0.04),
                              minWidth: 180,
                            }}
                          >
                            {isEditMode ? (
                              <TextField
                                fullWidth
                                size="small"
                                placeholder="Department name"
                                variant="standard"
                                value={contact.department}
                                onChange={(e) => handleContactUpdate(contact.id, 'department', e.target.value)}
                                InputProps={{ disableUnderline: false }}
                              />
                            ) : (
                              contact.department
                            )}
                          </TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Name"
                              variant="standard"
                              value={contact.contactName}
                              onChange={(e) => handleContactUpdate(contact.id, 'contactName', e.target.value)}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 120 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Phone"
                              variant="standard"
                              value={contact.phone}
                              onChange={(e) => handleContactUpdate(contact.id, 'phone', e.target.value)}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Email"
                              variant="standard"
                              value={contact.email}
                              onChange={(e) => handleContactUpdate(contact.id, 'email', e.target.value)}
                            />
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="Notes"
                              variant="standard"
                              value={contact.notes}
                              onChange={(e) => handleContactUpdate(contact.id, 'notes', e.target.value)}
                            />
                          </TableCell>
                          {isEditMode && (
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteContact(contact)}
                                aria-label={`Delete ${contact.department}`}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Box>

          <DashboardResources userId={effectiveUserId} isMobile={isMobile} />
        </Stack>

        {/* Readiness Score Dialog */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Dialog open={readinessScoreDialogOpen} onClose={() => setReadinessScoreDialogOpen(false)}>
            <DialogTitle>
              {editingReadinessScoreId ? 'Edit Pediatric Readiness Score' : 'Add Pediatric Readiness Score'}
            </DialogTitle>
            <DialogContent>
              <DatePicker
                label="Assessment Date"
                value={readinessScoreForm.date}
                onChange={(newValue) => newValue && setReadinessScoreForm((prev) => ({ ...prev, date: newValue }))}
                slotProps={{ textField: { fullWidth: true, sx: { mt: 2 } } }}
              />
              <TextField
                label="Readiness Score"
                type="number"
                value={readinessScoreForm.score}
                onChange={(e) => setReadinessScoreForm((prev) => ({ ...prev, score: e.target.value }))}
                fullWidth
                sx={{ mt: 2 }}
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                helperText="Enter the score from your National Pediatric Readiness Project assessment"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setReadinessScoreDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSaveReadinessScore}
                variant="contained"
                disabled={!readinessScoreForm.score || isNaN(parseFloat(readinessScoreForm.score))}
              >
                {editingReadinessScoreId ? 'Update' : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>
        </LocalizationProvider>

        <Dialog
          open={readinessDeleteConfirm.open}
          onClose={() => setReadinessDeleteConfirm({ open: false, scoreId: null })}
          aria-labelledby="readiness-delete-dialog-title"
        >
          <DialogTitle id="readiness-delete-dialog-title">Delete readiness score?</DialogTitle>
          <DialogContent>
            <Typography>This will permanently remove the selected Pediatric Readiness Score entry.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReadinessDeleteConfirm({ open: false, scoreId: null })}>Cancel</Button>
            <Button color="error" variant="contained" onClick={confirmDeleteReadinessScore}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={deleteConfirmDialog.open}
          onClose={cancelDeleteContact}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography id="delete-dialog-description">
              Are you sure you want to delete the contact for {deleteConfirmDialog.contactName}? This action cannot be
              undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelDeleteContact} color="primary">
              Cancel
            </Button>
            <Button onClick={confirmDeleteContact} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default DashboardPage;
