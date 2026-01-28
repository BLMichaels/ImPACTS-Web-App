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
  TextField,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Link,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

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
  facilityId?: string;
  siteId: string; // facility_id or id
  isWorkingWith?: boolean;
}

interface HospitalMetrics {
  peccActivityHours: number;
  mentorHours: number;
  readinessScore: number | null;
  readinessScoreDate: string | null;
  simulationCount: number;
  peccUserId?: string; // For viewing PECC account
}

interface StageCompletion {
  completed: boolean;
  completionDate: string | null;
}

interface HospitalMilestones {
  hospitalId: string;
  stages: MilestoneStage[];
  stageCompletions: Record<string, StageCompletion>; // stage id -> completion
}

const STIPEND_PER_STAGE = 200;

// Default stages structure (same as MilestonesPage)
const DEFAULT_STAGES: MilestoneStage[] = [
  {
    id: 'stage1',
    title: 'Stage 1: Establish',
    subtitle: '',
    objectives: [],
    goal: '',
    tasks: [
      { id: '1.1', text: 'Review the role responsibilities for Nurse PECC or Physician PECC', completed: false },
      { id: '1.2', text: 'Complete the Emergency Medical Services for Children (EMSC) PECC Modules', completed: false },
      { id: '1.3', text: 'Contact your emergency department (ED) nursing leadership and/or physician partners with the following email template', completed: false },
      { id: '1.4', text: 'Share Pediatric Readiness resources with ED leadership', completed: false },
      { id: '1.5', text: 'Meet your PRISM mentor (virtual or in-person) and schedule monthly check-ins', completed: false },
      { id: '1.6', text: 'Join the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', completed: false },
      { id: '1.7', text: 'Review the National Pediatric Readiness Project assessment with your PRISM', completed: false },
      { id: '1.8', text: 'Work with your PRISM to attend an in-person PECC training event', completed: false },
      { id: '1.9', text: 'Review SimBox How-To Video and Simulation/Education Guide', completed: false },
      { id: '1.10', text: 'Plan your in-person simulation with your PRISM by selecting a simulation case, assigning roles, and setting up technology to run during Stage 2', completed: false },
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
      { id: '2.3', text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', completed: false },
      { id: '2.4', text: 'Complete your National Pediatric Readiness Project assessment and review score with your PRISM', completed: false },
      { id: '2.5', text: 'Review, prioritize, and address one ongoing gap utilizing resources from ImPACTS with your PRISM', completed: false },
      { id: '2.6', text: 'Create a SMART aim goal to address the prioritized gap with support from your PRISM', completed: false },
      { id: '2.7', text: 'Schedule your first simulation with an ED team with support from your PRISM', completed: false },
      { id: '2.8', text: 'Run and complete your first simulation with support from your PRISM', completed: false },
      { id: '2.9', text: 'Complete the associated Facilitator Checklist with that scenario', completed: false },
      { id: '2.10', text: 'Ask all participants to complete the Participant Survey to access the simulation report', completed: false },
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
      { id: '3.3', text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', completed: false },
      { id: '3.4', text: 'Continue addressing prioritized gaps from Stage 2 with virtual support and consultation from your PRISM', completed: false },
      { id: '3.5', text: 'Review the "Gap Analysis" tab on your ImPACTS dashboard with your PRISM', completed: false },
      { id: '3.6', text: 'Begin logging activities in your ImPACTS dashboard', completed: false },
      { id: '3.7', text: 'Independently create a SMART aim goal to address ongoing gaps, with consultation and feedback from your PRISM', completed: false },
      { id: '3.8', text: 'Schedule and facilitate quarterly simulations with an ED team with virtual support from your PRISM', completed: false },
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
      { id: '4.3', text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', completed: false },
      { id: '4.4', text: 'Review and update the status of the current "Gap Analysis" on your ImPACTS dashboard', completed: false },
      { id: '4.5', text: 'Log monthly activities on your ImPACTS dashboard', completed: false },
      { id: '4.6', text: 'Present your ImPACTS dashboard snapshots to ED and hospital leadership', completed: false },
      { id: '4.7', text: 'Each year, complete the National Pediatric Readiness Project assessment, address new or ongoing gaps utilizing resources from ImPACTS, and create a SMART aim goal to tackle the next identified gap', completed: false },
      { id: '4.8', text: 'Facilitate, independently, ongoing quarterly simulations in the ED', completed: false },
      { id: '4.9', text: 'Fill out the ImPACTS Program Evaluation Survey to share your feedback and indicate interest in becoming a PRISM', completed: false }
    ]
  }
];

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

  // Load hospitals (only "working with" ones)
  useEffect(() => {
    if (currentUser?.id) {
      const savedHospitals = localStorage.getItem(`mentorHospitals_${currentUser.id}`);
      if (savedHospitals) {
        const parsed: any[] = JSON.parse(savedHospitals);
        // Filter to only "working with" hospitals
        const workingHospitals = parsed
          .filter((h: any) => h.isWorkingWith !== false)
          .map((h: any) => ({
            id: h.id,
            name: h.name,
            facilityId: h.id, // Assuming id is facility_id
            siteId: h.id, // site_id = facility_id or id
            isWorkingWith: h.isWorkingWith
          }));
        setHospitals(workingHospitals);
      }
    }
  }, [currentUser]);

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
        // Find PECC users for this hospital
        const { data: peccUsers } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('role', 'pecc')
          .or(`hospital_facility_id.eq.${hospital.siteId},hospital_facility_id.eq.${hospital.id}`);

        // Also check site_members
        const { data: siteMembers } = await supabase
          .from('site_members')
          .select('user_id')
          .eq('site_id', hospital.siteId);

        const peccUserIds = [
          ...(peccUsers?.map(u => u.id) || []),
          ...(siteMembers?.map(sm => sm.user_id) || [])
        ];

        if (peccUserIds.length > 0) {
          // Load milestones from first PECC (assuming shared milestones per site)
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

          // Load metrics
          const peccActivities = JSON.parse(localStorage.getItem(`activities_${peccId}`) || '[]');
          const mentorActivities = JSON.parse(localStorage.getItem(`mentorActivities_${currentUser.id}`) || '[]');
          // Try both readinessScores keys
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
          // No PECC yet, initialize empty milestones
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

        // Load stage completions from mentor's stored data
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

  // Save stage completions
  const saveStageCompletions = (hospitalId: string, completions: Record<string, StageCompletion>) => {
    if (currentUser?.id) {
      localStorage.setItem(`mentorStageCompletions_${currentUser.id}_${hospitalId}`, JSON.stringify(completions));
      updateStipends(hospitalId, completions);
    }
  };

  // Update stipends in Wages & Expenses
  const updateStipends = (hospitalId: string, completions: Record<string, StageCompletion>) => {
    if (!currentUser?.id) return;

    const wagesDataStr = localStorage.getItem(`mentorWages_${currentUser.id}`);
    if (!wagesDataStr) return;

    try {
      const wagesData = JSON.parse(wagesDataStr);
      const currentYear = new Date().getFullYear();
      
      // Count completed stages
      const completedStages = Object.values(completions).filter(c => c.completed).length;
      const totalStipend = completedStages * STIPEND_PER_STAGE;

      // Distribute across months (simplified - could be more sophisticated)
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

      // Update stipends
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

  // Handle task checkbox toggle
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

    // Sync to PECC's milestones
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

  // Handle stage completion toggle
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

  // Handle completion date change
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

  // Handle hospital menu
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
    // Could navigate to specific hospital in CRM if we add that route
  };

  const handleViewPECCAccount = (hospitalId: string) => {
    const metrics = hospitalMetrics[hospitalId];
    if (metrics?.peccUserId) {
      handleHospitalMenuClose();
      // Navigate to PECC view (would need admin/manager view or special route)
      // For now, just show a message
      alert(`Viewing PECC account for ${hospitals.find(h => h.id === hospitalId)?.name}`);
    }
  };

  // Flatten all tasks for table rows
  const tableRows = useMemo(() => {
    const rows: Array<{ type: 'stage' | 'task' | 'completion'; stageId?: string; stageTitle?: string; taskId?: string; taskText?: string }> = [];
    
    DEFAULT_STAGES.forEach(stage => {
      rows.push({ type: 'stage', stageId: stage.id, stageTitle: stage.title });
      stage.tasks.forEach(task => {
        rows.push({ type: 'task', stageId: stage.id, taskId: task.id, taskText: task.text });
      });
      rows.push({ type: 'completion', stageId: stage.id, stageTitle: stage.title });
    });
    
    return rows;
  }, []);

  if (loading) {
    return (
      <Box sx={{ py: 3 }}>
        <Typography>Loading milestones...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>Site Milestones</Typography>
        <Typography color="textSecondary" gutterBottom sx={{ mb: 3 }}>
          Track checklist progress for each of your hospital sites. Changes sync with PECC accounts.
        </Typography>

        {hospitals.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="textSecondary">No hospitals assigned yet. Add hospitals from the Hospital Contacts page.</Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: 800, overflowX: 'auto', overflowY: 'auto' }}>
            <Table stickyHeader sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 300, position: 'sticky', left: 0, zIndex: 10, bgcolor: 'background.paper' }}>
                    <strong>Stage / Task</strong>
                  </TableCell>
                  {hospitals.map(hospital => {
                    const metrics = hospitalMetrics[hospital.id];
                    return (
                      <TableCell key={hospital.id} align="center" sx={{ minWidth: 200 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Link
                              component="button"
                              onClick={() => handleViewCRM(hospital.id)}
                              sx={{ textDecoration: 'none', fontWeight: 'bold', color: 'primary.main', cursor: 'pointer' }}
                            >
                              {hospital.name}
                            </Link>
                            <IconButton size="small" onClick={(e) => handleHospitalMenuOpen(e, hospital.id)}>
                              <MoreIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          {metrics && (
                            <Box sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center' }}>
                              <div>PECC Hours: {metrics.peccActivityHours.toFixed(1)}</div>
                              <div>Mentor Hours: {metrics.mentorHours.toFixed(1)}</div>
                              <div>Readiness: {metrics.readinessScore !== null ? `${metrics.readinessScore}` : 'N/A'}</div>
                              <div>Simulations: {metrics.simulationCount}</div>
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
                    return (
                      <TableRow key={`${row.stageId}-header`} sx={{ bgcolor: 'grey.100' }}>
                        <TableCell sx={{ position: 'sticky', left: 0, zIndex: 9, bgcolor: 'grey.100', fontWeight: 'bold' }}>
                          {row.stageTitle}
                        </TableCell>
                        {hospitals.map(() => (
                          <TableCell key={`empty-${rowIndex}`} />
                        ))}
                      </TableRow>
                    );
                  } else if (row.type === 'task') {
                    return (
                      <TableRow key={`${row.stageId}-${row.taskId}`}>
                        <TableCell sx={{ position: 'sticky', left: 0, zIndex: 9, bgcolor: 'background.paper', pl: 4 }}>
                          {row.taskText}
                        </TableCell>
                        {hospitals.map(hospital => {
                          const hospitalData = hospitalMilestones[hospital.id];
                          const stage = hospitalData?.stages.find(s => s.id === row.stageId);
                          const task = stage?.tasks.find(t => t.id === row.taskId);
                          const isCompleted = task?.completed || false;

                          return (
                            <TableCell key={hospital.id} align="center">
                              <Checkbox
                                checked={isCompleted}
                                onChange={() => handleTaskToggle(hospital.id, row.stageId!, row.taskId!)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  } else {
                    // Completion row
                    const stageNum = row.stageId?.replace('stage', '');
                    return (
                      <TableRow key={`${row.stageId}-completion`} sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ position: 'sticky', left: 0, zIndex: 9, bgcolor: 'grey.50', fontWeight: 'bold', pl: 4 }}>
                          Stage {stageNum} Complete
                        </TableCell>
                        {hospitals.map(hospital => {
                          const hospitalData = hospitalMilestones[hospital.id];
                          const completion = hospitalData?.stageCompletions[row.stageId!];
                          const isCompleted = completion?.completed || false;

                          return (
                            <TableCell key={hospital.id} align="center">
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                <Checkbox
                                  checked={isCompleted}
                                  onChange={() => handleStageCompletionToggle(hospital.id, row.stageId!)}
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
                                  >
                                    {completion?.completionDate ? format(parseISO(completion.completionDate), 'MMM d, yyyy') : 'Set Date'}
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
        )}

        {/* Hospital Menu */}
        <Menu
          anchorEl={hospitalMenuAnchor?.el}
          open={Boolean(hospitalMenuAnchor)}
          onClose={handleHospitalMenuClose}
        >
          <MenuItem onClick={() => hospitalMenuAnchor && handleViewCRM(hospitalMenuAnchor.hospitalId)}>
            <BusinessIcon sx={{ mr: 1 }} />
            View in CRM
          </MenuItem>
          {hospitalMenuAnchor && hospitalMetrics[hospitalMenuAnchor.hospitalId]?.peccUserId && (
            <MenuItem onClick={() => hospitalMenuAnchor && handleViewPECCAccount(hospitalMenuAnchor.hospitalId)}>
              <ViewIcon sx={{ mr: 1 }} />
              View PECC Account
            </MenuItem>
          )}
        </Menu>

        {/* Completion Date Dialog */}
        <Dialog open={dateDialogOpen} onClose={() => setDateDialogOpen(false)}>
          <DialogTitle>Set Completion Date</DialogTitle>
          <DialogContent>
            <DatePicker
              label="Stage Completion Date"
              value={completionDate}
              onChange={(newValue) => setCompletionDate(newValue)}
              slotProps={{ textField: { fullWidth: true, sx: { mt: 2 } } }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCompletionDateChange} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default MentorSiteMilestonesPage;
