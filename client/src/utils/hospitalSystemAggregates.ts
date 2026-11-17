/**
 * Aggregate Assessment Gaps + Simulation continuity data across hospitals in a system.
 */
import { EDUCATION_BUCKETS } from '../constants/educationBuckets';
import { isGapPlanCompleted, normalizeGapPlanStatus } from './snapshotGapStatus';
import type { HospitalSystemSite } from './hospitalSystemScope';

export const GAP_STATUS_LABELS = [
  'In Progress',
  'Needs Update',
  'Need to Develop',
  'Cannot be done at this time',
  'Completed',
] as const;

export type GapStatusLabel = (typeof GAP_STATUS_LABELS)[number];

export const SIM_GAP_STATUS_LABELS = [
  { key: 'identified', label: 'Identified' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

export interface ContinuityGapPlan {
  id?: string;
  questionId?: string;
  questionText?: string;
  status?: string;
  action?: string;
}

export interface ContinuityActivity {
  id?: string;
  hours?: number | string;
  associatedGaps?: string[];
  associatedSimulationGaps?: string[];
  categories?: string[];
  simulation?: string;
  simbox_case_key?: string;
  title?: string;
}

export interface ContinuitySimSession {
  id?: string;
  caseId?: string;
  caseName?: string;
  date?: string;
  participants?: string[] | string;
  duration?: number;
}

export interface ContinuitySimGap {
  id?: string;
  caseName?: string;
  category?: string;
  severity?: string;
  status?: string;
  description?: string;
  linkedActivities?: string[];
}

export interface SiteContinuityBundle {
  site: HospitalSystemSite;
  canonicalHospitalId: string | null;
  activities: ContinuityActivity[];
  gapPlans: ContinuityGapPlan[];
  simulationSessions: ContinuitySimSession[];
  simulationGaps: ContinuitySimGap[];
}

export interface EducationQuestionMeta {
  questionId: string;
  domain?: string;
  category?: string;
}

function participantCount(session: ContinuitySimSession): number {
  if (Array.isArray(session.participants)) return session.participants.filter(Boolean).length;
  if (typeof session.participants === 'string') {
    return session.participants
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean).length;
  }
  return 0;
}

function activityHours(a: ContinuityActivity): number {
  const n = typeof a.hours === 'number' ? a.hours : Number(a.hours);
  return Number.isFinite(n) ? n : 0;
}

function canonicalStatus(raw: unknown): GapStatusLabel | 'Other' | '' {
  const n = normalizeGapPlanStatus(raw);
  if (!n) return '';
  const match = GAP_STATUS_LABELS.find((label) => label.toLowerCase() === n);
  return match || 'Other';
}

function domainForQuestion(
  questionId: string | undefined,
  questionText: string | undefined,
  educationById: Map<string, EducationQuestionMeta>
): string {
  if (questionId && educationById.has(questionId)) {
    const domain = String(educationById.get(questionId)?.domain || '').trim();
    if (domain) return domain;
  }
  const text = String(questionText || '').trim().toLowerCase();
  for (const bucket of EDUCATION_BUCKETS) {
    if (text.includes(bucket.toLowerCase().slice(0, 40))) return bucket;
  }
  return 'Uncategorized';
}

export interface GapInventoryRow {
  gapKey: string;
  questionId: string;
  questionText: string;
  domain: string;
  sitesWithGap: number;
  totalSites: number;
  statusSiteCounts: Record<string, number>;
  planCount: number;
  activityCount: number;
  activityHours: number;
}

export interface DomainStatusRow {
  domain: string;
  /** Questions in this domain from the education/assessment catalog. */
  questionCount: number;
  /** Distinct assessment questions that have ≥1 gap plan somewhere in the system. */
  questionsWithPlans: number;
  /** questionCount × totalSites — max plans if every site had every question. */
  possiblePlanSlots: number;
  statusCounts: Record<string, number>;
  /** Gap plan instances in this domain across all sites. */
  total: number;
  /** questionsWithPlans / questionCount × 100 */
  pctQuestionsWithPlans: number | null;
  /** total / possiblePlanSlots × 100 */
  pctPlanCoverage: number | null;
}

export interface AssessmentGapsAggregate {
  totalSites: number;
  sitesWithAnyGap: number;
  totalPlans: number;
  statusPlanCounts: Record<string, number>;
  statusSiteCounts: Record<string, number>;
  domainRows: DomainStatusRow[];
  gapInventory: GapInventoryRow[];
  totalClosingActivities: number;
  totalClosingHours: number;
}

export function aggregateAssessmentGaps(
  bundles: SiteContinuityBundle[],
  educationQuestions: EducationQuestionMeta[]
): AssessmentGapsAggregate {
  const educationById = new Map(
    educationQuestions
      .filter((q) => q.questionId)
      .map((q) => [String(q.questionId), q] as const)
  );
  const totalSites = bundles.length;
  const sitesWithAnyGap = new Set<string>();
  const statusPlanCounts: Record<string, number> = {};
  const statusSiteSets: Record<string, Set<string>> = {};
  GAP_STATUS_LABELS.forEach((s) => {
    statusPlanCounts[s] = 0;
    statusSiteSets[s] = new Set();
  });
  statusPlanCounts.Other = 0;
  statusSiteSets.Other = new Set();

  const questionsPerDomain = new Map<string, number>();
  educationQuestions.forEach((q) => {
    const domain = String(q.domain || '').trim() || 'Uncategorized';
    questionsPerDomain.set(domain, (questionsPerDomain.get(domain) || 0) + 1);
  });
  EDUCATION_BUCKETS.forEach((d) => {
    if (!questionsPerDomain.has(d)) questionsPerDomain.set(d, 0);
  });

  const domainMap = new Map<string, Record<string, number>>();
  const domainQuestionIdsWithPlans = new Map<string, Set<string>>();
  EDUCATION_BUCKETS.forEach((d) => {
    const counts: Record<string, number> = {};
    GAP_STATUS_LABELS.forEach((s) => {
      counts[s] = 0;
    });
    counts.Other = 0;
    domainMap.set(d, counts);
    domainQuestionIdsWithPlans.set(d, new Set());
  });
  domainMap.set('Uncategorized', {
    ...Object.fromEntries(GAP_STATUS_LABELS.map((s) => [s, 0])),
    Other: 0,
  });
  domainQuestionIdsWithPlans.set('Uncategorized', new Set());

  type GapAccum = {
    questionId: string;
    questionText: string;
    domain: string;
    planCount: number;
    siteIds: Set<string>;
    statusSites: Record<string, Set<string>>;
    planIds: Set<string>;
  };
  const gapByKey = new Map<string, GapAccum>();

  let totalPlans = 0;
  const closingActivityIds = new Set<string>();
  let totalClosingHours = 0;

  bundles.forEach((bundle) => {
    const siteKey = bundle.site.id;
    const planIdsAtSite = new Set<string>();
    bundle.gapPlans.forEach((plan) => {
      totalPlans += 1;
      sitesWithAnyGap.add(siteKey);
      const status = canonicalStatus(plan.status) || (isGapPlanCompleted(plan) ? 'Completed' : 'Other');
      const statusKey = status || 'Other';
      statusPlanCounts[statusKey] = (statusPlanCounts[statusKey] || 0) + 1;
      statusSiteSets[statusKey]?.add(siteKey);

      const domain = domainForQuestion(plan.questionId, plan.questionText, educationById);
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          ...Object.fromEntries(GAP_STATUS_LABELS.map((s) => [s, 0])),
          Other: 0,
        });
        domainQuestionIdsWithPlans.set(domain, new Set());
      }
      const domainCounts = domainMap.get(domain)!;
      domainCounts[statusKey] = (domainCounts[statusKey] || 0) + 1;
      const qKey = String(plan.questionId || plan.questionText || plan.id || '').trim();
      if (qKey) domainQuestionIdsWithPlans.get(domain)?.add(qKey);

      const gapKey = String(plan.questionId || plan.questionText || plan.id || '').trim() || 'unknown';
      let accum = gapByKey.get(gapKey);
      if (!accum) {
        accum = {
          questionId: String(plan.questionId || ''),
          questionText: String(plan.questionText || plan.action || gapKey).trim() || gapKey,
          domain,
          planCount: 0,
          siteIds: new Set(),
          statusSites: Object.fromEntries(
            [...GAP_STATUS_LABELS, 'Other' as const].map((s) => [s, new Set<string>()])
          ),
          planIds: new Set(),
        };
        gapByKey.set(gapKey, accum);
      }
      accum.planCount += 1;
      accum.siteIds.add(siteKey);
      accum.statusSites[statusKey]?.add(siteKey);
      if (plan.id) {
        accum.planIds.add(String(plan.id));
        planIdsAtSite.add(String(plan.id));
      }
    });

    bundle.activities.forEach((activity) => {
      const linked = (activity.associatedGaps || []).map(String).filter(Boolean);
      if (linked.length === 0) return;
      const touchesSystemGap = linked.some((id) =>
        [...gapByKey.values()].some((g) => g.planIds.has(id)) || planIdsAtSite.has(id)
      );
      // Count any activity that tags a gap plan present at this site
      const touchesSiteGap = linked.some((id) => planIdsAtSite.has(id));
      if (!touchesSiteGap && !touchesSystemGap) return;
      const actId = String(activity.id || `${siteKey}:${linked.join(',')}:${activity.title || ''}`);
      if (!closingActivityIds.has(actId)) {
        closingActivityIds.add(actId);
        totalClosingHours += activityHours(activity);
      }
    });
  });

  // Second pass: attach activity counts/hours per gap key
  const gapInventory: GapInventoryRow[] = [...gapByKey.entries()].map(([gapKey, accum]) => {
    let activityCount = 0;
    let hours = 0;
    const seen = new Set<string>();
    bundles.forEach((bundle) => {
      bundle.activities.forEach((activity) => {
        const linked = (activity.associatedGaps || []).map(String);
        if (!linked.some((id) => accum.planIds.has(id))) return;
        const actId = String(activity.id || `${bundle.site.id}:${linked.join(',')}`);
        if (seen.has(actId)) return;
        seen.add(actId);
        activityCount += 1;
        hours += activityHours(activity);
      });
    });
    const statusSiteCounts: Record<string, number> = {};
    GAP_STATUS_LABELS.forEach((s) => {
      statusSiteCounts[s] = accum.statusSites[s]?.size || 0;
    });
    statusSiteCounts.Other = accum.statusSites.Other?.size || 0;
    return {
      gapKey,
      questionId: accum.questionId,
      questionText: accum.questionText,
      domain: accum.domain,
      sitesWithGap: accum.siteIds.size,
      totalSites,
      statusSiteCounts,
      planCount: accum.planCount,
      activityCount,
      activityHours: Math.round(hours * 10) / 10,
    };
  });

  gapInventory.sort((a, b) => b.sitesWithGap - a.sitesWithGap || a.questionText.localeCompare(b.questionText));

  const pct = (num: number, den: number): number | null =>
    den > 0 ? Math.round((num / den) * 1000) / 10 : null;

  const domainRows: DomainStatusRow[] = [...domainMap.entries()]
    .map(([domain, statusCounts]) => {
      const questionCount = questionsPerDomain.get(domain) || 0;
      const questionsWithPlans = domainQuestionIdsWithPlans.get(domain)?.size || 0;
      const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
      const possiblePlanSlots = questionCount * Math.max(totalSites, 0);
      return {
        domain,
        questionCount,
        questionsWithPlans,
        possiblePlanSlots,
        statusCounts,
        total,
        pctQuestionsWithPlans: pct(questionsWithPlans, questionCount),
        pctPlanCoverage: pct(total, possiblePlanSlots),
      };
    })
    .filter((row) => row.total > 0 || row.questionCount > 0 || EDUCATION_BUCKETS.includes(row.domain as (typeof EDUCATION_BUCKETS)[number]))
    .sort((a, b) => {
      const ai = EDUCATION_BUCKETS.indexOf(a.domain as (typeof EDUCATION_BUCKETS)[number]);
      const bi = EDUCATION_BUCKETS.indexOf(b.domain as (typeof EDUCATION_BUCKETS)[number]);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.domain.localeCompare(b.domain);
    });

  const statusSiteCounts: Record<string, number> = {};
  Object.entries(statusSiteSets).forEach(([status, set]) => {
    statusSiteCounts[status] = set.size;
  });

  return {
    totalSites,
    sitesWithAnyGap: sitesWithAnyGap.size,
    totalPlans,
    statusPlanCounts,
    statusSiteCounts,
    domainRows,
    gapInventory,
    totalClosingActivities: closingActivityIds.size,
    totalClosingHours: Math.round(totalClosingHours * 10) / 10,
  };
}

export interface CaseSiteCell {
  hospitalId: string;
  hospitalName: string;
  runs: number;
  participants: number;
}

export interface CaseAggregateRow {
  caseKey: string;
  caseName: string;
  totalRuns: number;
  totalParticipants: number;
  bySite: CaseSiteCell[];
}

export interface SimGapStatusAggregate {
  status: string;
  label: string;
  count: number;
  sites: number;
}

export interface SimulationAggregate {
  totalSites: number;
  totalSessions: number;
  totalParticipants: number;
  totalSimGaps: number;
  simGapStatus: SimGapStatusAggregate[];
  caseRows: CaseAggregateRow[];
  siteRows: Array<{
    hospitalId: string;
    hospitalName: string;
    sessions: number;
    participants: number;
    openSimGaps: number;
  }>;
}

export function aggregateSimulation(bundles: SiteContinuityBundle[]): SimulationAggregate {
  const totalSites = bundles.length;
  let totalSessions = 0;
  let totalParticipants = 0;
  let totalSimGaps = 0;

  const statusSiteSets: Record<string, Set<string>> = {};
  const statusCounts: Record<string, number> = {};
  SIM_GAP_STATUS_LABELS.forEach(({ key }) => {
    statusSiteSets[key] = new Set();
    statusCounts[key] = 0;
  });

  const caseMap = new Map<
    string,
    { caseName: string; totalRuns: number; totalParticipants: number; bySite: Map<string, CaseSiteCell> }
  >();

  const siteRows = bundles.map((bundle) => {
    const sessions = bundle.simulationSessions || [];
    const gaps = bundle.simulationGaps || [];
    let siteParticipants = 0;
    sessions.forEach((session) => {
      totalSessions += 1;
      const parts = participantCount(session);
      totalParticipants += parts;
      siteParticipants += parts;
      const caseName = String(session.caseName || session.caseId || 'Unknown case').trim() || 'Unknown case';
      const caseKey = String(session.caseId || caseName).trim().toLowerCase();
      let row = caseMap.get(caseKey);
      if (!row) {
        row = { caseName, totalRuns: 0, totalParticipants: 0, bySite: new Map() };
        caseMap.set(caseKey, row);
      }
      row.totalRuns += 1;
      row.totalParticipants += parts;
      const existing = row.bySite.get(bundle.site.id) || {
        hospitalId: bundle.site.id,
        hospitalName: bundle.site.name || 'Unnamed',
        runs: 0,
        participants: 0,
      };
      existing.runs += 1;
      existing.participants += parts;
      row.bySite.set(bundle.site.id, existing);
    });

    gaps.forEach((gap) => {
      totalSimGaps += 1;
      const key = normalizeGapPlanStatus(gap.status) || 'identified';
      statusCounts[key] = (statusCounts[key] || 0) + 1;
      if (!statusSiteSets[key]) statusSiteSets[key] = new Set();
      statusSiteSets[key].add(bundle.site.id);
    });

    const openSimGaps = gaps.filter((g) => {
      const s = normalizeGapPlanStatus(g.status);
      return s !== 'completed' && s !== 'cancelled';
    }).length;

    return {
      hospitalId: bundle.site.id,
      hospitalName: bundle.site.name || 'Unnamed',
      sessions: sessions.length,
      participants: siteParticipants,
      openSimGaps,
    };
  });

  const simGapStatus: SimGapStatusAggregate[] = SIM_GAP_STATUS_LABELS.map(({ key, label }) => ({
    status: key,
    label,
    count: statusCounts[key] || 0,
    sites: statusSiteSets[key]?.size || 0,
  }));

  const caseRows: CaseAggregateRow[] = [...caseMap.entries()]
    .map(([caseKey, row]) => ({
      caseKey,
      caseName: row.caseName,
      totalRuns: row.totalRuns,
      totalParticipants: row.totalParticipants,
      bySite: [...row.bySite.values()].sort((a, b) => a.hospitalName.localeCompare(b.hospitalName)),
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns || a.caseName.localeCompare(b.caseName));

  siteRows.sort((a, b) => b.sessions - a.sessions || a.hospitalName.localeCompare(b.hospitalName));

  return {
    totalSites,
    totalSessions,
    totalParticipants,
    totalSimGaps,
    simGapStatus,
    caseRows,
    siteRows,
  };
}
