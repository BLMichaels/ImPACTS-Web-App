/**
 * Keep cohort_members and cohort_managers in sync with CRM person assignments.
 */
import { supabase } from '../supabase';

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
