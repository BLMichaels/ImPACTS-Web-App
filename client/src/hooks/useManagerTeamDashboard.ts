import { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { supabase } from '../supabase';
import { getMentorActivitiesForUser, batchGetMentorActivitiesForUsers } from '../utils/mentorActivities';
import { buildMentorHospitalContext, countPeccsByCanonicalHospital } from '../utils/mentorHospitalScope';
import { buildPeccHospitalFacilityOrClause } from '../utils/mentorHospitalAssignments';
import { getScopedMentorUsersForManager } from '../utils/managerTeamScope';
import { loadSiteChecklistStats } from '../utils/checklistTemplates';

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

export interface ManagerTeamDashboardData {
  mentors: ManagerTeamMentorRow[];
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

      const [scopedMentors, own] = await Promise.all([
        getScopedMentorUsersForManager(managerId),
        loadManagerOwnMentoring(managerId),
      ]);
      setManagerOwn(own);

      if (scopedMentors.length === 0) {
        setMentors([]);
        setTotalPeccs(0);
        setTotalSites(0);
        setAvgPeccProgress(0);
        return;
      }

      const scopedMentorIds = scopedMentors.map((m) => m.id);
      // Snapshot team rollups exclude the manager's own mentoring (shown separately as managerOwn).
      const teamMentors = scopedMentors.filter((m) => m.id !== managerId);
      const hospitalCtx = await buildMentorHospitalContext(scopedMentorIds);
      const uniqueHospitalIds = hospitalCtx.allHospitalUuids;
      const refToCanonicalHospitalId = hospitalCtx.refToCanonicalId;
      const peccCountByHospital = await countPeccsByCanonicalHospital(
        uniqueHospitalIds,
        refToCanonicalHospitalId
      );

      const { data: peccs, error: peccsError } = hospitalCtx.allHospitalRefs.length > 0
        ? await supabase
            .from('users')
            .select('id, hospital_facility_id')
            .eq('role', 'pecc')
            .or(buildPeccHospitalFacilityOrClause(hospitalCtx.allHospitalRefs))
        : { data: [], error: null };
      if (peccsError) throw peccsError;

      setTotalPeccs((peccs || []).length);
      setTotalSites(uniqueHospitalIds.length);

      let progressSum = 0;
      let progressCount = 0;

      if (uniqueHospitalIds.length > 0) {
        const checklistStatsByHospital = await loadSiteChecklistStats(uniqueHospitalIds);

        const checklistPctByHospital = new Map<string, number>();
        checklistStatsByHospital.forEach((stats, hid) => {
          checklistPctByHospital.set(hid, stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0);
        });

        for (const pecc of peccs || []) {
          const canonicalHospitalId = refToCanonicalHospitalId.get(String(pecc.hospital_facility_id));
          const pct = canonicalHospitalId ? checklistPctByHospital.get(canonicalHospitalId) || 0 : 0;
          progressSum += pct;
          progressCount += 1;
        }
      }

      setAvgPeccProgress(progressCount > 0 ? Math.round(progressSum / progressCount) : 0);

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
