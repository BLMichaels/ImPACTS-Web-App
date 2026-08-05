import { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { supabase } from '../supabase';
import { getMentorActivitiesForUser, batchGetMentorActivitiesForUsers } from '../utils/mentorActivities';
import { buildMentorHospitalContext, countPeccsByCanonicalHospital } from '../utils/mentorHospitalScope';
import {
  fetchManagerVisibleUserIdsSet,
  getRosterMentorUsersForManager,
} from '../utils/managerTeamScope';
import { loadSiteChecklistStats } from '../utils/checklistTemplates';
import {
  batchGetHospitalDataForKey,
  batchGetUserDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
} from '../utils/userData';

export interface ManagerTeamMentorRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedHospitals: Array<{ id: string; name: string; peccCount: number }>;
  totalActivities: number;
  activitiesThisMonth: number;
  hoursThisMonth: number;
  hoursTotal: number;
  lastActivity: string | null;
}

export interface ManagerOwnMentoring {
  hasAssignments: boolean;
  hospitalNames: string[];
  totalActivities: number;
  hoursTotal: number;
  hoursThisMonth: number;
  lastMonthHours: number;
}

export interface ManagerTeamPeccRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospitalId: string | null;
  hospitalName: string;
  checklistProgress: number;
  activityCount: number;
  activityHours: number;
  activitiesLast30: number;
  gapPlanCount: number;
  lastActivity: string | null;
  lastLogin: string | null;
}

export interface ManagerTeamDashboardData {
  mentors: ManagerTeamMentorRow[];
  peccs: ManagerTeamPeccRow[];
  totalPeccs: number;
  totalSites: number;
  avgPeccProgress: number;
  managerOwn: ManagerOwnMentoring;
  teamHoursThisMonth: number;
  teamActivitiesThisMonth: number;
  teamTotalHours: number;
}

const EMPTY_OWN: ManagerOwnMentoring = {
  hasAssignments: false,
  hospitalNames: [],
  totalActivities: 0,
  hoursTotal: 0,
  hoursThisMonth: 0,
  lastMonthHours: 0,
};

async function loadManagerOwnMentoring(managerId: string): Promise<ManagerOwnMentoring> {
  const { data: managerAssignments } = await supabase
    .from('mentor_hospital_assignments')
    .select('hospital:hospital_id(id, name)')
    .eq('mentor_id', managerId)
    .eq('is_active', true);

  const hasAssignments = (managerAssignments || []).length > 0;
  const hospitalNames = (managerAssignments || []).map((a: { hospital: unknown }) => {
    const h = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
    return (h as { name?: string } | null)?.name || 'Unknown';
  });

  const ownActivities = await getMentorActivitiesForUser(managerId);
  const now = new Date();
  const ownMonthStart = startOfMonth(now);
  const ownMonthEnd = endOfMonth(now);
  const lastMonth = subMonths(now, 1);

  const hoursThisMonth = ownActivities
    .filter((a: { date?: string }) => {
      const d = new Date(a.date || '');
      return d >= ownMonthStart && d <= ownMonthEnd;
    })
    .reduce((sum: number, a: { hours?: number }) => sum + (a.hours || 0), 0);

  const lastMonthHours = ownActivities
    .filter((a: { date?: string }) => {
      const d = new Date(a.date || '');
      return d >= startOfMonth(lastMonth) && d <= endOfMonth(lastMonth);
    })
    .reduce((sum: number, a: { hours?: number }) => sum + (a.hours || 0), 0);

  return {
    hasAssignments,
    hospitalNames,
    totalActivities: ownActivities.length,
    hoursTotal: ownActivities.reduce((s: number, a: { hours?: number }) => s + (a.hours || 0), 0),
    hoursThisMonth,
    lastMonthHours,
  };
}

export function useManagerTeamDashboard(managerId: string | undefined) {
  const [mentors, setMentors] = useState<ManagerTeamMentorRow[]>([]);
  const [peccRows, setPeccRows] = useState<ManagerTeamPeccRow[]>([]);
  const [totalPeccs, setTotalPeccs] = useState(0);
  const [totalSites, setTotalSites] = useState(0);
  const [avgPeccProgress, setAvgPeccProgress] = useState(0);
  const [managerOwn, setManagerOwn] = useState<ManagerOwnMentoring>(EMPTY_OWN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const load = useCallback(async () => {
    if (!managerId) return;

    try {
      setLoading(true);
      setError(null);

      const [scopedMentors, visibleUserIds, own] = await Promise.all([
        getRosterMentorUsersForManager(managerId),
        fetchManagerVisibleUserIdsSet(managerId),
        loadManagerOwnMentoring(managerId),
      ]);
      setManagerOwn(own);

      const scopedMentorIds = scopedMentors.map((m) => m.id);
      // The manager's personal log is shown separately; supervised mentors stay in the team rollup.
      const teamMentors = scopedMentors.filter((m) => m.id !== managerId);
      const hospitalCtx = await buildMentorHospitalContext(scopedMentorIds);
      const uniqueHospitalIds = hospitalCtx.allHospitalUuids;
      const refToCanonicalHospitalId = hospitalCtx.refToCanonicalId;
      const peccCountByHospital = await countPeccsByCanonicalHospital(
        uniqueHospitalIds,
        refToCanonicalHospitalId
      );

      const visibleIds = [...visibleUserIds].filter((id) => id !== managerId);
      const peccs: Array<{
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        hospital_facility_id: string | null;
        last_login: string | null;
      }> = [];
      for (let i = 0; i < visibleIds.length; i += 80) {
        const { data, error: peccsError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, hospital_facility_id, last_login')
          .in('id', visibleIds.slice(i, i + 80))
          .eq('role', 'pecc')
          .eq('is_active', true);
        if (peccsError) throw peccsError;
        peccs.push(...((data || []) as typeof peccs));
      }

      const peccSiteRefs = peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
      const peccRefToHospital = await mapSiteRefsToHospitalRowIds(peccSiteRefs);
      const allSiteIds = [
        ...new Set([
          ...uniqueHospitalIds,
          ...peccSiteRefs.map((ref) => peccRefToHospital.get(ref)).filter((id): id is string => Boolean(id)),
        ]),
      ];
      const [checklistStats, hospitalActivities, hospitalGaps, legacyActivities, legacyGaps] = await Promise.all([
        loadSiteChecklistStats(allSiteIds),
        batchGetHospitalDataForKey<unknown[]>(allSiteIds, 'activities'),
        batchGetHospitalDataForKey<unknown[]>(allSiteIds, 'gapPlans'),
        shouldMirrorLegacyUserData()
          ? batchGetUserDataForKey<unknown[]>(peccs.map((p) => p.id), 'activities')
          : Promise.resolve(new Map<string, unknown[]>()),
        shouldMirrorLegacyUserData()
          ? batchGetUserDataForKey<unknown[]>(peccs.map((p) => p.id), 'gapPlans')
          : Promise.resolve(new Map<string, unknown[]>()),
      ]);
      const hospitalNames = new Map<string, string>();
      for (let i = 0; i < allSiteIds.length; i += 80) {
        const { data } = await supabase
          .from('hospitals')
          .select('id, name, facility_id')
          .in('id', allSiteIds.slice(i, i + 80));
        (data || []).forEach((h: { id: string; name: string; facility_id: string | null }) => {
          hospitalNames.set(h.id, h.name);
          if (h.facility_id) hospitalNames.set(String(h.facility_id), h.name);
        });
      }
      const cutoff30 = new Date();
      cutoff30.setDate(cutoff30.getDate() - 30);
      const normalizedPeccRows: ManagerTeamPeccRow[] = peccs.map((pecc) => {
        const hospitalId = pecc.hospital_facility_id
          ? peccRefToHospital.get(pecc.hospital_facility_id) || refToCanonicalHospitalId.get(pecc.hospital_facility_id) || null
          : null;
        const activitiesRaw = (hospitalId ? hospitalActivities.get(hospitalId) : null) || legacyActivities.get(pecc.id) || [];
        const gapsRaw = (hospitalId ? hospitalGaps.get(hospitalId) : null) || legacyGaps.get(pecc.id) || [];
        const activities = Array.isArray(activitiesRaw) ? activitiesRaw : [];
        const gaps = Array.isArray(gapsRaw) ? gapsRaw : [];
        const dated = activities
          .map((a: unknown) => {
            const item = a as { date?: string; activity_date?: string; created_at?: string; hours?: number };
            const raw = item.date || item.activity_date || item.created_at || '';
            const time = raw ? new Date(raw).getTime() : NaN;
            return { item, raw, time };
          })
          .filter((a) => Number.isFinite(a.time));
        const stats = hospitalId ? checklistStats.get(hospitalId) : undefined;
        return {
          id: pecc.id,
          firstName: pecc.first_name,
          lastName: pecc.last_name,
          email: pecc.email,
          hospitalId,
          hospitalName:
            (pecc.hospital_facility_id && hospitalNames.get(pecc.hospital_facility_id)) ||
            (hospitalId && hospitalNames.get(hospitalId)) ||
            'Unassigned site',
          checklistProgress: stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
          activityCount: activities.length,
          activityHours: activities.reduce(
            (sum, a: unknown) => sum + (Number((a as { hours?: unknown }).hours) || 0),
            0
          ),
          activitiesLast30: dated.filter((a) => new Date(a.time) >= cutoff30).length,
          gapPlanCount: gaps.length,
          lastActivity: dated.length
            ? dated.sort((a, b) => b.time - a.time)[0].raw
            : null,
          lastLogin: pecc.last_login,
        };
      });
      setPeccRows(normalizedPeccRows);
      setTotalPeccs(normalizedPeccRows.length);
      setTotalSites(allSiteIds.length);
      setAvgPeccProgress(
        normalizedPeccRows.length
          ? Math.round(normalizedPeccRows.reduce((sum, p) => sum + p.checklistProgress, 0) / normalizedPeccRows.length)
          : 0
      );

      const now = new Date();
      const monthStart = startOfMonth(now);

      const activitiesByMentor = await batchGetMentorActivitiesForUsers(teamMentors.map((m) => m.id));

      const mentorRows: ManagerTeamMentorRow[] = teamMentors.map((mentor) => {
        const mergedRows = hospitalCtx.rowsByMentor.get(mentor.id) || [];
        const assignedHospitals = mergedRows.map((row) => ({
          id: row.hospital.id,
          name: hospitalCtx.hospitalNameById.get(row.hospital.id) || row.hospital.name || 'Unknown',
          peccCount: peccCountByHospital.get(row.hospital.id) || 0,
        }));

        const activities = activitiesByMentor.get(mentor.id) || [];
        const monthActivities = activities.filter((a: { date?: string }) => new Date(a.date || '') >= monthStart);

        const lastActivity =
          activities.length > 0
            ? [...activities].sort(
                (a: { date?: string }, b: { date?: string }) =>
                  new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
              )[0].date || null
            : null;

        return {
          id: mentor.id,
          firstName: mentor.first_name,
          lastName: mentor.last_name,
          email: mentor.email,
          assignedHospitals,
          totalActivities: activities.length,
          activitiesThisMonth: monthActivities.length,
          hoursThisMonth: monthActivities.reduce((sum: number, a: { hours?: number }) => sum + (a.hours || 0), 0),
          hoursTotal: activities.reduce((sum: number, a: { hours?: number }) => sum + (a.hours || 0), 0),
          lastActivity,
        };
      });

      setMentors(mentorRows);
    } catch (err) {
      console.error('Error loading manager team dashboard:', err);
      setError('Failed to load team dashboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    void load();
  }, [load, retryCount]);

  const teamHoursThisMonth = useMemo(
    () => mentors.reduce((sum, m) => sum + m.hoursThisMonth, 0),
    [mentors]
  );
  const teamActivitiesThisMonth = useMemo(
    () => mentors.reduce((sum, m) => sum + m.activitiesThisMonth, 0),
    [mentors]
  );
  const teamTotalHours = useMemo(() => mentors.reduce((sum, m) => sum + m.hoursTotal, 0), [mentors]);

  const data: ManagerTeamDashboardData = useMemo(
    () => ({
      mentors,
      peccs: peccRows,
      totalPeccs,
      totalSites,
      avgPeccProgress,
      managerOwn,
      teamHoursThisMonth,
      teamActivitiesThisMonth,
      teamTotalHours,
    }),
    [
      mentors,
      peccRows,
      totalPeccs,
      totalSites,
      avgPeccProgress,
      managerOwn,
      teamHoursThisMonth,
      teamActivitiesThisMonth,
      teamTotalHours,
    ]
  );

  return {
    data,
    loading,
    error,
    retry: () => setRetryCount((c) => c + 1),
    reload: load,
  };
}
