/**
 * Longitudinal and operational report dataset loaders for Admin Reports.
 */
import { format } from 'date-fns';
import { supabase } from '../supabase';
import { buildHospitalsTableOrClause, isHospitalUuid } from './hospitalId';
import { batchGetMentorActivitiesForUsers } from './mentorActivities';
import type { ReportRowLinkHints } from './reportPresets';
import {
  batchGetHospitalDataForKey,
  batchGetUserDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
} from './userData';
import { isSupabaseMissingRelationError } from './supabaseErrors';
import {
  getManagedMentorIdsForManager,
  getManagedCohortIdsForManager,
  getManagedCohortPeopleIdsForManager,
} from './managerTeamScope';

const POSTGREST_PAGE = 1000;

export type LongitudinalReportDataset =
  | 'prs_longitudinal'
  | 'activities_longitudinal'
  | 'gap_plans_longitudinal'
  | 'simulations_longitudinal'
  | 'mentor_hours'
  | 'invitations'
  | 'wages'
  | 'cohort_discussions'
  | 'site_milestones_detail';

export interface LongitudinalReportRow {
  id: string;
  cells: Record<string, string>;
  linkHints?: ReportRowLinkHints;
}

export interface LongitudinalColumnMeta {
  id: string;
  label: string;
  defaultOn: boolean;
  group?: string;
}

export interface LongitudinalLoadContext {
  scope: 'admin' | 'manager' | 'mentor';
  actorUserId: string;
  hospitalScope: string[] | null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAllRows<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await run(from, from + POSTGREST_PAGE - 1);
    if (error) throw error;
    const page = data || [];
    all.push(...page);
    if (page.length < POSTGREST_PAGE) break;
    from += POSTGREST_PAGE;
  }
  return all;
}

async function fetchAllRowsOrEmpty<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await run(from, from + POSTGREST_PAGE - 1);
    if (error) {
      if (isSupabaseMissingRelationError(error)) return [];
      throw error;
    }
    const page = data || [];
    all.push(...page);
    if (page.length < POSTGREST_PAGE) break;
    from += POSTGREST_PAGE;
  }
  return all;
}

function hospitalInScope(hospitalRef: string | null | undefined, scopeSet: Set<string> | null): boolean {
  if (!scopeSet) return true;
  if (!hospitalRef) return false;
  return scopeSet.has(String(hospitalRef).trim());
}

async function resolveScopeHospitalSet(hospitalScope: string[] | null): Promise<Set<string> | null> {
  if (hospitalScope === null) return null;
  const refMap = await mapSiteRefsToHospitalRowIds(hospitalScope);
  const set = new Set<string>();
  for (const ref of hospitalScope) {
    const t = String(ref || '').trim();
    if (!t) continue;
    set.add(t);
    const uuid = refMap.get(t);
    if (uuid) set.add(uuid);
  }
  return set;
}

async function loadPeccUsersInScope(hospitalScope: string[] | null) {
  const peccs = await fetchAllRows<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    hospital_facility_id: string | null;
    mentor_id: string | null;
    manager_id: string | null;
  }>((from, to) =>
    supabase
      .from('users')
      .select('id, first_name, last_name, email, hospital_facility_id, mentor_id, manager_id')
      .eq('role', 'pecc')
      .eq('is_active', true)
      .range(from, to)
  );
  if (!hospitalScope || hospitalScope.length === 0) return hospitalScope === null ? peccs : [];
  const scopeSet = await resolveScopeHospitalSet(hospitalScope);
  return peccs.filter((p) => {
    const ref = p.hospital_facility_id;
    if (!ref) return false;
    return hospitalInScope(ref, scopeSet) || (scopeSet?.has(ref) ?? false);
  });
}

async function loadHospitalNameMap(refs: string[]): Promise<Map<string, { id: string; name: string; state: string }>> {
  const map = new Map<string, { id: string; name: string; state: string }>();
  const unique = [...new Set(refs.map((r) => String(r || '').trim()).filter(Boolean))];
  if (!unique.length) return map;
  for (const part of chunk(unique, 40)) {
    const orClause = buildHospitalsTableOrClause(part);
    if (!orClause || orClause.includes('__no_match__')) continue;
    const { data } = await supabase.from('hospitals').select('id, name, state, facility_id').or(orClause);
    (data || []).forEach((h: { id: string; name: string; state: string | null; facility_id: string | null }) => {
      const row = { id: h.id, name: h.name, state: String(h.state || '').toUpperCase() };
      map.set(h.id, row);
      if (h.facility_id) map.set(String(h.facility_id), row);
    });
  }
  return map;
}

async function loadProgramCohortLabelsForUsers(userIds: string[]): Promise<{
  programs: Map<string, string>;
  cohorts: Map<string, string>;
}> {
  const progMap = new Map<string, string>();
  const coMap = new Map<string, string>();
  const [programs, cohorts, pm, cm] = await Promise.all([
    fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
      supabase.from('programs').select('id, name').eq('is_active', true).range(from, to)
    ),
    fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
      supabase.from('cohorts').select('id, name').eq('is_active', true).range(from, to)
    ),
    fetchAllRowsOrEmpty<{ user_id: string; program_id: string }>((from, to) =>
      supabase.from('program_members').select('user_id, program_id').eq('status', 'active').in('user_id', userIds).range(from, to)
    ),
    fetchAllRowsOrEmpty<{ user_id: string; cohort_id: string }>((from, to) =>
      supabase.from('cohort_members').select('user_id, cohort_id').eq('status', 'active').in('user_id', userIds).range(from, to)
    ),
  ]);
  programs.forEach((p) => progMap.set(p.id, p.name));
  cohorts.forEach((c) => coMap.set(c.id, c.name));
  const programsByUser = new Map<string, string[]>();
  const cohortsByUser = new Map<string, string[]>();
  pm.forEach((row) => {
    const list = programsByUser.get(row.user_id) || [];
    list.push(progMap.get(row.program_id) || row.program_id);
    programsByUser.set(row.user_id, list);
  });
  cm.forEach((row) => {
    const list = cohortsByUser.get(row.user_id) || [];
    list.push(coMap.get(row.cohort_id) || row.cohort_id);
    cohortsByUser.set(row.user_id, list);
  });
  return {
    programs: new Map([...programsByUser].map(([uid, names]) => [uid, names.join('; ')])),
    cohorts: new Map([...cohortsByUser].map(([uid, names]) => [uid, names.join('; ')])),
  };
}

export function buildLongitudinalColumnList(dataset: LongitudinalReportDataset): LongitudinalColumnMeta[] {
  switch (dataset) {
    case 'prs_longitudinal':
      return [
        { id: 'assessmentDate', label: 'Assessment date', defaultOn: true, group: 'PRS' },
        { id: 'score', label: 'PRS score', defaultOn: true, group: 'PRS' },
        { id: 'sequenceNumber', label: 'Assessment # (chronological)', defaultOn: true, group: 'PRS' },
        { id: 'baselineScore', label: 'Baseline score', defaultOn: true, group: 'PRS' },
        { id: 'deltaFromBaseline', label: 'Delta from baseline', defaultOn: true, group: 'PRS' },
        { id: 'name', label: 'PECC name', defaultOn: true, group: 'Person' },
        { id: 'email', label: 'Email', defaultOn: false, group: 'Person' },
        { id: 'hospitalName', label: 'Site', defaultOn: true, group: 'Site' },
        { id: 'state', label: 'State', defaultOn: true, group: 'Site' },
        { id: 'facilityId', label: 'Facility ID', defaultOn: false, group: 'Site' },
        { id: 'programs', label: 'Programs', defaultOn: false, group: 'Membership' },
        { id: 'cohorts', label: 'Cohorts', defaultOn: false, group: 'Membership' },
      ];
    case 'activities_longitudinal':
      return [
        { id: 'activityDate', label: 'Activity date', defaultOn: true, group: 'Activity' },
        { id: 'hours', label: 'Hours', defaultOn: true, group: 'Activity' },
        { id: 'categories', label: 'Categories', defaultOn: true, group: 'Activity' },
        { id: 'activityName', label: 'Activity name', defaultOn: true, group: 'Activity' },
        { id: 'description', label: 'Description', defaultOn: false, group: 'Activity' },
        { id: 'name', label: 'PECC name', defaultOn: true, group: 'Person' },
        { id: 'hospitalName', label: 'Site', defaultOn: true, group: 'Site' },
        { id: 'state', label: 'State', defaultOn: true, group: 'Site' },
        { id: 'programs', label: 'Programs', defaultOn: false, group: 'Membership' },
      ];
    case 'gap_plans_longitudinal':
      return [
        { id: 'gapTitle', label: 'Gap title', defaultOn: true, group: 'Gap plan' },
        { id: 'gapStatus', label: 'Status', defaultOn: true, group: 'Gap plan' },
        { id: 'gapCategory', label: 'Category / domain', defaultOn: true, group: 'Gap plan' },
        { id: 'gapUpdated', label: 'Last updated', defaultOn: true, group: 'Gap plan' },
        { id: 'name', label: 'PECC name', defaultOn: true, group: 'Person' },
        { id: 'hospitalName', label: 'Site', defaultOn: true, group: 'Site' },
        { id: 'state', label: 'State', defaultOn: true, group: 'Site' },
      ];
    case 'simulations_longitudinal':
      return [
        { id: 'sessionDate', label: 'Session date', defaultOn: true, group: 'Simulation' },
        { id: 'simulationCase', label: 'Case / scenario', defaultOn: true, group: 'Simulation' },
        { id: 'participantCount', label: 'Participants', defaultOn: true, group: 'Simulation' },
        { id: 'hospitalName', label: 'Site', defaultOn: true, group: 'Site' },
        { id: 'state', label: 'State', defaultOn: true, group: 'Site' },
        { id: 'facilityId', label: 'Facility ID', defaultOn: false, group: 'Site' },
      ];
    case 'mentor_hours':
      return [
        { id: 'activityDate', label: 'Date', defaultOn: true, group: 'Mentor activity' },
        { id: 'hours', label: 'Hours', defaultOn: true, group: 'Mentor activity' },
        { id: 'category', label: 'Category', defaultOn: true, group: 'Mentor activity' },
        { id: 'activityName', label: 'Activity', defaultOn: true, group: 'Mentor activity' },
        { id: 'hospitalNames', label: 'Sites', defaultOn: true, group: 'Mentor activity' },
        { id: 'simulationCase', label: 'Simulation case', defaultOn: false, group: 'Mentor activity' },
        { id: 'simParticipants', label: 'Sim participants', defaultOn: false, group: 'Mentor activity' },
        { id: 'mentorName', label: 'Mentor', defaultOn: true, group: 'Person' },
        { id: 'mentorEmail', label: 'Mentor email', defaultOn: false, group: 'Person' },
        { id: 'description', label: 'Notes', defaultOn: false, group: 'Mentor activity' },
      ];
    case 'invitations':
      return [
        { id: 'email', label: 'Invitee email', defaultOn: true, group: 'Invitation' },
        { id: 'role', label: 'Role', defaultOn: true, group: 'Invitation' },
        { id: 'status', label: 'Status', defaultOn: true, group: 'Invitation' },
        { id: 'createdAt', label: 'Sent at', defaultOn: true, group: 'Invitation' },
        { id: 'acceptedAt', label: 'Accepted at', defaultOn: true, group: 'Invitation' },
        { id: 'expiresAt', label: 'Expires at', defaultOn: false, group: 'Invitation' },
        { id: 'daysToAccept', label: 'Days to accept', defaultOn: true, group: 'Invitation' },
        { id: 'hospitalName', label: 'Site', defaultOn: true, group: 'Context' },
        { id: 'mentorName', label: 'Mentor', defaultOn: false, group: 'Context' },
        { id: 'managerName', label: 'Manager', defaultOn: false, group: 'Context' },
      ];
    case 'wages':
      return [
        { id: 'userName', label: 'Name', defaultOn: true, group: 'Payroll' },
        { id: 'userRole', label: 'Role', defaultOn: true, group: 'Payroll' },
        { id: 'payPeriodStart', label: 'Pay period start', defaultOn: true, group: 'Payroll' },
        { id: 'payPeriodEnd', label: 'Pay period end', defaultOn: true, group: 'Payroll' },
        { id: 'hoursWorked', label: 'Hours worked', defaultOn: true, group: 'Payroll' },
        { id: 'hourlyRate', label: 'Hourly rate', defaultOn: true, group: 'Payroll' },
        { id: 'stipendAmount', label: 'Stipend', defaultOn: true, group: 'Payroll' },
        { id: 'totalAmount', label: 'Total amount', defaultOn: true, group: 'Payroll' },
        { id: 'status', label: 'Payment status', defaultOn: true, group: 'Payroll' },
        { id: 'approvedAt', label: 'Approved at', defaultOn: false, group: 'Payroll' },
        { id: 'notes', label: 'Notes', defaultOn: false, group: 'Payroll' },
      ];
    case 'cohort_discussions':
      return [
        { id: 'postType', label: 'Post type', defaultOn: true, group: 'Discussion' },
        { id: 'cohortName', label: 'Cohort', defaultOn: true, group: 'Discussion' },
        { id: 'programName', label: 'Program', defaultOn: true, group: 'Discussion' },
        { id: 'title', label: 'Title / topic', defaultOn: true, group: 'Discussion' },
        { id: 'contentExcerpt', label: 'Content excerpt', defaultOn: true, group: 'Discussion' },
        { id: 'authorName', label: 'Author', defaultOn: true, group: 'Discussion' },
        { id: 'createdAt', label: 'Posted at', defaultOn: true, group: 'Discussion' },
        { id: 'replyCount', label: 'Replies', defaultOn: false, group: 'Discussion' },
      ];
    case 'site_milestones_detail':
      return [
        { id: 'hospitalName', label: 'Site', defaultOn: true, group: 'Milestone' },
        { id: 'state', label: 'State', defaultOn: true, group: 'Milestone' },
        { id: 'milestoneName', label: 'Milestone', defaultOn: true, group: 'Milestone' },
        { id: 'status', label: 'Status', defaultOn: true, group: 'Milestone' },
        { id: 'targetDate', label: 'Target date', defaultOn: true, group: 'Milestone' },
        { id: 'completedDate', label: 'Completed date', defaultOn: true, group: 'Milestone' },
        { id: 'assignedTo', label: 'Assigned to', defaultOn: false, group: 'Milestone' },
        { id: 'notes', label: 'Notes', defaultOn: false, group: 'Milestone' },
      ];
    default:
      return [];
  }
}

export function longitudinalDatasetTitle(dataset: LongitudinalReportDataset): string {
  const titles: Record<LongitudinalReportDataset, string> = {
    prs_longitudinal: 'PRS assessments (longitudinal)',
    activities_longitudinal: 'PECC activities (longitudinal)',
    gap_plans_longitudinal: 'Gap plans (longitudinal)',
    simulations_longitudinal: 'Simulations (longitudinal)',
    mentor_hours: 'Mentor hours & activities',
    invitations: 'Invitations funnel',
    wages: 'Wages & payroll',
    cohort_discussions: 'Cohort discussions',
    site_milestones_detail: 'Site milestones (detail)',
  };
  return titles[dataset];
}

export function longitudinalDatasetSlug(dataset: LongitudinalReportDataset): string {
  return dataset.replace(/_/g, '-');
}

export function isLongitudinalReportDataset(value: string): value is LongitudinalReportDataset {
  return [
    'prs_longitudinal',
    'activities_longitudinal',
    'gap_plans_longitudinal',
    'simulations_longitudinal',
    'mentor_hours',
    'invitations',
    'wages',
    'cohort_discussions',
    'site_milestones_detail',
  ].includes(value);
}

export function formatPrsTimeline(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return '';
  const parsed = value
    .map((entry) => {
      const score = Number((entry as { score?: unknown })?.score);
      const date = String((entry as { date?: unknown })?.date || '');
      if (!Number.isFinite(score) || !date) return null;
      return { score, date };
    })
    .filter((x): x is { score: number; date: string } => Boolean(x))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return parsed.map((p) => `${p.date}:${p.score.toFixed(2)}`).join('; ');
}

export async function loadLongitudinalReportDataset(
  dataset: LongitudinalReportDataset,
  ctx: LongitudinalLoadContext
): Promise<LongitudinalReportRow[]> {
  switch (dataset) {
    case 'prs_longitudinal':
      return loadPrsLongitudinal(ctx);
    case 'activities_longitudinal':
      return loadActivitiesLongitudinal(ctx);
    case 'gap_plans_longitudinal':
      return loadGapPlansLongitudinal(ctx);
    case 'simulations_longitudinal':
      return loadSimulationsLongitudinal(ctx);
    case 'mentor_hours':
      return loadMentorHours(ctx);
    case 'invitations':
      return loadInvitations(ctx);
    case 'wages':
      return loadWages(ctx);
    case 'cohort_discussions':
      return loadCohortDiscussions(ctx);
    case 'site_milestones_detail':
      return loadSiteMilestonesDetail(ctx);
    default:
      return [];
  }
}

async function loadPrsLongitudinal(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const peccs = await loadPeccUsersInScope(ctx.hospitalScope);
  if (!peccs.length) return [];
  const peccIds = peccs.map((p) => p.id);
  const refs = peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
  const hospMap = await loadHospitalNameMap(refs);
  const refToUuid = await mapSiteRefsToHospitalRowIds(refs);
  const hospitalUuids = [...new Set(refs.map((r) => refToUuid.get(r)).filter(Boolean))] as string[];
  const [hdReadiness, hdPrs, udMap, membership] = await Promise.all([
    batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'readinessScores'),
    batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'prsReadinessScores'),
    shouldMirrorLegacyUserData()
      ? batchGetUserDataForKey<unknown[]>(peccIds, 'readinessScores')
      : Promise.resolve(new Map<string, unknown[] | null>()),
    loadProgramCohortLabelsForUsers(peccIds),
  ]);
  const rows: LongitudinalReportRow[] = [];
  for (const p of peccs) {
    const hRef = p.hospital_facility_id || '';
    const h = hRef ? hospMap.get(hRef) : undefined;
    const hid = hRef ? refToUuid.get(hRef) : undefined;
    const raw =
      (hid ? hdReadiness.get(hid) : null) ??
      (hid ? hdPrs.get(hid) : null) ??
      udMap.get(p.id);
    if (!Array.isArray(raw)) continue;
    const parsed = raw
      .map((entry) => {
        const score = Number((entry as { score?: unknown })?.score);
        const date = String((entry as { date?: unknown })?.date || '');
        if (!Number.isFinite(score) || !date) return null;
        return { score, date };
      })
      .filter((x): x is { score: number; date: string } => Boolean(x))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!parsed.length) continue;
    const baseline = parsed[0].score;
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    parsed.forEach((assessment, idx) => {
      rows.push({
        id: `prs:${p.id}:${assessment.date}:${idx}`,
        cells: {
          assessmentDate: assessment.date,
          score: assessment.score.toFixed(2),
          sequenceNumber: String(idx + 1),
          baselineScore: baseline.toFixed(2),
          deltaFromBaseline: (assessment.score - baseline).toFixed(2),
          name,
          email: p.email || '',
          hospitalName: h?.name || '',
          state: h?.state || '',
          facilityId: hRef,
          programs: membership.programs.get(p.id) || '',
          cohorts: membership.cohorts.get(p.id) || '',
        },
        linkHints: { userId: p.id, hospitalId: h?.id || hRef || undefined },
      });
    });
  }
  return rows;
}

async function loadActivitiesLongitudinal(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const peccs = await loadPeccUsersInScope(ctx.hospitalScope);
  if (!peccs.length) return [];
  const peccIds = peccs.map((p) => p.id);
  const refs = peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
  const hospMap = await loadHospitalNameMap(refs);
  const refToUuid = await mapSiteRefsToHospitalRowIds(refs);
  const hospitalUuids = [...new Set(refs.map((r) => refToUuid.get(r)).filter(Boolean))] as string[];
  const [hdMap, udMap, membership] = await Promise.all([
    batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'activities'),
    shouldMirrorLegacyUserData() ? batchGetUserDataForKey<unknown[]>(peccIds, 'activities') : Promise.resolve(new Map()),
    loadProgramCohortLabelsForUsers(peccIds),
  ]);
  const rows: LongitudinalReportRow[] = [];
  for (const p of peccs) {
    const hRef = p.hospital_facility_id || '';
    const h = hRef ? hospMap.get(hRef) : undefined;
    const hid = hRef ? refToUuid.get(hRef) : undefined;
    const acts = (hid ? hdMap.get(hid) : null) ?? udMap.get(p.id);
    if (!Array.isArray(acts)) continue;
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    acts.forEach((act, idx) => {
      if (!act || typeof act !== 'object') return;
      const a = act as Record<string, unknown>;
      const categories = Array.isArray(a.categories)
        ? (a.categories as string[]).join('; ')
        : String(a.category || a.activityType || '');
      rows.push({
        id: `act:${p.id}:${String(a.id || idx)}`,
        cells: {
          activityDate: String(a.date || ''),
          hours: String(Number(a.hours) || 0),
          categories,
          activityName: String(a.activityName || a.name || ''),
          description: String(a.description || '').slice(0, 500),
          name,
          hospitalName: h?.name || '',
          state: h?.state || '',
          programs: membership.programs.get(p.id) || '',
        },
        linkHints: { userId: p.id, hospitalId: h?.id || hRef || undefined },
      });
    });
  }
  return rows;
}

async function loadGapPlansLongitudinal(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const peccs = await loadPeccUsersInScope(ctx.hospitalScope);
  if (!peccs.length) return [];
  const peccIds = peccs.map((p) => p.id);
  const refs = peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
  const hospMap = await loadHospitalNameMap(refs);
  const refToUuid = await mapSiteRefsToHospitalRowIds(refs);
  const hospitalUuids = [...new Set(refs.map((r) => refToUuid.get(r)).filter(Boolean))] as string[];
  const [hdMap, udMap] = await Promise.all([
    batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'gapPlans'),
    shouldMirrorLegacyUserData() ? batchGetUserDataForKey<unknown[]>(peccIds, 'gapPlans') : Promise.resolve(new Map()),
  ]);
  const rows: LongitudinalReportRow[] = [];
  for (const p of peccs) {
    const hRef = p.hospital_facility_id || '';
    const h = hRef ? hospMap.get(hRef) : undefined;
    const hid = hRef ? refToUuid.get(hRef) : undefined;
    const gaps = (hid ? hdMap.get(hid) : null) ?? udMap.get(p.id);
    if (!Array.isArray(gaps)) continue;
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    gaps.forEach((gap, idx) => {
      if (!gap || typeof gap !== 'object') return;
      const g = gap as Record<string, unknown>;
      rows.push({
        id: `gap:${p.id}:${String(g.id || idx)}`,
        cells: {
          gapTitle: String(g.title || g.name || g.gapTitle || 'Untitled'),
          gapStatus: String(g.status || ''),
          gapCategory: String(g.category || g.domain || ''),
          gapUpdated: String(g.updatedAt || g.updated_at || g.date || ''),
          name,
          hospitalName: h?.name || '',
          state: h?.state || '',
        },
        linkHints: { userId: p.id, hospitalId: h?.id || hRef || undefined },
      });
    });
  }
  return rows;
}

async function loadSimulationsLongitudinal(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const scopeSet = ctx.hospitalScope ? await resolveScopeHospitalSet(ctx.hospitalScope) : null;
  let hospitalIds: string[] = [];
  if (scopeSet) {
    hospitalIds = [...scopeSet].filter(isHospitalUuid);
  } else {
    hospitalIds = await fetchAllRows<{ id: string }>((from, to) =>
      supabase.from('hospitals').select('id').eq('is_active', true).range(from, to)
    ).then((rows) => rows.map((r) => r.id));
  }
  if (!hospitalIds.length) return [];
  const hospMap = await loadHospitalNameMap(hospitalIds);
  const simMap = await batchGetHospitalDataForKey<unknown[]>(hospitalIds, 'simulation_sessions');
  const rows: LongitudinalReportRow[] = [];
  for (const hid of hospitalIds) {
    const sessions = simMap.get(hid);
    if (!Array.isArray(sessions)) continue;
    const h = hospMap.get(hid);
    sessions.forEach((session, idx) => {
      if (!session || typeof session !== 'object') return;
      const s = session as Record<string, unknown>;
      const participants = Array.isArray(s.participants) ? s.participants.length : Number(s.simParticipants) || 0;
      rows.push({
        id: `sim:${hid}:${String(s.id || idx)}`,
        cells: {
          sessionDate: String(s.date || s.sessionDate || ''),
          simulationCase: String(s.case || s.simulationCase || s.caseName || ''),
          participantCount: String(participants),
          hospitalName: h?.name || '',
          state: h?.state || '',
          facilityId: hid,
        },
        linkHints: { hospitalId: hid },
      });
    });
  }
  return rows;
}

async function loadMentorIdsForScope(ctx: LongitudinalLoadContext): Promise<string[]> {
  if (ctx.scope === 'admin') {
    const mentors = await fetchAllRows<{ id: string }>((from, to) =>
      supabase.from('users').select('id').eq('role', 'mentor').eq('is_active', true).range(from, to)
    );
    return mentors.map((m) => m.id);
  }
  if (ctx.scope === 'manager') {
    const [managed, cohortPeople] = await Promise.all([
      getManagedMentorIdsForManager(ctx.actorUserId),
      getManagedCohortPeopleIdsForManager(ctx.actorUserId),
    ]);
    const ids = new Set(managed);
    if (cohortPeople.length) {
      for (let i = 0; i < cohortPeople.length; i += 80) {
        const part = cohortPeople.slice(i, i + 80);
        const { data } = await supabase.from('users').select('id').in('id', part).eq('role', 'mentor');
        (data || []).forEach((r: { id: string }) => ids.add(r.id));
      }
    }
    return [...ids];
  }
  return [ctx.actorUserId];
}

async function loadMentorHours(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const mentorIds = await loadMentorIdsForScope(ctx);
  if (!mentorIds.length) return [];
  const mentors = await fetchAllRows<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>((from, to) =>
    supabase.from('users').select('id, first_name, last_name, email').in('id', mentorIds).range(from, to)
  );
  const mentorById = new Map(mentors.map((m) => [m.id, m]));
  const allHospitalIds = new Set<string>();
  const rows: LongitudinalReportRow[] = [];
  const activitiesByMentor = await batchGetMentorActivitiesForUsers(mentorIds);
  for (const mid of mentorIds) {
    const m = mentorById.get(mid);
    const acts = activitiesByMentor.get(mid) || [];
    const name = m ? `${m.first_name || ''} ${m.last_name || ''}`.trim() : mid;
    acts.forEach((act: Record<string, unknown>, idx: number) => {
      const hospitalIds = Array.isArray(act.hospitalIds) ? (act.hospitalIds as string[]) : [];
      hospitalIds.forEach((id) => allHospitalIds.add(String(id)));
      rows.push({
        id: `mh:${mid}:${String(act.id || idx)}`,
        cells: {
          activityDate: String(act.date || ''),
          hours: String(Number(act.hours) || 0),
          category: String(act.category || ''),
          activityName: String(act.activityName || ''),
          hospitalNames: hospitalIds.join('; '),
          simulationCase: String(act.simulationCase || ''),
          simParticipants: act.simParticipants != null ? String(act.simParticipants) : '',
          mentorName: name,
          mentorEmail: m?.email || '',
          description: String(act.description || '').slice(0, 500),
        },
        linkHints: { userId: mid },
      });
    });
  }
  if (rows.length && allHospitalIds.size) {
    const hospMap = await loadHospitalNameMap([...allHospitalIds]);
    rows.forEach((row) => {
      const ids = (row.cells.hospitalNames || '').split(';').map((s) => s.trim()).filter(Boolean);
      row.cells.hospitalNames = ids.map((id) => hospMap.get(id)?.name || id).join('; ');
    });
  }
  return rows;
}

async function loadInvitations(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const invitations = await fetchAllRowsOrEmpty<{
    id: string;
    email: string;
    role: string;
    status: string;
    hospital_id: string | null;
    mentor_id: string | null;
    manager_id: string | null;
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
  }>((from, to) =>
    supabase
      .from('invitations')
      .select('id, email, role, status, hospital_id, mentor_id, manager_id, created_at, expires_at, accepted_at')
      .order('created_at', { ascending: false })
      .range(from, to)
  );
  const scopeSet = ctx.hospitalScope ? await resolveScopeHospitalSet(ctx.hospitalScope) : null;
  const mentorIds = ctx.scope !== 'admin' ? new Set(await loadMentorIdsForScope(ctx)) : null;
  const userIds = [
    ...new Set(
      invitations.flatMap((i) => [i.mentor_id, i.manager_id].filter(Boolean) as string[])
    ),
  ];
  const hospIds = [...new Set(invitations.map((i) => i.hospital_id).filter(Boolean))] as string[];
  const [users, hospMap] = await Promise.all([
    userIds.length
      ? fetchAllRows<{ id: string; first_name: string | null; last_name: string | null }>((from, to) =>
          supabase.from('users').select('id, first_name, last_name').in('id', userIds).range(from, to)
        )
      : Promise.resolve([]),
    loadHospitalNameMap(hospIds),
  ]);
  const userName = new Map(
    users.map((u) => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.id])
  );
  return invitations
    .filter((inv) => {
      if (ctx.scope === 'admin' && !scopeSet) return true;
      if (scopeSet && inv.hospital_id && scopeSet.has(inv.hospital_id)) return true;
      if (mentorIds && inv.mentor_id && mentorIds.has(inv.mentor_id)) return true;
      if (ctx.scope === 'manager' && inv.manager_id === ctx.actorUserId) return true;
      return ctx.scope === 'mentor' && inv.mentor_id === ctx.actorUserId;
    })
    .map((inv) => {
      const h = inv.hospital_id ? hospMap.get(inv.hospital_id) : undefined;
      let daysToAccept = '';
      if (inv.accepted_at && inv.created_at) {
        const d = Math.round(
          (new Date(inv.accepted_at).getTime() - new Date(inv.created_at).getTime()) / 86400000
        );
        daysToAccept = String(Math.max(0, d));
      }
      return {
        id: inv.id,
        cells: {
          email: inv.email,
          role: inv.role,
          status: inv.status,
          createdAt: inv.created_at ? format(new Date(inv.created_at), 'yyyy-MM-dd HH:mm') : '',
          acceptedAt: inv.accepted_at ? format(new Date(inv.accepted_at), 'yyyy-MM-dd HH:mm') : '',
          expiresAt: inv.expires_at ? format(new Date(inv.expires_at), 'yyyy-MM-dd') : '',
          daysToAccept,
          hospitalName: h?.name || '',
          mentorName: inv.mentor_id ? userName.get(inv.mentor_id) || '' : '',
          managerName: inv.manager_id ? userName.get(inv.manager_id) || '' : '',
        },
        linkHints: { hospitalId: inv.hospital_id || undefined, userId: inv.mentor_id || undefined },
      };
    });
}

async function loadWages(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  // Manager tier: wages reports are not available (UI also hides the dataset).
  if (ctx.scope === 'manager') return [];
  const entries = await fetchAllRowsOrEmpty<{
    id: string;
    user_id: string;
    pay_period_start: string;
    pay_period_end: string;
    hours_worked: number;
    hourly_rate: number;
    stipend_amount: number;
    total_amount: number;
    status: string;
    approved_at: string | null;
    notes: string | null;
  }>((from, to) =>
    supabase
      .from('wage_entries')
      .select(
        'id, user_id, pay_period_start, pay_period_end, hours_worked, hourly_rate, stipend_amount, total_amount, status, approved_at, notes'
      )
      .order('pay_period_start', { ascending: false })
      .range(from, to)
  );
  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const users = userIds.length
    ? await fetchAllRows<{ id: string; first_name: string | null; last_name: string | null; role: string; manager_id: string | null }>(
        (from, to) =>
          supabase.from('users').select('id, first_name, last_name, role, manager_id').in('id', userIds).range(from, to)
      )
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  return entries
    .filter((e) => {
      const u = userById.get(e.user_id);
      if (!u) return ctx.scope === 'admin';
      if (ctx.scope === 'admin') return true;
      // mentor: own wage entries only
      return e.user_id === ctx.actorUserId;
    })
    .map((e) => {
      const u = userById.get(e.user_id);
      return {
        id: e.id,
        cells: {
          userName: u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : e.user_id,
          userRole: u?.role || '',
          payPeriodStart: e.pay_period_start,
          payPeriodEnd: e.pay_period_end,
          hoursWorked: String(e.hours_worked ?? 0),
          hourlyRate: String(e.hourly_rate ?? 0),
          stipendAmount: String(e.stipend_amount ?? 0),
          totalAmount: String(e.total_amount ?? 0),
          status: e.status,
          approvedAt: e.approved_at ? format(new Date(e.approved_at), 'yyyy-MM-dd') : '',
          notes: String(e.notes || '').slice(0, 300),
        },
        linkHints: { userId: e.user_id },
      };
    });
}

async function loadCohortDiscussions(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const [cohorts, programs, topics, replies] = await Promise.all([
    fetchAllRowsOrEmpty<{ id: string; name: string; program_id: string | null }>((from, to) =>
      supabase.from('cohorts').select('id, name, program_id').eq('is_active', true).range(from, to)
    ),
    fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
      supabase.from('programs').select('id, name').eq('is_active', true).range(from, to)
    ),
    fetchAllRowsOrEmpty<{
      id: string;
      cohort_id: string;
      title: string;
      content: string | null;
      created_by: string | null;
      created_at: string;
      reply_count: number | null;
    }>((from, to) =>
      supabase
        .from('cohort_discussion_topics')
        .select('id, cohort_id, title, content, created_by, created_at, reply_count')
        .order('created_at', { ascending: false })
        .range(from, to)
    ),
    fetchAllRowsOrEmpty<{
      id: string;
      topic_id: string;
      content: string | null;
      created_by: string | null;
      created_at: string;
    }>((from, to) =>
      supabase
        .from('cohort_discussion_replies')
        .select('id, topic_id, content, created_by, created_at')
        .order('created_at', { ascending: false })
        .range(from, to)
    ),
  ]);
  const cohortMap = new Map(cohorts.map((c) => [c.id, c]));
  const programMap = new Map(programs.map((p) => [p.id, p.name]));
  const authorIds = [
    ...new Set([
      ...topics.map((t) => t.created_by).filter(Boolean),
      ...replies.map((r) => r.created_by).filter(Boolean),
    ]),
  ] as string[];
  const authors = authorIds.length
    ? await fetchAllRows<{ id: string; first_name: string | null; last_name: string | null }>((from, to) =>
        supabase.from('users').select('id, first_name, last_name').in('id', authorIds).range(from, to)
      )
    : [];
  const authorName = new Map(
    authors.map((a) => [a.id, `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.id])
  );
  const managedCohortIds =
    ctx.scope === 'manager' ? new Set(await getManagedCohortIdsForManager(ctx.actorUserId)) : null;
  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const rows: LongitudinalReportRow[] = [];
  const topicById = new Map(topics.map((t) => [t.id, t]));
  topics.forEach((t) => {
    if (managedCohortIds && !managedCohortIds.has(t.cohort_id)) return;
    const coh = cohortMap.get(t.cohort_id);
    const progName = coh?.program_id ? programMap.get(coh.program_id) || '' : '';
    rows.push({
      id: `topic:${t.id}`,
      cells: {
        postType: 'Topic',
        cohortName: coh?.name || '',
        programName: progName,
        title: t.title,
        contentExcerpt: stripHtml(String(t.content || '')).slice(0, 400),
        authorName: t.created_by ? authorName.get(t.created_by) || '' : '',
        createdAt: t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm') : '',
        replyCount: String(t.reply_count ?? 0),
      },
    });
  });
  replies.forEach((r) => {
    const topic = topicById.get(r.topic_id);
    if (managedCohortIds && topic && !managedCohortIds.has(topic.cohort_id)) return;
    if (managedCohortIds && !topic) return;
    const coh = topic ? cohortMap.get(topic.cohort_id) : undefined;
    const progName = coh?.program_id ? programMap.get(coh.program_id) || '' : '';
    rows.push({
      id: `reply:${r.id}`,
      cells: {
        postType: 'Reply',
        cohortName: coh?.name || '',
        programName: progName,
        title: topic?.title || '',
        contentExcerpt: stripHtml(String(r.content || '')).slice(0, 400),
        authorName: r.created_by ? authorName.get(r.created_by) || '' : '',
        createdAt: r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '',
        replyCount: '',
      },
    });
  });
  return rows;
}

async function loadSiteMilestonesDetail(ctx: LongitudinalLoadContext): Promise<LongitudinalReportRow[]> {
  const scopeSet = ctx.hospitalScope ? await resolveScopeHospitalSet(ctx.hospitalScope) : null;
  let milestones: Array<{
    id: string;
    hospital_id: string;
    milestone_name: string;
    status: string;
    target_date: string | null;
    completed_date: string | null;
    assigned_to: string | null;
    notes: string | null;
  }> = [];
  if (scopeSet) {
    const uuids = [...scopeSet].filter(isHospitalUuid);
    for (const part of chunk(uuids, 80)) {
      const partRows = await fetchAllRowsOrEmpty<typeof milestones[0]>((from, to) =>
        supabase
          .from('site_milestones')
          .select('id, hospital_id, milestone_name, status, target_date, completed_date, assigned_to, notes')
          .in('hospital_id', part)
          .range(from, to)
      );
      milestones.push(...partRows);
    }
  } else {
    milestones = await fetchAllRowsOrEmpty((from, to) =>
      supabase
        .from('site_milestones')
        .select('id, hospital_id, milestone_name, status, target_date, completed_date, assigned_to, notes')
        .range(from, to)
    );
  }
  const hospIds = [...new Set(milestones.map((m) => m.hospital_id))];
  const assigneeIds = [...new Set(milestones.map((m) => m.assigned_to).filter(Boolean))] as string[];
  const [hospMap, assignees] = await Promise.all([
    loadHospitalNameMap(hospIds),
    assigneeIds.length
      ? fetchAllRows<{ id: string; first_name: string | null; last_name: string | null }>((from, to) =>
          supabase.from('users').select('id, first_name, last_name').in('id', assigneeIds).range(from, to)
        )
      : Promise.resolve([]),
  ]);
  const assigneeName = new Map(
    assignees.map((a) => [a.id, `${a.first_name || ''} ${a.last_name || ''}`.trim()])
  );
  return milestones.map((m) => {
    const h = hospMap.get(m.hospital_id);
    return {
      id: m.id,
      cells: {
        hospitalName: h?.name || '',
        state: h?.state || '',
        milestoneName: m.milestone_name,
        status: m.status,
        targetDate: m.target_date || '',
        completedDate: m.completed_date || '',
        assignedTo: m.assigned_to ? assigneeName.get(m.assigned_to) || m.assigned_to : '',
        notes: String(m.notes || '').slice(0, 300),
      },
      linkHints: { hospitalId: m.hospital_id },
    };
  });
}
