import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  TextField,
  SelectChangeEvent,
  Tabs,
  Tab,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  alpha,
  InputAdornment,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PageviewIcon from '@mui/icons-material/Pageview';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import TimelineIcon from '@mui/icons-material/Timeline';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupIcon from '@mui/icons-material/Group';
import WorkIcon from '@mui/icons-material/Work';
import LinkIcon from '@mui/icons-material/Link';
import EventIcon from '@mui/icons-material/Event';
import MailIcon from '@mui/icons-material/Mail';
import SchoolIcon from '@mui/icons-material/School';
import FlagIcon from '@mui/icons-material/Flag';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SearchIcon from '@mui/icons-material/Search';
import TableChartIcon from '@mui/icons-material/TableChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';
import {
  ProgramBreakdownGroupedBar,
  CohortBreakdownGroupedBar,
  UsageActivityVolumeChart,
  UsageTopPagesBar,
  UsageUniqueLoginsPie,
  UsageEventTypesBar,
  ClicksByRoleBar,
} from '../../components/admin/AdminReportCharts';
import { supabase } from '../../supabase';
import { isSupabaseMissingRelationError } from '../../utils/supabaseErrors';
import { useAuth } from '../../context/AuthContext';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';
import {
  batchGetUserDataForKey,
  batchGetHospitalDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
} from '../../utils/userData';

const AdminPlatformOverviewCharts = React.lazy(() => import('../../components/admin/AdminPlatformOverviewCharts'));

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const MENTOR_HOURS_PERIODS = [
  { value: 'month', label: 'This month' },
  { value: '3months', label: 'Last 3 months' },
];

const TABLE_LIMITS = [5, 10, 15, 25, 50];

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface ProgramBreakdown {
  id: string;
  name: string;
  mentorCount: number;
  peccCount: number;
  sites: number;
  mentorHoursThisMonth: number;
  mentorActivitiesThisMonth: number;
  avgPeccProgress: number;
}

interface CohortBreakdown {
  id: string;
  name: string;
  program_id: string | null;
  programName: string | null;
  mentorCount: number;
  peccCount: number;
  sites: number;
  mentorHoursThisMonth: number;
  mentorActivitiesThisMonth: number;
  avgPeccProgress: number;
}

interface UsageEvent {
  id: string;
  user_id: string;
  role: string;
  event_type: string;
  path: string;
  metadata: {
    time_spent_seconds?: number;
    target?: string;
    url?: string;
    label?: string;
    link_context?: string;
    action?: string;
    checklist_id?: string;
    item_id?: string;
    activity_id?: string;
    name?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

interface AggregatedPlatformData {
  managers: number;
  mentors: number;
  peccs: number;
  sites: number;
  contacts: number;
  avgPeccProgress: number;
  mentorHoursThisMonth: number;
  mentorActivitiesThisMonth: number;
  mentorHoursLast3Months: number;
  mentorActivitiesLast3Months: number;
  // Additional metrics
  totalHospitals: number;
  activeAssignments: number;
  mentorsWithoutAssignments: number;
  programs: number;
  cohorts: number;
  invitationsPending: number;
  invitationsAcceptedThisMonth: number;
  siteMilestonesTotal: number;
  siteMilestonesCompleted: number;
  peccHoursThisMonth: number;
  peccActivitiesThisMonth: number;
}

export default function AdminSnapshotPage() {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = Number(searchParams.get('tab') ?? '0');
  const activeTab = (tabParam >= 0 && tabParam <= 3 ? tabParam : 0) as 0 | 1 | 2 | 3;
  const setActiveTab = useCallback(
    (v: 0 | 1 | 2 | 3) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', String(v));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const [periodValue, setPeriodValue] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [mentorHoursPeriod, setMentorHoursPeriod] = useState<string>('month');
  const [tableLimit, setTableLimit] = useState(10);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [aggregated, setAggregated] = useState<AggregatedPlatformData | null>(null);
  const [programBreakdowns, setProgramBreakdowns] = useState<ProgramBreakdown[]>([]);
  const [cohortBreakdowns, setCohortBreakdowns] = useState<CohortBreakdown[]>([]);
  const [aggregatedLoading, setAggregatedLoading] = useState(true);
  const [aggregatedError, setAggregatedError] = useState<string | null>(null);
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownFilterProgram, setBreakdownFilterProgram] = useState<string>('all');
  const [usageSearch, setUsageSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const runQuery = () => {
      let query = supabase
        .from('usage_events')
        .select('id, user_id, role, event_type, path, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(40000);

      if (periodValue === 'all') {
        // No date filter
      } else if (periodValue === 'custom' && customFrom && customTo) {
        const fromIso = new Date(customFrom + 'T00:00:00.000Z').toISOString();
        const toEnd = new Date(customTo + 'T23:59:59.999Z').toISOString();
        query = query.gte('created_at', fromIso).lte('created_at', toEnd);
      } else if (['7', '30', '90'].includes(periodValue)) {
        const days = parseInt(periodValue, 10);
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte('created_at', since.toISOString());
      } else {
        // custom but missing dates – don't fetch
        setLoading(false);
        setEvents([]);
        return;
      }

      query.then(({ data, error: err }) => {
        if (!mounted) return;
        if (err) {
          setError(err.message);
          setEvents([]);
        } else {
          setEvents((data as UsageEvent[]) || []);
        }
        setLoading(false);
      });
    };

    runQuery();
    return () => { mounted = false; };
  }, [periodValue, customFrom, customTo, retryCount]);

  // Load aggregated platform data (managers, mentors, PECCs, sites, contacts, progress)
  useEffect(() => {
    let mounted = true;
    setAggregatedLoading(true);
    setAggregatedError(null);
    (async () => {
      try {
        const [
          managersRes,
          mentorsRes,
          peccsRes,
          assignmentsRes,
          contactsRes,
          hospitalsRes,
          programsRes,
          cohortsRes,
          invitationsRes,
          milestonesRes,
          peccActivitiesRes,
          programsListRes,
          cohortsListRes,
          programMembersRes,
          cohortMembersRes
        ] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'manager').eq('is_active', true),
          supabase.from('users').select('id').eq('role', 'mentor').eq('is_active', true),
          supabase.from('users').select('id, hospital_facility_id').eq('role', 'pecc').eq('is_active', true),
          supabase.from('mentor_hospital_assignments').select('hospital_id, mentor_id').eq('is_active', true),
          supabase.from('hospital_contacts').select('id', { count: 'exact', head: true }),
          supabase.from('hospitals').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('programs').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('cohorts').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('invitations').select('id, status, accepted_at').in('status', ['pending', 'accepted']),
          supabase.from('site_milestones').select('id, status'),
          supabase.from('pecc_activities').select('hours, date').gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
          supabase.from('programs').select('id, name').eq('is_active', true).order('name'),
          supabase.from('cohorts').select('id, name, program_id').eq('is_active', true).order('name'),
          supabase.from('program_members').select('program_id, user_id').eq('status', 'active'),
          supabase.from('cohort_members').select('cohort_id, user_id').eq('status', 'active')
        ]);
        if (!mounted) return;

        if (contactsRes.error && !isSupabaseMissingRelationError(contactsRes.error)) {
          console.warn('Admin snapshot: hospital_contacts', contactsRes.error);
        }
        if (milestonesRes.error && !isSupabaseMissingRelationError(milestonesRes.error)) {
          console.warn('Admin snapshot: site_milestones', milestonesRes.error);
        }
        if (peccActivitiesRes.error && !isSupabaseMissingRelationError(peccActivitiesRes.error)) {
          console.warn('Admin snapshot: pecc_activities', peccActivitiesRes.error);
        }

        const managers = managersRes.count ?? 0;
        const mentors = (mentorsRes.data || []).length;
        const peccs = (peccsRes.data || []).length;
        const contacts = contactsRes.error ? 0 : (contactsRes.count ?? 0);
        const assignmentsData = (assignmentsRes.data || []) as { hospital_id: string; mentor_id: string }[];
        const hospitalIds = [...new Set(assignmentsData.map((a) => a.hospital_id).filter(Boolean))];
        const sites = hospitalIds.length;
        const totalHospitals = hospitalsRes.count ?? 0;
        const activeAssignments = assignmentsData.length;
        const assignedMentorIds = new Set(assignmentsData.map((a) => a.mentor_id));
        const mentorsWithoutAssignments = mentors - assignedMentorIds.size;
        const programs = programsRes.count ?? 0;
        const cohorts = cohortsRes.count ?? 0;
        const invitationsData = (invitationsRes.data || []) as { status: string; accepted_at: string | null }[];
        const invitationsPending = invitationsData.filter((i) => i.status === 'pending').length;
        const invMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const invitationsAcceptedThisMonth = invitationsData.filter(
          (i) => i.status === 'accepted' && i.accepted_at && i.accepted_at >= invMonthStart
        ).length;
        const milestonesData = (milestonesRes.error ? [] : milestonesRes.data || []) as { status: string }[];
        const siteMilestonesTotal = milestonesData.length;
        const siteMilestonesCompleted = milestonesData.filter((m) => m.status === 'completed').length;
        const peccActivitiesData = (peccActivitiesRes.error ? [] : peccActivitiesRes.data || []) as {
          hours: number;
          date: string;
        }[];
        const peccList = (peccsRes.data || []) as { id: string; hospital_facility_id: string }[];
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const peccActMap = shouldMirrorLegacyUserData()
          ? await batchGetUserDataForKey<unknown[]>(peccList.map((p) => p.id), 'activities')
          : new Map<string, unknown[] | null>();
        const siteRefs = peccList.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
        const refToHospitalId = await mapSiteRefsToHospitalRowIds(siteRefs);
        const hospitalUuids = [...new Set(
          siteRefs.map((r) => refToHospitalId.get(r)).filter((x): x is string => Boolean(x))
        )];
        const hospActMap = await batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'activities');
        let peccHoursThisMonth = 0;
        let peccActivitiesThisMonth = 0;
        for (const p of peccList) {
          const hid = p.hospital_facility_id ? refToHospitalId.get(p.hospital_facility_id) : undefined;
          const fromHospital = hid ? hospActMap.get(hid) : null;
          const acts = Array.isArray(fromHospital) ? fromHospital : peccActMap.get(p.id);
          if (!Array.isArray(acts)) continue;
          for (const a of acts) {
            if (!a || typeof a !== 'object' || !('date' in a)) continue;
            const d = new Date(String((a as { date: string }).date));
            if (d < monthStart) continue;
            peccActivitiesThisMonth += 1;
            peccHoursThisMonth += Number((a as { hours?: number }).hours) || 0;
          }
        }
        if (peccActivitiesThisMonth === 0 && peccActivitiesData.length > 0) {
          peccHoursThisMonth = peccActivitiesData.reduce((s, a) => s + (a.hours || 0), 0);
          peccActivitiesThisMonth = peccActivitiesData.length;
        }
        const uniqueHospIds = [...new Set(hospitalUuids)];
        const checklistStatsByHospital = new Map<string, { total: number; completed: number }>();
        for (const part of chunkIds(uniqueHospIds, 80)) {
          const { data: checklistData } = await supabase
            .from('site_checklist_progress')
            .select('hospital_id, completed')
            .in('hospital_id', part);
          for (const row of checklistData || []) {
            const hid = (row as { hospital_id: string; completed: boolean }).hospital_id;
            const prev = checklistStatsByHospital.get(hid) || { total: 0, completed: 0 };
            prev.total += 1;
            if ((row as { completed: boolean }).completed) prev.completed += 1;
            checklistStatsByHospital.set(hid, prev);
          }
        }
        let progressSum = 0;
        let progressCount = 0;
        const peccProgressByPecc: Record<string, number> = {};
        for (const p of peccList) {
          if (!p.hospital_facility_id) continue;
          const canonicalHospitalId = refToHospitalId.get(p.hospital_facility_id);
          if (!canonicalHospitalId) continue;
          const stats = checklistStatsByHospital.get(canonicalHospitalId);
          const completed = stats?.completed || 0;
          const totalTasks = stats?.total || 0;
          const pct = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
          progressSum += pct;
          progressCount += 1;
          peccProgressByPecc[p.id] = pct;
        }
        const avgPeccProgress = progressCount > 0 ? Math.round(progressSum / progressCount) : 0;
        const mentorIds = ((mentorsRes.data || []) as { id: string }[]).map((m) => m.id);
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        let mentorHoursThisMonth = 0;
        let mentorActivitiesThisMonth = 0;
        let mentorHoursLast3Months = 0;
        let mentorActivitiesLast3Months = 0;
        const mentorHoursByMentor: Record<string, number> = {};
        const mentorActivitiesByMentor: Record<string, number> = {};
        const mentorActivitiesLists = await Promise.all(mentorIds.map((mid) => getMentorActivitiesForUser(mid)));
        for (let i = 0; i < mentorIds.length; i++) {
          const mid = mentorIds[i];
          const acts = mentorActivitiesLists[i];
          const thisMonth = acts.filter((a: { date: string }) => new Date(a.date) >= monthStart);
          const last3Months = acts.filter((a: { date: string }) => new Date(a.date) >= threeMonthsAgo);
          const h = thisMonth.reduce((s: number, a: { hours?: number }) => s + (a.hours || 0), 0);
          mentorHoursByMentor[mid] = h;
          mentorActivitiesByMentor[mid] = thisMonth.length;
          mentorActivitiesThisMonth += thisMonth.length;
          mentorHoursThisMonth += h;
          mentorActivitiesLast3Months += last3Months.length;
          mentorHoursLast3Months += last3Months.reduce((s: number, a: { hours?: number }) => s + (a.hours || 0), 0);
        }
        if (!mounted) return;

        const programsList = (programsListRes.data || []) as { id: string; name: string }[];
        const cohortsList = (cohortsListRes.data || []) as { id: string; name: string; program_id: string | null }[];
        const programMembers = (programMembersRes.data || []) as { program_id: string; user_id: string }[];
        const cohortMembers = (cohortMembersRes.data || []) as { cohort_id: string; user_id: string }[];
        const programMap = new Map(programsList.map((p) => [p.id, p.name]));
        const cohortSitesByMentor: Record<string, Set<string>> = {};
        assignmentsData.forEach((a) => {
          if (!cohortSitesByMentor[a.mentor_id]) cohortSitesByMentor[a.mentor_id] = new Set();
          cohortSitesByMentor[a.mentor_id].add(a.hospital_id);
        });

        const progBreakdowns: ProgramBreakdown[] = programsList.map((prog) => {
          const memberIds = new Set(programMembers.filter((pm) => pm.program_id === prog.id).map((pm) => pm.user_id));
          const progMentorIds = mentorIds.filter((id) => memberIds.has(id));
          const progPeccIds = peccList.filter((p) => memberIds.has(p.id)).map((p) => p.id);
          const progSiteIds = new Set<string>();
          progMentorIds.forEach((mid) => {
            (cohortSitesByMentor[mid] || new Set()).forEach((hid) => progSiteIds.add(hid));
          });
          const hours = progMentorIds.reduce((s, mid) => s + (mentorHoursByMentor[mid] || 0), 0);
          const acts = progMentorIds.reduce((s, mid) => s + (mentorActivitiesByMentor[mid] || 0), 0);
          const progProgressSum = progPeccIds.reduce((s, pid) => s + (peccProgressByPecc[pid] || 0), 0);
          const avgProg = progPeccIds.length > 0 ? Math.round(progProgressSum / progPeccIds.length) : 0;
          return {
            id: prog.id,
            name: prog.name,
            mentorCount: progMentorIds.length,
            peccCount: progPeccIds.length,
            sites: progSiteIds.size,
            mentorHoursThisMonth: hours,
            mentorActivitiesThisMonth: acts,
            avgPeccProgress: avgProg
          };
        });

        const cohortBreakdowns: CohortBreakdown[] = cohortsList.map((coh) => {
          const memberIds = new Set(cohortMembers.filter((cm) => cm.cohort_id === coh.id).map((cm) => cm.user_id));
          const cohMentorIds = mentorIds.filter((id) => memberIds.has(id));
          const cohPeccIds = peccList.filter((p) => memberIds.has(p.id)).map((p) => p.id);
          const cohSiteIds = new Set<string>();
          cohMentorIds.forEach((mid) => {
            (cohortSitesByMentor[mid] || new Set()).forEach((hid) => cohSiteIds.add(hid));
          });
          const hours = cohMentorIds.reduce((s, mid) => s + (mentorHoursByMentor[mid] || 0), 0);
          const acts = cohMentorIds.reduce((s, mid) => s + (mentorActivitiesByMentor[mid] || 0), 0);
          const cohProgressSum = cohPeccIds.reduce((s, pid) => s + (peccProgressByPecc[pid] || 0), 0);
          const avgCoh = cohPeccIds.length > 0 ? Math.round(cohProgressSum / cohPeccIds.length) : 0;
          return {
            id: coh.id,
            name: coh.name,
            program_id: coh.program_id,
            programName: coh.program_id ? programMap.get(coh.program_id) || null : null,
            mentorCount: cohMentorIds.length,
            peccCount: cohPeccIds.length,
            sites: cohSiteIds.size,
            mentorHoursThisMonth: hours,
            mentorActivitiesThisMonth: acts,
            avgPeccProgress: avgCoh
          };
        });

        setProgramBreakdowns(progBreakdowns);
        setCohortBreakdowns(cohortBreakdowns);
        setAggregated({
          managers,
          mentors,
          peccs,
          sites,
          contacts,
          avgPeccProgress,
          mentorHoursThisMonth,
          mentorActivitiesThisMonth,
          mentorHoursLast3Months,
          mentorActivitiesLast3Months,
          totalHospitals,
          activeAssignments,
          mentorsWithoutAssignments,
          programs,
          cohorts,
          invitationsPending,
          invitationsAcceptedThisMonth,
          siteMilestonesTotal,
          siteMilestonesCompleted,
          peccHoursThisMonth,
          peccActivitiesThisMonth
        });
      } catch (e: unknown) {
        if (!mounted) return;
        setAggregatedError(e instanceof Error ? e.message : 'Failed to load platform data');
      } finally {
        if (mounted) setAggregatedLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [retryCount]);

  const metrics = useMemo(() => {
    const logins = events.filter((e) => e.event_type === 'login');
    const pageViews = events.filter((e) => e.event_type === 'page_view');
    const clicks = events.filter((e) => e.event_type === 'click');
    const linkClicks = events.filter((e) => e.event_type === 'link_click');
    const checklistEvents = events.filter((e) => e.event_type === 'checklist');
    const activityEvents = events.filter((e) => e.event_type === 'activity');

    const uniqueLoginsByRole: Record<string, Set<string>> = {};
    logins.forEach((e) => {
      if (!uniqueLoginsByRole[e.role]) uniqueLoginsByRole[e.role] = new Set();
      uniqueLoginsByRole[e.role].add(e.user_id);
    });

    const pageCountByPath: Record<string, number> = {};
    const pageCountByPathAndRole: Record<string, Record<string, number>> = {};
    pageViews.forEach((e) => {
      const path = e.path || '/';
      pageCountByPath[path] = (pageCountByPath[path] || 0) + 1;
      if (!pageCountByPathAndRole[path]) pageCountByPathAndRole[path] = {};
      pageCountByPathAndRole[path][e.role] = (pageCountByPathAndRole[path][e.role] || 0) + 1;
    });

    const timeByPath: Record<string, { total: number; count: number }> = {};
    pageViews.forEach((e) => {
      const sec = e.metadata?.time_spent_seconds;
      if (sec == null || sec < 0) return;
      const path = e.path || '/';
      if (!timeByPath[path]) timeByPath[path] = { total: 0, count: 0 };
      timeByPath[path].total += sec;
      timeByPath[path].count += 1;
    });

    const clickCountByTarget: Record<string, number> = {};
    const clickCountByRole: Record<string, number> = {};
    clicks.forEach((e) => {
      const target = (e.metadata?.target as string) || 'unknown';
      clickCountByTarget[target] = (clickCountByTarget[target] || 0) + 1;
      clickCountByRole[e.role] = (clickCountByRole[e.role] || 0) + 1;
    });

    const linkClickCountByLabel: Record<string, number> = {};
    linkClicks.forEach((e) => {
      const key = (e.metadata?.label as string) || (e.metadata?.url as string) || e.path || 'unknown';
      linkClickCountByLabel[key] = (linkClickCountByLabel[key] || 0) + 1;
    });

    const checklistCountByAction: Record<string, number> = {};
    checklistEvents.forEach((e) => {
      const action = (e.metadata?.action as string) || 'unknown';
      checklistCountByAction[action] = (checklistCountByAction[action] || 0) + 1;
    });

    const activityCountByAction: Record<string, number> = {};
    activityEvents.forEach((e) => {
      const action = (e.metadata?.action as string) || 'unknown';
      activityCountByAction[action] = (activityCountByAction[action] || 0) + 1;
    });

    const limit = tableLimit;
    const mostUsedPages = Object.entries(pageCountByPath)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const avgTimeByPath = Object.entries(timeByPath)
      .map(([path, { total, count }]) => ({ path, avgSeconds: total / count, viewsWithTime: count }))
      .filter((x) => x.avgSeconds >= 1)
      .sort((a, b) => b.avgSeconds - a.avgSeconds)
      .slice(0, limit);

    const topClicks = Object.entries(clickCountByTarget)
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topLinkClicks = Object.entries(linkClickCountByLabel)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topChecklistActions = Object.entries(checklistCountByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const topActivityActions = Object.entries(activityCountByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      totalLogins: logins.length,
      uniqueLoginsByRole,
      mostUsedPages,
      avgTimeByPath,
      topClicks,
      totalPageViews: pageViews.length,
      totalClicks: clicks.length,
      clickCountByRole,
      totalLinkClicks: linkClicks.length,
      topLinkClicks,
      totalChecklistEvents: checklistEvents.length,
      topChecklistActions,
      totalActivityEvents: activityEvents.length,
      topActivityActions,
    };
  }, [events, tableLimit]);

  /** Events per calendar day (for volume chart). */
  const usageByDay = useMemo(() => {
    const byDay: Record<string, number> = {};
    events.forEach((e) => {
      const d = e.created_at.slice(0, 10);
      byDay[d] = (byDay[d] || 0) + 1;
    });
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [events]);

  const eventTypeBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    events.forEach((e) => {
      const t = e.event_type || 'unknown';
      m[t] = (m[t] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [events]);

  const uniqueLoginsPieData = useMemo(() => {
    return Object.entries(metrics.uniqueLoginsByRole).map(([name, set]) => ({
      name,
      value: (set as Set<string>).size,
    }));
  }, [metrics.uniqueLoginsByRole]);

  const clicksByRoleData = useMemo(() => {
    return Object.entries(metrics.clickCountByRole).map(([name, value]) => ({ name, value }));
  }, [metrics.clickCountByRole]);

  const downloadUsageChartsCsv = useCallback(() => {
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const lines: string[] = ['section,key,value'];
    usageByDay.forEach((r) => lines.push(`events_by_day,${esc(r.date)},${r.count}`));
    eventTypeBreakdown.forEach((r) => lines.push(`event_type,${esc(r.name)},${r.value}`));
    uniqueLoginsPieData.forEach((r) => lines.push(`unique_logins,${esc(r.name)},${r.value}`));
    clicksByRoleData.forEach((r) => lines.push(`clicks_by_role,${esc(r.name)},${r.value}`));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `usage-chart-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [usageByDay, eventTypeBreakdown, uniqueLoginsPieData, clicksByRoleData]);

  const pathLabel = (path: string) => {
    if (path === '/') return 'Home';
    const p = path.replace(/^\//, '');
    const rolePrefix = ['admin', 'mentor', 'manager'].find((r) => p.startsWith(r + '/'));
    if (rolePrefix) return p.replace(rolePrefix + '/', '').replace(/-/g, ' ') || rolePrefix;
    return p.replace(/-/g, ' ') || path;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return s ? `${m}m ${s}s` : `${m}m`;
  };

  const mentorHours = mentorHoursPeriod === '3months' ? aggregated?.mentorHoursLast3Months ?? 0 : aggregated?.mentorHoursThisMonth ?? 0;
  const mentorActivities = mentorHoursPeriod === '3months' ? aggregated?.mentorActivitiesLast3Months ?? 0 : aggregated?.mentorActivitiesThisMonth ?? 0;

  const filteredProgramBreakdowns = useMemo(() => {
    let list = programBreakdowns;
    if (breakdownSearch.trim()) {
      const q = breakdownSearch.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [programBreakdowns, breakdownSearch]);

  const filteredCohortBreakdowns = useMemo(() => {
    let list = cohortBreakdowns;
    if (breakdownSearch.trim()) {
      const q = breakdownSearch.trim().toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.programName || '').toLowerCase().includes(q)
      );
    }
    if (breakdownFilterProgram && breakdownFilterProgram !== 'all') {
      list = list.filter((c) => c.program_id === breakdownFilterProgram);
    }
    return list;
  }, [cohortBreakdowns, breakdownSearch, breakdownFilterProgram]);

  const filterUsageTable = <T extends { path?: string; target?: string; label?: string; action?: string }>(rows: T[], search: string): T[] => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      (r.path || '').toLowerCase().includes(q) ||
      (r.target || '').toLowerCase().includes(q) ||
      (r.label || '').toLowerCase().includes(q) ||
      (r.action || '').toLowerCase().includes(q)
    );
  };

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimelineIcon fontSize="large" />
            Reports
          </Typography>
          <Typography color="text.secondary">
            Custom PECC reports, platform overview, program &amp; cohort breakdowns, and usage analytics.
          </Typography>
        </Box>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v: number) => setActiveTab(v as 0 | 1 | 2 | 3)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab icon={<AssessmentIcon />} iconPosition="start" label="Reports" />
        <Tab icon={<DashboardIcon />} iconPosition="start" label="Platform overview" />
        <Tab icon={<TableChartIcon />} iconPosition="start" label="By program & cohort" />
        <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Usage analytics" />
      </Tabs>

      {activeTab === 0 && currentUser?.id && (
        <StaffPeccReportBuilder scope="admin" actorUserId={currentUser.id} />
      )}

      {activeTab === 1 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={600}>Platform overview</Typography>
                <Typography variant="body2" color="text.secondary">
                  Aggregated counts from managers, mentors, and PECC tiers.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Mentor hours</InputLabel>
                  <Select
                    value={mentorHoursPeriod}
                    label="Mentor hours"
                    onChange={(e: SelectChangeEvent) => setMentorHoursPeriod(e.target.value)}
                  >
                    {MENTOR_HOURS_PERIODS.map((p) => (
                      <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={() => setRetryCount((c) => c + 1)}
                  disabled={aggregatedLoading}
                >
                  Refresh
                </Button>
              </Stack>
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            {aggregatedError && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setAggregatedError(null); setRetryCount((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {aggregatedError}
              </Alert>
            )}
            {aggregatedLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading platform metrics...</Typography>
              </Box>
            ) : aggregated ? (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  People by tier
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <PeopleIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Managers</Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{aggregated.managers}</Typography>
                        <Typography variant="caption" color="text.secondary">Active platform-wide</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <AssignmentIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Mentors</Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{aggregated.mentors}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aggregated.managers > 0 ? `~${(aggregated.mentors / aggregated.managers).toFixed(0)} per manager` : 'Active platform-wide'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <GroupIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>PECCs</Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{aggregated.peccs}</Typography>
                        <Typography variant="caption" color="text.secondary">At assigned sites</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Sites & contacts
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <LocalHospitalIcon color="info" />
                          <Typography variant="subtitle1" fontWeight={600}>Sites (assigned)</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.sites}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          of {aggregated.totalHospitals} total hospitals
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'secondary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <PeopleIcon color="secondary" />
                          <Typography variant="subtitle1" fontWeight={600}>Contacts</Typography>
                        </Box>
                        <Typography variant="h4" color="secondary.main">{aggregated.contacts}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aggregated.sites > 0 ? `~${(aggregated.contacts / aggregated.sites).toFixed(0)} per site` : 'Hospital CRM'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <AssignmentIcon color="info" fontSize="small" />
                          <Typography variant="subtitle1" fontWeight={600}>Active assignments</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.activeAssignments}</Typography>
                        <Typography variant="caption" color="text.secondary">Mentor–site links</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: aggregated.mentorsWithoutAssignments > 0 ? 'warning.main' : 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          {aggregated.mentorsWithoutAssignments > 0 ? <WarningAmberIcon color="warning" /> : <PeopleIcon color="success" />}
                          <Typography variant="subtitle1" fontWeight={600}>Mentors unassigned</Typography>
                        </Box>
                        <Typography variant="h4" color={aggregated.mentorsWithoutAssignments > 0 ? 'warning.main' : 'success.main'}>{aggregated.mentorsWithoutAssignments}</Typography>
                        <Typography variant="caption" color="text.secondary">No site assignments</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Programs & cohorts
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <SchoolIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Programs</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">{aggregated.programs}</Typography>
                        <Typography variant="caption" color="text.secondary">Active programs</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <GroupIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Cohorts</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">{aggregated.cohorts}</Typography>
                        <Typography variant="caption" color="text.secondary">Active cohorts</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <MailIcon color="info" />
                          <Typography variant="subtitle1" fontWeight={600}>Invitations pending</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.invitationsPending}</Typography>
                        <Typography variant="caption" color="text.secondary">Awaiting acceptance</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <EventIcon color="success" />
                          <Typography variant="subtitle1" fontWeight={600}>Accepted this month</Typography>
                        </Box>
                        <Typography variant="h4" color="success.main">{aggregated.invitationsAcceptedThisMonth}</Typography>
                        <Typography variant="caption" color="text.secondary">New users joined</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Milestones & PECC activities
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <FlagIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Site milestones</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">{aggregated.siteMilestonesCompleted}</Typography>
                        <Typography variant="caption" color="text.secondary">of {aggregated.siteMilestonesTotal} completed</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'secondary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <WorkIcon color="secondary" />
                          <Typography variant="subtitle1" fontWeight={600}>PECC hours (this month)</Typography>
                        </Box>
                        <Typography variant="h4" color="secondary.main">{aggregated.peccHoursThisMonth.toFixed(1)}h</Typography>
                        <Typography variant="caption" color="text.secondary">{aggregated.peccActivitiesThisMonth} activities</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Engagement
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'success.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <TimelineIcon color="success" />
                          <Typography variant="subtitle1" fontWeight={600}>PECC checklist progress</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                          <Typography variant="h4" color="success.main">{aggregated.avgPeccProgress}%</Typography>
                          <Typography variant="body2" color="text.secondary">avg completion</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(aggregated.avgPeccProgress, 100)}
                          sx={{ height: 8, borderRadius: 1, bgcolor: (t) => alpha(t.palette.success.main, 0.2) }}
                          color="success"
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <WorkIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>
                            Mentor hours ({mentorHoursPeriod === '3months' ? 'last 3 months' : 'this month'})
                          </Typography>
                        </Box>
                        <Typography variant="h4" color="primary">{mentorHours.toFixed(1)}h</Typography>
                        <Typography variant="caption" color="text.secondary">{mentorActivities} activities logged</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, mt: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Visual summary
                </Typography>
                <Suspense
                  fallback={
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} />
                    </Box>
                  }
                >
                  <AdminPlatformOverviewCharts aggregated={aggregated} />
                </Suspense>
              </>
            ) : null}
          </Box>
        </Paper>
      )}

      {activeTab === 2 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              <TextField
                size="small"
                placeholder="Search programs & cohorts..."
                value={breakdownSearch}
                onChange={(e) => setBreakdownSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ minWidth: 240 }}
              />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Cohorts by program</InputLabel>
                <Select
                  value={breakdownFilterProgram}
                  label="Cohorts by program"
                  onChange={(e: SelectChangeEvent) => setBreakdownFilterProgram(e.target.value)}
                >
                  <MenuItem value="all">All programs</MenuItem>
                  {programBreakdowns.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setRetryCount((c) => c + 1)}
                disabled={aggregatedLoading}
              >
                Refresh
              </Button>
            </Box>
          </Box>
          <Box sx={{ p: 3 }}>
            {aggregatedLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading breakdowns...</Typography>
              </Box>
            ) : (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Programs: mentors, PECCs, and sites
                        </Typography>
                        <ProgramBreakdownGroupedBar programs={filteredProgramBreakdowns} />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Cohorts: mentors, PECCs, and sites
                        </Typography>
                        <CohortBreakdownGroupedBar cohorts={filteredCohortBreakdowns} />
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>By program</Typography>
                <TableContainer sx={{ mb: 4 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Program</TableCell>
                        <TableCell align="right">Mentors</TableCell>
                        <TableCell align="right">PECCs</TableCell>
                        <TableCell align="right">Sites</TableCell>
                        <TableCell align="right">Hours (mo)</TableCell>
                        <TableCell align="right">Activities</TableCell>
                        <TableCell align="right">PECC progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredProgramBreakdowns.length === 0 ? (
                        <TableRow><TableCell colSpan={7}>No programs match</TableCell></TableRow>
                      ) : (
                        filteredProgramBreakdowns.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell align="right">{p.mentorCount}</TableCell>
                            <TableCell align="right">{p.peccCount}</TableCell>
                            <TableCell align="right">{p.sites}</TableCell>
                            <TableCell align="right">{p.mentorHoursThisMonth.toFixed(1)}h</TableCell>
                            <TableCell align="right">{p.mentorActivitiesThisMonth}</TableCell>
                            <TableCell align="right">{p.avgPeccProgress}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="subtitle1" fontWeight={600} gutterBottom>By cohort</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Cohort</TableCell>
                        <TableCell>Program</TableCell>
                        <TableCell align="right">Mentors</TableCell>
                        <TableCell align="right">PECCs</TableCell>
                        <TableCell align="right">Sites</TableCell>
                        <TableCell align="right">Hours (mo)</TableCell>
                        <TableCell align="right">Activities</TableCell>
                        <TableCell align="right">PECC progress</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCohortBreakdowns.length === 0 ? (
                        <TableRow><TableCell colSpan={8}>No cohorts match</TableCell></TableRow>
                      ) : (
                        filteredCohortBreakdowns.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>{c.name}</TableCell>
                            <TableCell>{c.programName || '—'}</TableCell>
                            <TableCell align="right">{c.mentorCount}</TableCell>
                            <TableCell align="right">{c.peccCount}</TableCell>
                            <TableCell align="right">{c.sites}</TableCell>
                            <TableCell align="right">{c.mentorHoursThisMonth.toFixed(1)}h</TableCell>
                            <TableCell align="right">{c.mentorActivitiesThisMonth}</TableCell>
                            <TableCell align="right">{c.avgPeccProgress}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        </Paper>
      )}

      {activeTab === 3 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 3, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              <TextField
                size="small"
                placeholder="Search tables..."
                value={usageSearch}
                onChange={(e) => setUsageSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Period</InputLabel>
                <Select
                  value={periodValue}
                  label="Period"
                  onChange={(e: SelectChangeEvent) => setPeriodValue(e.target.value)}
                >
                  {PERIODS.map((p) => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {periodValue === 'custom' && (
                <>
                  <TextField
                    size="small"
                    label="From"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    label="To"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                </>
              )}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Table rows</InputLabel>
                <Select
                  value={String(tableLimit)}
                  label="Table rows"
                  onChange={(e: SelectChangeEvent) => setTableLimit(Number(e.target.value))}
                >
                  {TABLE_LIMITS.map((n) => (
                    <MenuItem key={n} value={String(n)}>Top {n}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setRetryCount((c) => c + 1)}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={downloadUsageChartsCsv}
                disabled={loading || events.length === 0}
              >
                Chart data (CSV)
              </Button>
            </Box>
          </Box>

          <Box sx={{ p: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {error}
              </Alert>
            )}
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading usage analytics...</Typography>
              </Box>
            ) : (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PeopleIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Logins</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalLogins}</Typography>
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {Object.entries(metrics.uniqueLoginsByRole).map(([role, set]) => (
                            <Chip key={role} label={`${role}: ${set.size}`} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <PageviewIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Page views</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalPageViews}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <TouchAppIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Clicks</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalClicks}</Typography>
                        {Object.keys(metrics.clickCountByRole).length > 0 && (
                          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {Object.entries(metrics.clickCountByRole).map(([role, count]) => (
                              <Chip key={role} label={`${role}: ${count}`} size="small" variant="outlined" />
                            ))}
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <LinkIcon color="primary" fontSize="small" />
                          <Typography variant="subtitle2" fontWeight={600}>Link clicks</Typography>
                        </Box>
                        <Typography variant="h5" color="primary">{metrics.totalLinkClicks}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Visual summary
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} lg={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Event volume by day
                        </Typography>
                        <UsageActivityVolumeChart byDay={usageByDay} />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Unique logins by role
                        </Typography>
                        <UsageUniqueLoginsPie byRole={uniqueLoginsPieData} />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Events by type
                        </Typography>
                        <UsageEventTypesBar rows={eventTypeBreakdown} />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Top pages (views)
                        </Typography>
                        <UsageTopPagesBar pages={filterUsageTable(metrics.mostUsedPages, usageSearch)} pathLabel={pathLabel} />
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          UI clicks by role
                        </Typography>
                        <ClicksByRoleBar byRole={clicksByRoleData} />
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                <Accordion defaultExpanded disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600}>Pages & engagement</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Most used pages</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Page</TableCell>
                                <TableCell align="right">Views</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(() => {
                                const filtered = filterUsageTable(metrics.mostUsedPages, usageSearch);
                                return filtered.length === 0 ? (
                                  <TableRow><TableCell colSpan={2}>No page views match</TableCell></TableRow>
                                ) : (
                                  filtered.map(({ path, count }) => (
                                    <TableRow key={path}>
                                      <TableCell>{pathLabel(path)}</TableCell>
                                      <TableCell align="right">{count}</TableCell>
                                    </TableRow>
                                  ))
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Avg time on page</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Page</TableCell>
                                <TableCell align="right">Avg time</TableCell>
                                <TableCell align="right">Samples</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(() => {
                                const filtered = filterUsageTable(metrics.avgTimeByPath, usageSearch);
                                return filtered.length === 0 ? (
                                  <TableRow><TableCell colSpan={3}>No duration data match</TableCell></TableRow>
                                ) : (
                                  filtered.map(({ path, avgSeconds, viewsWithTime }) => (
                                    <TableRow key={path}>
                                      <TableCell>{pathLabel(path)}</TableCell>
                                      <TableCell align="right">{formatDuration(avgSeconds)}</TableCell>
                                      <TableCell align="right">{viewsWithTime}</TableCell>
                                    </TableRow>
                                  ))
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>

                <Accordion defaultExpanded disableGutters sx={{ '&:before': { display: 'none' }, boxShadow: 'none', border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={600}>Clickthroughs & actions</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Top clickthroughs</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Action / target</TableCell>
                                <TableCell align="right">Clicks</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(() => {
                                const filtered = filterUsageTable(metrics.topClicks, usageSearch);
                                return filtered.length === 0 ? (
                                  <TableRow><TableCell colSpan={2}>No click events match</TableCell></TableRow>
                                ) : (
                                  filtered.map(({ target, count }) => (
                                    <TableRow key={target}>
                                      <TableCell>{target}</TableCell>
                                      <TableCell align="right">{count}</TableCell>
                                    </TableRow>
                                  ))
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Link clicks</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Link / label</TableCell>
                                <TableCell align="right">Clicks</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(() => {
                                const filtered = filterUsageTable(metrics.topLinkClicks, usageSearch);
                                return filtered.length === 0 ? (
                                  <TableRow><TableCell colSpan={2}>No link clicks match</TableCell></TableRow>
                                ) : (
                                  filtered.map(({ label, count }) => (
                                    <TableRow key={label}>
                                      <TableCell>{label}</TableCell>
                                      <TableCell align="right">{count}</TableCell>
                                    </TableRow>
                                  ))
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Checklist actions</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Action</TableCell>
                                <TableCell align="right">Count</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(() => {
                                const filtered = filterUsageTable(metrics.topChecklistActions, usageSearch);
                                return filtered.length === 0 ? (
                                  <TableRow><TableCell colSpan={2}>No checklist events match</TableCell></TableRow>
                                ) : (
                                  filtered.map(({ action, count }) => (
                                    <TableRow key={action}>
                                      <TableCell>{action}</TableCell>
                                      <TableCell align="right">{count}</TableCell>
                                    </TableRow>
                                  ))
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Activity actions</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Action</TableCell>
                                <TableCell align="right">Count</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(() => {
                                const filtered = filterUsageTable(metrics.topActivityActions, usageSearch);
                                return filtered.length === 0 ? (
                                  <TableRow><TableCell colSpan={2}>No activity events match</TableCell></TableRow>
                                ) : (
                                  filtered.map(({ action, count }) => (
                                    <TableRow key={action}>
                                      <TableCell>{action}</TableCell>
                                      <TableCell align="right">{count}</TableCell>
                                    </TableRow>
                                  ))
                                );
                              })()}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
