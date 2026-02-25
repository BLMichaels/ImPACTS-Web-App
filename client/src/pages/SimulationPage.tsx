import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Container,
  IconButton,
  CircularProgress,
  useMediaQuery,
  useTheme,
  Fab,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  School as SchoolIcon,
  Build as BuildIcon,
  People as PeopleIcon,
  Policy as PolicyIcon,
  Chat as ChatIcon,
  Folder as FolderIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import ScormPackagesSection from '../components/ScormPackagesSection';
import { supabase } from '../supabase';
import { getUserData, setUserData, migrateFromLocalStorage } from '../utils/userData';

interface SimulationCase {
  id: string;
  name: string;
  description: string;
  category: 'medical' | 'trauma' | 'neonatal' | 'psychiatric' | 'other';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
  learningObjectives: string[];
  equipment: string[];
  teamRoles: string[];
}

interface SimulationGap {
  id: string;
  sessionId: string;
  caseName: string;
  category: 'equipment' | 'knowledge' | 'policy' | 'communication' | 'training' | 'resources' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionPlan: string;
  assignedTo: string;
  targetDate: string;
  status: 'identified' | 'in_progress' | 'completed' | 'cancelled';
  linkedActivities: string[];
  createdAt: string;
  updatedAt: string;
}

interface SimulationSession {
  id: string;
  caseId: string;
  caseName: string;
  date: string;
  participants: string[];
  duration: number;
  debriefNotes: string;
  overallRating: number;
  gaps: SimulationGap[];
  createdAt: string;
  updatedAt: string;
}

const SIMULATION_CASES: SimulationCase[] = [
  {
    id: 'dka',
    name: 'Diabetic Ketoacidosis (DKA)',
    description: '',
    category: 'medical',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Perform and evaluate the appropriate diagnostic tests to recognize diabetic ketoacidosis',
      'Initiate evidence-based therapies for diabetic ketoacidosis',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'bronchiolitis',
    name: 'Bronchiolitis',
    description: '',
    category: 'medical',
    difficulty: 'beginner',
    estimatedDuration: 0,
    learningObjectives: [
      'Demonstrate a systematic assessment of a critically ill pediatric patient in your Emergency Department',
      'Demonstrate the interventions required for an infant with respiratory distress',
      'Determine the appropriate disposition/ destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'asthma',
    name: 'Asthma',
    description: '',
    category: 'medical',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in a pediatric resuscitation (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a pediatric patient with status asthmaticus',
      'Determine the appropriate patient disposition/ transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'tbi',
    name: 'Severe Head Injury',
    description: '',
    category: 'trauma',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Verbalize the systematic evaluation of an acutely injured pediatric patient using principles of Advanced Trauma Life Support',
      'Properly assign score to describe the mental status of a pediatric trauma patient',
      'Demonstrate two interventions required for stabilization of a pediatric patient with severe head injury'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'nat',
    name: 'A Vomiting Baby',
    description: '',
    category: 'trauma',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for an infant with vomiting',
      'Identify non-accidental trauma and activate local protocol for reporting',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'tracheostomy',
    name: 'Pediatric Tracheostomy Emergency',
    description: '',
    category: 'medical',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Present tracheostomy malfunction as a source of respiratory distress',
      'Decide appropriate interventions for patient and clearly demonstrate treatment steps for tracheostomy emergency',
      'Evaluate effectiveness of interventions and determine next appropriate steps in care'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'newborn-resuscitation',
    name: 'Newborn Resuscitation',
    description: '',
    category: 'neonatal',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in the care of a newborn (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a newborn baby',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'pph',
    name: 'A Postpartum Complication',
    description: '',
    category: 'medical',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in the care of a patient, with attention to role designation, directed orders, shared mental model and closed loop communication',
      'Prioritize treatment of potential etiologies to stabilize the patient or escalate care',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'scald-burn',
    name: 'Scald Burn',
    description: '',
    category: 'trauma',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in a pediatric resuscitation (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a pediatric patient',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'agitation',
    name: 'Agitation',
    description: '',
    category: 'psychiatric',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Recognize signs and symptoms of agitation in a pediatric patient, as well as verbalize the level of agitation the patient is exhibiting',
      'Verbalize three verbal de-escalation techniques and/or environmental modifications for the management of pediatric agitation',
      'Reflect on possible unconscious biases and/or untested assumptions experienced by pediatric mental health patients in emergency care'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'seizing-infant',
    name: 'A Seizing Infant',
    description: '',
    category: 'neonatal',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in the care of a patient with a seizure (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a patient with a seizure',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'svt',
    name: 'Supraventricular Tachycardia',
    description: '',
    category: 'medical',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in the care of a patient with SVT (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to the guide stabilization or escalation of care for a patient with SVT',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'blunt-trauma',
    name: 'Blunt Abdominal Trauma',
    description: '',
    category: 'trauma',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in a pediatric trauma resuscitation (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a pediatric trauma patient',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'neonatal-sepsis',
    name: 'A Sick Neonate',
    description: '',
    category: 'neonatal',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a neonate in shock',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'seizing-child',
    name: 'A Seizing Child',
    description: '',
    category: 'medical',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in the care of a patient with a seizure (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a patient with a seizure',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'anaphylaxis',
    name: 'Pediatric Anaphylaxis',
    description: '',
    category: 'medical',
    difficulty: 'intermediate',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a patient with Anaphylaxis',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  },
  {
    id: 'altered-mental-status',
    name: 'Altered Mental Status',
    description: '',
    category: 'medical',
    difficulty: 'advanced',
    estimatedDuration: 0,
    learningObjectives: [
      'Apply Crisis Resource Management and teamwork in the care of a toddler with altered mental status (with attention to role designation, directed orders, sharing mental model and closed loop communication with team and family members)',
      'Prioritize treatment of potential etiologies to guide stabilization or escalation of care for a patient with altered mental status',
      'Determine the appropriate destination for transfer'
    ],
    equipment: [],
    teamRoles: []
  }
];

const GAP_CATEGORIES = [
  { value: 'equipment', label: 'Equipment', icon: <BuildIcon />, description: 'Missing or malfunctioning equipment' },
  { value: 'knowledge', label: 'Knowledge', icon: <SchoolIcon />, description: 'Knowledge gaps in team members' },
  { value: 'policy', label: 'Policy', icon: <PolicyIcon />, description: 'Missing or unclear policies' },
  { value: 'communication', label: 'Communication', icon: <ChatIcon />, description: 'Communication breakdowns' },
  { value: 'training', label: 'Training', icon: <SchoolIcon />, description: 'Insufficient training or competency' },
  { value: 'resources', label: 'Resources', icon: <FolderIcon />, description: 'Lack of necessary resources' },
  { value: 'other', label: 'Other', icon: <InfoIcon />, description: 'Additional gaps not covered above' }
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'success', description: 'Minor issue, easy to address' },
  { value: 'medium', label: 'Medium', color: 'warning', description: 'Moderate issue, requires attention' },
  { value: 'high', label: 'High', color: 'error', description: 'Serious issue, needs immediate action' },
  { value: 'critical', label: 'Critical', color: 'error', description: 'Critical issue, patient safety risk' }
];

const SimulationPage: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const { effectiveUserId } = useUserProfile();
  const { trackClick } = useUsageAnalytics();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [sessions, setSessions] = useState<SimulationSession[]>([]);
  const [gaps, setGaps] = useState<SimulationGap[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<SimulationCase | null>(null);
  const [showGapDialog, setShowGapDialog] = useState(false);
  const [editingGap, setEditingGap] = useState<SimulationGap | null>(null);
  const [currentSession, setCurrentSession] = useState<SimulationSession | null>(null);
  const [showCaseGapDialog, setShowCaseGapDialog] = useState(false);
  const [otherCases, setOtherCases] = useState<string[]>([]);

  // Sorting and filtering state for gaps
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'status' | 'case'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('not_completed');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCase, setFilterCase] = useState<string>('all');

  const [sessionForm, setSessionForm] = useState({
    caseId: '',
    date: '',
    participants: '',
    duration: '',
    debriefNotes: '',
    overallRating: 3
  });

  const [peccSimulations, setPeccSimulations] = useState<Array<{
    id: string;
    name: string | null;
    url: string | null;
    learning_objectives: string | null;
    additional_resources: { name: string; url: string }[];
  }>>([]);

  const [caseGapForm, setCaseGapForm] = useState({
    caseName: '',
    otherCaseName: '',
    category: 'equipment' as 'equipment' | 'knowledge' | 'policy' | 'communication' | 'training' | 'resources' | 'other',
    description: '',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    actionPlan: '',
    assignedTo: '',
    targetDate: '',
    status: 'identified' as 'identified' | 'in_progress' | 'completed' | 'cancelled'
  });

  const [gapForm, setGapForm] = useState({
    category: '',
    description: '',
    severity: 'medium',
    actionPlan: '',
    assignedTo: '',
    targetDate: '',
    status: 'identified'
  });

  const userId = effectiveUserId;
  // Activities list for linked-activities display and for updating activity–gap links (from user_data)
  const [activitiesSim, setActivitiesSim] = useState<any[]>([]);

  // Load sessions, gaps, other_cases, activities from Supabase (with migration from localStorage)
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const [sessionsVal, gapsVal, otherVal, activitiesVal] = await Promise.all([
        getUserData<SimulationSession[]>(userId, 'simulation_sessions'),
        getUserData<SimulationGap[]>(userId, 'simulation_gaps'),
        getUserData<string[]>(userId, 'other_cases'),
        getUserData<any[]>(userId, 'activities')
      ]);
      if (!mounted) return;
      if (sessionsVal != null && Array.isArray(sessionsVal)) setSessions(sessionsVal);
      else migrateFromLocalStorage(userId, 'simulation_sessions', `simulation_sessions_${userId}`, (v) => setSessions(Array.isArray(v) ? v : []));
      if (gapsVal != null && Array.isArray(gapsVal)) setGaps(gapsVal);
      else migrateFromLocalStorage(userId, 'simulation_gaps', `simulation_gaps_${userId}`, (v) => setGaps(Array.isArray(v) ? v : []));
      if (otherVal != null && Array.isArray(otherVal)) setOtherCases(otherVal);
      else migrateFromLocalStorage(userId, 'other_cases', `other_cases_${userId}`, (v) => setOtherCases(Array.isArray(v) ? v : []));
      if (activitiesVal != null && Array.isArray(activitiesVal)) setActivitiesSim(activitiesVal);
      else migrateFromLocalStorage(userId, 'activities', `activities_${userId}`, (v) => setActivitiesSim(Array.isArray(v) ? v : []));
    })();
    return () => { mounted = false; };
  }, [userId]);

  // Persist to Supabase when state changes
  useEffect(() => {
    if (!userId) return;
    setUserData(userId, 'simulation_sessions', sessions);
  }, [userId, sessions]);

  useEffect(() => {
    if (!userId) return;
    setUserData(userId, 'simulation_gaps', gaps);
  }, [userId, gaps]);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('pecc_simulations').select('id, name, url, learning_objectives, additional_resources').order('display_order', { ascending: true });
      if (error) {
        console.error('pecc_simulations', error);
        return;
      }
      setPeccSimulations((data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: r.name != null ? String(r.name) : null,
        url: r.url != null ? String(r.url) : null,
        learning_objectives: r.learning_objectives != null ? String(r.learning_objectives) : null,
        additional_resources: Array.isArray(r.additional_resources)
          ? (r.additional_resources as { name?: string; url?: string }[]).map(x => ({ name: x?.name ?? '', url: x?.url ?? '' }))
          : []
      })));
    };
    load();
  }, []);

  const handleStartSimulation = (caseId: string) => {
    trackClick?.('Simulation - Start');
    const selectedCase = SIMULATION_CASES.find(c => c.id === caseId);
    setSelectedCase(selectedCase || null);
    setSessionForm({
      caseId: caseId,
      date: new Date().toISOString().split('T')[0],
      participants: '',
      duration: selectedCase?.estimatedDuration.toString() || '',
      debriefNotes: '',
      overallRating: 3
    });
    setActiveStep(0);
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setSelectedCase(null);
    setCurrentSession(null);
    setActiveStep(0);
    setSessionForm({
      caseId: '',
      date: '',
      participants: '',
      duration: '',
      debriefNotes: '',
      overallRating: 3
    });
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Create session
      const caseData = SIMULATION_CASES.find(c => c.id === sessionForm.caseId);
      if (!caseData) return;

      const newSession: SimulationSession = {
        id: Date.now().toString(),
        caseId: sessionForm.caseId,
        caseName: caseData.name,
        date: sessionForm.date,
        participants: sessionForm.participants.split(',').map(p => p.trim()).filter(p => p),
        duration: parseInt(sessionForm.duration),
        debriefNotes: sessionForm.debriefNotes,
        overallRating: sessionForm.overallRating,
        gaps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setCurrentSession(newSession);
      setSessions([newSession, ...sessions]);
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFinish = () => {
    trackClick?.('Simulation - Finish');
    handleCloseDialog();
  };

  const handleOpenGapDialog = (gap?: SimulationGap) => {
    setEditingGap(gap || null);
    setGapForm({
      category: gap?.category || '',
      description: gap?.description || '',
      severity: gap?.severity || 'medium',
      actionPlan: gap?.actionPlan || '',
      assignedTo: gap?.assignedTo || '',
      targetDate: gap?.targetDate || '',
      status: gap?.status || 'identified'
    });
    setShowGapDialog(true);
  };

  const handleCloseGapDialog = () => {
    setShowGapDialog(false);
    setEditingGap(null);
    setGapForm({
      category: '',
      description: '',
      severity: 'medium',
      actionPlan: '',
      assignedTo: '',
      targetDate: '',
      status: 'identified'
    });
  };

  const handleOpenCaseGapDialog = () => {
    setShowCaseGapDialog(true);
    setCaseGapForm({
      caseName: '',
      otherCaseName: '',
      category: 'equipment' as 'equipment' | 'knowledge' | 'policy' | 'communication' | 'training' | 'resources' | 'other',
      description: '',
      severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
      actionPlan: '',
      assignedTo: '',
      targetDate: '',
      status: 'identified' as 'identified' | 'in_progress' | 'completed' | 'cancelled'
    });
  };

  const handleCloseCaseGapDialog = () => {
    setShowCaseGapDialog(false);
    setCaseGapForm({
      caseName: '',
      otherCaseName: '',
      category: 'equipment' as 'equipment' | 'knowledge' | 'policy' | 'communication' | 'training' | 'resources' | 'other',
      description: '',
      severity: 'medium' as 'low' | 'medium' | 'high' | 'critical',
      actionPlan: '',
      assignedTo: '',
      targetDate: '',
      status: 'identified' as 'identified' | 'in_progress' | 'completed' | 'cancelled'
    });
  };

  const handleCaseGapChange = (field: string, value: string) => {
    setCaseGapForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitCaseGap = () => {
    if (!caseGapForm.category || !caseGapForm.description) {
      alert('Please fill in category and description');
      return;
    }

    const caseName = caseGapForm.caseName === 'other' ? caseGapForm.otherCaseName : caseGapForm.caseName;
    
    if (!caseName) {
      alert('Please select a case or enter an other case name');
      return;
    }

    // Add to other cases if it's an "other" case
    if (caseGapForm.caseName === 'other' && caseGapForm.otherCaseName && !otherCases.includes(caseGapForm.otherCaseName)) {
      const updatedOtherCases = [...otherCases, caseGapForm.otherCaseName];
      setOtherCases(updatedOtherCases);
      if (userId) setUserData(userId, 'other_cases', updatedOtherCases);
    }

    const newGap: SimulationGap = {
      id: Date.now().toString(),
      sessionId: 'standalone',
      caseName: caseName,
      category: caseGapForm.category,
      description: caseGapForm.description,
      severity: caseGapForm.severity,
      actionPlan: caseGapForm.actionPlan,
      assignedTo: caseGapForm.assignedTo,
      targetDate: caseGapForm.targetDate,
      status: caseGapForm.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      linkedActivities: []
    };

    const updatedGaps = [...gaps, newGap];
    setGaps(updatedGaps);

    console.log('✅ Case-related gap created successfully');
    handleCloseCaseGapDialog();
  };

  const handleSubmitGap = () => {
    console.log('Submitting gap:', gapForm);
    console.log('Current session:', currentSession);
    
    // Validate required fields
    if (!gapForm.category || !gapForm.description) {
      alert('Please fill in the category and description fields.');
      return;
    }

    // If we're in the middle of a simulation session, use currentSession
    // Otherwise, create a standalone gap
    const sessionId = currentSession?.id || 'standalone';
    const caseName = currentSession?.caseName || 'General Simulation';

    const newGap: SimulationGap = {
      id: editingGap?.id || Date.now().toString(),
      sessionId: sessionId,
      caseName: caseName,
      category: gapForm.category as any,
      description: gapForm.description,
      severity: gapForm.severity as any,
      actionPlan: gapForm.actionPlan,
      assignedTo: gapForm.assignedTo,
      targetDate: gapForm.targetDate,
      status: gapForm.status as any,
      linkedActivities: editingGap?.linkedActivities || [],
      createdAt: editingGap?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('New gap created:', newGap);

    if (editingGap) {
      // Update existing gap
      setGaps(gaps.map(g => g.id === editingGap.id ? newGap : g));
      
      // Update session gaps if we have a current session
      if (currentSession) {
        setSessions(sessions.map(s => 
          s.id === currentSession.id 
            ? { ...s, gaps: s.gaps.map(g => g.id === editingGap.id ? newGap : g) }
            : s
        ));
      }
    } else {
      // Add new gap
      setGaps([newGap, ...gaps]);
      
      // Update session gaps if we have a current session
      if (currentSession) {
        setSessions(sessions.map(s => 
          s.id === currentSession.id 
            ? { ...s, gaps: [...s.gaps, newGap] }
            : s
        ));
      }
    }

    // Update bidirectional linking with activities
    try {
      if (userId) {
        const activities = [...activitiesSim];
        let activitiesUpdated = false;
        activities.forEach((activity: any) => {
          if (activity.associatedSimulationGaps) {
            const originalLength = activity.associatedSimulationGaps.length;
            activity.associatedSimulationGaps = activity.associatedSimulationGaps.filter((gapId: string) => {
              const gap = gaps.find(g => g.id === gapId);
              return gap && gap.id !== newGap.id;
            });
            if (activity.associatedSimulationGaps.length !== originalLength) activitiesUpdated = true;
          }
        });
        if (activitiesUpdated) {
          setActivitiesSim(activities);
          setUserData(userId, 'activities', activities);
          console.log('✅ Updated activities with bidirectional gap links');
        }
      }
    } catch (linkError) {
      console.error('❌ Failed to update activity links:', linkError);
    }

    console.log('Gap saved successfully');
    handleCloseGapDialog();
  };

  const getSeverityColor = (severity: string) => {
    const level = SEVERITY_LEVELS.find(s => s.value === severity);
    return level?.color || 'default';
  };

  const getCategoryIcon = (category: string) => {
    const cat = GAP_CATEGORIES.find(c => c.value === category);
    return cat?.icon || <InfoIcon />;
  };

  // Sorting and filtering functions
  const getFilteredAndSortedGaps = () => {
    let filteredGaps = [...gaps];

    // Apply filters
    if (filterStatus === 'not_completed') {
      filteredGaps = filteredGaps.filter(gap => gap.status !== 'completed');
    } else if (filterStatus !== 'all') {
      filteredGaps = filteredGaps.filter(gap => gap.status === filterStatus);
    }
    if (filterSeverity !== 'all') {
      filteredGaps = filteredGaps.filter(gap => gap.severity === filterSeverity);
    }
    if (filterCase !== 'all') {
      filteredGaps = filteredGaps.filter(gap => gap.caseName === filterCase);
    }

    // Apply sorting
    filteredGaps.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
          break;
        case 'status':
          const statusOrder = { identified: 1, in_progress: 2, completed: 3, cancelled: 4 };
          comparison = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
          break;
        case 'case':
          comparison = a.caseName.localeCompare(b.caseName);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filteredGaps;
  };

  const clearFilters = () => {
    setFilterStatus('not_completed');
    setFilterSeverity('all');
    setFilterCase('all');
  };

  // Delete gap function
  const handleDeleteGap = () => {
    if (!editingGap) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this gap?\n\n"${editingGap.description}"\n\nThis action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
      // Remove gap from gaps array
      const updatedGaps = gaps.filter(gap => gap.id !== editingGap.id);
      setGaps(updatedGaps);

      // Remove gap from sessions if it exists
      const updatedSessions = sessions.map(session => ({
        ...session,
        gaps: session.gaps.filter(gap => gap.id !== editingGap.id)
      }));
      setSessions(updatedSessions);

      // Remove gap from activities that reference it
      try {
        if (userId) {
          const activities = [...activitiesSim];
          let activitiesUpdated = false;
          activities.forEach((activity: any) => {
            if (activity.associatedSimulationGaps) {
              const originalLength = activity.associatedSimulationGaps.length;
              activity.associatedSimulationGaps = activity.associatedSimulationGaps.filter(
                (gapId: string) => gapId !== editingGap.id
              );
              if (activity.associatedSimulationGaps.length !== originalLength) activitiesUpdated = true;
            }
          });
          if (activitiesUpdated) {
            setActivitiesSim(activities);
            setUserData(userId, 'activities', activities);
            console.log('✅ Removed gap references from activities');
          }
        }
      } catch (linkError) {
        console.error('❌ Failed to update activity links:', linkError);
      }

      console.log('✅ Gap deleted successfully');
      handleCloseGapDialog();
    } catch (error) {
      console.error('❌ Failed to delete gap:', error);
      alert('Failed to delete gap. Please try again.');
    }
  };

  // Export functions
  const handleExportToExcel = () => {
    const filteredGaps = getFilteredAndSortedGaps();
    
    // Prepare data for Excel export
    const excelData = filteredGaps.map(gap => ({
      'Description': gap.description,
      'Case': gap.caseName,
      'Category': gap.category,
      'Severity': gap.severity,
      'Status': gap.status,
      'Assigned To': gap.assignedTo || '',
      'Target Date': gap.targetDate ? new Date(gap.targetDate).toLocaleDateString() : '',
      'Action Plan': gap.actionPlan || '',
      'Created Date': new Date(gap.createdAt).toLocaleDateString()
    }));

    // Create Excel file
    const XLSX = require('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Simulation Gaps');
    
    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `simulation-gaps-${currentDate}.xlsx`;
    
    // Save file
    XLSX.writeFile(workbook, filename);
  };

  const handleExportToPDF = () => {
    const filteredGaps = getFilteredAndSortedGaps();
    
    // Import jsPDF dynamically
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Simulation Gaps Report', 20, 20);
      
      // Add date
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30);
      doc.text(`Total Gaps: ${filteredGaps.length}`, 20, 35);
      
      // Add summary statistics
      const statusCounts = filteredGaps.reduce((acc, gap) => {
        acc[gap.status] = (acc[gap.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const severityCounts = filteredGaps.reduce((acc, gap) => {
        acc[gap.severity] = (acc[gap.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      let yPosition = 50;
      doc.setFontSize(14);
      doc.text('Summary Statistics', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.text('Status Distribution:', 20, yPosition);
      yPosition += 5;
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`  ${status}: ${count}`, 25, yPosition);
        yPosition += 5;
      });
      
      yPosition += 5;
      doc.text('Severity Distribution:', 20, yPosition);
      yPosition += 5;
      Object.entries(severityCounts).forEach(([severity, count]) => {
        doc.text(`  ${severity}: ${count}`, 25, yPosition);
        yPosition += 5;
      });
      
      // Add gaps table
      yPosition += 15;
      doc.setFontSize(14);
      doc.text('Gap Details', 20, yPosition);
      yPosition += 10;
      
      // Table headers
      doc.setFontSize(8);
      const headers = ['Description', 'Case', 'Category', 'Severity', 'Status', 'Assigned To', 'Target Date'];
      const colWidths = [60, 30, 25, 20, 20, 25, 25];
      let xPosition = 20;
      
      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      
      yPosition += 5;
      
      // Add gap rows
      filteredGaps.forEach((gap, index) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        xPosition = 20;
        const rowData = [
          gap.description.length > 30 ? gap.description.substring(0, 30) + '...' : gap.description,
          gap.caseName.length > 15 ? gap.caseName.substring(0, 15) + '...' : gap.caseName,
          gap.category,
          gap.severity,
          gap.status,
          gap.assignedTo || '-',
          gap.targetDate ? new Date(gap.targetDate).toLocaleDateString() : '-'
        ];
        
        rowData.forEach((data, colIndex) => {
          doc.text(data, xPosition, yPosition);
          xPosition += colWidths[colIndex];
        });
        
        yPosition += 5;
        
        // Add action plan if exists
        if (gap.actionPlan) {
          doc.text(`Action: ${gap.actionPlan.length > 50 ? gap.actionPlan.substring(0, 50) + '...' : gap.actionPlan}`, 20, yPosition);
          yPosition += 5;
        }
        
        yPosition += 3;
      });
      
      // Save PDF
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `simulation-gaps-${currentDate}.pdf`;
      doc.save(filename);
    });
  };

  const getSteps = () => {
    return ['Simulation Setup', 'Debriefing', 'Gap Identification', 'Action Planning'];
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!currentUser) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6" color="text.secondary">
            Please log in to view simulation cases.
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, mt: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant={isMobile ? "h4" : "h3"} component="h1" gutterBottom color="primary">
            Simulation Debriefing & Gap Analysis
          </Typography>
          <Typography variant="h6" gutterBottom sx={{ mb: 2, color: 'text.secondary' }}>
            SimBox Pediatric Cases
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Practice pediatric emergency scenarios and systematically identify gaps in your team's readiness. 
            Use the structured debriefing process to track improvements and link to your activities.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
            <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in sessions, debrief notes, or gap descriptions.
          </Alert>
        </Box>

        <ScormPackagesSection title="SCORM simulation modules" placement="simulation" />

        {/* Statistics Cards */}
        <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PlayIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" color="primary">
                      {sessions.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sessions Completed
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <WarningIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" color="warning.main">
                      {gaps.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Gaps Identified
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" color="success.main">
                      {gaps.filter(g => g.status === 'completed').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Gaps Resolved
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AssessmentIcon sx={{ fontSize: 40, color: 'info.main', mr: 2 }} />
                  <Box>
                    <Typography variant="h4" color="info.main">
                      {Math.round((gaps.filter(g => g.status === 'completed').length / Math.max(gaps.length, 1)) * 100)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completion Rate
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => {
              const gapsSection = document.getElementById('all-identified-gaps');
              if (gapsSection) {
                gapsSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            sx={{ minWidth: 200 }}
          >
            View All Identified Gaps
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<PlayIcon />}
            onClick={() => handleOpenCaseGapDialog()}
            sx={{ minWidth: 200 }}
          >
            Add Case-Related Gap
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenGapDialog()}
            sx={{ minWidth: 200 }}
          >
            Add Standalone Gap
          </Button>
        </Box>

        {/* All Identified Gaps - above simulations for PECC */}
        <Box sx={{ mt: 4 }} id="all-identified-gaps">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              All Identified Gaps
            </Typography>
          </Box>

          {/* Filters and Sorting */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      label="Sort By"
                    >
                      <MenuItem value="date">Date Created</MenuItem>
                      <MenuItem value="severity">Severity</MenuItem>
                      <MenuItem value="status">Status</MenuItem>
                      <MenuItem value="case">Case</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Order</InputLabel>
                    <Select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      label="Order"
                    >
                      <MenuItem value="desc">Descending</MenuItem>
                      <MenuItem value="asc">Ascending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="not_completed">Not Completed</MenuItem>
                      <MenuItem value="all">All Status</MenuItem>
                      <MenuItem value="identified">Identified</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      label="Severity"
                    >
                      <MenuItem value="all">All Severity</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Case</InputLabel>
                    <Select
                      value={filterCase}
                      onChange={(e) => setFilterCase(e.target.value)}
                      label="Case"
                    >
                      <MenuItem value="all">All Cases</MenuItem>
                      {[...new Set([...peccSimulations.map(s => s.name).filter(Boolean) as string[], ...gaps.map(g => g.caseName), ...otherCases])].filter(Boolean).sort().map((caseName) => (
                        <MenuItem key={caseName} value={caseName}>
                          {caseName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    variant="outlined"
                    onClick={clearFilters}
                    fullWidth
                    size="small"
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Export and Add Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportToExcel}
              disabled={getFilteredAndSortedGaps().length === 0}
              sx={{ 
                minWidth: 150,
                color: 'success.main',
                borderColor: 'success.main',
                '&:hover': {
                  borderColor: 'success.dark',
                  backgroundColor: 'success.light'
                }
              }}
            >
              Export Excel
            </Button>
            <Button
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={handleExportToPDF}
              disabled={getFilteredAndSortedGaps().length === 0}
              sx={{ 
                minWidth: 150,
                color: 'error.main',
                borderColor: 'error.main',
                '&:hover': {
                  borderColor: 'error.dark',
                  backgroundColor: 'error.light'
                }
              }}
            >
              Export PDF
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenGapDialog()}
              sx={{ minWidth: 200 }}
            >
              Add Standalone Gap
            </Button>
          </Box>
          
          {/* Gaps Table */}
          {getFilteredAndSortedGaps().length > 0 ? (
            <Card>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#1976d2', borderBottom: '1px solid #e0e0e0' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '300px', width: '35%', color: 'white' }}>
                          Description
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '200px', width: '25%', color: 'white' }}>
                          Action Plan
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '120px', color: 'white' }}>
                          Case
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '100px', color: 'white' }}>
                          Category
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '80px', color: 'white' }}>
                          Severity
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '100px', color: 'white' }}>
                          Status
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '120px', color: 'white' }}>
                          Assigned To
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '100px', color: 'white' }}>
                          Target Date
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '14px', minWidth: '150px', color: 'white' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredAndSortedGaps().map((gap, index) => (
                        <tr 
                          key={gap.id}
                          style={{ 
                            borderBottom: '1px solid #e0e0e0',
                            backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafafa'
                          }}
                        >
                          <td style={{ padding: '12px 16px', verticalAlign: 'top', width: '35%' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5, lineHeight: 1.4 }}>
                              {gap.description}
                            </Typography>
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top', width: '25%' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                              {gap.actionPlan || '-'}
                            </Typography>
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Chip
                              label={gap.caseName}
                              size="small"
                              variant="outlined"
                            />
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Chip
                              label={gap.category}
                              size="small"
                              icon={getCategoryIcon(gap.category)}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Chip
                              label={gap.severity}
                              size="small"
                              color={getSeverityColor(gap.severity) as any}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Chip
                              label={gap.status}
                              size="small"
                              color={gap.status === 'completed' ? 'success' : gap.status === 'in_progress' ? 'warning' : 'default'}
                            />
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Typography variant="body2" color="text.secondary">
                              {gap.assignedTo || '-'}
                            </Typography>
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <Typography variant="body2" color="text.secondary">
                              {gap.targetDate ? new Date(gap.targetDate).toLocaleDateString() : '-'}
                            </Typography>
                          </td>
                          <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Button
                                size="small"
                                onClick={() => handleOpenGapDialog(gap)}
                                sx={{ minWidth: 'auto', px: 1 }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                  window.location.href = '/activities?simulationGap=' + gap.id;
                                }}
                                sx={{ minWidth: 'auto', px: 1 }}
                              >
                                Link
                              </Button>
                            </Box>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No gaps found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {gaps.length === 0 
                    ? 'Start a simulation session or add a standalone gap to begin tracking improvements.'
                    : 'Try adjusting your filters to see more results.'
                  }
                </Typography>
                {gaps.length === 0 && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenGapDialog()}
                  >
                    Add Your First Gap
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Simulations (admin-managed list) */}
        <Typography variant="h5" gutterBottom sx={{ mb: 3, mt: 4 }}>
          Simulations
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
          {peccSimulations.map((sim) => {
            const caseGaps = gaps.filter(gap => gap.caseName === (sim.name ?? ''));
            const completedGaps = caseGaps.filter(gap => gap.status === 'completed');
            const objectives = (sim.learning_objectives ?? '').trim().split(/\r?\n/).filter(Boolean);
            const resources = (sim.additional_resources || []).filter(r => (r.name && r.name.trim()) || (r.url && r.url.trim()));
            return (
              <Card key={sim.id} sx={{ width: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {sim.url ? (
                        <Typography
                          variant="h6"
                          component="a"
                          href={sim.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ color: 'primary.main', textDecoration: 'underline', '&:hover': { color: 'primary.dark' }, mb: 0 }}
                        >
                          {sim.name || 'Simulation'}
                        </Typography>
                      ) : (
                        <Typography variant="h6" component="h3" sx={{ mb: 0 }}>
                          {sim.name || 'Simulation'}
                        </Typography>
                      )}
                      {caseGaps.length > 0 && (
                        <Chip
                          label={`${completedGaps.length}/${caseGaps.length} resolved`}
                          size="small"
                          color={completedGaps.length === caseGaps.length ? 'success' : 'warning'}
                        />
                      )}
                    </Box>
                    <Button
                      variant="contained"
                      onClick={() => {
                        setCaseGapForm(prev => ({ ...prev, caseName: sim.name ?? '', otherCaseName: '' }));
                        handleOpenCaseGapDialog();
                      }}
                      sx={{ minWidth: 200 }}
                    >
                      Identified Gaps & Action Plans
                    </Button>
                  </Box>
                  {objectives.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                        Learning Objectives:
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {objectives.map((obj, idx) => (
                          <Typography key={idx} component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5, lineHeight: 1.4 }}>
                            {obj}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {resources.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                        Additional Resources:
                      </Typography>
                      <Box component="ul" sx={{ pl: 2, m: 0 }}>
                        {resources.map((r, idx) => (
                          <li key={idx}>
                            <Typography component="a" href={r.url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ color: 'primary.main', textDecoration: 'underline' }}>
                              {r.name?.trim() || r.url}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {caseGaps.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                        Identified Gaps ({caseGaps.length}):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {caseGaps.map((gap) => (
                          <Chip
                            key={gap.id}
                            label={gap.description}
                            size="small"
                            color={getSeverityColor(gap.severity) as any}
                            icon={getCategoryIcon(gap.category)}
                            onClick={() => handleOpenGapDialog(gap)}
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>

        {/* Other Cases */}
        {otherCases.length > 0 && (
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3, mt: 4 }}>
              Other Cases
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
              {otherCases.map((caseName) => {
                const caseGaps = gaps.filter(gap => gap.caseName === caseName);
                return (
                  <Card key={caseName} sx={{ width: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', mb: 0 }}>
                          {caseName}
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setCaseGapForm(prev => ({ ...prev, caseName: 'other', otherCaseName: caseName }));
                            handleOpenCaseGapDialog();
                          }}
                          sx={{ minWidth: 200 }}
                        >
                          Identified Gaps & Action Plans
                        </Button>
                      </Box>
                      
                      {caseGaps.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {caseGaps.length} gap{caseGaps.length !== 1 ? 's' : ''} identified
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {caseGaps.slice(0, 3).map((gap) => (
                              <Chip
                                key={gap.id}
                                label={gap.description.length > 50 ? `${gap.description.substring(0, 50)}...` : gap.description}
                                size="small"
                                color={gap.status === 'completed' ? 'success' : gap.severity === 'high' ? 'error' : gap.severity === 'medium' ? 'warning' : 'default'}
                                variant={gap.status === 'completed' ? 'filled' : 'outlined'}
                              />
                            ))}
                            {caseGaps.length > 3 && (
                              <Chip
                                label={`+${caseGaps.length - 3} more`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </>
        )}

        {/* Simulation Dialog with Stepper */}
        <Dialog open={open} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {selectedCase?.name} - Simulation Debriefing
          </DialogTitle>
          <DialogContent>
            <Stepper activeStep={activeStep} orientation="vertical">
              {/* Step 1: Simulation Setup */}
              <Step>
                <StepLabel>Simulation Setup</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {selectedCase?.description}
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Date"
                        type="date"
                        value={sessionForm.date}
                        onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Duration (minutes)"
                        type="number"
                        value={sessionForm.duration}
                        onChange={(e) => setSessionForm({ ...sessionForm, duration: e.target.value })}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Participants (comma-separated)"
                        value={sessionForm.participants}
                        onChange={(e) => setSessionForm({ ...sessionForm, participants: e.target.value })}
                        placeholder="Dr. Smith, Nurse Johnson, Respiratory Therapist Brown"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Overall Rating (1-5)"
                        type="number"
                        inputProps={{ min: 1, max: 5 }}
                        value={sessionForm.overallRating}
                        onChange={(e) => setSessionForm({ ...sessionForm, overallRating: parseInt(e.target.value) })}
                      />
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Continue to Debriefing
                    </Button>
                    <Button
                      onClick={handleCloseDialog}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 2: Debriefing */}
              <Step>
                <StepLabel>Debriefing</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Reflect on the simulation. What went well? What could be improved?
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Debrief Notes"
                    multiline
                    rows={6}
                    value={sessionForm.debriefNotes}
                    onChange={(e) => setSessionForm({ ...sessionForm, debriefNotes: e.target.value })}
                    placeholder="What went well? What could be improved? Key learning points..."
                  />
                  
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Continue to Gap Identification
                    </Button>
                    <Button
                      onClick={handleBack}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 3: Gap Identification */}
              <Step>
                <StepLabel>Gap Identification</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Identify specific gaps in your team's capabilities. Click "Add Gap" for each issue identified.
                  </Typography>
                  
                  {currentSession && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Identified Gaps ({currentSession.gaps.length}):
                      </Typography>
                      {currentSession.gaps.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                          {currentSession.gaps.map((gap) => (
                            <Chip
                              key={gap.id}
                              label={gap.description}
                              size="small"
                              color={getSeverityColor(gap.severity) as any}
                              icon={getCategoryIcon(gap.category)}
                              onDelete={() => {
                                setGaps(gaps.filter(g => g.id !== gap.id));
                                setSessions(sessions.map(s => 
                                  s.id === currentSession.id 
                                    ? { ...s, gaps: s.gaps.filter(g => g.id !== gap.id) }
                                    : s
                                ));
                              }}
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          No gaps identified yet
                        </Typography>
                      )}
                      
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenGapDialog()}
                        sx={{ mb: 2 }}
                      >
                        Add Gap
                      </Button>
                    </Box>
                  )}
                  
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Continue to Action Planning
                    </Button>
                    <Button
                      onClick={handleBack}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>

              {/* Step 4: Action Planning */}
              <Step>
                <StepLabel>Action Planning</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Review identified gaps and create action plans. Link to activities for tracking progress.
                  </Typography>
                  
                  {currentSession && currentSession.gaps.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Action Plans:
                      </Typography>
                      {currentSession.gaps.map((gap) => (
                        <Card key={gap.id} sx={{ mb: 2 }}>
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {gap.description}
                              </Typography>
                              <Chip
                                label={gap.severity}
                                size="small"
                                color={getSeverityColor(gap.severity) as any}
                              />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                              {gap.category} • Assigned to: {gap.assignedTo || 'Not assigned'}
                            </Typography>
                            {gap.actionPlan && (
                              <Typography variant="body2" color="text.secondary">
                                Action Plan: {gap.actionPlan}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </Box>
                  )}
                  
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <Button
                      variant="contained"
                      onClick={handleFinish}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Complete Session
                    </Button>
                    <Button
                      onClick={handleBack}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      Back
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </DialogContent>
        </Dialog>

        {/* Gap Dialog */}
        <Dialog open={showGapDialog} onClose={handleCloseGapDialog} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingGap ? 'Edit Gap' : 'Identify Gap'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={gapForm.category}
                    onChange={(e) => setGapForm({ ...gapForm, category: e.target.value })}
                    label="Category"
                  >
                    {GAP_CATEGORIES.map(category => (
                      <MenuItem key={category.value} value={category.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {category.icon}
                          <Box sx={{ ml: 1 }}>
                            <Typography variant="body2">{category.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {category.description}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={gapForm.severity}
                    onChange={(e) => setGapForm({ ...gapForm, severity: e.target.value })}
                    label="Severity"
                  >
                    {SEVERITY_LEVELS.map(level => (
                      <MenuItem key={level.value} value={level.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Chip label={level.label} size="small" color={level.color as any} />
                          <Typography variant="body2" sx={{ ml: 1 }}>
                            {level.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Gap Description"
                  multiline
                  rows={3}
                  value={gapForm.description}
                  onChange={(e) => setGapForm({ ...gapForm, description: e.target.value })}
                  placeholder="Describe the gap identified during the simulation..."
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Action Plan"
                  multiline
                  rows={3}
                  value={gapForm.actionPlan}
                  onChange={(e) => setGapForm({ ...gapForm, actionPlan: e.target.value })}
                  placeholder="What steps will be taken to address this gap?"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Assigned To"
                  value={gapForm.assignedTo}
                  onChange={(e) => setGapForm({ ...gapForm, assignedTo: e.target.value })}
                  placeholder="Person or department responsible"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Target Date"
                  type="date"
                  value={gapForm.targetDate}
                  onChange={(e) => setGapForm({ ...gapForm, targetDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={gapForm.status}
                    onChange={(e) => setGapForm({ ...gapForm, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="identified">Identified</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            {/* Linked Activities Section */}
            {editingGap && editingGap.linkedActivities && editingGap.linkedActivities.length > 0 && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Linked Activities
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {editingGap.linkedActivities.map((activityId) => {
                    // Get activity details from user_data (activitiesSim)
                    const activity = activitiesSim.find((a: any) => a.id === activityId);
                    
                    if (!activity) return null;
                    
                    return (
                      <Card key={activityId} variant="outlined">
                        <CardContent sx={{ py: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {activity.activity}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {activity.date} • {activity.category} • {activity.hours}h
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              onClick={() => {
                                window.location.href = '/activities';
                              }}
                            >
                              View Activity
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Box>
                {editingGap && (
                  <Button 
                    onClick={handleDeleteGap}
                    color="error"
                    startIcon={<DeleteIcon />}
                    sx={{ mr: 2 }}
                  >
                    Delete Gap
                  </Button>
                )}
              </Box>
              <Box>
                <Button onClick={handleCloseGapDialog}>Cancel</Button>
                <Button onClick={handleSubmitGap} variant="contained">
                  {editingGap ? 'Update' : 'Save Gap'}
                </Button>
              </Box>
            </Box>
          </DialogActions>
        </Dialog>

        {/* Case Gap Dialog */}
        <Dialog 
          open={showCaseGapDialog} 
          onClose={handleCloseCaseGapDialog}
          maxWidth="md"
          fullWidth
          disablePortal
          disableEnforceFocus
          disableAutoFocus
          disableRestoreFocus
          hideBackdrop={false}
        >
          <DialogTitle>Add Case-Related Gap</DialogTitle>
          <DialogContent>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Case Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Case</InputLabel>
                  <Select
                    value={caseGapForm.caseName}
                    onChange={(e) => handleCaseGapChange('caseName', e.target.value)}
                    label="Case"
                  >
                    {peccSimulations.filter(s => s.name && s.name.trim()).map((sim) => (
                      <MenuItem key={sim.id} value={sim.name!}>
                        {sim.name}
                      </MenuItem>
                    ))}
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Other Case Name Input */}
              {caseGapForm.caseName === 'other' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Other Case Name"
                    value={caseGapForm.otherCaseName}
                    onChange={(e) => handleCaseGapChange('otherCaseName', e.target.value)}
                    placeholder="Enter the name of the other case"
                  />
                </Grid>
              )}

              {/* Category and Severity */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={caseGapForm.category}
                    onChange={(e) => handleCaseGapChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="equipment">Equipment</MenuItem>
                    <MenuItem value="knowledge">Knowledge</MenuItem>
                    <MenuItem value="policy">Policy</MenuItem>
                    <MenuItem value="communication">Communication</MenuItem>
                    <MenuItem value="training">Training</MenuItem>
                    <MenuItem value="resources">Resources</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={caseGapForm.severity}
                    onChange={(e) => handleCaseGapChange('severity', e.target.value)}
                    label="Severity"
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Gap Description"
                  value={caseGapForm.description}
                  onChange={(e) => handleCaseGapChange('description', e.target.value)}
                  placeholder="Describe the gap identified during the simulation"
                />
              </Grid>

              {/* Action Plan */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Action Plan"
                  value={caseGapForm.actionPlan}
                  onChange={(e) => handleCaseGapChange('actionPlan', e.target.value)}
                  placeholder="Describe the action plan to address this gap"
                />
              </Grid>

              {/* Assignment and Status */}
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Assigned To"
                  value={caseGapForm.assignedTo}
                  onChange={(e) => handleCaseGapChange('assignedTo', e.target.value)}
                  placeholder="Person responsible"
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Target Date"
                  type="date"
                  value={caseGapForm.targetDate}
                  onChange={(e) => handleCaseGapChange('targetDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={caseGapForm.status}
                    onChange={(e) => handleCaseGapChange('status', e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="identified">Identified</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCaseGapDialog}>Cancel</Button>
            <Button onClick={handleSubmitCaseGap} variant="contained">
              Save Gap
            </Button>
          </DialogActions>
        </Dialog>

        {/* Mobile Floating Action Button */}
        {isMobile && (
          <Fab
            color="primary"
            aria-label="start simulation"
            onClick={() => setOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1000
            }}
          >
            <PlayIcon />
          </Fab>
        )}
      </Box>
    </Container>
  );
};

export default SimulationPage;