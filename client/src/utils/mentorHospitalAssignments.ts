/**
 * Keeps mentor_hospital_assignments aligned with PECC ↔ hospital ↔ mentor links.
 */
import { supabase } from '../supabase';
import {
  buildHospitalsTableOrClause,
  hospitalIdOrFacilityOrClause,
  normalizeHospitalKey,
  resolvePeccFacilityId,
} from './hospitalId';
import { getUserData } from './userData';
import { pickCanonicalUserByEmail } from './canonicalUserByEmail';

const PECC_MENTOR_IDS_KEY = 'pecc_mentor_ids';

/** Resolve portal PECC user id from CRM user_id or matching email. */
export async function resolvePeccPortalUserId(
  userId?: string | null,
  email?: string | null
): Promise<string | null> {
  const uid = normalizeHospitalKey(userId);
  if (uid) return uid;
  const em = String(email || '').trim();
  if (!em) return null;
  const { data: rows } = await supabase
    .from('users')
    .select('id, email, last_login, created_at, is_active')
    .eq('role', 'pecc')
    .ilike('email', em);
  const picked = pickCanonicalUserByEmail(rows ?? []);
  return picked?.id ? String(picked.id) : null;
}

/** Apply CRM linked hospitals to users + mentor assignment rows. */
export async function syncPeccHospitalAndMentorFromCrm(
  peccUserId: string,
  linkedHospitalIds: string[],
  assignedBy: string
): Promise<void> {
  if (linkedHospitalIds.length > 0) {
    await applyPeccHospitalFromLinkedIds(peccUserId, linkedHospitalIds);
  }
  await syncMentorHospitalAssignmentsForPecc(peccUserId, assignedBy);
}

export async function resolveHospitalUuidFromRef(
  hospitalRef: string | null | undefined
): Promise<string | null> {
  const raw = normalizeHospitalKey(hospitalRef);
  if (!raw) return null;
  const { data, error } = await supabase
    .from('hospitals')
    .select('id')
    .or(hospitalIdOrFacilityOrClause(raw))
    .maybeSingle();
  if (error || !data?.id) return null;
  return String(data.id);
}

export async function ensureMentorHospitalAssignment(
  mentorId: string,
  hospitalRef: string,
  assignedBy: string
): Promise<{ ok: boolean; hospitalUuid?: string; error?: string }> {
  const mentor = normalizeHospitalKey(mentorId);
  const actor = normalizeHospitalKey(assignedBy);
  if (!mentor || !actor) return { ok: false, error: 'missing mentor or assigner' };

  const hospitalUuid = await resolveHospitalUuidFromRef(hospitalRef);
  if (!hospitalUuid) return { ok: false, error: `unresolved hospital ref: ${hospitalRef}` };

  const { data: existing, error: lookupError } = await supabase
    .from('mentor_hospital_assignments')
    .select('id, is_active')
    .eq('mentor_id', mentor)
    .eq('hospital_id', hospitalUuid)
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };

  if (existing?.id) {
    if (existing.is_active === false) {
      const { error: reactivateError } = await supabase
        .from('mentor_hospital_assignments')
        .update({ is_active: true })
        .eq('id', existing.id);
      if (reactivateError) return { ok: false, error: reactivateError.message };
    }
    return { ok: true, hospitalUuid };
  }

  const { error: insertError } = await supabase.from('mentor_hospital_assignments').insert({
    mentor_id: mentor,
    hospital_id: hospitalUuid,
    assigned_by: actor,
    is_active: true,
  });
  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, hospitalUuid };
}

/** Set users.hospital_facility_id from CRM linked hospital ids (first hospital wins). */
export async function applyPeccHospitalFromLinkedIds(
  peccUserId: string,
  linkedHospitalIds: string[]
): Promise<string | null> {
  const first = linkedHospitalIds.map((id) => normalizeHospitalKey(id)).find(Boolean);
  if (!first || !peccUserId) return null;
  const facilityId = await resolvePeccFacilityId(supabase, first);
  if (!facilityId) return null;
  const { error } = await supabase
    .from('users')
    .update({ hospital_facility_id: facilityId, updated_at: new Date().toISOString() })
    .eq('id', peccUserId)
    .eq('role', 'pecc');
  if (error) {
    console.warn('[applyPeccHospitalFromLinkedIds]', error.message);
    return null;
  }
  return facilityId;
}

async function mentorIdsForPecc(peccUserId: string, primaryMentorId?: string | null): Promise<string[]> {
  const ids = new Set<string>();
  const primary = normalizeHospitalKey(primaryMentorId);
  if (primary) ids.add(primary);
  const extra = await getUserData<string[]>(peccUserId, PECC_MENTOR_IDS_KEY);
  if (Array.isArray(extra)) {
    extra.forEach((id) => {
      const trimmed = normalizeHospitalKey(id);
      if (trimmed) ids.add(trimmed);
    });
  }
  return [...ids];
}

/** Ensure each mentor linked to this PECC has an assignment row for the PECC's hospital. */
export async function syncMentorHospitalAssignmentsForPecc(
  peccUserId: string,
  assignedBy: string
): Promise<void> {
  const { data: pecc, error } = await supabase
    .from('users')
    .select('hospital_facility_id, mentor_id')
    .eq('id', peccUserId)
    .eq('role', 'pecc')
    .maybeSingle();
  if (error || !pecc) return;
  const hospitalRef = normalizeHospitalKey(pecc.hospital_facility_id);
  if (!hospitalRef) return;

  const mentorIds = await mentorIdsForPecc(peccUserId, pecc.mentor_id);
  await Promise.all(
    mentorIds.map((mentorId) => ensureMentorHospitalAssignment(mentorId, hospitalRef, assignedBy))
  );
}

/** After mentor ↔ PECC assignment changes, sync hospital rows for all relevant PECCs. */
export async function syncMentorHospitalAssignmentsFromMentorPeccLink(
  mentorId: string,
  peccIds: string[],
  assignedBy: string
): Promise<void> {
  const mentor = normalizeHospitalKey(mentorId);
  const actor = normalizeHospitalKey(assignedBy);
  if (!mentor || !actor) return;

  const peccIdSet = new Set(peccIds.map((id) => normalizeHospitalKey(id)).filter(Boolean));

  const [{ data: selectedPeccs }, { data: mentorPeccs }] = await Promise.all([
    peccIdSet.size > 0
      ? supabase
          .from('users')
          .select('id, hospital_facility_id')
          .eq('role', 'pecc')
          .in('id', [...peccIdSet])
      : Promise.resolve({ data: [] as Array<{ id: string; hospital_facility_id: string | null }> }),
    supabase
      .from('users')
      .select('id, hospital_facility_id')
      .eq('role', 'pecc')
      .eq('mentor_id', mentor),
  ]);

  const refs = new Set<string>();
  const peccRows = [...(selectedPeccs || []), ...(mentorPeccs || [])];
  for (const row of peccRows) {
    const ref = normalizeHospitalKey(row.hospital_facility_id);
    if (ref) refs.add(ref);
  }

  const missingHospitalPeccIds = peccRows
    .filter((row) => !normalizeHospitalKey(row.hospital_facility_id))
    .map((row) => row.id);
  if (missingHospitalPeccIds.length > 0) {
    const { data: peccProfiles } = await supabase
      .from('users')
      .select('id, email')
      .in('id', missingHospitalPeccIds);
    const emails = (peccProfiles || [])
      .map((p) => String(p.email || '').trim().toLowerCase())
      .filter(Boolean);
    if (emails.length > 0) {
      const { data: crmRows } = await supabase
        .from('crm_organizations')
        .select('email, linked_hospital_ids')
        .eq('contact_type', 'pecc');
      const emailSet = new Set(emails);
      for (const crm of crmRows || []) {
        const em = String(crm.email || '').trim().toLowerCase();
        if (!emailSet.has(em)) continue;
        const links = Array.isArray(crm.linked_hospital_ids) ? crm.linked_hospital_ids : [];
        const hospitalIds = links.map((id) => normalizeHospitalKey(String(id))).filter(Boolean);
        const peccProfile = (peccProfiles || []).find(
          (p) => String(p.email || '').trim().toLowerCase() === em
        );
        if (peccProfile && hospitalIds.length > 0) {
          await applyPeccHospitalFromLinkedIds(peccProfile.id, hospitalIds);
        }
        hospitalIds.forEach((ref) => refs.add(ref));
      }
    }
  }

  await Promise.all(
    [...refs].map((ref) => ensureMentorHospitalAssignment(mentor, ref, actor))
  );
}

/** PostgREST .or() for matching PECC hospital_facility_id against multiple id/facility refs. */
export function buildPeccHospitalFacilityOrClause(refs: string[]): string {
  const unique = [...new Set(refs.map((r) => normalizeHospitalKey(r)).filter(Boolean))];
  if (unique.length === 0) return '';
  return unique.map((r) => `hospital_facility_id.eq.${r}`).join(',');
}

/** Expand hospital UUIDs to include facility_id refs for PECC queries. */
export async function expandHospitalRefsForPeccQuery(
  hospitalRefs: string[]
): Promise<{ refs: string[]; refToCanonicalId: Map<string, string> }> {
  const seeds = [...new Set(hospitalRefs.map((r) => normalizeHospitalKey(r)).filter(Boolean))];
  const refToCanonicalId = new Map<string, string>();
  const refs = new Set<string>();
  if (seeds.length === 0) return { refs: [], refToCanonicalId };

  const orClause = buildHospitalsTableOrClause(seeds);
  const { data, error } = await supabase.from('hospitals').select('id, facility_id').or(orClause);
  if (error) throw error;

  for (const row of (data || []) as Array<{ id: string; facility_id?: string | null }>) {
    const id = normalizeHospitalKey(row.id);
    const fid = row.facility_id != null ? normalizeHospitalKey(String(row.facility_id)) : '';
    if (id) {
      refs.add(id);
      refToCanonicalId.set(id, id);
    }
    if (fid) {
      refs.add(fid);
      refToCanonicalId.set(fid, id);
    }
  }
  seeds.forEach((seed) => {
    refs.add(seed);
    if (!refToCanonicalId.has(seed)) refToCanonicalId.set(seed, seed);
  });
  return { refs: [...refs], refToCanonicalId };
}
