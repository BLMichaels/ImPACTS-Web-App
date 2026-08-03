/**
 * Shared manager team scoping: primary manager_id, secondary mentor_manager_ids,
 * and manager-as-mentor (self) hospital assignments.
 */
import { supabase } from '../supabase';
import { batchGetUserDataForKey, setUserData } from './userData';
import {
  syncCohortManagersForMentorSupervisors,
  syncProgramManagersForMentorSupervisors,
} from './cohortMembershipSync';
import {
  buildPeccHospitalFacilityOrClause,
  expandHospitalRefsForPeccQuery,
} from './mentorHospitalAssignments';
import { fetchMergedMentorHospitals } from './mentorHospitalScope';

export const USER_DATA_MENTOR_MANAGER_IDS = 'mentor_manager_ids';
export const USER_DATA_PECC_DIRECT_MANAGER_IDS = 'pecc_direct_manager_ids';

const PERMISSIONS_USER_SELECT =
  'id, email, first_name, last_name, phone, role, is_admin, is_active, created_at, updated_at, last_login, manager_id, mentor_id, manager_id_for_pecc, primary_program_id';

export function normalizeManagerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
}

export type ManagedMentorUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  manager_id: string | null;
};

export async function managerHasHospitalAssignments(managerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('mentor_hospital_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('mentor_id', managerId)
    .eq('is_active', true);
  if (error) {
    console.warn('[managerTeamScope] hospital assignment check failed', error);
    return false;
  }
  return (count ?? 0) > 0;
}

/** Mentor user IDs this manager oversees (primary, secondary, and self when mentoring). */
export async function getManagedMentorIdsForManager(managerId: string): Promise<string[]> {
  const { data: mentorUsers, error } = await supabase
    .from('users')
    .select('id, manager_id')
    .eq('role', 'mentor')
    .eq('is_active', true);

  if (error) throw error;

  const scoped: string[] = [];
  if (mentorUsers?.length) {
    const mentorIds = mentorUsers.map((m) => m.id);
    const extraManagerMap = await batchGetUserDataForKey<string[]>(mentorIds, USER_DATA_MENTOR_MANAGER_IDS);
    mentorUsers.forEach((mentor) => {
      if (mentor.manager_id === managerId) {
        scoped.push(mentor.id);
        return;
      }
      const additional = normalizeManagerIds(extraManagerMap.get(mentor.id));
      if (additional.includes(managerId)) scoped.push(mentor.id);
    });
  }

  if (!scoped.includes(managerId) && (await managerHasHospitalAssignments(managerId))) {
    scoped.push(managerId);
  }

  return scoped;
}

/** Mentor rows scoped to this manager (includes self when manager mentors directly). */
export async function getScopedMentorUsersForManager(
  managerId: string,
  opts?: { includeInactive?: boolean }
): Promise<ManagedMentorUser[]> {
  let query = supabase
    .from('users')
    .select('id, first_name, last_name, email, manager_id, is_active')
    .eq('role', 'mentor');
  if (!opts?.includeInactive) {
    query = query.eq('is_active', true);
  }
  const { data: mentorUsers, error } = await query;

  if (error) throw error;
  if (!mentorUsers?.length) return [];

  const mentorIds = mentorUsers.map((m) => m.id);
  const extraManagerMap = await batchGetUserDataForKey<string[]>(mentorIds, USER_DATA_MENTOR_MANAGER_IDS);
  const scoped = mentorUsers.filter((mentor) => {
    if (mentor.manager_id === managerId) return true;
    const additional = normalizeManagerIds(extraManagerMap.get(mentor.id));
    return additional.includes(managerId);
  }) as ManagedMentorUser[];

  if (!scoped.some((m) => m.id === managerId) && (await managerHasHospitalAssignments(managerId))) {
    const { data: self } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, manager_id')
      .eq('id', managerId)
      .maybeSingle();
    if (self) scoped.push(self as ManagedMentorUser);
  }

  return scoped;
}

export type RosterMentorUser = ManagedMentorUser & {
  /** How this mentor appears on the manager roster. */
  supervision: 'direct' | 'cohort' | 'both';
};

/**
 * Mentors for the Team Roster: direct reports (primary/secondary/self) plus
 * active mentors who are members/co-managers of cohorts this manager manages.
 */
export async function getRosterMentorUsersForManager(
  managerId: string
): Promise<RosterMentorUser[]> {
  const direct = await getScopedMentorUsersForManager(managerId);
  const directIds = new Set(direct.map((m) => m.id));
  const cohortPeople = await getManagedCohortPeopleIdsForManager(managerId);
  const cohortSet = new Set(cohortPeople);

  const roster: RosterMentorUser[] = direct.map((m) => ({
    ...m,
    supervision: cohortSet.has(m.id) ? 'both' : 'direct',
  }));

  const extraIds = cohortPeople.filter((id) => !directIds.has(id));
  for (let i = 0; i < extraIds.length; i += 80) {
    const part = extraIds.slice(i, i + 80);
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, manager_id')
      .in('id', part)
      .eq('role', 'mentor')
      .eq('is_active', true);
    if (error) throw error;
    (data || []).forEach((m) => {
      roster.push({ ...(m as ManagedMentorUser), supervision: 'cohort' });
    });
  }

  return roster;
}

/** Active programs linked to cohorts this manager directly manages. */
export async function fetchManagedProgramsForManager(
  managerId: string
): Promise<{ id: string; name: string }[]> {
  const cohortIds = await getManagedCohortIdsForManager(managerId);
  if (!cohortIds.length) return [];

  const programIds = new Set<string>();
  for (let i = 0; i < cohortIds.length; i += 80) {
    const part = cohortIds.slice(i, i + 80);
    const { data } = await supabase.from('cohorts').select('program_id').in('id', part);
    (data || []).forEach((c: { program_id: string | null }) => {
      if (c.program_id) programIds.add(c.program_id);
    });
  }

  const { data: pm } = await supabase.from('program_managers').select('program_id').eq('manager_id', managerId);
  (pm || []).forEach((r: { program_id: string }) => {
    if (r.program_id) programIds.add(r.program_id);
  });

  const ids = [...programIds];
  if (!ids.length) return [];

  const out: { id: string; name: string }[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { data } = await supabase
      .from('programs')
      .select('id, name')
      .in('id', part)
      .eq('is_active', true)
      .order('name');
    (data || []).forEach((p: { id: string; name: string }) => {
      if (p.id) out.push({ id: p.id, name: p.name || p.id });
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/** Cohort IDs this manager is assigned to manage (`cohort_managers`). */
export async function getManagedCohortIdsForManager(managerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('cohort_managers')
    .select('cohort_id')
    .eq('manager_id', managerId);
  if (error) {
    console.warn('[managerTeamScope] managed cohorts lookup failed', error);
    return [];
  }
  return [...new Set((data || []).map((r: { cohort_id: string }) => String(r.cohort_id || '').trim()).filter(Boolean))];
}

/** Active cohorts this manager directly manages (report filter list). */
export async function fetchManagedCohortsForManager(
  managerId: string
): Promise<{ id: string; name: string }[]> {
  const cohortIds = await getManagedCohortIdsForManager(managerId);
  if (!cohortIds.length) return [];

  const out: { id: string; name: string }[] = [];
  for (let i = 0; i < cohortIds.length; i += 80) {
    const part = cohortIds.slice(i, i + 80);
    const { data, error } = await supabase
      .from('cohorts')
      .select('id, name')
      .in('id', part)
      .eq('is_active', true)
      .order('name');
    if (error) {
      console.warn('[managerTeamScope] managed cohort names failed', error);
      continue;
    }
    (data || []).forEach((c: { id: string; name: string }) => {
      if (c.id) out.push({ id: c.id, name: c.name || c.id });
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

/**
 * People in cohorts this manager directly manages:
 * active cohort members + all cohort_managers for those cohorts (mentors, managers, PECCs).
 */
export async function getManagedCohortPeopleIdsForManager(managerId: string): Promise<string[]> {
  const cohortIds = await getManagedCohortIdsForManager(managerId);
  if (!cohortIds.length) return [];

  const ids = new Set<string>();
  for (let i = 0; i < cohortIds.length; i += 80) {
    const part = cohortIds.slice(i, i + 80);
    const [{ data: members }, { data: managers }] = await Promise.all([
      supabase.from('cohort_members').select('user_id').in('cohort_id', part).eq('status', 'active'),
      supabase.from('cohort_managers').select('manager_id').in('cohort_id', part),
    ]);
    (members || []).forEach((r: { user_id: string }) => {
      if (r.user_id) ids.add(r.user_id);
    });
    (managers || []).forEach((r: { manager_id: string }) => {
      if (r.manager_id) ids.add(r.manager_id);
    });
  }
  return [...ids];
}

/** Hospital id/facility keys for manager-scoped reports and maps. */
export async function getManagedHospitalScopeKeysForManager(managerId: string): Promise<string[]> {
  const mentorIds = await getManagedMentorIdsForManager(managerId);
  const keys = new Set<string>();

  for (const mentorId of mentorIds) {
    try {
      const merged = await fetchMergedMentorHospitals(mentorId);
      merged.forEach((m) => {
        const id = String(m.hospital.id || '').trim();
        if (id) keys.add(id);
        const fid = m.hospital.facility_id != null ? String(m.hospital.facility_id).trim() : '';
        if (fid) keys.add(fid);
      });
    } catch {
      const { data } = await supabase
        .from('mentor_hospital_assignments')
        .select('hospital_id')
        .eq('mentor_id', mentorId)
        .eq('is_active', true);
      (data || []).forEach((r: { hospital_id: string }) => {
        if (r.hospital_id) keys.add(r.hospital_id);
      });
    }
  }

  // Sites for PECCs who sit in managed cohorts (even when not yet under a mentor assignment).
  const cohortPeople = await getManagedCohortPeopleIdsForManager(managerId);
  for (let i = 0; i < cohortPeople.length; i += 80) {
    const part = cohortPeople.slice(i, i + 80);
    const { data } = await supabase
      .from('users')
      .select('hospital_facility_id')
      .in('id', part)
      .eq('role', 'pecc');
    (data || []).forEach((r: { hospital_facility_id: string | null }) => {
      const ref = String(r.hospital_facility_id || '').trim();
      if (ref) keys.add(ref);
    });
  }

  return [...keys];
}

/** PECCs directly supervised by this manager (primary or secondary). */
async function addDirectlyManagedPeccIds(managerId: string, ids: Set<string>): Promise<void> {
  const { data: peccRows } = await supabase
    .from('users')
    .select('id, manager_id_for_pecc')
    .eq('role', 'pecc')
    .eq('is_active', true);
  if (!peccRows?.length) return;

  const peccIds = peccRows.map((p) => p.id);
  const extraManagerMap = await batchGetUserDataForKey<string[]>(peccIds, USER_DATA_PECC_DIRECT_MANAGER_IDS);
  peccRows.forEach((pecc) => {
    if (pecc.manager_id_for_pecc === managerId) ids.add(pecc.id);
    const additional = normalizeManagerIds(extraManagerMap.get(pecc.id));
    if (additional.includes(managerId)) ids.add(pecc.id);
  });
}

/** Users a manager may see in CRM previews and reports. */
export async function fetchManagerVisibleUserIdsSet(managerId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  ids.add(managerId);

  const mentorIds = await getManagedMentorIdsForManager(managerId);
  mentorIds.forEach((id) => ids.add(id));

  // Mentors, managers, and PECCs in cohorts this manager directly manages.
  const cohortPeople = await getManagedCohortPeopleIdsForManager(managerId);
  cohortPeople.forEach((id) => ids.add(id));

  await addDirectlyManagedPeccIds(managerId, ids);

  if (mentorIds.length === 0) return ids;

  const { data: assignments } = await supabase
    .from('mentor_hospital_assignments')
    .select('hospital_id')
    .in('mentor_id', mentorIds)
    .eq('is_active', true);

  const hospitalIds = [...new Set((assignments || []).map((r: { hospital_id: string }) => r.hospital_id))];
  if (hospitalIds.length === 0) return ids;

  const { refs: peccHospitalRefs } = await expandHospitalRefsForPeccQuery(hospitalIds);
  if (peccHospitalRefs.length === 0) return ids;

  const { data: peccs } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'pecc')
    .eq('is_active', true)
    .or(buildPeccHospitalFacilityOrClause(peccHospitalRefs));

  (peccs || []).forEach((p: { id: string }) => ids.add(p.id));

  return ids;
}

/** Team users a manager can configure in Team Permissions. */
export async function fetchUsersForManagerPermissions(managerId: string) {
  const visibleIds = await fetchManagerVisibleUserIdsSet(managerId);
  const idList = [...visibleIds];
  if (idList.length === 0) return [];

  const { data, error } = await supabase.from('users').select(PERMISSIONS_USER_SELECT).in('id', idList);
  if (error) throw error;
  return data || [];
}

/** Persist full mentor supervisor list (primary + secondary) and sync cohort/program managers. */
export async function applyMentorSupervisorAssignment(
  mentorUserId: string,
  managerUserIds: string[],
  assignedBy: string
): Promise<void> {
  const managers = normalizeManagerIds(managerUserIds);
  if (managers.length === 0) return;
  const { error } = await supabase
    .from('users')
    .update({ manager_id: managers[0], updated_at: new Date().toISOString() })
    .eq('id', mentorUserId);
  if (error) throw error;
  await setUserData(mentorUserId, USER_DATA_MENTOR_MANAGER_IDS, managers);
  await syncCohortManagersForMentorSupervisors(mentorUserId, managers, assignedBy);
  await syncProgramManagersForMentorSupervisors(mentorUserId, managers, assignedBy);
}

/** Persist full PECC direct-manager list (primary + secondary). */
export async function applyPeccDirectManagerAssignment(
  peccUserId: string,
  managerUserIds: string[]
): Promise<void> {
  const managers = normalizeManagerIds(managerUserIds);
  if (managers.length === 0) return;
  const { error } = await supabase
    .from('users')
    .update({ manager_id_for_pecc: managers[0], updated_at: new Date().toISOString() })
    .eq('id', peccUserId);
  if (error) throw error;
  await setUserData(peccUserId, USER_DATA_PECC_DIRECT_MANAGER_IDS, managers);
}
