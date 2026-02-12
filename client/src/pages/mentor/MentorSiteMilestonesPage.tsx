import React, { useState, useEffect, useMemo } from 'react';
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
  Checkbox,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Chip
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  DragIndicator as DragIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';

// Interfaces matching MilestonesPage
interface MilestoneTask {
  id: string;
  text: string;
  completed: boolean;
  links?: { text: string; url: string; }[];
}

interface MilestoneStage {
  id: string;
  title: string;
  subtitle: string;
  objectives: string[];
  goal: string;
  tasks: MilestoneTask[];
}

interface Hospital {
  id: string;
  name: string;
  facilityId: string;
  siteId: string;
  isWorkingWith?: boolean;
}

interface HospitalMetrics {
  peccActivityHours: number;
  mentorHours: number;
  readinessScore: number | null;
  readinessScoreDate: string | null;
  simulationCount: number;
  peccUserId?: string;
}

interface StageCompletion {
  completed: boolean;
  completionDate: string | null;
}

interface HospitalMilestones {
  hospitalId: string;
  stages: MilestoneStage[];
  stageCompletions: Record<string, StageCompletion>;
}

const STIPEND_PER_STAGE = 200;

// Full stages structure with links from MilestonesPage
const DEFAULT_STAGES: MilestoneStage[] = [
  {
    id: 'stage1',
    title: 'Stage 1: Establish',
    subtitle: '',
    objectives: [],
    goal: '',
    tasks: [
      { 
        id: '1.1', 
        text: 'Review the role responsibilities for Nurse PECC or Physician PECC', 
        completed: false,
        links: [
          { text: 'Nurse PECC', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/role-of-the-nursing-pecc-in-the-ed/' },
          { text: 'Physician PECC', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/readiness-toolkit/readiness-toolkit-checklist/pecc/md-pecc/' }
        ]
      },
      { 
        id: '1.2', 
        text: 'Complete the Emergency Medical Services for Children (EMSC) PECC Modules', 
        completed: false,
        links: [
          { text: 'PECC Modules', url: 'https://emscimprovement.center/domains/pecc/pecc-module-ed/' }
        ]
      },
      { 
        id: '1.3', 
        text: 'Contact your emergency department (ED) nursing leadership and/or physician partners with the following email template', 
        completed: false,
        links: [
          { text: 'email template', url: 'https://docs.google.com/document/d/14QcAO6S8llniLOKo-NoIuwDpYgo63GCN/edit' }
        ]
      },
      { 
        id: '1.4', 
        text: 'Share Pediatric Readiness resources with ED leadership', 
        completed: false,
        links: [
          { text: 'Joint Policy Statement', url: 'https://publications.aap.org/pediatrics/article/142/5/e20182459/38608/Pediatric-Readiness-in-the-Emergency-Department' },
          { text: 'How Pediatric Readiness Saves Lives', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/' },
          { text: 'The National Pediatric Readiness Project Assessment', url: 'https://www.pedsready.org/' },
          { text: 'Importance of a PECC', url: 'https://emscimprovement.center/domains/pecc/' }
        ]
      },
      { id: '1.5', text: 'Meet your PRISM mentor (virtual or in-person) and schedule monthly check-ins', completed: false },
      { 
        id: '1.6', 
        text: 'Join the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
        completed: false,
        links: [
          { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
        ]
      },
      { id: '1.7', text: 'Review the National Pediatric Readiness Project assessment with your PRISM', completed: false },
      { id: '1.8', text: 'Work with your PRISM to attend an in-person PECC training event', completed: false },
      { 
        id: '1.9', 
        text: 'Review SimBox How-To Video and Simulation/Education Guide', 
        completed: false,
        links: [
          { text: 'How-To Video', url: 'https://www.emergencysimbox.com/how-to-use' },
          { text: 'Simulation/Education Guide', url: 'https://www.emergencysimbox.com/respiratory-distress' }
        ]
      },
      { 
        id: '1.10', 
        text: 'Plan your in-person simulation with your PRISM by selecting a simulation case, assigning roles, and setting up technology to run during Stage 2', 
        completed: false,
        links: [
          { text: 'simulation case', url: 'https://www.emergencysimbox.com/' }
        ]
      },
      { id: '1.11', text: 'Communicate to leadership your progress', completed: false }
    ]
  },
  {
    id: 'stage2',
    title: 'Stage 2: Implement',
    subtitle: '',
    objectives: [],
    goal: '',
    tasks: [
      { id: '2.1', text: 'Complete Stage 1 objectives', completed: false },
      { id: '2.2', text: 'After completing Stage 1 objectives, re-evaluate your available time commitment to Pediatric Readiness', completed: false },
      { 
        id: '2.3', 
        text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
        completed: false,
        links: [
          { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
        ]
      },
      { id: '2.4', text: 'Complete your National Pediatric Readiness Project assessment and review score with your PRISM', completed: false },
      { id: '2.5', text: 'Review, prioritize, and address one ongoing gap utilizing resources from ImPACTS with your PRISM', completed: false },
      { id: '2.6', text: 'Create a SMART aim goal to address the prioritized gap with support from your PRISM', completed: false },
      { id: '2.7', text: 'Schedule your first simulation with an ED team with support from your PRISM', completed: false },
      { id: '2.8', text: 'Run and complete your first simulation with support from your PRISM', completed: false },
      { 
        id: '2.9', 
        text: 'Complete the associated Facilitator Checklist with that scenario', 
        completed: false,
        links: [
          { text: 'Facilitator Checklist', url: 'https://yalesurvey.ca1.qualtrics.com/jfe/form/SV_2i2AQF9Lq5ixm6i' }
        ]
      },
      { 
        id: '2.10', 
        text: 'Ask all participants to complete the Participant Survey to access the simulation report', 
        completed: false,
        links: [
          { text: 'Participant Survey', url: 'https://yalesurvey.ca1.qualtrics.com/jfe/form/SV_3vXMUgYvIPFWKUK' }
        ]
      },
      { id: '2.11', text: 'Communicate to leadership your progress', completed: false }
    ]
  },
  {
    id: 'stage3',
    title: 'Stage 3: Lead',
    subtitle: '',
    objectives: [],
    goal: '',
    tasks: [
      { id: '3.1', text: 'Complete Stage 2 objectives', completed: false },
      { id: '3.2', text: 'After completing Stage 2 objectives, re-evaluate your available time commitment to Pediatric Readiness', completed: false },
      { 
        id: '3.3', 
        text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
        completed: false,
        links: [
          { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
        ]
      },
      { id: '3.4', text: 'Continue addressing prioritized gaps from Stage 2 with virtual support and consultation from your PRISM', completed: false },
      { id: '3.5', text: 'Review the "Gap Analysis" tab on your ImPACTS dashboard with your PRISM', completed: false },
      { id: '3.6', text: 'Begin logging activities in your ImPACTS dashboard', completed: false },
      { id: '3.7', text: 'Independently create a SMART aim goal to address ongoing gaps, with consultation and feedback from your PRISM', completed: false },
      { 
        id: '3.8', 
        text: 'Schedule and facilitate quarterly simulations with an ED team with virtual support from your PRISM', 
        completed: false,
        links: [
          { text: 'simulations', url: 'https://www.emergencysimbox.com/' }
        ]
      },
      { id: '3.9', text: 'Communicate to leadership your progress', completed: false }
    ]
  },
  {
    id: 'stage4',
    title: 'Stage 4: Sustain',
    subtitle: '',
    objectives: [],
    goal: '',
    tasks: [
      { id: '4.1', text: 'Complete Stage 3 objectives', completed: false },
      { id: '4.2', text: 'After completing Stage 3 objectives, re-evaluate your available time commitment to Pediatric Readiness', completed: false },
      { 
        id: '4.3', 
        text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
        completed: false,
        links: [
          { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
        ]
      },
      { id: '4.4', text: 'Review and update the status of the current "Gap Analysis" on your ImPACTS dashboard', completed: false },
      { id: '4.5', text: 'Log monthly activities on your ImPACTS dashboard', completed: false },
      { id: '4.6', text: 'Present your ImPACTS dashboard snapshots to ED and hospital leadership', completed: false },
      { 
        id: '4.7', 
        text: 'Each year, complete the National Pediatric Readiness Project assessment, address new or ongoing gaps utilizing resources from ImPACTS, and create a SMART aim goal to tackle the next identified gap', 
        completed: false,
        links: [
          { text: 'National Pediatric Readiness Project assessment', url: 'https://www.pedsready.org/' }
        ]
      },
      { 
        id: '4.8', 
        text: 'Facilitate, independently, ongoing quarterly simulations in the ED', 
        completed: false,
        links: [
          { text: 'simulations', url: 'https://www.emergencysimbox.com/' }
        ]
      },
      { id: '4.9', text: 'Fill out the ImPACTS Program Evaluation Survey to share your feedback and indicate interest in becoming a PRISM', completed: false }
    ]
  }
];

// Helper to render task text with links
const renderTaskText = (task: MilestoneTask) => {
  if (!task.links || task.links.length === 0) {
    return <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>{task.text}</Typography>;
  }

  let text = task.text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  task.links.forEach((link, idx) => {
    const linkIndex = text.indexOf(link.text, lastIndex);
    if (linkIndex !== -1) {
      // Add text before link
      if (linkIndex > lastIndex) {
        parts.push(text.substring(lastIndex, linkIndex));
      }
      // Add link
      parts.push(
        <Link
          key={idx}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ fontSize: '0.75rem', textDecoration: 'underline' }}
        >
          {link.text}
        </Link>
      );
      lastIndex = linkIndex + link.text.length;
    }
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <Typography variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.3 }}>{parts}</Typography>;
};

const MentorSiteMilestonesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalMilestones, setHospitalMilestones] = useState<Record<string, HospitalMilestones>>({});
  const [hospitalMetrics, setHospitalMetrics] = useState<Record<string, HospitalMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [hospitalMenuAnchor, setHospitalMenuAnchor] = useState<{ el: HTMLElement; hospitalId: string } | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<{ hospitalId: string; stageId: string } | null>(null);
  const [completionDate, setCompletionDate] = useState<Date | null>(null);
  const [hiddenHospitals, setHiddenHospitals] = useState<Set<string>>(new Set());
  const [draggedHospitalId, setDraggedHospitalId] = useState<string | null>(null);

  // Load hospitals (only "working with" ones) and hidden hospitals
  useEffect(() => {
    if (currentUser?.id) {
      const savedHospitals = localStorage.getItem(`mentorHospitals_${currentUser.id}`);
      const savedHidden = localStorage.getItem(`mentorHiddenHospitals_${currentUser.id}`);
      const savedOrder = localStorage.getItem(`mentorHospitalOrder_${currentUser.id}`);
      
      if (savedHospitals) {
        const parsed: any[] = JSON.parse(savedHospitals);
        let workingHospitals: Hospital[] = parsed
          .filter((h: any) => h.isWorkingWith !== false)
          .map((h: any) => ({
            id: String(h.id),
            name: String(h.name ?? ''),
            facilityId: String(h.id),
            siteId: String(h.id),
            isWorkingWith: Boolean(h.isWorkingWith)
          })) as Hospital[];
        
        // Apply saved order if exists
        if (savedOrder) {
          try {
            const order: string[] = JSON.parse(savedOrder);
            const ordered: Hospital[] = order
              .map((id) => workingHospitals.find((h) => h.id === id))
              .filter((h): h is Hospital => Boolean(h));
            const remaining: Hospital[] = workingHospitals.filter((h) => !order.includes(h.id));
            workingHospitals = [...ordered, ...remaining];
          } catch {}
        }
        
        setHospitals(workingHospitals);
      }
      
      if (savedHidden) {
        try {
          const hidden: string[] = JSON.parse(savedHidden);
          setHiddenHospitals(new Set(hidden));
        } catch {}
      }
    }
  }, [currentUser]);

  // Save hospital order
  const saveHospitalOrder = (newOrder: Hospital[]) => {
    if (currentUser?.id) {
      localStorage.setItem(`mentorHospitalOrder_${currentUser.id}`, JSON.stringify(newOrder.map(h => h.id)));
      setHospitals(newOrder);
    }
  };

  // Toggle hospital visibility
  const toggleHospitalVisibility = (hospitalId: string) => {
    const newHidden = new Set(hiddenHospitals);
    if (newHidden.has(hospitalId)) {
      newHidden.delete(hospitalId);
    } else {
      newHidden.add(hospitalId);
    }
    setHiddenHospitals(newHidden);
    if (currentUser?.id) {
      localStorage.setItem(`mentorHiddenHospitals_${currentUser.id}`, JSON.stringify(Array.from(newHidden)));
    }
  };

  // Handle drag and drop
  const handleDragStart = (hospitalId: string) => {
    setDraggedHospitalId(hospitalId);
  };

  const handleDragOver = (e: React.DragEvent, hospitalId: string) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetHospitalId: string) => {
    e.preventDefault();
    if (!draggedHospitalId || draggedHospitalId === targetHospitalId) return;

    const draggedIndex = hospitals.findIndex(h => h.id === draggedHospitalId);
    const targetIndex = hospitals.findIndex(h => h.id === targetHospitalId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    const newHospitals = [...hospitals];
    const [dragged] = newHospitals.splice(draggedIndex, 1);
    newHospitals.splice(targetIndex, 0, dragged);
    
    saveHospitalOrder(newHospitals);
    setDraggedHospitalId(null);
  };

  // Load milestones for each hospital's PECC(s)
  useEffect(() => {
    const loadMilestones = async () => {
      if (!currentUser?.id || hospitals.length === 0) {
        setLoading(false);
        return;
      }

      const milestones: Record<string, HospitalMilestones> = {};
      const metrics: Record<string, HospitalMetrics> = {};

      for (const hospital of hospitals) {
        const { data: peccUsers } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('role', 'pecc')
          .or(`hospital_facility_id.eq.${hospital.siteId},hospital_facility_id.eq.${hospital.id}`);

        const { data: siteMembers } = await supabase
          .from('site_members')
          .select('user_id')
          .eq('site_id', hospital.siteId);

        const peccUserIds = [
          ...(peccUsers?.map(u => u.id) || []),
          ...(siteMembers?.map(sm => sm.user_id) || [])
        ];

        if (peccUserIds.length > 0) {
          const peccId = peccUserIds[0];
          const savedMilestones = localStorage.getItem(`milestones_${peccId}`);
          
          if (savedMilestones) {
            try {
              const parsed: MilestoneStage[] = JSON.parse(savedMilestones);
              milestones[hospital.id] = {
                hospitalId: hospital.id,
                stages: parsed,
                stageCompletions: {}
              };
            } catch {
              milestones[hospital.id] = {
                hospitalId: hospital.id,
                stages: DEFAULT_STAGES.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t, completed: false })) })),
                stageCompletions: {}
              };
            }
          } else {
            milestones[hospital.id] = {
              hospitalId: hospital.id,
              stages: DEFAULT_STAGES.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t, completed: false })) })),
              stageCompletions: {}
            };
          }

          const peccActivities = JSON.parse(localStorage.getItem(`activities_${peccId}`) || '[]');
          const mentorActivities = JSON.parse(localStorage.getItem(`mentorActivities_${currentUser.id}`) || '[]');
          let readinessScores = JSON.parse(localStorage.getItem(`readinessScores_${peccId}`) || '[]');
          if (readinessScores.length === 0) {
            readinessScores = JSON.parse(localStorage.getItem(`readinessScores_${currentUser.id}`) || '[]');
          }
          
          const peccActivityHours = peccActivities.reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
          const mentorHours = mentorActivities
            .filter((a: any) => a.hospitalIds?.includes(hospital.id))
            .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
          const simulations = mentorActivities
            .filter((a: any) => a.hospitalIds?.includes(hospital.id) && a.category === 'SC')
            .length;
          
          const latestScore = readinessScores.length > 0 
            ? readinessScores.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
            : null;

          metrics[hospital.id] = {
            peccActivityHours,
            mentorHours,
            readinessScore: latestScore?.score || null,
            readinessScoreDate: latestScore?.date || null,
            simulationCount: simulations,
            peccUserId: peccId
          };
        } else {
          milestones[hospital.id] = {
            hospitalId: hospital.id,
            stages: DEFAULT_STAGES.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t, completed: false })) })),
            stageCompletions: {}
          };
          metrics[hospital.id] = {
            peccActivityHours: 0,
            mentorHours: 0,
            readinessScore: null,
            readinessScoreDate: null,
            simulationCount: 0
          };
        }

        const savedCompletions = localStorage.getItem(`mentorStageCompletions_${currentUser.id}_${hospital.id}`);
        if (savedCompletions) {
          try {
            milestones[hospital.id].stageCompletions = JSON.parse(savedCompletions);
          } catch {}
        }
      }

      setHospitalMilestones(milestones);
      setHospitalMetrics(metrics);
      setLoading(false);
    };

    loadMilestones();
  }, [currentUser, hospitals]);

  const saveStageCompletions = (hospitalId: string, completions: Record<string, StageCompletion>) => {
    if (currentUser?.id) {
      localStorage.setItem(`mentorStageCompletions_${currentUser.id}_${hospitalId}`, JSON.stringify(completions));
      updateStipends(hospitalId, completions);
    }
  };

  const updateStipends = (hospitalId: string, completions: Record<string, StageCompletion>) => {
    if (!currentUser?.id) return;

    const wagesDataStr = localStorage.getItem(`mentorWages_${currentUser.id}`);
    if (!wagesDataStr) return;

    try {
      const wagesData = JSON.parse(wagesDataStr);
      const currentYear = new Date().getFullYear();
      
      const monthsWithStages: Record<number, number> = {};
      Object.entries(completions).forEach(([stageId, completion]) => {
        if (completion.completed && completion.completionDate) {
          const date = parseISO(completion.completionDate);
          if (date.getFullYear() === currentYear) {
            const month = date.getMonth();
            monthsWithStages[month] = (monthsWithStages[month] || 0) + STIPEND_PER_STAGE;
          }
        }
      });

      const updatedStipends = { ...wagesData.stipends };
      Object.entries(monthsWithStages).forEach(([month, amount]) => {
        const key = `${currentYear}-${month}`;
        updatedStipends[key] = (updatedStipends[key] || 0) + amount;
      });

      localStorage.setItem(`mentorWages_${currentUser.id}`, JSON.stringify({
        ...wagesData,
        stipends: updatedStipends
      }));
    } catch (err) {
      console.error('Error updating stipends:', err);
    }
  };

  const handleTaskToggle = (hospitalId: string, stageId: string, taskId: string) => {
    const hospital = hospitalMilestones[hospitalId];
    if (!hospital) return;

    const updatedStages = hospital.stages.map(stage => {
      if (stage.id === stageId) {
        return {
          ...stage,
          tasks: stage.tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          )
        };
      }
      return stage;
    });

    const updated: HospitalMilestones = {
      ...hospital,
      stages: updatedStages
    };

    setHospitalMilestones(prev => ({ ...prev, [hospitalId]: updated }));

    const metrics = hospitalMetrics[hospitalId];
    if (metrics?.peccUserId) {
      const peccMilestones = localStorage.getItem(`milestones_${metrics.peccUserId}`);
      if (peccMilestones) {
        try {
          const parsed: MilestoneStage[] = JSON.parse(peccMilestones);
          const synced = parsed.map(stage => {
            if (stage.id === stageId) {
              return {
                ...stage,
                tasks: stage.tasks.map(task =>
                  task.id === taskId ? { ...task, completed: !task.completed } : task
                )
              };
            }
            return stage;
          });
          localStorage.setItem(`milestones_${metrics.peccUserId}`, JSON.stringify(synced));
        } catch {}
      }
    }
  };

  const handleStageCompletionToggle = (hospitalId: string, stageId: string) => {
    const hospital = hospitalMilestones[hospitalId];
    if (!hospital) return;

    const current = hospital.stageCompletions[stageId];
    const updated: Record<string, StageCompletion> = {
      ...hospital.stageCompletions,
      [stageId]: {
        completed: !current?.completed,
        completionDate: !current?.completed ? format(new Date(), 'yyyy-MM-dd') : null
      }
    };

    setHospitalMilestones(prev => ({
      ...prev,
      [hospitalId]: { ...hospital, stageCompletions: updated }
    }));

    saveStageCompletions(hospitalId, updated);
  };

  const handleCompletionDateChange = () => {
    if (!editingStage) return;

    const { hospitalId, stageId } = editingStage;
    const hospital = hospitalMilestones[hospitalId];
    if (!hospital) return;

    const updated: Record<string, StageCompletion> = {
      ...hospital.stageCompletions,
      [stageId]: {
        completed: true,
        completionDate: completionDate ? format(completionDate, 'yyyy-MM-dd') : null
      }
    };

    setHospitalMilestones(prev => ({
      ...prev,
      [hospitalId]: { ...hospital, stageCompletions: updated }
    }));

    saveStageCompletions(hospitalId, updated);
    setDateDialogOpen(false);
    setEditingStage(null);
    setCompletionDate(null);
  };

  const handleHospitalMenuOpen = (event: React.MouseEvent<HTMLElement>, hospitalId: string) => {
    event.stopPropagation();
    setHospitalMenuAnchor({ el: event.currentTarget, hospitalId });
  };

  const handleHospitalMenuClose = () => {
    setHospitalMenuAnchor(null);
  };

  const handleViewCRM = (hospitalId: string) => {
    handleHospitalMenuClose();
    navigate(`/mentor/hospitals`);
  };

  const handleViewPECCAccount = (hospitalId: string) => {
    const metrics = hospitalMetrics[hospitalId];
    if (metrics?.peccUserId) {
      handleHospitalMenuClose();
      alert(`Viewing PECC account for ${normalizeHospitalOrOrgName(hospitals.find(h => h.id === hospitalId)?.name)}`);
    }
  };

  // Match stage colors from PECC checklist page
  const getStageColor = (stageId: string) => {
    switch (stageId) {
      case 'stage1':
        return '#2196F3'; // Blue
      case 'stage2':
        return '#4CAF50'; // Green
      case 'stage3':
        return '#FF9800'; // Orange
      case 'stage4':
        return '#9C27B0'; // Purple
      default:
        return '#2196F3';
    }
  };

  const tableRows = useMemo(() => {
    const rows: Array<{ type: 'stage' | 'task' | 'completion'; stageId?: string; stageTitle?: string; taskId?: string; task?: MilestoneTask }> = [];
    
    DEFAULT_STAGES.forEach(stage => {
      rows.push({ type: 'stage', stageId: stage.id, stageTitle: stage.title });
      stage.tasks.forEach(task => {
        rows.push({ type: 'task', stageId: stage.id, taskId: task.id, task });
      });
      rows.push({ type: 'completion', stageId: stage.id, stageTitle: stage.title });
    });
    
    return rows;
  }, []);

  const visibleHospitals = useMemo(
    () => hospitals.filter((h) => !hiddenHospitals.has(h.id)),
    [hospitals, hiddenHospitals]
  );

  if (loading) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography>Loading milestones...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ py: 2, px: 1 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 1, fontSize: '1.25rem', fontWeight: 600 }}>
          Site Milestones
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2, fontSize: '0.75rem' }}>
          Track checklist progress for each hospital site. Changes sync with PECC accounts.
        </Typography>

        {hospitals.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="textSecondary">No hospitals assigned yet. Add hospitals from the Hospital Contacts page.</Typography>
          </Paper>
        ) : (
          <>
            {/* Hospital Management Controls */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                {visibleHospitals.length} of {hospitals.length} hospitals visible
              </Typography>
              {hospitals.map(hospital => (
                <Chip
                  key={hospital.id}
                  label={normalizeHospitalOrOrgName(hospital.name)}
                  size="small"
                  icon={hiddenHospitals.has(hospital.id) ? <HideIcon /> : <ShowIcon />}
                  onClick={() => toggleHospitalVisibility(hospital.id)}
                  color={hiddenHospitals.has(hospital.id) ? 'default' : 'primary'}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
            
            <TableContainer 
              component={Paper} 
              sx={{ 
                maxHeight: 'calc(100vh - 200px)',
                overflowX: 'auto',
                overflowY: 'auto',
                '& .MuiTableCell-root': {
                  padding: '4px 8px',
                  fontSize: '0.75rem'
                }
              }}
            >
              <Table stickyHeader size="small" sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow>
                    <TableCell 
                      sx={{ 
                        minWidth: 250, 
                        maxWidth: 250,
                        position: 'sticky', 
                        left: 0, 
                        zIndex: 10, 
                        bgcolor: 'background.paper',
                        fontWeight: 600,
                        borderRight: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      Stage / Task
                    </TableCell>
                    {visibleHospitals.map((hospital, index) => {
                    const metrics = hospitalMetrics[hospital.id];
                    return (
                      <TableCell 
                        key={hospital.id} 
                        align="center" 
                        sx={{ 
                          minWidth: 180,
                          maxWidth: 180,
                          bgcolor: 'background.paper',
                          fontWeight: 600,
                          borderBottom: '2px solid',
                          borderColor: 'primary.main'
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Link
                              component="button"
                              onClick={() => handleViewCRM(hospital.id)}
                              sx={{ 
                                textDecoration: 'none', 
                                fontWeight: 600, 
                                color: 'primary.main', 
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                '&:hover': { textDecoration: 'underline' }
                              }}
                            >
                              {normalizeHospitalOrOrgName(hospital.name)}
                            </Link>
                            <IconButton 
                              size="small" 
                              onClick={(e) => handleHospitalMenuOpen(e, hospital.id)}
                              sx={{ padding: '2px' }}
                            >
                              <MoreIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          {metrics && (
                            <Box sx={{ fontSize: '0.65rem', color: 'text.secondary', textAlign: 'center', lineHeight: 1.2 }}>
                              <div>PECC: {metrics.peccActivityHours.toFixed(1)}h</div>
                              <div>Mentor: {metrics.mentorHours.toFixed(1)}h</div>
                              <div>Score: {metrics.readinessScore !== null ? `${metrics.readinessScore}` : 'N/A'}</div>
                              <div>Sims: {metrics.simulationCount}</div>
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((row, rowIndex) => {
                  if (row.type === 'stage') {
                    const stageColor = getStageColor(row.stageId!);
                    return (
                      <TableRow 
                        key={`${row.stageId}-header`} 
                        sx={{ 
                          bgcolor: stageColor,
                          '& .MuiTableCell-root': {
                            borderBottom: '2px solid',
                            borderColor: stageColor,
                            fontWeight: 600,
                            color: 'white'
                          }
                        }}
                      >
                        <TableCell 
                          sx={{ 
                            position: 'sticky', 
                            left: 0, 
                            zIndex: 9, 
                            bgcolor: stageColor,
                            fontWeight: 600,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            fontSize: '0.8rem',
                            minWidth: 250,
                            maxWidth: 250,
                            color: 'white'
                          }}
                        >
                          {row.stageTitle}
                        </TableCell>
                        {visibleHospitals.map(() => (
                          <TableCell key={`empty-${rowIndex}`} sx={{ bgcolor: stageColor }} />
                        ))}
                      </TableRow>
                    );
                  } else if (row.type === 'task' && row.task) {
                    return (
                      <TableRow 
                        key={`${row.stageId}-${row.taskId}`}
                        sx={{
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <TableCell 
                          sx={{ 
                            position: 'sticky', 
                            left: 0, 
                            zIndex: 9, 
                            bgcolor: 'background.paper',
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            pl: 2,
                            minWidth: 250,
                            maxWidth: 250
                          }}
                        >
                          {renderTaskText(row.task)}
                        </TableCell>
                        {visibleHospitals.map(hospital => {
                          const hospitalData = hospitalMilestones[hospital.id];
                          const stage = hospitalData?.stages.find(s => s.id === row.stageId);
                          const task = stage?.tasks.find(t => t.id === row.taskId);
                          const isCompleted = task?.completed || false;

                          return (
                            <TableCell key={hospital.id} align="center" sx={{ py: 0.5 }}>
                              <Checkbox
                                checked={isCompleted}
                                onChange={() => handleTaskToggle(hospital.id, row.stageId!, row.taskId!)}
                                size="small"
                                sx={{ padding: '2px' }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  } else {
                    const stageNum = row.stageId?.replace('stage', '');
                    const stageColor = getStageColor(row.stageId!);
                    return (
                      <TableRow 
                        key={`${row.stageId}-completion`} 
                        sx={{ 
                          bgcolor: stageColor,
                          '& .MuiTableCell-root': {
                            borderTop: '1px solid',
                            borderBottom: '1px solid',
                            borderColor: stageColor,
                            color: 'white'
                          }
                        }}
                      >
                        <TableCell 
                          sx={{ 
                            position: 'sticky', 
                            left: 0, 
                            zIndex: 9, 
                            bgcolor: stageColor,
                            fontWeight: 600,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            pl: 2,
                            minWidth: 250,
                            maxWidth: 250,
                            color: 'white'
                          }}
                        >
                          Stage {stageNum} Complete
                        </TableCell>
                        {visibleHospitals.map(hospital => {
                          const hospitalData = hospitalMilestones[hospital.id];
                          const completion = hospitalData?.stageCompletions[row.stageId!];
                          const isCompleted = completion?.completed || false;

                          return (
                            <TableCell key={hospital.id} align="center" sx={{ py: 0.5, bgcolor: stageColor }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                <Checkbox
                                  checked={isCompleted}
                                  onChange={() => handleStageCompletionToggle(hospital.id, row.stageId!)}
                                  size="small"
                                  sx={{ padding: '2px', color: 'white', '&.Mui-checked': { color: 'white' } }}
                                />
                                {isCompleted && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                      setEditingStage({ hospitalId: hospital.id, stageId: row.stageId! });
                                      setCompletionDate(completion?.completionDate ? parseISO(completion.completionDate) : new Date());
                                      setDateDialogOpen(true);
                                    }}
                                    sx={{ 
                                      fontSize: '0.65rem',
                                      padding: '2px 6px',
                                      minWidth: 'auto',
                                      height: '20px',
                                      borderColor: 'white',
                                      color: 'white',
                                      '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
                                    }}
                                  >
                                    {completion?.completionDate ? format(parseISO(completion.completionDate), 'M/d/yy') : 'Date'}
                                  </Button>
                                )}
                              </Box>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  }
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
        )}

        <Menu
          anchorEl={hospitalMenuAnchor?.el}
          open={Boolean(hospitalMenuAnchor)}
          onClose={handleHospitalMenuClose}
        >
          <MenuItem onClick={() => hospitalMenuAnchor && handleViewCRM(hospitalMenuAnchor.hospitalId)}>
            <BusinessIcon sx={{ mr: 1, fontSize: '1rem' }} />
            View in CRM
          </MenuItem>
          {hospitalMenuAnchor && hospitalMetrics[hospitalMenuAnchor.hospitalId]?.peccUserId && (
            <MenuItem onClick={() => hospitalMenuAnchor && handleViewPECCAccount(hospitalMenuAnchor.hospitalId)}>
              <ViewIcon sx={{ mr: 1, fontSize: '1rem' }} />
              View PECC Account
            </MenuItem>
          )}
        </Menu>

        <Dialog open={dateDialogOpen} onClose={() => setDateDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: '1rem', pb: 1 }}>Set Completion Date</DialogTitle>
          <DialogContent>
            <DatePicker
              label="Stage Completion Date"
              value={completionDate}
              onChange={(newValue) => setCompletionDate(newValue)}
              slotProps={{ textField: { fullWidth: true, size: 'small', sx: { mt: 1 } } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={() => setDateDialogOpen(false)} size="small">Cancel</Button>
            <Button onClick={handleCompletionDateChange} variant="contained" size="small">Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MentorSiteMilestonesPage;
