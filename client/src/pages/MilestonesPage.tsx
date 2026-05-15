import React, { useState, useEffect, useRef } from 'react';
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
  Button
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { supabase } from '../supabase';
import { getUserData, setUserData, migrateFromLocalStorage, writeContinuityData } from '../utils/userData';
import ScormPackagesSection from '../components/ScormPackagesSection';
import { sanitizeHtml, stripHtmlToText } from '../components/cohorts/RichTextEditor';

type ChecklistEntryType = 'task' | 'banner' | 'footnote' | 'subnote' | 'divider';
const DEFAULT_STAGE_PALETTE: Record<'stage1' | 'stage2' | 'stage3' | 'stage4', string> = {
  stage1: '#2196F3',
  stage2: '#4CAF50',
  stage3: '#FF9800',
  stage4: '#9C27B0'
};

function decodeEntry(text: string): { type: ChecklistEntryType; content: string } {
  const m = String(text || '').match(/^\[\[ENTRY:(task|banner|footnote|subnote|divider)\]\]/i);
  if (!m) return { type: 'task', content: text || '' };
  const type = m[1].toLowerCase() as ChecklistEntryType;
  return { type, content: String(text || '').slice(m[0].length) };
}

interface MilestoneTask {
  id: string;
  text: string;
  completed: boolean;
  links?: { text: string; url: string; }[];
  entry_type?: ChecklistEntryType;
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
      const { data } = await supabase
        .from('hospitals')
        .select('id')
        .or(`id.eq.${siteId},facility_id.eq.${siteId}`)
        .limit(1)
        .maybeSingle();
      setHospitalId(data?.id ?? null);
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
      tasks: (stage.tasks || []).map((t: { task_id_suffix: string; text_content: string; links?: Array<{ text: string; url: string }> }) => ({
        id: `program:${checklist.id}:${stage.id}.${t.task_id_suffix}`,
        text: decodeEntry(t.text_content).content,
        entry_type: decodeEntry(t.text_content).type,
        completed: false,
        links: t.links || []
      }))
    });

    const before = programChecklists.filter((c) => c.show_before_default).flatMap((c) => c.stages.map((s, i) => toMilestoneStage(c, s, i)));
    const after = programChecklists.filter((c) => !c.show_before_default).flatMap((c) => c.stages.map((s, i) => toMilestoneStage(c, s, i)));
    const merged: MilestoneStage[] = hasProgramChecklistStages ? [...before, ...after] : [...defaultStages];

    setStages(merged);
    if (hospitalId) {
      supabase.from('site_checklist_progress').select('task_id, completed').eq('hospital_id', hospitalId).then(({ data: rows }) => {
        const completedByTask: Record<string, boolean> = {};
        (rows || []).forEach((r: { task_id: string; completed: boolean }) => { completedByTask[r.task_id] = r.completed; });
        setStages((prev) => prev.map((stage) => ({
          ...stage,
          tasks: stage.tasks.map((task) => ({ ...task, completed: completedByTask[task.id] ?? task.completed }))
        })));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- merges program checklists with default stages; adding stages would loop
  }, [programChecklists, resolvedProgramId, hospitalId, hasProgramChecklistStages]);

  // Load checklist from Supabase (shared with Mentor Site Milestones) when hospitalId is set
  // (default stages only when program checklists are not configured for this program).
  useEffect(() => {
    if (!hospitalId || hasProgramChecklistStages) return;
    (async () => {
      const { data: rows } = await supabase
        .from('site_checklist_progress')
        .select('task_id, completed')
        .eq('hospital_id', hospitalId);
      if (rows && rows.length > 0) {
        const completedByTask: Record<string, boolean> = {};
        rows.forEach((r: { task_id: string; completed: boolean }) => { completedByTask[r.task_id] = r.completed; });
        setStages(prev => prev.map(stage => ({
          ...stage,
          tasks: stage.tasks.map(task => ({
            ...task,
            completed: completedByTask[task.id] ?? task.completed
          }))
        })));
      }
      dataLoadedRef.current = true;
    })();
  }, [hospitalId, hasProgramChecklistStages]);

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


  const handleTaskToggle = (stageId: string, taskId: string) => {
    const newCompleted = !stages.find(s => s.id === stageId)?.tasks.find(t => t.id === taskId)?.completed;
    const stage = stages.find(s => s.id === stageId);
    const task = stage?.tasks.find(t => t.id === taskId);
    trackChecklist(newCompleted ? 'task_complete' : 'task_uncomplete', { checklist_id: 'milestones', stage_id: stageId, item_id: taskId, name: task?.text?.slice(0, 80) });
    const newStages = stages.map(stage => 
      stage.id === stageId 
        ? {
            ...stage,
            tasks: stage.tasks.map(task => 
              task.id === taskId 
                ? { ...task, completed: newCompleted }
                : task
            )
          }
        : stage
    );
    
    // Update state
    setStages(newStages);
    
    if (hospitalId) {
      supabase
        .from('site_checklist_progress')
        .upsert({
          hospital_id: hospitalId,
          task_id: taskId,
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'hospital_id,task_id' })
        .then(({ error }) => { if (error) console.error('Checklist save error:', error); });
      if (milestonesUserId) {
        void writeContinuityData(hospitalId, milestonesUserId, 'milestones', newStages);
      }
    }
    if (!hospitalId && milestonesUserId) setUserData(milestonesUserId, 'milestones', newStages);
  };

  const getStageProgress = (stage: MilestoneStage) => {
    const taskRows = stage.tasks.filter((task) => (task.entry_type || 'task') === 'task');
    const completedTasks = taskRows.filter(task => task.completed).length;
    const totalTasks = taskRows.length || 1;
    const percentage = Math.round((completedTasks / totalTasks) * 100);
    return { completedTasks, totalTasks, percentage };
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom color="primary">
        Step-by-Step Task Checklist
      </Typography>
      
      <Typography variant="h6" gutterBottom sx={{ mb: 4, color: 'text.secondary' }}>
        Use this checklist to track your progress through the stages.
      </Typography>
      
      <Typography variant="body1" paragraph sx={{ mb: 4, lineHeight: 1.6 }}>
        This staged approach is designed to guide Pediatric Emergency Care Coordinators (PECCs) in strengthening Pediatric Readiness through mentorship, simulation, and continuous quality improvement. At each stage, PECCs are supported by a Pediatric Readiness Improvement & Simulation Mentor (PRISM), who provides tailored guidance from foundational learning to sustained leadership.
      </Typography>
      {hasProgramChecklistStages && (
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Checklist stage and task content for this page is managed in Program Checklists.
        </Typography>
      )}

      {/* Export Buttons */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<TableChartIcon />}
          onClick={exportToExcel}
          sx={{ borderColor: 'success.main', color: 'success.main', '&:hover': { borderColor: 'success.dark', bgcolor: 'success.light' } }}
        >
          Export to Excel
        </Button>
        <Button
          variant="contained"
          startIcon={<PictureAsPdfIcon />}
          onClick={exportToPDF}
          sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
        >
          Export to PDF
        </Button>
      </Box>
      
      <ScormPackagesSection title="Checklist learning modules" placement="checklist" />

      {stages.map((stage) => {
        const progress = getStageProgress(stage);
        
        // Define unique colors for each stage header
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
        
        return (
          <Box key={stage.id}>
            {stage.program_checklist_first_stage && stage.program_checklist_name && (
              <Box sx={{ mt: 2.5, mb: 1.25 }}>
                <Divider sx={{ mb: 1 }} />
                <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
                  {stage.program_checklist_name} Checklist
                </Typography>
              </Box>
            )}
          <Accordion sx={{ mb: 2, boxShadow: 2 }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                bgcolor: getStageColor(stage),
                color: 'white',
                '&:hover': {
                  bgcolor: getStageColor(stage),
                  opacity: 0.9
                }
              }}
            >
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h4" fontWeight="bold" color="white">
                  {stage.title}
                </Typography>
                
                {/* Progress */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip 
                    label={`${progress.percentage}% Complete`}
                    color="primary"
                    variant="outlined"
                    sx={{ 
                      bgcolor: 'white', 
                      color: getStageColor(stage),
                      borderColor: 'white',
                      '& .MuiChip-label': { color: getStageColor(stage) }
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'white' }}>
                    {progress.completedTasks} of {progress.totalTasks} tasks completed
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>
            
            <AccordionDetails sx={{ p: 3 }}>
              {/* Objectives */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom color="primary" sx={{ fontWeight: 500 }}>
                  Objectives:
                </Typography>
                <Grid container spacing={1}>
                  {stage.objectives.map((objective, idx) => (
                    <Grid item xs={12} key={idx}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                          • {objective}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
              
              {/* Goal */}
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="h6" color="primary" sx={{ display: 'inline' }}>
                  Goal:&nbsp;
                </Typography>
                <Typography variant="body1" sx={{ fontStyle: 'italic', display: 'inline' }}>
                  {stage.goal}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Tasks */}
              <Typography variant="h6" gutterBottom color="primary">
                Step-by-Step Task Checklist:
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                {stage.tasks.map((task) => {
                  const entryType = task.entry_type || 'task';
                  if (entryType !== 'task') {
                    return (
                      <Box
                        key={task.id}
                        sx={{
                          my: 1.25,
                          px: 1.25,
                          py: entryType === 'divider' ? 0.75 : 1,
                          borderLeft: entryType === 'subnote' ? '3px solid' : undefined,
                          borderColor: entryType === 'subnote' ? 'warning.main' : undefined,
                          bgcolor:
                            entryType === 'banner'
                              ? 'info.light'
                              : entryType === 'footnote'
                                ? 'grey.100'
                                : 'transparent'
                        }}
                      >
                        {entryType === 'divider' && <Divider sx={{ mb: 1 }} />}
                        <Box
                          sx={{
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
                          checked={task.completed}
                          onChange={() => handleTaskToggle(stage.id, task.id)}
                        />
                      }
                      label={
                        <Typography
                          variant="body1"
                          component="span"
                          sx={{
                            textDecoration: task.completed ? 'line-through' : 'none',
                            color: task.completed ? 'text.secondary' : 'text.primary',
                            fontWeight: 500,
                            whiteSpace: 'pre-line',
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
                                        color: 'primary.main',
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
                        mb: 0.5,
                        width: '100%',
                        alignItems: 'center',
                        '& .MuiFormControlLabel-label': {
                          marginLeft: 1,
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center'
                        },
                        '& .MuiCheckbox-root': {
                          alignSelf: 'flex-start',
                          marginTop: '2px'
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
    </Container>
  );
};
  
  export default MilestonesPage;
