import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Chip,
  Grid,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Paper,
  Stack,
  LinearProgress,
  Alert,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { supabase } from '../supabase';
import { getUserData, setUserData, migrateFromLocalStorage, writeContinuityData } from '../utils/userData';
import {
  fetchSiteChecklistProgress,
  resolveSiteChecklistHospitalUuid,
  subscribeToSiteChecklistProgress,
  upsertSiteChecklistTaskProgress,
} from '../utils/siteChecklistProgress';
import ScormPackagesSection from '../components/ScormPackagesSection';
import { sanitizeHtml, stripHtmlToText } from '../components/cohorts/RichTextEditor';
import {
  decodeChecklistEntry,
  isValidHexColor,
  type ChecklistEntryType,
} from '../utils/checklistEntries';

const sectionShellSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  overflow: 'hidden',
} as const;

const DEFAULT_STAGE_PALETTE: Record<'stage1' | 'stage2' | 'stage3' | 'stage4', string> = {
  stage1: '#2196F3',
  stage2: '#4CAF50',
  stage3: '#FF9800',
  stage4: '#9C27B0'
};

interface MilestoneTask {
  id: string;
  text: string;
  completed: boolean;
  links?: { text: string; url: string; }[];
  entry_type?: ChecklistEntryType;
  entry_color?: string;
}

interface MilestoneStage {
  id: string;
  title: string;
  subtitle: string;
  objectives: string[];
  goal: string;
  tasks: MilestoneTask[];
  color_hex?: string | null;
  program_checklist_name?: string | null;
  program_checklist_first_stage?: boolean;
}

// Program checklist types for merge
interface ProgramChecklistLoaded {
  id: string;
  program_id: string;
  name: string;
  show_before_default: boolean;
  stages: Array<{
    id: string;
    checklist_id: string;
    sort_order: number;
    title: string;
    subtitle: string | null;
    color_hex: string | null;
    objectives: string[];
    goal: string | null;
    tasks: Array<{ id: string; stage_id: string; task_id_suffix: string; text_content: string; links: Array<{ text: string; url: string }> }>;
  }>;
}

const MilestonesPage = () => {
  useAuth();
  const { siteId, effectiveUserId, navbarBrandProgramId } = useUserProfile();
  /** Same program id as navbar logo / branding (primary with logo, else membership with logo, etc.). */
  const resolvedProgramId = navbarBrandProgramId;
  const { trackChecklist } = useUsageAnalytics();
  const dataLoadedRef = useRef(false);
  const defaultStagesRef = useRef<MilestoneStage[] | null>(null);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [programChecklists, setProgramChecklists] = useState<ProgramChecklistLoaded[]>([]);
  const [stagePalette, setStagePalette] = useState(DEFAULT_STAGE_PALETTE);
  const hasProgramChecklistStages = programChecklists.some((c) => Array.isArray(c.stages) && c.stages.length > 0);
  const refreshChecklistProgress = useCallback(async (targetHospitalId: string) => {
    if (!targetHospitalId) return;
    try {
      const rows = await fetchSiteChecklistProgress(targetHospitalId);
      const completedByTask: Record<string, boolean> = {};
      rows.forEach((r) => {
        completedByTask[r.task_id] = r.completed;
      });
      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          tasks: stage.tasks.map((task) => ({ ...task, completed: completedByTask[task.id] ?? false })),
        }))
      );
    } catch (err) {
      console.error('[MilestonesPage] checklist progress refresh failed:', err);
    }
  }, []);

  const exportToPDF = () => {
    // Create a simple PDF export using window.print() for now
    // In a production app, you'd use a library like jsPDF or html2pdf
    window.print();
  };

  const exportToExcel = () => {
    // Create CSV export for Excel compatibility
    let csvContent = "Stage,Task,Completed,Description\n";
    
    stages.forEach(stage => {
      stage.tasks.forEach(task => {
        const taskText = stripHtmlToText(task.text || '').replace(/\n/g, ' ').replace(/"/g, '""');
        csvContent += `"${stage.title}","${taskText}","${task.completed ? 'Yes' : 'No'}","${stage.subtitle}"\n`;
      });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'checklist_progress.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const [stages, setStages] = useState<MilestoneStage[]>([
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
          text: 'Share Pediatric Readiness resources with ED leadership:\n• Joint Policy Statement\n• How Pediatric Readiness Saves Lives\n• The National Pediatric Readiness Project Assessment\n• Importance of a PECC', 
          completed: false,
          links: [
            { text: 'Joint Policy Statement', url: 'https://publications.aap.org/pediatrics/article/142/5/e20182459/38608/Pediatric-Readiness-in-the-Emergency-Department' },
            { text: 'How Pediatric Readiness Saves Lives', url: 'https://emscimprovement.center/domains/pediatric-readiness-project/' },
            { text: 'The National Pediatric Readiness Project Assessment', url: 'https://www.pedsready.org/' },
            { text: 'Importance of a PECC', url: 'https://emscimprovement.center/domains/pecc/' }
          ]
        },
        { 
          id: '1.5', 
          text: 'Meet your PRISM mentor (virtual or in-person) and schedule monthly check-ins', 
          completed: false
        },
        { 
          id: '1.6', 
          text: 'Join the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
          completed: false,
          links: [
            { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
          ]
        },
        { 
          id: '1.7', 
          text: 'Review the National Pediatric Readiness Project assessment with your PRISM', 
          completed: false
        },
        { 
          id: '1.8', 
          text: 'Work with your PRISM to attend an in-person PECC training event', 
          completed: false
        },
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
        { 
          id: '1.11', 
          text: 'Communicate to leadership your progress', 
          completed: false
        }
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
        { 
          id: '2.1', 
          text: 'Complete Stage 1 objectives', 
          completed: false
        },
        { 
          id: '2.2', 
          text: 'After completing Stage 1 objectives, re-evaluate your available time commitment to Pediatric Readiness', 
          completed: false
        },
        { 
          id: '2.3', 
          text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
          completed: false,
          links: [
            { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
          ]
        },
        { 
          id: '2.4', 
          text: 'Complete your National Pediatric Readiness Project assessment and review score with your PRISM', 
          completed: false
        },
        { 
          id: '2.5', 
          text: 'Review, prioritize, and address one ongoing gap utilizing resources from ImPACTS with your PRISM', 
          completed: false
        },
        { 
          id: '2.6', 
          text: 'Create a SMART aim goal to address the prioritized gap with support from your PRISM', 
          completed: false
        },
        { 
          id: '2.7', 
          text: 'Schedule your first simulation with an ED team with support from your PRISM', 
          completed: false
        },
        { 
          id: '2.8', 
          text: 'Run and complete your first simulation with support from your PRISM', 
          completed: false
        },
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
        { 
          id: '2.11', 
          text: 'Communicate to leadership your progress', 
          completed: false
        }
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
        { 
          id: '3.1', 
          text: 'Complete Stage 2 objectives', 
          completed: false
        },
        { 
          id: '3.2', 
          text: 'After completing Stage 2 objectives, re-evaluate your available time commitment to Pediatric Readiness', 
          completed: false
        },
        { 
          id: '3.3', 
          text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
          completed: false,
          links: [
            { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
          ]
        },
        { 
          id: '3.4', 
          text: 'Continue addressing prioritized gaps from Stage 2 with virtual support and consultation from your PRISM', 
          completed: false
        },
        { 
          id: '3.5', 
          text: 'Review the "Gap Analysis" tab on your PECC Support Tool with your PRISM', 
          completed: false
        },
        { 
          id: '3.6', 
          text: 'Begin logging activities in your PECC Support Tool', 
          completed: false
        },
        { 
          id: '3.7', 
          text: 'Independently create a SMART aim goal to address ongoing gaps, with consultation and feedback from your PRISM', 
          completed: false
        },
        { 
          id: '3.8', 
          text: 'Schedule and facilitate quarterly simulations with an ED team with virtual support from your PRISM', 
          completed: false,
          links: [
            { text: 'simulations', url: 'https://www.emergencysimbox.com/' }
          ]
        },
        { 
          id: '3.9', 
          text: 'Communicate to leadership your progress', 
          completed: false
        }
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
        { 
          id: '4.1', 
          text: 'Complete Stage 3 objectives', 
          completed: false
        },
        { 
          id: '4.2', 
          text: 'After completing Stage 3 objectives, re-evaluate your available time commitment to Pediatric Readiness', 
          completed: false
        },
        { 
          id: '4.3', 
          text: 'Continue engagement with the ImPACTS Community of Practice and attend or watch the monthly virtual meetings', 
          completed: false,
          links: [
            { text: 'monthly virtual meetings', url: 'https://docs.google.com/spreadsheets/d/1_LFNGpLBj67rx8lOTl5xQFxBUw7gh-JnRzJA1L53R40/edit?gid=0#gid=0' }
          ]
        },
        { 
          id: '4.4', 
          text: 'Review and update the status of the current "Gap Analysis" on your PECC Support Tool', 
          completed: false
        },
        { 
          id: '4.5', 
          text: 'Log monthly activities on your PECC Support Tool', 
          completed: false
        },
        { 
          id: '4.6', 
          text: 'Present your PECC Support Tool snapshots to ED and hospital leadership', 
          completed: false
        },
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
        { 
          id: '4.9', 
          text: 'Fill out the ImPACTS Program Evaluation Survey to share your feedback and indicate interest in becoming a PRISM', 
          completed: false
        }
      ]
    }
  ]);

  // Resolve PECC siteId to hospital_id (UUID) for shared checklist table
  useEffect(() => {
    if (!siteId) {
      setHospitalId(null);
      return;
    }
    (async () => {
      const resolved = await resolveSiteChecklistHospitalUuid(siteId);
      setHospitalId(resolved);
    })();
  }, [siteId]);

  useEffect(() => {
    trackChecklist('view', { checklist_id: 'milestones' });
  }, [trackChecklist]);

  // Capture default stages once for merging with program checklists
  useEffect(() => {
    if (defaultStagesRef.current === null && stages.length > 0 && stages[0]?.id === 'stage1') {
      defaultStagesRef.current = JSON.parse(JSON.stringify(stages));
    }
  }, [stages]);

  // Load program checklists for user's program (primary_program_id or first program_members)
  useEffect(() => {
    if (!resolvedProgramId) {
      setProgramChecklists([]);
      return;
    }
    let mounted = true;
    (async () => {
      const [{ data: list }, { data: visibilitySettings }] = await Promise.all([
        supabase.from('program_checklists').select('*').eq('program_id', resolvedProgramId).order('sort_order'),
        supabase.from('app_settings').select('value').eq('key', 'program_checklist_enabled_overrides').maybeSingle()
      ]);
      const visibilityRaw = (visibilitySettings?.value ?? null) as Record<string, unknown> | null;
      const isEnabled = (checklistId: string) => {
        if (!visibilityRaw || typeof visibilityRaw !== 'object') return true;
        return visibilityRaw[checklistId] !== false;
      };
      const enabledList = (list || []).filter((c: { id: string }) => isEnabled(c.id));
      if (!mounted || !enabledList.length) {
        if (mounted) setProgramChecklists([]);
        return;
      }
      const withStages = await Promise.all(enabledList.map(async (c: ProgramChecklistLoaded) => {
        const { data: stages } = await supabase.from('program_checklist_stages').select('*').eq('checklist_id', c.id).order('sort_order');
        const stagesWithTasks = await Promise.all((stages || []).map(async (s: any) => {
          const { data: tasks } = await supabase.from('program_checklist_tasks').select('*').eq('stage_id', s.id).order('sort_order');
          return { ...s, tasks: tasks || [] };
        }));
        return { ...c, stages: stagesWithTasks };
      }));
      if (mounted) setProgramChecklists(withStages);
    })();
    return () => { mounted = false; };
  }, [resolvedProgramId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'milestone_stage_palette').maybeSingle();
      const saved = (data?.value ?? null) as Record<string, unknown> | null;
      if (!mounted || !saved || typeof saved !== 'object') return;
      setStagePalette({
        stage1: typeof saved.stage1 === 'string' ? saved.stage1 : DEFAULT_STAGE_PALETTE.stage1,
        stage2: typeof saved.stage2 === 'string' ? saved.stage2 : DEFAULT_STAGE_PALETTE.stage2,
        stage3: typeof saved.stage3 === 'string' ? saved.stage3 : DEFAULT_STAGE_PALETTE.stage3,
        stage4: typeof saved.stage4 === 'string' ? saved.stage4 : DEFAULT_STAGE_PALETTE.stage4
      });
    })();
    return () => { mounted = false; };
  }, []);

  // Build merged stages (program before + default + program after) and apply progress
  useEffect(() => {
    const defaultStages = defaultStagesRef.current;
    if (!defaultStages) return;

    const toMilestoneStage = (
      checklist: ProgramChecklistLoaded,
      stage: ProgramChecklistLoaded['stages'][0],
      stageIndex: number
    ): MilestoneStage => ({
      id: stage.id,
      title: stage.title,
      subtitle: stage.subtitle || '',
      objectives: Array.isArray(stage.objectives) ? stage.objectives : [],
      goal: stage.goal || '',
      color_hex: stage.color_hex || null,
      program_checklist_name: checklist.name,
      program_checklist_first_stage: stageIndex === 0,
                tasks: (stage.tasks || []).map((t: { task_id_suffix: string; text_content: string; links?: Array<{ text: string; url: string }> }) => {
                  const decoded = decodeChecklistEntry(t.text_content);
                  return {
                    id: `program:${checklist.id}:${stage.id}.${t.task_id_suffix}`,
                    text: decoded.content,
                    entry_type: decoded.type,
                    entry_color: decoded.color_hex,
                    completed: false,
                    links: t.links || []
                  };
                })
    });

    const before = programChecklists.filter((c) => c.show_before_default).flatMap((c) => c.stages.map((s, i) => toMilestoneStage(c, s, i)));
    const after = programChecklists.filter((c) => !c.show_before_default).flatMap((c) => c.stages.map((s, i) => toMilestoneStage(c, s, i)));
    const merged: MilestoneStage[] = hasProgramChecklistStages ? [...before, ...after] : [...defaultStages];

    setStages(merged);
    if (hospitalId) {
      void refreshChecklistProgress(hospitalId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merges program checklists with default stages; adding stages would loop
  }, [programChecklists, resolvedProgramId, hospitalId, hasProgramChecklistStages, refreshChecklistProgress]);

  // Load checklist from Supabase (shared with Mentor Site Milestones) when hospitalId is set
  // (default stages only when program checklists are not configured for this program).
  useEffect(() => {
    if (!hospitalId || hasProgramChecklistStages) return;
    (async () => {
      await refreshChecklistProgress(hospitalId);
      dataLoadedRef.current = true;
    })();
  }, [hospitalId, hasProgramChecklistStages, refreshChecklistProgress]);

  useEffect(() => {
    if (!hospitalId) return;
    return subscribeToSiteChecklistProgress([hospitalId], () => {
      void refreshChecklistProgress(hospitalId);
    });
  }, [hospitalId, refreshChecklistProgress]);

  const milestonesUserId = effectiveUserId;
  // Load milestone data from user_data when no site/hospital
  useEffect(() => {
    if (!milestonesUserId || hospitalId) return;
    let mounted = true;
    (async () => {
      try {
        let savedStages = await getUserData<MilestoneStage[]>(milestonesUserId, 'milestones');
        if (savedStages == null || !Array.isArray(savedStages)) {
          await migrateFromLocalStorage(milestonesUserId, 'milestones', `milestones_${milestonesUserId}`, (v) => {
            const parsed = Array.isArray(v) ? v : null;
            if (parsed && mounted) applyStages(parsed);
          });
          dataLoadedRef.current = true;
          return;
        }
        if (!mounted) return;
        applyStages(savedStages);
        dataLoadedRef.current = true;
      } catch (err) {
        console.error('Error loading milestones:', err);
        dataLoadedRef.current = true;
      }
    })();
    function applyStages(parsedStages: MilestoneStage[]) {
      // Always treat stored milestones as progress only. This prevents deleted
      // program checklist structures from lingering after checklist changes.
      const completedByTaskId: Record<string, boolean> = {};
      parsedStages.forEach((stage) => {
        stage.tasks.forEach((task) => {
          completedByTaskId[task.id] = Boolean(task.completed);
        });
      });
      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          tasks: stage.tasks.map((task) => ({
            ...task,
            completed: completedByTaskId[task.id] ?? task.completed
          }))
        }))
      );
    }
    return () => { mounted = false; };
  }, [milestonesUserId, hospitalId]);


  const handleTaskToggle = async (stageId: string, taskId: string) => {
    const previousCompleted = Boolean(
      stages.find((s) => s.id === stageId)?.tasks.find((t) => t.id === taskId)?.completed
    );
    const newCompleted = !previousCompleted;
    const stage = stages.find((s) => s.id === stageId);
    const task = stage?.tasks.find((t) => t.id === taskId);
    trackChecklist(newCompleted ? 'task_complete' : 'task_uncomplete', {
      checklist_id: 'milestones',
      stage_id: stageId,
      item_id: taskId,
      name: task?.text?.slice(0, 80),
    });
    const newStages = stages.map((stageRow) =>
      stageRow.id === stageId
        ? {
            ...stageRow,
            tasks: stageRow.tasks.map((taskRow) =>
              taskRow.id === taskId ? { ...taskRow, completed: newCompleted } : taskRow
            ),
          }
        : stageRow
    );

    setStages(newStages);

    if (hospitalId) {
      const { error } = await upsertSiteChecklistTaskProgress(hospitalId, taskId, newCompleted);
      if (error) {
        console.error('Checklist save error:', error);
        setStages((prev) =>
          prev.map((stageRow) =>
            stageRow.id === stageId
              ? {
                  ...stageRow,
                  tasks: stageRow.tasks.map((taskRow) =>
                    taskRow.id === taskId ? { ...taskRow, completed: previousCompleted } : taskRow
                  ),
                }
              : stageRow
          )
        );
        return;
      }
      if (milestonesUserId) {
        void writeContinuityData(hospitalId, milestonesUserId, 'milestones', newStages);
      }
    }
    if (!hospitalId && milestonesUserId) setUserData(milestonesUserId, 'milestones', newStages);
  };

  const theme = useTheme();

  const getStageProgress = (stage: MilestoneStage) => {
    const taskRows = stage.tasks.filter((task) => (task.entry_type || 'task') === 'task');
    const completedTasks = taskRows.filter(task => task.completed).length;
    const totalTasks = taskRows.length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { completedTasks, totalTasks, percentage };
  };

  const getStageColor = (s: MilestoneStage) => {
    if (s.color_hex) return s.color_hex;
    switch (s.id) {
      case 'stage1': return stagePalette.stage1;
      case 'stage2': return stagePalette.stage2;
      case 'stage3': return stagePalette.stage3;
      case 'stage4': return stagePalette.stage4;
      default: return stagePalette.stage1;
    }
  };

  const overallProgress = useMemo(() => {
    let completedTasks = 0;
    let totalTasks = 0;
    stages.forEach((stage) => {
      const p = getStageProgress(stage);
      completedTasks += p.completedTasks;
      totalTasks += p.totalTasks;
    });
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return { completedTasks, totalTasks, percentage };
  }, [stages]);

  const stageProgressRows = useMemo(
    () =>
      stages.map((stage) => ({
        stage,
        progress: getStageProgress(stage),
        color: getStageColor(stage),
      })),
    [stages, stagePalette]
  );

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 4, md: 5 } }}>
      <Container
        maxWidth={false}
        sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4, lg: 5 }, width: '100%' }}
      >
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {/* Hero */}
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
              <Box sx={{ maxWidth: { md: 720 } }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
                >
                  PECC milestones
                </Typography>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    letterSpacing: -0.02,
                    mb: 0.75,
                    fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
                  }}
                >
                  Checklist
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: { xs: '0.925rem', sm: '0.975rem' } }}>
                  Track progress through staged PECC milestones—from foundational learning with your PRISM mentor through
                  sustained pediatric readiness leadership.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Button size="small" variant="outlined" startIcon={<TableChartIcon />} onClick={exportToExcel}>
                  Excel
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  startIcon={<PictureAsPdfIcon />}
                  onClick={exportToPDF}
                >
                  PDF
                </Button>
              </Stack>
            </Box>
          </Paper>

          {hasProgramChecklistStages && (
            <Alert severity="info" variant="outlined" icon={false} sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.04) }}>
              Checklist stage and task content for this page is managed in Program Checklists.
            </Alert>
          )}

          {/* At a glance */}
          <Paper elevation={0} sx={sectionShellSx}>
            <Box
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.secondary.main, 0.04),
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
              >
                At a glance
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Overall completion across all checklist stages
              </Typography>
            </Box>
            <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
              {overallProgress.totalTasks > 0 ? (
                <>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={0.75}
                    sx={{ mb: 0.75 }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Overall
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {overallProgress.completedTasks} of {overallProgress.totalTasks} · {overallProgress.percentage}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={overallProgress.percentage}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      mb: 2,
                      bgcolor: alpha(theme.palette.secondary.main, 0.12),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: 'secondary.main',
                      },
                    }}
                  />
                  <Stack spacing={1.25}>
                    {stageProgressRows.map(({ stage, progress, color }) => (
                      <Box key={stage.id}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.35 }} spacing={1}>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: color,
                                flexShrink: 0,
                              }}
                              aria-hidden
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {stage.title}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {progress.completedTasks}/{progress.totalTasks || 0} · {progress.percentage}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={progress.percentage}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha(color, 0.15),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                              bgcolor: color,
                            },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No checklist tasks yet.
                </Typography>
              )}
            </Box>
          </Paper>

          <Box sx={{ '& > .MuiCard-root': { mt: 0 } }}>
            <ScormPackagesSection title="Checklist learning modules" placement="checklist" />
          </Box>

          {/* Stages */}
          <Stack spacing={1.5}>
            {stages.map((stage, stageIndex) => {
              const progress = getStageProgress(stage);
              const stageColor = getStageColor(stage);

              return (
                <Box key={stage.id}>
                  {stage.program_checklist_first_stage && stage.program_checklist_name && (
                    <Box sx={{ mb: 1.25, mt: stageIndex === 0 ? 0 : 1 }}>
                      <Typography
                        variant="overline"
                        sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
                      >
                        {stage.program_checklist_name} Checklist
                      </Typography>
                    </Box>
                  )}
                  <Accordion
                    disableGutters
                    elevation={0}
                    sx={{
                      ...sectionShellSx,
                      '&:before': { display: 'none' },
                      borderLeft: '4px solid',
                      borderLeftColor: stageColor,
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
                      sx={{
                        px: { xs: 1.5, md: 2 },
                        py: 0.5,
                        minHeight: 56,
                        bgcolor: alpha(stageColor, 0.06),
                        '&:hover': { bgcolor: alpha(stageColor, 0.1) },
                        '& .MuiAccordionSummary-content': {
                          my: 1.25,
                          alignItems: 'center',
                          gap: 1.5,
                          flexWrap: 'wrap',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          flexWrap: 'wrap',
                          pr: 1,
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              letterSpacing: -0.015,
                              fontSize: { xs: '1rem', sm: '1.1rem' },
                              color: 'text.primary',
                            }}
                          >
                            {stage.title}
                          </Typography>
                          {stage.subtitle && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}
                            >
                              {stage.subtitle}
                            </Typography>
                          )}
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip
                            size="small"
                            label={`${progress.percentage}%`}
                            sx={{
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              bgcolor: alpha(stageColor, 0.12),
                              color: stageColor,
                              border: '1px solid',
                              borderColor: alpha(stageColor, 0.35),
                            }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontVariantNumeric: 'tabular-nums', display: { xs: 'none', sm: 'block' } }}
                          >
                            {progress.completedTasks} of {progress.totalTasks} tasks
                          </Typography>
                        </Stack>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ px: { xs: 1.5, md: 2.5 }, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      {stage.objectives.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography
                            variant="overline"
                            sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.75 }}
                          >
                            Objectives
                          </Typography>
                          <Grid container spacing={0.75}>
                            {stage.objectives.map((objective, idx) => (
                              <Grid item xs={12} key={idx}>
                                <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'text.secondary' }}>
                                  • {objective}
                                </Typography>
                              </Grid>
                            ))}
                          </Grid>
                        </Box>
                      )}

                      {stage.goal && (
                        <Box
                          sx={{
                            mb: 2,
                            px: 1.5,
                            py: 1.25,
                            borderRadius: 1.5,
                            bgcolor: alpha(theme.palette.secondary.main, 0.04),
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.dark', textTransform: 'uppercase', letterSpacing: 0.04 }}>
                            Goal
                          </Typography>
                          <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.35, lineHeight: 1.5 }}>
                            {stage.goal}
                          </Typography>
                        </Box>
                      )}

                      <Divider sx={{ my: 1.5 }} />

                      <Typography
                        variant="overline"
                        sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 1 }}
                      >
                        Tasks
                      </Typography>

                      <Box>
                        {stage.tasks.map((task) => {
                          const entryType = task.entry_type || 'task';
                          if (entryType !== 'task') {
                            const accentColor = task.entry_color && isValidHexColor(task.entry_color) ? task.entry_color : stageColor;
                            const accentBackground = `${accentColor}1A`;
                            return (
                              <Box
                                key={task.id}
                                sx={{
                                  my: 1,
                                  px: 1.25,
                                  py: entryType === 'divider' ? 0.75 : 1,
                                  borderRadius: 1,
                                  borderLeft: entryType === 'subnote' ? '3px solid' : undefined,
                                  borderColor: entryType === 'subnote' ? accentColor : undefined,
                                  bgcolor:
                                    entryType === 'banner'
                                      ? accentBackground
                                      : entryType === 'footnote'
                                        ? alpha(theme.palette.primary.main, 0.04)
                                        : entryType === 'subnote'
                                          ? accentBackground
                                          : 'transparent'
                                }}
                              >
                                {entryType === 'divider' && <Divider sx={{ mb: 1 }} />}
                                <Box
                                  sx={{
                                    fontSize: '0.9rem',
                                    '& p': { my: 0.25 },
                                    '& ul, & ol': { my: 0.25, pl: 2.5 }
                                  }}
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.text) }}
                                />
                              </Box>
                            );
                          }
                          return (
                            <FormControlLabel
                              key={task.id}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={task.completed}
                                  onChange={() => handleTaskToggle(stage.id, task.id)}
                                  sx={{
                                    color: alpha(stageColor, 0.55),
                                    '&.Mui-checked': { color: stageColor },
                                  }}
                                />
                              }
                              label={
                                <Typography
                                  variant="body2"
                                  component="span"
                                  sx={{
                                    textDecoration: task.completed ? 'line-through' : 'none',
                                    color: task.completed ? 'text.secondary' : 'text.primary',
                                    fontWeight: 500,
                                    whiteSpace: 'pre-line',
                                    lineHeight: 1.45,
                                    '& p': { my: 0.25 },
                                    '& ul, & ol': { my: 0.25, pl: 2.5 }
                                  }}
                                >
                                  {task.text && task.text.includes('<') ? (
                                    <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.text) }} />
                                  ) : task.links && task.links.length > 0 ? (
                                    (() => {
                                      let result = task.text;
                                      const elements: React.ReactNode[] = [];
                                      let lastIndex = 0;

                                      task.links.forEach((link, index) => {
                                        const linkIndex = result.indexOf(link.text, lastIndex);
                                        if (linkIndex !== -1) {
                                          if (linkIndex > lastIndex) {
                                            elements.push(result.slice(lastIndex, linkIndex));
                                          }
                                          elements.push(
                                            <Box
                                              key={index}
                                              component="a"
                                              href={link.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              sx={{
                                                color: 'secondary.dark',
                                                textDecoration: 'underline',
                                                cursor: 'pointer',
                                                '&:hover': { textDecoration: 'underline', opacity: 0.8 }
                                              }}
                                            >
                                              {link.text}
                                            </Box>
                                          );
                                          lastIndex = linkIndex + link.text.length;
                                        }
                                      });
                                      if (lastIndex < result.length) {
                                        elements.push(result.slice(lastIndex));
                                      }
                                      return elements.length > 0 ? elements : result;
                                    })()
                                  ) : (
                                    task.text
                                  )}
                                </Typography>
                              }
                              sx={{
                                display: 'flex',
                                margin: 0,
                                mb: 0.25,
                                py: 0.35,
                                px: 0.5,
                                borderRadius: 1,
                                width: '100%',
                                alignItems: 'flex-start',
                                '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.03) },
                                '& .MuiFormControlLabel-label': {
                                  marginLeft: 0.5,
                                  flex: 1,
                                  display: 'flex',
                                  alignItems: 'center'
                                },
                                '& .MuiCheckbox-root': {
                                  alignSelf: 'flex-start',
                                  marginTop: '1px',
                                  padding: '4px'
                                }
                              }}
                            />
                          );
                        })}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default MilestonesPage;
