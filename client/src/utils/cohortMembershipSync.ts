/**
 * Keep cohort/program membership and manager assignments in sync with CRM.
 */
import { supabase } from '../supabase';

export function resolveProgramIdsByNames(
  programNames: string[],
  availablePrograms: Array<{ id: string; name: string }>
): string[] {
  return programNames
    .map((name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;
      return availablePrograms.find(
        (p) => (p.name || '').trim().toLowerCase() === trimmed.toLowerCase()
      )?.id ?? null;
    })
    .filter(Boolean) as string[];
}

export function resolveCohortIdsByNames(
  cohortNames: string[],
  availableCohorts: Array<{ id: string; name: string }>
): string[] {
  return cohortNames
    .map((name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;
      return availableCohorts.find(
        (c) => (c.name || '').trim().toLowerCase() === trimmed.toLowerCase()
      )?.id ?? null;
    })
    .filter(Boolean) as string[];
}

export async function syncCohortMembersForUser(
  userId: string,
  cohortIds: string[],
  addedBy: string
): Promise<string | null> {
  const { data: existing, error: existingErr } = await supabase
    .from('cohort_members')
    .select('cohort_id')
    .eq('user_id', userId);
  if (existingErr) return existingErr.message;

  const existingIds = (existing ?? []).map((r: { cohort_id: string }) => r.cohort_id);
  for (const cid of existingIds) {
    if (!cohortIds.includes(cid)) {
      const { error: delErr } = await supabase
        .from('cohort_members')
        .delete()
        .eq('user_id', userId)
        .eq('cohort_id', cid);
      if (delErr) return delErr.message;
    }
  }
  for (const cid of cohortIds) {
    const { error: upsertErr } = await supabase
      .from('cohort_members')
      .upsert(
        { cohort_id: cid, user_id: userId, added_by: addedBy, status: 'active' },
        { onConflict: 'cohort_id,user_id' }
      );
    if (upsertErr) return upsertErr.message;
  }
  return null;
}

/** Managers assigned to cohorts in CRM can manage those cohorts in the app. */
export async function syncCohortManagersForUser(
  managerUserId: string,
  cohortIds: string[],
  assignedBy: string
): Promise<string | null> {
  const { data: existing, error: existingErr } = await supabase
    .from('cohort_managers')
    .select('cohort_id')
    .eq('manager_id', managerUserId);
  if (existingErr) return existingErr.message;

  const existingIds = (existing ?? []).map((r: { cohort_id: string }) => r.cohort_id);
  for (const cid of existingIds) {
    if (!cohortIds.includes(cid)) {
      const { error: delErr } = await supabase
        .from('cohort_managers')
        .delete()
        .eq('manager_id', managerUserId)
        .eq('cohort_id', cid);
      if (delErr) return delErr.message;
    }
  }
  for (const cid of cohortIds) {
    const { error: upsertErr } = await supabase
      .from('cohort_managers')
      .upsert(
        { cohort_id: cid, manager_id: managerUserId, assigned_by: assignedBy },
        { onConflict: 'cohort_id,manager_id' }
      );
    if (upsertErr && upsertErr.code !== '23505') return upsertErr.message;
    await supabase
      .from('cohort_members')
      .upsert(
        { cohort_id: cid, user_id: managerUserId, added_by: assignedBy, status: 'active' },
        { onConflict: 'cohort_id,user_id' }
      );
  }
  return null;
}

/** When a mentor has multiple supervisors, grant each supervisor cohort-manager access for the mentor's cohorts. */
export async function syncCohortManagersForMentorSupervisors(
  mentorUserId: string,
  managerUserIds: string[],
  assignedBy: string
): Promise<void> {
  const uniqueManagerIds = [...new Set(managerUserIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueManagerIds.length === 0) return;

  const { data: memberRows } = await supabase
    .from('cohort_members')
    .select('cohort_id')
    .eq('user_id', mentorUserId)
    .eq('status', 'active');
  const cohortIds = [...new Set((memberRows ?? []).map((r: { cohort_id: string }) => r.cohort_id))];
  if (cohortIds.length === 0) return;

  await Promise.all(
    uniqueManagerIds.map((managerId) => syncCohortManagersForUser(managerId, cohortIds, assignedBy))
  );
}

/** Managers assigned to programs in CRM can manage those programs in the app. */
export async function syncProgramManagersForUser(
  managerUserId: string,
  programIds: string[],
  assignedBy: string
): Promise<string | null> {
  const { data: existing, error: existingErr } = await supabase
    .from('program_managers')
    .select('program_id')
    .eq('manager_id', managerUserId);
  if (existingErr) return existingErr.message;

  const existingIds = (existing ?? []).map((r: { program_id: string }) => r.program_id);
  for (const pid of existingIds) {
    if (!programIds.includes(pid)) {
      const { error: delErr } = await supabase
        .from('program_managers')
        .delete()
        .eq('manager_id', managerUserId)
        .eq('program_id', pid);
      if (delErr) return delErr.message;
    }
  }
  for (const pid of programIds) {
    const { error: upsertErr } = await supabase
      .from('program_managers')
      .upsert(
        { program_id: pid, manager_id: managerUserId, assigned_by: assignedBy },
        { onConflict: 'program_id,manager_id' }
      );
    if (upsertErr && upsertErr.code !== '23505') return upsertErr.message;
    await supabase
      .from('program_members')
      .upsert(
        { program_id: pid, user_id: managerUserId, added_by: assignedBy, status: 'active' },
        { onConflict: 'program_id,user_id' }
      );
  }
  return null;
}

/** When a mentor has multiple supervisors, grant each supervisor program-manager access for the mentor's programs. */
export async function syncProgramManagersForMentorSupervisors(
  mentorUserId: string,
  managerUserIds: string[],
  assignedBy: string
): Promise<void> {
  const uniqueManagerIds = [...new Set(managerUserIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueManagerIds.length === 0) return;

  const { data: memberRows } = await supabase
    .from('program_members')
    .select('program_id')
    .eq('user_id', mentorUserId)
    .eq('status', 'active');
  const programIds = [...new Set((memberRows ?? []).map((r: { program_id: string }) => r.program_id))];
  if (programIds.length === 0) return;

  await Promise.all(
    uniqueManagerIds.map((managerId) => syncProgramManagersForUser(managerId, programIds, assignedBy))
  );
}
