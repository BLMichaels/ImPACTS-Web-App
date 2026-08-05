import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Chip,
  LinearProgress,
  ButtonGroup,
  Divider
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Visibility as ViewIcon,
  Business as BusinessIcon,
  VisibilityOff as HideIcon,
  Visibility as ShowIcon
} from '@mui/icons-material';

import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';
import { alpha } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useNavigate } from 'react-router-dom';
import { useMentorWorkRoutes } from '../../hooks/useMentorWorkRoutes';
import { useUsageAnalytics } from '../../context/UsageAnalyticsContext';
import { supabase } from '../../supabase';
import {
  getUserData,
  setUserData,
  mapSiteRefsToHospitalRowIds,
  batchGetHospitalDataForKey,
  shouldMirrorLegacyUserData,
} from '../../utils/userData';
import { fetchMergedMentorHospitals } from '../../utils/mentorHospitalScope';
import { buildPeccHospitalFacilityOrClause } from '../../utils/mentorHospitalAssignments';
import {
  resolvePeccsForMentorHospital,
  type MentorContactLike,
  type PeccUserLike,
} from '../../utils/mentorPeccHospitalMatch';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';
import { DEFAULT_SITE_CHECKLIST_STAGES } from '../../data/defaultSiteChecklist';
import { sanitizeHtml, stripHtmlToText } from '../../components/cohorts/RichTextEditor';
import {
  decodeChecklistEntry,
  isValidHexColor,
  type ChecklistEntryType,
} from '../../utils/checklistEntries';
import {
  completedByTaskMap,
  fetchSiteChecklistProgress,
  subscribeToSiteChecklistProgress,
  upsertSiteChecklistTaskProgress,
  upsertSiteChecklistTasksProgress,
} from '../../utils/siteChecklistProgress';

// Interfaces matching MilestonesPage
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

const isActionableChecklistTask = (task: MilestoneTask) => (task.entry_type ?? 'task') === 'task';

type MilestoneTableRow =
  | { type: 'checklist_header'; checklistName: string }
  | { type: 'stage'; stageId: string; stageTitle: string; stage: MilestoneStage }
  | { type: 'task'; stageId: string; taskId: string; task: MilestoneTask }
  | { type: 'entry'; stageId: string; task: MilestoneTask }
  | { type: 'completion'; stageId: string; stageTitle: string; stage: MilestoneStage };

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
  peccDisplayName?: string;
  fullSiteAccessApproved?: boolean;
}

interface StageCompletion {
  completed: boolean;
  completionDate: string | null;
}

interface HospitalMilestones {
  hospitalId: string;
  defaultStages: MilestoneStage[];
  checklistStages: Record<string, { name: string; stages: MilestoneStage[] }>;
  stageCompletions: Record<string, StageCompletion>;
}

type MentorContactRecord = MentorContactLike;

const STIPEND_PER_STAGE = 200;
const isUuidText = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const DEFAULT_STAGES: MilestoneStage[] = DEFAULT_SITE_CHECKLIST_STAGES.map((stage) => ({
  id: stage.id,
  title: stage.title,
  subtitle: '',
  objectives: [],
  goal: '',
  tasks: stage.tasks.map((task) => ({
    id: task.id,
    text: task.text,
    completed: false,
    ...(task.links ? { links: task.links } : {}),
  })),
}));

const richTextSx = {
  fontSize: '0.8rem',
  lineHeight: 1.45,
  '& p': { my: 0.25 },
  '& ul, & ol': { my: 0.35, pl: 2.25 },
  '& strong': { fontWeight: 600 },
};

const renderRichContent = (htmlOrText: string, sx?: Record<string, unknown>) => {
  if (htmlOrText.includes('<')) {
    return (
      <Box
        sx={{ ...richTextSx, ...sx }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlOrText) }}
      />
    );
  }
  return (
    <Typography variant="body2" sx={{ ...richTextSx, ...sx }} component="div">
      {htmlOrText}
    </Typography>
  );
};

const renderTaskLabel = (task: MilestoneTask) => {
  if (task.text && task.text.includes('<')) {
    return renderRichContent(task.text, { fontWeight: 500 });
  }
  if (!task.links || task.links.length === 0) {
    return (
      <Typography variant="body2" sx={{ ...richTextSx, fontWeight: 500 }}>
        {task.text}
      </Typography>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  task.links.forEach((link, idx) => {
    const linkIndex = task.text.indexOf(link.text, lastIndex);
    if (linkIndex !== -1) {
      if (linkIndex > lastIndex) parts.push(task.text.substring(lastIndex, linkIndex));
      parts.push(
        <Link
          key={idx}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ fontSize: '0.8rem', fontWeight: 500 }}
        >
          {link.text}
        </Link>
      );
      lastIndex = linkIndex + link.text.length;
    }
  });
  if (lastIndex < task.text.length) parts.push(task.text.substring(lastIndex));

  return (
    <Typography variant="body2" sx={{ ...richTextSx, fontWeight: 500 }}>
      {parts}
    </Typography>
  );
};

const renderDecorativeEntry = (task: MilestoneTask, stageColor: string) => {
  const entryType = task.entry_type ?? 'task';
  const accent =
    task.entry_color && isValidHexColor(task.entry_color) ? task.entry_color : stageColor;
  const accentBg = `${accent}14`;

  if (entryType === 'divider') {
    return (
      <Box sx={{ py: 0.75 }}>
        <Divider sx={{ borderColor: 'divider' }} />
      </Box>
    );
  }

  if (entryType === 'banner') {
    return (
      <Box
        sx={{
          px: 1.25,
          py: 1,
          borderRadius: 1,
          bgcolor: accentBg,
          borderLeft: `4px solid ${accent}`,
        }}
      >
        {renderRichContent(task.text, { fontWeight: 700, color: accent })}
      </Box>
    );
  }

  if (entryType === 'subnote') {
    return (
      <Box
        sx={{
          pl: 1.5,
          py: 0.75,
          borderLeft: `3px solid ${accent}`,
          bgcolor: accentBg,
          borderRadius: '0 4px 4px 0',
        }}
      >
        {renderRichContent(task.text, { fontWeight: 600, color: 'text.primary' })}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: 1,
        py: 0.65,
        bgcolor: 'grey.50',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      {renderRichContent(task.text, {
        fontSize: '0.72rem',
        color: 'text.secondary',
        fontStyle: 'italic',
      })}
    </Box>
  );
};

const formatStageLabel = (stage: MilestoneStage) => stripHtmlToText(stage.title || '').trim() || 'Stage';

const MentorSiteMilestonesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { effectiveUserId, enterViewAsUser } = useUserProfile();
  const navigate = useNavigate();
  const mentorRoutes = useMentorWorkRoutes();
  const { trackChecklist } = useUsageAnalytics();

  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalMilestones, setHospitalMilestones] = useState<Record<string, HospitalMilestones>>({});
  const [hospitalMetrics, setHospitalMetrics] = useState<Record<string, HospitalMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [hospitalMenuAnchor, setHospitalMenuAnchor] = useState<{ el: HTMLElement; hospitalId: string } | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<{ hospitalId: string; stageId: string } | null>(null);
  const [completionDate, setCompletionDate] = useState<Date | null>(null);
  const [hiddenHospitals, setHiddenHospitals] = useState<Set<string>>(new Set());
  const [selectedChecklistKey, setSelectedChecklistKey] = useState<string>('default');
  const [hospitalChecklistIds, setHospitalChecklistIds] = useState<Record<string, string>>({});
  const [progressVersion, setProgressVersion] = useState(0);
  const [stagePalette, setStagePalette] = useState<Record<'stage1' | 'stage2' | 'stage3' | 'stage4', string>>({
    stage1: '#2196F3',
    stage2: '#4CAF50',
    stage3: '#FF9800',
    stage4: '#9C27B0'
  });

  const uid = effectiveUserId ?? currentUser?.id;
  const PECC_FULL_SITE_APPROVAL_KEY = 'pecc_allow_manager_mentor_full_view';
  const getChecklistIdFromKey = useCallback((checklistKey: string) => {
    return checklistKey.startsWith('program:') ? checklistKey.slice('program:'.length) : null;
  }, []);
  const getStagesForChecklist = useCallback((hospitalData: HospitalMilestones | undefined, checklistKey: string): MilestoneStage[] | null => {
    if (!hospitalData) return null;
    const checklistId = getChecklistIdFromKey(checklistKey);
    if (!checklistId) return hospitalData.defaultStages;
    return hospitalData.checklistStages[checklistId]?.stages ?? null;
  }, [getChecklistIdFromKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'milestone_stage_palette').maybeSingle();
      const saved = (data?.value ?? null) as Record<string, unknown> | null;
      if (!mounted || !saved || typeof saved !== 'object') return;
      setStagePalette({
        stage1: typeof saved.stage1 === 'string' ? saved.stage1 : '#2196F3',
        stage2: typeof saved.stage2 === 'string' ? saved.stage2 : '#4CAF50',
        stage3: typeof saved.stage3 === 'string' ? saved.stage3 : '#FF9800',
        stage4: typeof saved.stage4 === 'string' ? saved.stage4 : '#9C27B0'
      });
    })();
    return () => { mounted = false; };
  }, []);
  // Load hospitals: mentor_hospital_assignments + mentorHospitals (user_data); hidden/order from user_data
  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    (async () => {
      let savedHospitals = await getUserData<any[]>(uid, 'mentorHospitals');
      if (savedHospitals == null) {
        try {
          const raw = localStorage.getItem(`mentorHospitals_${uid}`);
          if (raw) {
            savedHospitals = JSON.parse(raw);
            if (Array.isArray(savedHospitals)) {
              await setUserData(uid, 'mentorHospitals', savedHospitals);
              localStorage.removeItem(`mentorHospitals_${uid}`);
            }
          }
        } catch {}
      }
      const savedHidden = await getUserData<string[]>(uid, 'mentorHiddenHospitals');
      const savedOrder = await getUserData<string[]>(uid, 'mentorHospitalOrder');
      const storedById = new Map((Array.isArray(savedHospitals) ? savedHospitals : []).map((h: any) => [String(h.id), h]));

      let workingHospitals: Hospital[] = [];
      try {
        const merged = await fetchMergedMentorHospitals(uid);
        workingHospitals = merged
          .map((m) => {
            const s = storedById.get(m.hospital.id);
            if (s && s.isWorkingWith === false) return null;
            const rowId = String(m.hospital.id);
            const fac = String(m.hospital.facility_id ?? m.hospital.id);
            return {
              id: rowId,
              name: normalizeHospitalOrOrgName(String(s?.name ?? m.hospital.name ?? '')),
              facilityId: fac,
              siteId: fac,
              isWorkingWith: s?.isWorkingWith !== false
            } as Hospital;
          })
          .filter((h): h is Hospital => h != null);
      } catch {
        if (savedHospitals != null && Array.isArray(savedHospitals)) {
          workingHospitals = savedHospitals
            .filter((h: any) => h.isWorkingWith !== false)
            .map((h: any) => ({
              id: String(h.id),
              name: normalizeHospitalOrOrgName(String(h.name ?? '')),
              facilityId: String(h.id),
              siteId: String(h.id),
              isWorkingWith: Boolean(h.isWorkingWith)
            })) as Hospital[];
        }
      }

      if (!mounted) return;
      if (savedOrder && Array.isArray(savedOrder) && workingHospitals.length > 0) {
        const ordered = savedOrder.map((id) => workingHospitals.find((h) => h.id === id)).filter((h): h is Hospital => Boolean(h));
        const remaining = workingHospitals.filter((h) => !savedOrder.includes(h.id));
        workingHospitals = [...ordered, ...remaining];
      }
      setHospitals(workingHospitals);
      if (savedHidden != null && Array.isArray(savedHidden)) setHiddenHospitals(new Set(savedHidden));
    })();
    return () => { mounted = false; };
  }, [uid]);

  const toggleHospitalVisibility = async (hospitalId: string) => {
    const newHidden = new Set(hiddenHospitals);
    if (newHidden.has(hospitalId)) newHidden.delete(hospitalId);
    else newHidden.add(hospitalId);
    setHiddenHospitals(newHidden);
    if (uid) await setUserData(uid, 'mentorHiddenHospitals', Array.from(newHidden));
  };

  // Load milestones for each hospital's PECC(s)
  useEffect(() => {
    const loadMilestones = async () => {
      if (!(effectiveUserId ?? currentUser?.id) || hospitals.length === 0) {
        setLoading(false);
        return;
      }

      const mentorDataUserId = uid!;
      const milestones: Record<string, HospitalMilestones> = {};
      const metrics: Record<string, HospitalMetrics> = {};
      const canonicalIdsByHospital: Record<string, string> = {};

      const hospitalRefLists = hospitals.flatMap((h) => [h.id, h.facilityId].filter(Boolean) as string[]);
      const hospitalRefToRowId = await mapSiteRefsToHospitalRowIds(hospitalRefLists);
      const canonHospitalIdsForData = [
        ...new Set(
          hospitals
            .map((h) => hospitalRefToRowId.get(h.id) || (h.facilityId ? hospitalRefToRowId.get(h.facilityId) : undefined))
            .filter((x): x is string => Boolean(x))
        ),
      ];
      const [hospitalActivitiesMap, hospitalReadinessMap] = await Promise.all([
        batchGetHospitalDataForKey<unknown[]>(canonHospitalIdsForData, 'activities'),
        batchGetHospitalDataForKey<unknown[]>(canonHospitalIdsForData, 'readinessScores'),
      ]);
      const mentorContacts = (await getUserData<MentorContactRecord[]>(mentorDataUserId, 'mentorContacts')) || [];
      const { data: mentorLinkedPeccRows } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, mentor_id, hospital_facility_id')
        .eq('role', 'pecc')
        .eq('mentor_id', mentorDataUserId);
      const mentorLinkedPeccs = (mentorLinkedPeccRows || []) as PeccUserLike[];
      const mentorLinkedPeccIds = mentorLinkedPeccs.map((p) => p.id).filter(Boolean);
      let programIdsFromMentorPeccs: string[] = [];
      if (mentorLinkedPeccIds.length > 0) {
        const [{ data: mentorPeccPrograms }, { data: mentorPeccProfiles }] = await Promise.all([
          supabase
            .from('program_members')
            .select('program_id')
            .in('user_id', mentorLinkedPeccIds)
            .eq('status', 'active'),
          supabase.from('users').select('id, primary_program_id').in('id', mentorLinkedPeccIds),
        ]);
        programIdsFromMentorPeccs = [
          ...new Set([
            ...((mentorPeccPrograms || []) as Array<{ program_id?: string | null }>)
              .map((row) => String(row.program_id || '').trim())
              .filter(Boolean),
            ...((mentorPeccProfiles || []) as Array<{ primary_program_id?: string | null }>)
              .map((row) => String(row.primary_program_id || '').trim())
              .filter(Boolean),
          ]),
        ];
      }
      const { data: allPrograms } = await supabase.from('programs').select('id, name');
      const programNameToId = new Map(
        ((allPrograms || []) as Array<{ id: string; name?: string | null }>)
          .map((p) => [String(p.name || '').trim().toLowerCase(), String(p.id || '').trim()] as [string, string])
          .filter(([name, id]) => Boolean(name && id))
      );
      const { data: visibilitySettings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'program_checklist_enabled_overrides')
        .maybeSingle();
      const visibilityRaw = (visibilitySettings?.value ?? null) as Record<string, unknown> | null;
      const isChecklistEnabled = (checklistId: string) => {
        if (!visibilityRaw || typeof visibilityRaw !== 'object') return true;
        return visibilityRaw[checklistId] !== false;
      };

      for (const hospital of hospitals) {
        const canonicalHospitalUuid =
          hospitalRefToRowId.get(hospital.id) ||
          (hospital.facilityId ? hospitalRefToRowId.get(hospital.facilityId) : undefined) ||
          null;
        const userHospitalRefs = [...new Set(
          [hospital.siteId, hospital.id, hospital.facilityId, canonicalHospitalUuid]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
        )];
        const userHospitalRefSet = new Set(userHospitalRefs);
        const peccHospitalOrClause = buildPeccHospitalFacilityOrClause([...userHospitalRefs]);
        const { data: peccUsers } = peccHospitalOrClause
          ? await supabase
              .from('users')
              .select('id, first_name, last_name, email, mentor_id, hospital_facility_id')
              .eq('role', 'pecc')
              .or(peccHospitalOrClause)
          : { data: [] as PeccUserLike[] };

        const { data: siteMembers } = await supabase
          .from('site_members')
          .select('user_id')
          .eq('site_id', hospital.siteId);
        const siteMemberUserIds = [...new Set((siteMembers || []).map((sm: { user_id: string }) => sm.user_id).filter(Boolean))];
        let siteMemberPeccIds: string[] = [];
        if (siteMemberUserIds.length > 0) {
          const { data: siteMemberPeccs } = await supabase
            .from('users')
            .select('id')
            .in('id', siteMemberUserIds)
            .eq('role', 'pecc');
          siteMemberPeccIds = (siteMemberPeccs || []).map((u: { id: string }) => u.id);
        }

        const {
          mergedPeccUsers,
          uniquePeccUserIds,
          directMentorPeccIds,
        } = resolvePeccsForMentorHospital({
          hospitalRefs: userHospitalRefSet,
          contacts: mentorContacts,
          mentorLinkedPeccs,
          peccUsersByHospital: (peccUsers || []) as PeccUserLike[],
          siteMemberPeccIds,
          mentorId: mentorDataUserId,
        });

        const peccNameById = new Map(
          mergedPeccUsers.map((u) => [u.id, [u.first_name, u.last_name].filter(Boolean).join(' ').trim()])
        );
        const missingPeccNameIds = uniquePeccUserIds.filter((id) => !peccNameById.get(id));
        if (missingPeccNameIds.length > 0) {
          const { data: missingProfiles } = await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', missingPeccNameIds);
          (missingProfiles || []).forEach((u: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }) => {
            const label = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || String(u.email || '');
            if (label) peccNameById.set(u.id, label);
          });
        }
        const checklistUserIds = [...new Set([...uniquePeccUserIds, ...siteMemberUserIds].map((id) => String(id || '').trim()).filter(Boolean))];

        const progressHospitalUuid =
          hospitalRefToRowId.get(hospital.id) ||
          (hospital.facilityId ? hospitalRefToRowId.get(hospital.facilityId) : undefined) ||
          null;
        if (progressHospitalUuid) {
          canonicalIdsByHospital[hospital.id] = progressHospitalUuid;
        }
        let completedByTask: Record<string, { completed: boolean; completed_at: string | null }> = {};
        if (progressHospitalUuid) {
          try {
            const progressRows = await fetchSiteChecklistProgress(progressHospitalUuid);
            completedByTask = completedByTaskMap(progressRows);
          } catch (progressError) {
            console.error('[MentorSiteMilestones] checklist progress load failed:', progressError);
          }
        }
        const checklistIdsFromProgress = [...new Set(
          Object.keys(completedByTask)
            .map((taskId) => {
              const match = /^program:([^:]+):/.exec(String(taskId || '').trim());
              return match?.[1] ? String(match[1]).trim() : '';
            })
            .filter(Boolean)
        )];

        const defaultStagesWithProgress = DEFAULT_STAGES.map((s) => ({
          ...s,
          tasks: s.tasks.map((t) => ({
            ...t,
            completed: completedByTask[t.id]?.completed ?? false
          }))
        }));
        const checklistStages: Record<string, { name: string; stages: MilestoneStage[] }> = {};
        if (checklistUserIds.length > 0 || checklistIdsFromProgress.length > 0) {
          const [{ data: checklistProfiles }, { data: programMemberships }, { data: cohortMemberships }] = await Promise.all([
            checklistUserIds.length > 0
              ? supabase.from('users').select('id, primary_program_id').in('id', checklistUserIds)
              : Promise.resolve({ data: [] as Array<{ id: string; primary_program_id?: string | null }> }),
            checklistUserIds.length > 0
              ? supabase.from('program_members').select('user_id, program_id').in('user_id', checklistUserIds).eq('status', 'active')
              : Promise.resolve({ data: [] as Array<{ user_id: string; program_id?: string | null }> }),
            checklistUserIds.length > 0
              ? supabase.from('cohort_members').select('user_id, cohort_id').in('user_id', checklistUserIds).eq('status', 'active')
              : Promise.resolve({ data: [] as Array<{ user_id: string; cohort_id?: string | null }> })
          ]);
          const cohortIds = [...new Set(
            ((cohortMemberships || []) as Array<{ cohort_id?: string | null }>)
              .map((row) => String(row.cohort_id || '').trim())
              .filter(Boolean)
          )];
          let cohortProgramIds: string[] = [];
          if (cohortIds.length > 0) {
            const { data: cohortRows } = await supabase
              .from('cohorts')
              .select('id, name, program_id')
              .in('id', cohortIds);
            cohortProgramIds = ((cohortRows || []) as Array<{ name?: string | null; program_id?: string | null }>)
              .map((row) => {
                const rawProgramId = String(row.program_id || '').trim();
                if (isUuidText(rawProgramId)) return rawProgramId;
                // Some environments store cohorts.program_id as text name or null; resolve by program name.
                const candidateName = rawProgramId || String(row.name || '').trim();
                return programNameToId.get(candidateName.toLowerCase()) || '';
              })
              .filter(Boolean);
          }
          const programIds = [...new Set([
            ...((checklistProfiles || []) as Array<{ primary_program_id?: string | null }>).map((row) => String(row.primary_program_id || '').trim()).filter(Boolean),
            ...((programMemberships || []) as Array<{ program_id?: string | null }>).map((row) => String(row.program_id || '').trim()).filter(Boolean),
            ...cohortProgramIds,
            ...(uniquePeccUserIds.length > 0 ? programIdsFromMentorPeccs : []),
          ])];
          if (programIds.length > 0 || checklistIdsFromProgress.length > 0) {
            let list: any[] = [];
            if (programIds.length > 0 && checklistIdsFromProgress.length > 0) {
              const [{ data: byProgram }, { data: byChecklistIds }] = await Promise.all([
                supabase.from('program_checklists').select('*').in('program_id', programIds).order('sort_order'),
                supabase.from('program_checklists').select('*').in('id', checklistIdsFromProgress)
              ]);
              const merged = [...(byProgram || []), ...(byChecklistIds || [])];
              const seenChecklist = new Set<string>();
              list = merged.filter((row: any) => {
                const id = String(row?.id || '').trim();
                if (!id || seenChecklist.has(id)) return false;
                seenChecklist.add(id);
                return true;
              });
            } else if (programIds.length > 0) {
              const { data: byProgram } = await supabase.from('program_checklists').select('*').in('program_id', programIds).order('sort_order');
              list = byProgram || [];
            } else {
              const { data: byChecklistIds } = await supabase.from('program_checklists').select('*').in('id', checklistIdsFromProgress);
              list = byChecklistIds || [];
            }
            const enabledList = (list || []).filter((c: { id: string }) => isChecklistEnabled(c.id));
            if (enabledList.length) {
              const withStages = await Promise.all(enabledList.map(async (c: any) => {
                const { data: stages } = await supabase.from('program_checklist_stages').select('*').eq('checklist_id', c.id).order('sort_order');
                const stagesWithTasks = await Promise.all((stages || []).map(async (s: any) => {
                  const { data: tasks } = await supabase.from('program_checklist_tasks').select('*').eq('stage_id', s.id).order('sort_order');
                  return { ...s, tasks: tasks || [] };
                }));
                return { ...c, stages: stagesWithTasks };
              }));
              const toMilestoneStage = (checklist: any, stage: any, stageIndex: number): MilestoneStage => ({
                id: stage.id,
                title: stage.title,
                subtitle: stage.subtitle || '',
                objectives: Array.isArray(stage.objectives) ? stage.objectives : [],
                goal: stage.goal || '',
                color_hex: stage.color_hex || null,
                program_checklist_name: String(checklist.title || checklist.name || 'Program Checklist'),
                program_checklist_first_stage: stageIndex === 0,
                tasks: (stage.tasks || []).map((t: any) => {
                  const decoded = decodeChecklistEntry(String(t.text_content || ''));
                  return {
                    id: `program:${checklist.id}:${stage.id}.${t.task_id_suffix}`,
                    text: decoded.content,
                    entry_type: decoded.type,
                    entry_color: decoded.color_hex,
                    completed: false,
                    links: t.links || [],
                  };
                }),
              });
              withStages.forEach((c: any) => {
                const rawStages = Array.isArray(c.stages) ? c.stages : [];
                const stagesWithProgress = rawStages
                  .map((s: any, stageIndex: number) => toMilestoneStage(c, s, stageIndex))
                  .map((s: MilestoneStage) => ({
                  ...s,
                  tasks: s.tasks.map((t: MilestoneTask) => ({
                    ...t,
                    completed: completedByTask[t.id]?.completed ?? false
                  }))
                }));
                checklistStages[String(c.id)] = {
                  name: String(c.title || c.name || 'Program Checklist'),
                  stages: stagesWithProgress
                };
              });
            }
          }
        }

        const allStageSets = [
          ...defaultStagesWithProgress,
          ...Object.values(checklistStages).flatMap((entry) => entry.stages)
        ];

        const stageCompletions: Record<string, StageCompletion> = {};
        allStageSets.forEach(stage => {
          const taskIds = stage.tasks.filter(isActionableChecklistTask).map(t => t.id);
          const allComplete = taskIds.length > 0 && taskIds.every(tid => completedByTask[tid]?.completed);
          const dates = taskIds.map(tid => completedByTask[tid]?.completed_at).filter(Boolean) as string[];
          const completionDate = dates.length > 0 ? dates.sort().pop()!.slice(0, 10) : null;
          stageCompletions[stage.id] = { completed: allComplete, completionDate };
        });

        const allCompletions = await getUserData<Record<string, Record<string, StageCompletion>>>(mentorDataUserId, 'mentorStageCompletions');
        const savedCompletions = allCompletions?.[hospital.id];
        if (savedCompletions) {
          Object.keys(savedCompletions).forEach(sid => {
            if (savedCompletions[sid].completionDate) stageCompletions[sid] = savedCompletions[sid];
          });
        }

        milestones[hospital.id] = {
          hospitalId: hospital.id,
          defaultStages: defaultStagesWithProgress,
          checklistStages,
          stageCompletions
        };

        if (uniquePeccUserIds.length > 0) {
          const approvalRows = await Promise.all(
            uniquePeccUserIds.map(async (id) => ({
              id,
              approved: (await getUserData<boolean>(id, PECC_FULL_SITE_APPROVAL_KEY)) === true,
            }))
          );
          const approvedById = new Map(approvalRows.map((row) => [row.id, row.approved]));
          const approvedDirectMentorPecc = directMentorPeccIds.find((id) => approvedById.get(id) === true) || null;
          const approvedAnyPecc = uniquePeccUserIds.find((id) => approvedById.get(id) === true) || null;
          const preferredPeccId =
            approvedDirectMentorPecc ||
            approvedAnyPecc ||
            directMentorPeccIds[0] ||
            uniquePeccUserIds[0] ||
            undefined;
          const fullSiteAccessApproved = Boolean(preferredPeccId && approvedById.get(preferredPeccId) === true);
          const hospitalUuid = canonicalHospitalUuid;
          const hospActs = hospitalUuid ? hospitalActivitiesMap.get(hospitalUuid) : null;
          const hospReadiness = hospitalUuid ? hospitalReadinessMap.get(hospitalUuid) : null;

          const legacyPecc = shouldMirrorLegacyUserData();
          const [peccActivitiesVal, mentorActivitiesList, readinessPecc, readinessMentor] = await Promise.all([
            legacyPecc && !Array.isArray(hospActs) && preferredPeccId
              ? getUserData<any[]>(preferredPeccId, 'activities')
              : Promise.resolve<any[] | null>(null),
            getMentorActivitiesForUser(mentorDataUserId),
            legacyPecc && !(Array.isArray(hospReadiness) && hospReadiness.length > 0)
              && preferredPeccId
              ? getUserData<any[]>(preferredPeccId, 'readinessScores')
              : Promise.resolve<any[] | null>(null),
            Array.isArray(hospReadiness) && hospReadiness.length > 0
              ? Promise.resolve<any[] | null>(null)
              : getUserData<any[]>(mentorDataUserId, 'readinessScores'),
          ]);
          const peccActivities =
            hospActs != null && Array.isArray(hospActs) ? hospActs : (Array.isArray(peccActivitiesVal) ? peccActivitiesVal : []);
          const mentorActivities = mentorActivitiesList;
          let readinessScores: any[] = [];
          if (hospReadiness != null && Array.isArray(hospReadiness) && hospReadiness.length > 0) {
            readinessScores = hospReadiness;
          } else if (Array.isArray(readinessPecc) && readinessPecc.length > 0) {
            readinessScores = readinessPecc;
          } else if (Array.isArray(readinessMentor)) {
            readinessScores = readinessMentor;
          }
          
          const peccActivityHours = peccActivities.reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
          const matchesHospital = (a: { hospitalIds?: string[] }) => {
            const ids = a.hospitalIds || [];
            return ids.some((hid) => hid === hospital.id || hid === hospital.facilityId);
          };
          const mentorHours = mentorActivities
            .filter((a: any) => matchesHospital(a))
            .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
          const simulations = mentorActivities
            .filter((a: any) => matchesHospital(a) && a.category === 'SC')
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
            peccUserId: preferredPeccId,
            peccDisplayName: preferredPeccId ? (peccNameById.get(preferredPeccId) || preferredPeccId) : undefined,
            fullSiteAccessApproved
          };
        } else {
          metrics[hospital.id] = {
            peccActivityHours: 0,
            mentorHours: 0,
            readinessScore: null,
            readinessScoreDate: null,
            simulationCount: 0
          };
        }
      }

      setHospitalMilestones(milestones);
      setHospitalMetrics(metrics);
      setHospitalChecklistIds(canonicalIdsByHospital);
      setLoading(false);
    };

    loadMilestones();
  }, [uid, hospitals, effectiveUserId, currentUser?.id, progressVersion]);

  const checklistOptions = useMemo(() => {
    const options: Array<{ key: string; label: string }> = [{ key: 'default', label: 'Default 4-Stage Checklist' }];
    const seen = new Map<string, string>();
    Object.values(hospitalMilestones).forEach((hospitalData) => {
      Object.entries(hospitalData.checklistStages).forEach(([checklistId, checklist]) => {
        if (!seen.has(checklistId)) seen.set(checklistId, checklist.name);
      });
    });
    Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
      .forEach(([checklistId, checklistName]) => {
        options.push({ key: `program:${checklistId}`, label: checklistName });
      });
    return options;
  }, [hospitalMilestones]);

  useEffect(() => {
    if (!checklistOptions.some((option) => option.key === selectedChecklistKey)) {
      setSelectedChecklistKey('default');
    }
  }, [checklistOptions, selectedChecklistKey]);

  const saveStageCompletions = async (hospitalId: string, completions: Record<string, StageCompletion>) => {
    if (!uid) return;
    const all = await getUserData<Record<string, Record<string, StageCompletion>>>(uid, 'mentorStageCompletions');
    const updated = { ...(all || {}), [hospitalId]: completions };
    await setUserData(uid, 'mentorStageCompletions', updated);
    updateStipends(hospitalId, completions);
  };

  const updateStipends = async (hospitalId: string, completions: Record<string, StageCompletion>) => {
    if (!uid) return;
    const wagesData = await getUserData<{ stipends?: Record<string, number>; [k: string]: any }>(uid, 'mentorWages');
    if (!wagesData) return;
    try {
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
      const updatedStipends = { ...(wagesData.stipends || {}) };
      Object.entries(monthsWithStages).forEach(([month, amount]) => {
        const key = `${currentYear}-${month}`;
        updatedStipends[key] = (updatedStipends[key] || 0) + amount;
      });
      await setUserData(uid, 'mentorWages', { ...wagesData, stipends: updatedStipends });
    } catch (err) {
      console.error('Error updating stipends:', err);
    }
  };

  const handleTaskToggle = async (hospitalId: string, stageId: string, taskId: string) => {
    const hospital = hospitalMilestones[hospitalId];
    if (!hospital) return;
    const selectedChecklistId = getChecklistIdFromKey(selectedChecklistKey);
    const sourceStages = selectedChecklistId ? hospital.checklistStages[selectedChecklistId]?.stages : hospital.defaultStages;
    if (!sourceStages) return;

    const previousCompleted = Boolean(
      sourceStages.find((s) => s.id === stageId)?.tasks.find((t) => t.id === taskId)?.completed
    );
    const newCompleted = !previousCompleted;
    const updatedStages = sourceStages.map(stage =>
      stage.id === stageId
        ? {
            ...stage,
            tasks: stage.tasks.map(task =>
              task.id === taskId ? { ...task, completed: newCompleted } : task
            )
          }
        : stage
    );

    const newStageCompletions = { ...hospital.stageCompletions };
    const stage = updatedStages.find(s => s.id === stageId);
    if (stage) {
      const allComplete = stage.tasks.filter(isActionableChecklistTask).every(t => t.completed);
      newStageCompletions[stageId] = {
        completed: allComplete,
        completionDate: hospital.stageCompletions[stageId]?.completionDate ?? (allComplete ? format(new Date(), 'yyyy-MM-dd') : null)
      };
    }

    setHospitalMilestones(prev => {
      const current = prev[hospitalId];
      if (!current) return prev;
      if (selectedChecklistId) {
        const currentChecklist = current.checklistStages[selectedChecklistId];
        if (!currentChecklist) return prev;
        return {
          ...prev,
          [hospitalId]: {
            ...current,
            checklistStages: {
              ...current.checklistStages,
              [selectedChecklistId]: { ...currentChecklist, stages: updatedStages }
            },
            stageCompletions: newStageCompletions
          }
        };
      }
      return {
        ...prev,
        [hospitalId]: { ...current, defaultStages: updatedStages, stageCompletions: newStageCompletions }
      };
    });

    const canonicalHospitalId = hospitalChecklistIds[hospitalId] || hospitalId;
    const { error } = await upsertSiteChecklistTaskProgress(canonicalHospitalId, taskId, newCompleted);
    if (error) {
      console.error('Checklist task save error:', error);
      setHospitalMilestones((prev) => {
        const current = prev[hospitalId];
        if (!current) return prev;
        const revertStages = (stages: MilestoneStage[]) =>
          stages.map((stage) =>
            stage.id === stageId
              ? {
                  ...stage,
                  tasks: stage.tasks.map((task) =>
                    task.id === taskId ? { ...task, completed: previousCompleted } : task
                  ),
                }
              : stage
          );
        if (selectedChecklistId) {
          const currentChecklist = current.checklistStages[selectedChecklistId];
          if (!currentChecklist) return prev;
          return {
            ...prev,
            [hospitalId]: {
              ...current,
              checklistStages: {
                ...current.checklistStages,
                [selectedChecklistId]: { ...currentChecklist, stages: revertStages(currentChecklist.stages) },
              },
              stageCompletions: hospital.stageCompletions,
            },
          };
        }
        return {
          ...prev,
          [hospitalId]: { ...current, defaultStages: revertStages(current.defaultStages), stageCompletions: hospital.stageCompletions },
        };
      });
      return;
    }

    saveStageCompletions(hospitalId, newStageCompletions);
  };

  const handleStageCompletionToggle = (hospitalId: string, stageId: string) => {
    const hospital = hospitalMilestones[hospitalId];
    if (!hospital) return;
    const selectedChecklistId = getChecklistIdFromKey(selectedChecklistKey);
    const sourceStages = selectedChecklistId ? hospital.checklistStages[selectedChecklistId]?.stages : hospital.defaultStages;
    if (!sourceStages) return;

    const current = hospital.stageCompletions[stageId];
    const newCompleted = !current?.completed;
    const stage = sourceStages.find(s => s.id === stageId);
    trackChecklist(newCompleted ? 'stage_complete' : 'stage_uncomplete', { checklist_id: 'site_milestones', stage_id: stageId, name: stage?.title?.slice(0, 80) });
    const completionDateStr = newCompleted ? format(new Date(), 'yyyy-MM-dd') : null;

    const updated: Record<string, StageCompletion> = {
      ...hospital.stageCompletions,
      [stageId]: { completed: newCompleted, completionDate: completionDateStr }
    };

    const taskIds = stage?.tasks.map(t => t.id) ?? [];
    const completedAt = newCompleted ? new Date().toISOString() : null;

    const canonicalHospitalId = hospitalChecklistIds[hospitalId] || hospitalId;
    void upsertSiteChecklistTasksProgress(canonicalHospitalId, taskIds, newCompleted).then(({ error }) => {
      if (error) console.error('Checklist stage save error:', error);
    });

    const updatedStages = sourceStages.map(s =>
      s.id === stageId
        ? { ...s, tasks: s.tasks.map(t => ({ ...t, completed: newCompleted })) }
        : s
    );

    setHospitalMilestones(prev => {
      const currentHospital = prev[hospitalId];
      if (!currentHospital) return prev;
      if (selectedChecklistId) {
        const currentChecklist = currentHospital.checklistStages[selectedChecklistId];
        if (!currentChecklist) return prev;
        return {
          ...prev,
          [hospitalId]: {
            ...currentHospital,
            checklistStages: {
              ...currentHospital.checklistStages,
              [selectedChecklistId]: { ...currentChecklist, stages: updatedStages }
            },
            stageCompletions: updated
          }
        };
      }
      return {
        ...prev,
        [hospitalId]: { ...currentHospital, defaultStages: updatedStages, stageCompletions: updated }
      };
    });

    saveStageCompletions(hospitalId, updated);
  };

  const handleCompletionDateChange = () => {
    if (!editingStage) return;

    const { hospitalId, stageId } = editingStage;
    const hospital = hospitalMilestones[hospitalId];
    if (!hospital) return;
    const selectedChecklistId = getChecklistIdFromKey(selectedChecklistKey);
    const sourceStages = selectedChecklistId ? hospital.checklistStages[selectedChecklistId]?.stages : hospital.defaultStages;
    if (!sourceStages) return;

    const completionDateStr = completionDate ? format(completionDate, 'yyyy-MM-dd') : null;
    const completedAt = completionDate ? completionDate.toISOString() : null;

    const updated: Record<string, StageCompletion> = {
      ...hospital.stageCompletions,
      [stageId]: { completed: true, completionDate: completionDateStr }
    };

    const canonicalHospitalId = hospitalChecklistIds[hospitalId] || hospitalId;
    const stage = sourceStages.find(s => s.id === stageId);
    const taskIds = stage?.tasks.map(t => t.id) ?? [];
    void upsertSiteChecklistTasksProgress(canonicalHospitalId, taskIds, true).then(({ error }) => {
      if (error) console.error('Checklist date save error:', error);
    });

    const updatedStages = sourceStages.map(s =>
      s.id === stageId ? { ...s, tasks: s.tasks.map(t => ({ ...t, completed: true })) } : s
    );

    setHospitalMilestones(prev => {
      const currentHospital = prev[hospitalId];
      if (!currentHospital) return prev;
      if (selectedChecklistId) {
        const currentChecklist = currentHospital.checklistStages[selectedChecklistId];
        if (!currentChecklist) return prev;
        return {
          ...prev,
          [hospitalId]: {
            ...currentHospital,
            checklistStages: {
              ...currentHospital.checklistStages,
              [selectedChecklistId]: { ...currentChecklist, stages: updatedStages }
            },
            stageCompletions: updated
          }
        };
      }
      return {
        ...prev,
        [hospitalId]: { ...currentHospital, defaultStages: updatedStages, stageCompletions: updated }
      };
    });

    saveStageCompletions(hospitalId, updated);
    setDateDialogOpen(false);
    setEditingStage(null);
    setCompletionDate(null);
  };

  useEffect(() => {
    const watchedHospitalIds = [...new Set(Object.values(hospitalChecklistIds).filter(Boolean))];
    if (!watchedHospitalIds.length) return;
    return subscribeToSiteChecklistProgress(watchedHospitalIds, () => {
      setProgressVersion((prev) => prev + 1);
    });
  }, [hospitalChecklistIds]);

  const handleHospitalMenuOpen = (event: React.MouseEvent<HTMLElement>, hospitalId: string) => {
    event.stopPropagation();
    setHospitalMenuAnchor({ el: event.currentTarget, hospitalId });
  };

  const handleHospitalMenuClose = () => {
    setHospitalMenuAnchor(null);
  };

  const handleViewCRM = (hospitalId: string) => {
    handleHospitalMenuClose();
    navigate(mentorRoutes.hospitalsWithHospital(hospitalId));
  };

  const handleViewPECCAccount = async (hospitalId: string) => {
    const metrics = hospitalMetrics[hospitalId];
    if (!metrics?.peccUserId) return;
    handleHospitalMenuClose();
    if (metrics.fullSiteAccessApproved !== true) {
      alert('This PECC has not approved full-site sharing. You can continue using checklist and aggregated milestone/snapshot metrics only.');
      return;
    }
    const result = await enterViewAsUser(metrics.peccUserId);
    if (result.ok) {
      navigate(result.dashboardPath || '/dashboard');
      return;
    }
    alert('Unable to open PECC full-site view. Confirm that this PECC is assigned to you and has approved full-site sharing.');
  };

  const handleHospitalHeaderClick = async (hospitalId: string) => {
    const metrics = hospitalMetrics[hospitalId];
    if (metrics?.peccUserId && metrics.fullSiteAccessApproved === true) {
      await handleViewPECCAccount(hospitalId);
      return;
    }
    navigate(mentorRoutes.hospitalsWithHospital(hospitalId));
  };

  const getStageColor = (stageId: string, stage?: MilestoneStage) => {
    const resolved = stage ?? selectedChecklistTemplate.find((s) => s.id === stageId);
    if (resolved?.color_hex && isValidHexColor(resolved.color_hex)) return resolved.color_hex;
    switch (stageId) {
      case 'stage1':
        return stagePalette.stage1;
      case 'stage2':
        return stagePalette.stage2;
      case 'stage3':
        return stagePalette.stage3;
      case 'stage4':
        return stagePalette.stage4;
      default:
        return stagePalette.stage1;
    }
  };

  const selectedChecklistTemplate = useMemo(() => {
    for (const hospital of hospitals) {
      const hospitalData = hospitalMilestones[hospital.id];
      const stages = getStagesForChecklist(hospitalData, selectedChecklistKey);
      if (stages && stages.length > 0) return stages;
    }
    return selectedChecklistKey === 'default' ? DEFAULT_STAGES : [];
  }, [hospitals, hospitalMilestones, selectedChecklistKey, getStagesForChecklist]);

  const tableRows = useMemo(() => {
    const rows: MilestoneTableRow[] = [];

    selectedChecklistTemplate.forEach((stage) => {
      if (stage.program_checklist_first_stage && stage.program_checklist_name) {
        rows.push({ type: 'checklist_header', checklistName: stage.program_checklist_name });
      }
      rows.push({
        type: 'stage',
        stageId: stage.id,
        stageTitle: formatStageLabel(stage),
        stage,
      });
      stage.tasks.forEach((task) => {
        if (isActionableChecklistTask(task)) {
          rows.push({ type: 'task', stageId: stage.id, taskId: task.id, task });
        } else {
          rows.push({ type: 'entry', stageId: stage.id, task });
        }
      });
      rows.push({
        type: 'completion',
        stageId: stage.id,
        stageTitle: formatStageLabel(stage),
        stage,
      });
    });

    return rows;
  }, [selectedChecklistTemplate]);

  const visibleHospitals = useMemo(
    () => hospitals.filter((h) => !hiddenHospitals.has(h.id)),
    [hospitals, hiddenHospitals]
  );

  if (loading) {
    return (
      <AdminPageShell>
        <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Loading milestones…
          </Typography>
          <LinearProgress color="secondary" sx={{ maxWidth: 400, mt: 1 }} />
        </Paper>
      </AdminPageShell>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <AdminPageShell>
        <AdminHero
          overline="Checklist progress"
          title="Site Milestones"
          description="Track PECC checklist progress and your mentor hours per site. Completing stages here syncs with the PECC Checklist view. Add hospitals on the Hospitals page first."
        />

        {hospitals.length === 0 ? (
          <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 5, textAlign: 'center' }}>
            <Typography color="text.secondary" gutterBottom>
              No hospitals yet. Add hospitals from the Hospitals page so you can track checklist progress and mentor
              hours per site.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              sx={{ mt: 2 }}
              onClick={() => navigate(mentorRoutes.hospitals)}
            >
              Go to Hospitals
            </Button>
          </Paper>
        ) : (
          <>
            <AdminSection
              overline="View"
              title="Hospitals & checklist"
              description={`${visibleHospitals.length} of ${hospitals.length} hospitals visible`}
            >
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                  Checklist view:
                </Typography>
                <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap' }}>
                  {checklistOptions.map((option) => (
                    <Button
                      key={option.key}
                      variant={selectedChecklistKey === option.key ? 'contained' : 'outlined'}
                      color={selectedChecklistKey === option.key ? 'secondary' : 'inherit'}
                      onClick={() => setSelectedChecklistKey(option.key)}
                      sx={{ textTransform: 'none' }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </ButtonGroup>
                {hospitals.map((hospital) => (
                  <Chip
                    key={hospital.id}
                    label={normalizeHospitalOrOrgName(hospital.name)}
                    size="small"
                    icon={hiddenHospitals.has(hospital.id) ? <HideIcon /> : <ShowIcon />}
                    onClick={() => toggleHospitalVisibility(hospital.id)}
                    color={hiddenHospitals.has(hospital.id) ? 'default' : 'secondary'}
                    variant={hiddenHospitals.has(hospital.id) ? 'outlined' : 'filled'}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </AdminSection>

            <Paper elevation={0} sx={adminSectionShellSx}>
            <TableContainer
              sx={{
                maxHeight: 'calc(100vh - 240px)',
                overflowX: 'auto',
                overflowY: 'auto',
                '& .MuiTableCell-root': {
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                },
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
                    const hospitalData = hospitalMilestones[hospital.id];
                    const isChecklistAvailable = Boolean(getStagesForChecklist(hospitalData, selectedChecklistKey));
                    return (
                      <TableCell 
                        key={hospital.id} 
                        align="center" 
                        sx={{ 
                          minWidth: 180,
                          maxWidth: 180,
                          bgcolor: isChecklistAvailable ? 'background.paper' : 'action.disabledBackground',
                          fontWeight: 600,
                          borderBottom: '2px solid',
                          borderColor: isChecklistAvailable ? 'secondary.main' : 'divider',
                          opacity: isChecklistAvailable ? 1 : 0.7
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Link
                              component="button"
                              onClick={() => isChecklistAvailable && void handleHospitalHeaderClick(hospital.id)}
                              sx={{ 
                                textDecoration: 'none', 
                                fontWeight: 600, 
                                color: isChecklistAvailable ? 'primary.main' : 'text.disabled', 
                                cursor: isChecklistAvailable ? 'pointer' : 'default',
                                fontSize: '0.75rem',
                                pointerEvents: isChecklistAvailable ? 'auto' : 'none',
                                '&:hover': { textDecoration: isChecklistAvailable ? 'underline' : 'none' }
                              }}
                            >
                              {normalizeHospitalOrOrgName(hospital.name)}
                            </Link>
                            <IconButton 
                              size="small" 
                              onClick={(e) => handleHospitalMenuOpen(e, hospital.id)}
                              disabled={!isChecklistAvailable}
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
                  const hospitalColSpan = visibleHospitals.length;

                  if (row.type === 'checklist_header') {
                    return (
                      <TableRow key={`checklist-${row.checklistName}-${rowIndex}`}>
                        <TableCell
                          colSpan={1 + hospitalColSpan}
                          sx={{
                            py: 1.25,
                            bgcolor: 'primary.50',
                            borderBottom: '2px solid',
                            borderColor: 'primary.light',
                          }}
                        >
                          <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>
                            {row.checklistName} Checklist
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (row.type === 'stage') {
                    const stageColor = getStageColor(row.stageId, row.stage);
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
                            fontWeight: 700,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            fontSize: '0.85rem',
                            minWidth: 250,
                            maxWidth: 250,
                            color: 'white',
                            py: 1,
                          }}
                        >
                          {row.stageTitle}
                        </TableCell>
                        {visibleHospitals.map((hospital) => {
                          const isChecklistAvailable = Boolean(getStagesForChecklist(hospitalMilestones[hospital.id], selectedChecklistKey));
                          return (
                            <TableCell
                              key={`${hospital.id}-${row.stageId}`}
                              sx={{ bgcolor: isChecklistAvailable ? stageColor : 'action.disabledBackground', opacity: isChecklistAvailable ? 1 : 0.7 }}
                            />
                          );
                        })}
                      </TableRow>
                    );
                  }

                  if (row.type === 'entry' && row.task) {
                    const stageColor = getStageColor(row.stageId);
                    return (
                      <TableRow key={`${row.stageId}-entry-${row.task.id}`}>
                        <TableCell
                          colSpan={1 + hospitalColSpan}
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 8,
                            bgcolor: 'background.paper',
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            py: 0.75,
                            px: 1.5,
                          }}
                        >
                          {renderDecorativeEntry(row.task, stageColor)}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (row.type === 'task' && row.task) {
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
                            pl: 2.5,
                            py: 0.75,
                            minWidth: 250,
                            maxWidth: 250
                          }}
                        >
                          {renderTaskLabel(row.task)}
                        </TableCell>
                        {visibleHospitals.map(hospital => {
                          const hospitalData = hospitalMilestones[hospital.id];
                          const selectedStages = getStagesForChecklist(hospitalData, selectedChecklistKey);
                          const isChecklistAvailable = Boolean(selectedStages);
                          const stage = selectedStages?.find(s => s.id === row.stageId);
                          const task = stage?.tasks.find(t => t.id === row.taskId);
                          const isCompleted = task?.completed || false;

                          return (
                            <TableCell key={hospital.id} align="center" sx={{ py: 0.5, bgcolor: isChecklistAvailable ? 'inherit' : 'action.disabledBackground', opacity: isChecklistAvailable ? 1 : 0.7 }}>
                              <Checkbox
                                checked={isCompleted}
                                onChange={() => handleTaskToggle(hospital.id, row.stageId, row.taskId)}
                                disabled={!isChecklistAvailable}
                                size="small"
                                sx={{ padding: '2px' }}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  }

                  if (row.type === 'completion') {
                    const stageColor = getStageColor(row.stageId, row.stage);
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
                            color: 'white',
                            fontSize: '0.78rem',
                          }}
                        >
                          {row.stageTitle} — mark stage complete
                        </TableCell>
                        {visibleHospitals.map(hospital => {
                          const hospitalData = hospitalMilestones[hospital.id];
                          const isChecklistAvailable = Boolean(getStagesForChecklist(hospitalData, selectedChecklistKey));
                          const completion = hospitalData?.stageCompletions[row.stageId!];
                          const isCompleted = completion?.completed || false;

                          return (
                            <TableCell key={hospital.id} align="center" sx={{ py: 0.5, bgcolor: isChecklistAvailable ? stageColor : 'action.disabledBackground', opacity: isChecklistAvailable ? 1 : 0.7 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                <Checkbox
                                  checked={isCompleted}
                                  onChange={() => handleStageCompletionToggle(hospital.id, row.stageId!)}
                                  disabled={!isChecklistAvailable}
                                  size="small"
                                  sx={{
                                    padding: '2px',
                                    color: isChecklistAvailable ? 'white' : 'text.disabled',
                                    '&.Mui-checked': { color: isChecklistAvailable ? 'white' : 'text.disabled' }
                                  }}
                                />
                                {isCompleted && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={!isChecklistAvailable}
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
                                      borderColor: isChecklistAvailable ? 'white' : 'divider',
                                      color: isChecklistAvailable ? 'white' : 'text.disabled',
                                      '&:hover': { borderColor: isChecklistAvailable ? 'white' : 'divider', bgcolor: isChecklistAvailable ? 'rgba(255,255,255,0.1)' : 'inherit' }
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

                  return null;
                })}
              </TableBody>
            </Table>
          </TableContainer>
            </Paper>
          </>
        )}

        <Menu
          anchorEl={hospitalMenuAnchor?.el}
          open={Boolean(hospitalMenuAnchor)}
          onClose={handleHospitalMenuClose}
        >
          <MenuItem disabled dense>
            Full view target: {hospitalMenuAnchor ? (hospitalMetrics[hospitalMenuAnchor.hospitalId]?.peccDisplayName || 'Unavailable') : 'Unavailable'}
          </MenuItem>
          <MenuItem onClick={() => hospitalMenuAnchor && handleViewCRM(hospitalMenuAnchor.hospitalId)}>
            <BusinessIcon sx={{ mr: 1, fontSize: '1rem' }} />
            View in CRM
          </MenuItem>
          {hospitalMenuAnchor && hospitalMetrics[hospitalMenuAnchor.hospitalId]?.peccUserId && (
            <MenuItem onClick={() => hospitalMenuAnchor && handleViewPECCAccount(hospitalMenuAnchor.hospitalId)}>
              <ViewIcon sx={{ mr: 1, fontSize: '1rem' }} />
              {hospitalMetrics[hospitalMenuAnchor.hospitalId]?.fullSiteAccessApproved
                ? 'Open PECC Full Site (All Tabs)'
                : 'Summary Metrics + Checklist (No Full Access)'}
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
      </AdminPageShell>
    </LocalizationProvider>
  );
};

export default MentorSiteMilestonesPage;
