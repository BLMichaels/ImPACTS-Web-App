import React, { useState, useEffect, useMemo, useCallback, Suspense, type ReactNode } from 'react';
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
import StateMetricsMapPanel from '../../components/reports/StateMetricsMapPanel';
import {
  ProgramBreakdownGroupedBar,
  CohortBreakdownGroupedBar,
  UsageActivityVolumeChart,
  UsageTopPagesBar,
  UsageUniqueLoginsPie,
  UsageEventTypesBar,
  ClicksByRoleBar,
} from '../../components/admin/AdminReportCharts';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
  adminSectionHeaderSx,
} from '../../components/admin/AdminPageChrome';
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
import { downloadTableCsv } from '../../utils/reportCsvExport';

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

type KpiAccent = 'primary' | 'secondary' | 'info' | 'success' | 'warning';

function KpiTile({
  icon,
  title,
  value,
  caption,
  accent = 'primary',
  children,
}: {
  icon?: ReactNode;
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  accent?: KpiAccent;
  children?: ReactNode;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        px: 1.75,
        py: 1.5,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: 3,
        borderLeftColor: `${accent}.main`,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {icon}
        <Typography variant="subtitle2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
          {title}
        </Typography>
      </Box>
      <Typography
        variant="h4"
        color={`${accent}.main`}
        sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 700, lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      {caption != null && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {caption}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        height: '100%',
        p: 1.75,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

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
  simulationsTotal: number;
  simulationParticipants: number;
  gapPlansTotal: number;
  gapPlansCompleted: number;
  avgPrsLatest: number;
}

function parseReportsTab(raw: string | null): 0 | 1 | 2 | 3 {
  const n = Number(raw ?? '0');
  if (Number.isInteger(n) && n >= 0 && n <= 3) return n as 0 | 1 | 2 | 3;
  return 0;
}

export default function AdminSnapshotPage() {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseReportsTab(searchParams.get('tab'));
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

  // Keep URL ?tab= in sync when param is missing or invalid (browser nav / deep links).
  useEffect(() => {
    const raw = searchParams.get('tab');
    const parsed = parseReportsTab(raw);
    if (raw === String(parsed)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', String(parsed));
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);
  const [periodValue, setPeriodValue] = useState<string>('30');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [mentorHoursPeriod, setMentorHoursPeriod] = useState<string>('month');
  const [tableLimit, setTableLimit] = useState(10);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [aggregatedRetry, setAggregatedRetry] = useState(0);
  const [aggregated, setAggregated] = useState<AggregatedPlatformData | null>(null);
  const [programBreakdowns, setProgramBreakdowns] = useState<ProgramBreakdown[]>([]);
  const [cohortBreakdowns, setCohortBreakdowns] = useState<CohortBreakdown[]>([]);
  const [aggregatedLoading, setAggregatedLoading] = useState(false);
  const [aggregatedError, setAggregatedError] = useState<string | null>(null);
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownFilterProgram, setBreakdownFilterProgram] = useState<string>('all');
  const [usageSearch, setUsageSearch] = useState('');

  // Usage analytics: load only when that tab is active (avoids heavy fetch on Reports landing)
  useEffect(() => {
    if (activeTab !== 3) return;
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
        if (customFrom > customTo) {
          if (mounted) {
            setError('Custom range: From date must be on or before To date.');
            setLoading(false);
            setEvents([]);
          }
          return;
        }
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
        if (mounted) {
          setLoading(false);
          setEvents([]);
        }
        return;
      }

      void Promise.resolve(query)
        .then(({ data, error: err }) => {
          if (!mounted) return;
          if (err) {
            setError(err.message);
            setEvents([]);
          } else {
            setEvents((data as UsageEvent[]) || []);
          }
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (!mounted) return;
          setError(e instanceof Error ? e.message : 'Failed to load usage events');
          setEvents([]);
          setLoading(false);
        });
    };

    runQuery();
    return () => { mounted = false; };
  }, [activeTab, periodValue, customFrom, customTo, retryCount]);

  // Platform overview + program/cohort: load when those tabs are active
  useEffect(() => {
    if (activeTab !== 1 && activeTab !== 2) return;
    let mounted = true;
    setAggregatedLoading(true);
    setAggregatedError(null);
    (async () => {
      try {
        const [
          managersRes,
          mentorsRes,
          peccsRes,
          crmPeopleRes,
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
          supabase.from('users').select('id, email').eq('role', 'manager').eq('is_active', true),
          supabase.from('users').select('id, email').eq('role', 'mentor').eq('is_active', true),
          supabase.from('users').select('id, email, hospital_facility_id').eq('role', 'pecc').eq('is_active', true),
          supabase
            .from('crm_organizations')
            .select('id, email, contact_type, status')
            .in('contact_type', ['manager', 'mentor', 'pecc']),
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

        const criticalError = [
          managersRes.error,
          mentorsRes.error,
          peccsRes.error,
          assignmentsRes.error,
          hospitalsRes.error,
          programsListRes.error,
          cohortsListRes.error,
          programMembersRes.error,
          cohortMembersRes.error,
        ].find((err) => err && !isSupabaseMissingRelationError(err));
        if (criticalError) {
          throw new Error(criticalError.message);
        }

        if (contactsRes.error && !isSupabaseMissingRelationError(contactsRes.error)) {
          console.warn('Admin snapshot: hospital_contacts', contactsRes.error);
        }
        if (milestonesRes.error && !isSupabaseMissingRelationError(milestonesRes.error)) {
          console.warn('Admin snapshot: site_milestones', milestonesRes.error);
        }
        if (peccActivitiesRes.error && !isSupabaseMissingRelationError(peccActivitiesRes.error)) {
          console.warn('Admin snapshot: pecc_activities', peccActivitiesRes.error);
        }
        if (crmPeopleRes.error && !isSupabaseMissingRelationError(crmPeopleRes.error)) {
          console.warn('Admin snapshot: crm_organizations people', crmPeopleRes.error);
        }
        if (invitationsRes.error && !isSupabaseMissingRelationError(invitationsRes.error)) {
          console.warn('Admin snapshot: invitations', invitationsRes.error);
        }

        const managerUsers = (managersRes.data || []) as { id: string; email: string | null }[];
        const mentorUsers = (mentorsRes.data || []) as { id: string; email: string | null }[];
        const peccUsers = (peccsRes.data || []) as { id: string; email: string | null; hospital_facility_id: string }[];
        const crmPeopleRows = (crmPeopleRes.data || []) as {
          id: string;
          email: string | null;
          contact_type: string | null;
          status: string | null;
        }[];
        const activeCrmPeople = crmPeopleRows.filter(
          (row) => String(row.status ?? '').trim().toLowerCase() !== 'inactive'
        );
        const makeEmailSet = (rows: Array<{ email: string | null }>) =>
          new Set(
            rows
              .map((row) => String(row.email || '').trim().toLowerCase())
              .filter(Boolean)
          );
        const managerEmailSet = makeEmailSet(managerUsers);
        const mentorEmailSet = makeEmailSet(mentorUsers);
        const peccEmailSet = makeEmailSet(peccUsers);
        const crmManagers = activeCrmPeople.filter((row) => row.contact_type === 'manager');
        const crmMentors = activeCrmPeople.filter((row) => row.contact_type === 'mentor');
        const crmPeccs = activeCrmPeople.filter((row) => row.contact_type === 'pecc');
        const countMergedPeople = (
          userRows: Array<{ id: string; email: string | null }>,
          crmRows: Array<{ id: string; email: string | null }>,
          existingEmailSet: Set<string>
        ) => {
          const seen = new Set(existingEmailSet);
          let count = userRows.length;
          crmRows.forEach((row) => {
            const emailKey = String(row.email || '').trim().toLowerCase();
            if (emailKey) {
              if (seen.has(emailKey)) return;
              seen.add(emailKey);
              count += 1;
              return;
            }
            count += 1;
          });
          return count;
        };
        const managers = countMergedPeople(managerUsers, crmManagers, managerEmailSet);
        const mentors = countMergedPeople(mentorUsers, crmMentors, mentorEmailSet);
        const peccs = countMergedPeople(peccUsers, crmPeccs, peccEmailSet);
        const contacts = contactsRes.error ? 0 : (contactsRes.count ?? 0);
        const assignmentsData = (assignmentsRes.data || []) as { hospital_id: string; mentor_id: string }[];
        const hospitalIds = [...new Set(assignmentsData.map((a) => a.hospital_id).filter(Boolean))];
        const sites = hospitalIds.length;
        const totalHospitals = hospitalsRes.count ?? 0;
        const activeAssignments = assignmentsData.length;
        const assignedMentorIds = new Set(assignmentsData.map((a) => a.mentor_id));
        const mentorsWithoutAssignments = Math.max(
          0,
          mentorUsers.filter((m) => !assignedMentorIds.has(m.id)).length
        );
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
        const peccList = peccUsers.map((p) => ({ id: p.id, hospital_facility_id: p.hospital_facility_id }));
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
        const platformHospitalIds = [...new Set([...hospitalIds, ...uniqueHospIds])];
        const [simDataMap, gapDataMap, prsDataMap] = await Promise.all([
          batchGetHospitalDataForKey<unknown[]>(platformHospitalIds, 'simulation_sessions'),
          batchGetHospitalDataForKey<unknown[]>(platformHospitalIds, 'gapPlans'),
          batchGetHospitalDataForKey<unknown[]>(platformHospitalIds, 'readinessScores'),
        ]);
        let simulationsTotal = 0;
        let simulationParticipants = 0;
        let gapPlansTotal = 0;
        let gapPlansCompleted = 0;
        const prsLatestScores: number[] = [];
        for (const hid of platformHospitalIds) {
          const sessions = simDataMap.get(hid);
          if (Array.isArray(sessions)) {
            simulationsTotal += sessions.length;
            sessions.forEach((s) => {
              const p = (s as { participants?: unknown[] })?.participants;
              if (Array.isArray(p)) simulationParticipants += p.length;
            });
          }
          const gaps = gapDataMap.get(hid);
          if (Array.isArray(gaps)) {
            gapPlansTotal += gaps.length;
            gaps.forEach((g) => {
              if (String((g as { status?: string })?.status ?? '').trim().toLowerCase() === 'completed') {
                gapPlansCompleted += 1;
              }
            });
          }
          const prs = prsDataMap.get(hid);
          if (Array.isArray(prs) && prs.length > 0) {
            const parsed = prs
              .map((entry) => {
                const score = Number((entry as { score?: unknown })?.score);
                const date = String((entry as { date?: unknown })?.date || '');
                if (!Number.isFinite(score) || !date) return null;
                return { score, date };
              })
              .filter((x): x is { score: number; date: string } => Boolean(x))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            if (parsed.length) prsLatestScores.push(parsed[parsed.length - 1].score);
          }
        }
        const avgPrsLatest =
          prsLatestScores.length > 0
            ? Math.round((prsLatestScores.reduce((s, v) => s + v, 0) / prsLatestScores.length) * 10) / 10
            : 0;
        const mentorIds = mentorUsers.map((m) => m.id);
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
          peccActivitiesThisMonth,
          simulationsTotal,
          simulationParticipants,
          gapPlansTotal,
          gapPlansCompleted,
          avgPrsLatest,
        });
      } catch (e: unknown) {
        if (!mounted) return;
        const errMsg = e instanceof Error ? e.message : 'Failed to load platform data';
        setAggregatedError(errMsg);
      } finally {
        if (mounted) setAggregatedLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeTab, aggregatedRetry]);

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

  const downloadBreakdownCsv = useCallback(() => {
    downloadTableCsv(
      `impacts-program-cohort-breakdown-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Section', 'Name', 'Program', 'Mentors', 'PECCs', 'Sites', 'Mentor hours (mo)', 'Activities (mo)', 'Avg PECC progress %'],
      [
        ...filteredProgramBreakdowns.map((p) => [
          'Program',
          p.name,
          '',
          p.mentorCount,
          p.peccCount,
          p.sites,
          p.mentorHoursThisMonth.toFixed(1),
          p.mentorActivitiesThisMonth,
          p.avgPeccProgress,
        ]),
        ...filteredCohortBreakdowns.map((c) => [
          'Cohort',
          c.name,
          c.programName || '',
          c.mentorCount,
          c.peccCount,
          c.sites,
          c.mentorHoursThisMonth.toFixed(1),
          c.mentorActivitiesThisMonth,
          c.avgPeccProgress,
        ]),
      ]
    );
  }, [filteredProgramBreakdowns, filteredCohortBreakdowns]);

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
    <AdminPageShell>
      <AdminHero
        overline="Admin"
        title="Reports"
        description="Program improvement (PECC progress, mentor hours, milestones, gap plans), platform health (usage analytics and adoption by role), and research-ready CSV exports with optional de-identification — plus custom datasets, KPIs, and cohort breakdowns."
      />

      <Paper elevation={0} sx={adminSectionShellSx}>
        <Box sx={{ ...adminSectionHeaderSx, py: 0, alignItems: 'stretch' }}>
          <Tabs
            value={activeTab}
            onChange={(_, v: number) => setActiveTab(v as 0 | 1 | 2 | 3)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 48,
              width: '100%',
              '& .MuiTab-root': {
                minHeight: 48,
                py: 1,
                px: { xs: 1.25, sm: 1.75 },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
              },
            }}
          >
            <Tab icon={<AssessmentIcon />} iconPosition="start" label="Reports" />
            <Tab icon={<DashboardIcon />} iconPosition="start" label="Platform overview" />
            <Tab icon={<TableChartIcon />} iconPosition="start" label="By program & cohort" />
            <Tab icon={<AnalyticsIcon />} iconPosition="start" label="Usage analytics" />
          </Tabs>
        </Box>
      </Paper>

      {activeTab === 0 && (
        currentUser?.id ? (
          <Stack spacing={2.5}>
            <StateMetricsMapPanel />
            <StaffPeccReportBuilder scope="admin" actorUserId={currentUser.id} />
          </Stack>
        ) : (
          <Alert severity="info">Sign in to build and export reports.</Alert>
        )
      )}

      {activeTab === 1 && (
        <AdminSection
          overline="Platform"
          title="Platform overview"
          description="Aggregated counts from managers, mentors, and PECC tiers."
          disableBodyPadding
          actions={
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
                onClick={() => setAggregatedRetry((c) => c + 1)}
                disabled={aggregatedLoading}
              >
                Refresh
              </Button>
            </Stack>
          }
        >
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            {aggregatedError && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setAggregatedError(null); setAggregatedRetry((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {aggregatedError}
              </Alert>
            )}
            {!aggregated && !aggregatedLoading && !aggregatedError && (
              <Alert severity="info" sx={{ mb: 2 }}>No platform overview data yet. Click Refresh to load.</Alert>
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
                <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                  <Grid item xs={12} sm={6} md={4}>
                    <KpiTile
                      icon={<PeopleIcon color="primary" fontSize="small" />}
                      title="Managers"
                      value={aggregated.managers}
                      caption="Active platform-wide"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <KpiTile
                      icon={<AssignmentIcon color="primary" fontSize="small" />}
                      title="Mentors"
                      value={aggregated.mentors}
                      caption={aggregated.managers > 0 ? `~${(aggregated.mentors / aggregated.managers).toFixed(0)} per manager` : 'Active platform-wide'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <KpiTile
                      icon={<GroupIcon color="primary" fontSize="small" />}
                      title="PECCs"
                      value={aggregated.peccs}
                      caption="At assigned sites"
                    />
                  </Grid>
                </Grid>


                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Sites & contacts
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                  Outcomes & clinical readiness
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <WorkIcon color="secondary" />
                          <Typography variant="subtitle1" fontWeight={600}>PECC hours (this month)</Typography>
                        </Box>
                        <Typography variant="h4" color="secondary.main">{aggregated.peccHoursThisMonth.toFixed(1)}h</Typography>
                        <Typography variant="caption" color="text.secondary">{aggregated.peccActivitiesThisMonth} activities</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'info.main' }}>
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <AssignmentIcon color="info" />
                          <Typography variant="subtitle1" fontWeight={600}>Simulations</Typography>
                        </Box>
                        <Typography variant="h4" color="info.main">{aggregated.simulationsTotal}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aggregated.simulationParticipants} participants logged
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'success.main' }}>
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <FlagIcon color="success" />
                          <Typography variant="subtitle1" fontWeight={600}>Gap plans completed</Typography>
                        </Box>
                        <Typography variant="h4" color="success.main">{aggregated.gapPlansCompleted}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          of {aggregated.gapPlansTotal} total
                          {aggregated.gapPlansTotal > 0
                            ? ` (${Math.round((aggregated.gapPlansCompleted / aggregated.gapPlansTotal) * 100)}%)`
                            : ''}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined" sx={{ height: '100%', borderLeft: 3, borderLeftColor: 'primary.main' }}>
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <AssessmentIcon color="primary" />
                          <Typography variant="subtitle1" fontWeight={600}>Avg latest PRS</Typography>
                        </Box>
                        <Typography variant="h4" color="primary.main">
                          {aggregated.avgPrsLatest > 0 ? aggregated.avgPrsLatest : '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">Across sites with assessments</Typography>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
                      <CardContent sx={{ py: 1.5, px: 1.75, '&:last-child': { pb: 1.5 } }}>
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
        </AdminSection>
      )}

      {activeTab === 2 && (
        <AdminSection
          overline="Breakdown"
          title="By program & cohort"
          description="Compare mentors, PECCs, sites, and hours across programs and cohorts."
          disableBodyPadding
          actions={
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
                sx={{ minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
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
                startIcon={<FileDownloadIcon />}
                onClick={downloadBreakdownCsv}
                disabled={aggregatedLoading || (filteredProgramBreakdowns.length === 0 && filteredCohortBreakdowns.length === 0)}
              >
                Export CSV
              </Button>
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => setAggregatedRetry((c) => c + 1)}
                disabled={aggregatedLoading}
              >
                Refresh
              </Button>
            </Stack>
          }
        >
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            {aggregatedError && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setAggregatedError(null); setAggregatedRetry((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {aggregatedError}
              </Alert>
            )}
            {aggregatedLoading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading breakdowns...</Typography>
              </Box>
            ) : aggregatedError ? null : (
              <>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ ...adminSectionShellSx, p: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Programs: mentors, PECCs, and sites
                      </Typography>
                      <ProgramBreakdownGroupedBar programs={filteredProgramBreakdowns} />
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper elevation={0} sx={{ ...adminSectionShellSx, p: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Cohorts: mentors, PECCs, and sites
                      </Typography>
                      <CohortBreakdownGroupedBar cohorts={filteredCohortBreakdowns} />
                    </Paper>
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
        </AdminSection>
      )}

      {activeTab === 3 && (
        <AdminSection
          overline="Usage"
          title="Usage analytics"
          description="Logins, page views, clicks, and feature adoption by role for the selected period."
          disableBodyPadding
          actions={
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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
                sx={{ minWidth: 180 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
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
                    sx={{ width: 140 }}
                  />
                  <TextField
                    size="small"
                    label="To"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 140 }}
                  />
                </>
              )}
              <FormControl size="small" sx={{ minWidth: 110 }}>
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
            </Stack>
          }
        >
          <Box sx={{ p: { xs: 2, md: 2.5 } }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} action={
                <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount((c) => c + 1); }}>
                  Retry
                </Button>
              }>
                {error}
              </Alert>
            )}
            {periodValue === 'custom' && (!customFrom || !customTo) && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Choose both From and To dates to load a custom range.
              </Alert>
            )}
            {!loading && !error && events.length === 0 && !(periodValue === 'custom' && (!customFrom || !customTo)) && (
              <Alert severity="info" sx={{ mb: 2 }}>
                No usage events for this period. Try a wider date range or click Refresh.
              </Alert>
            )}
            {!loading && !error && events.length >= 40000 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Showing the most recent 40,000 events for this period. Use a shorter date range for complete counts in high-traffic windows.
              </Alert>
            )}
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">Loading usage analytics...</Typography>
              </Box>
            ) : (
              <>
                <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <KpiTile
                      icon={<PeopleIcon color="primary" fontSize="small" />}
                      title="Logins"
                      value={metrics.totalLogins}
                    >
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {Object.entries(metrics.uniqueLoginsByRole).map(([role, set]) => (
                          <Chip key={role} label={`${role}: ${set.size}`} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </KpiTile>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <KpiTile
                      icon={<PageviewIcon color="primary" fontSize="small" />}
                      title="Page views"
                      value={metrics.totalPageViews}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <KpiTile
                      icon={<TouchAppIcon color="primary" fontSize="small" />}
                      title="Clicks"
                      value={metrics.totalClicks}
                    >
                      {Object.keys(metrics.clickCountByRole).length > 0 && (
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {Object.entries(metrics.clickCountByRole).map(([role, count]) => (
                            <Chip key={role} label={`${role}: ${count}`} size="small" variant="outlined" />
                          ))}
                        </Box>
                      )}
                    </KpiTile>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <KpiTile
                      icon={<LinkIcon color="primary" fontSize="small" />}
                      title="Link clicks"
                      value={metrics.totalLinkClicks}
                    />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Visual summary
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} lg={6}>
                    <ChartPanel title="Event volume by day">
                      <UsageActivityVolumeChart byDay={usageByDay} />
                    </ChartPanel>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <ChartPanel title="Unique logins by role">
                      <UsageUniqueLoginsPie byRole={uniqueLoginsPieData} />
                    </ChartPanel>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <ChartPanel title="Events by type">
                      <UsageEventTypesBar rows={eventTypeBreakdown} />
                    </ChartPanel>
                  </Grid>
                  <Grid item xs={12} lg={6}>
                    <ChartPanel title="Top pages (views)">
                      <UsageTopPagesBar pages={filterUsageTable(metrics.mostUsedPages, usageSearch)} pathLabel={pathLabel} />
                    </ChartPanel>
                  </Grid>
                  <Grid item xs={12}>
                    <ChartPanel title="UI clicks by role">
                      <ClicksByRoleBar byRole={clicksByRoleData} />
                    </ChartPanel>
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
        </AdminSection>
      )}
    </AdminPageShell>
  );
}
