/**
 * Canonical merge for mentor site lists:
 * 1) Active rows from mentor_hospital_assignments (authoritative for ops/admin assignments)
 * 2) Hospitals from PECCs linked to this mentor (users.mentor_id + pecc_mentor_ids)
 * 3) mentorHospitals in user_data (Hospitals page / legacy; fills gaps before PECC accounts exist)
 * Order: assignment rows first, then PECC-linked, then stored-only sites not already represented.
 */
import { supabase } from '../supabase';
import { batchGetUserDataForKey, getUserData } from './userData';
import { hospitalIdOrFacilityOrClause, normalizeHospitalKey } from './hospitalId';
import {
  buildPeccHospitalFacilityOrClause,
  expandHospitalRefsForPeccQuery,
} from './mentorHospitalAssignments';

const PECC_MENTOR_IDS_KEY = 'pecc_mentor_ids';

type HospitalRowLite = { id: string; name?: string; facility_id?: string | null };

async function resolveHospitalRowsByRefs(refs: string[]): Promise<Map<string, HospitalRowLite>> {
  const unique = [...new Set(refs.map((r) => normalizeHospitalKey(r)).filter(Boolean))];
  const byRef = new Map<string, HospitalRowLite>();
  if (unique.length === 0) return byRef;

  const orClause = unique.map((r) => hospitalIdOrFacilityOrClause(r)).join(',');
  const { data, error } = await supabase.from('hospitals').select('id, name, facility_id').or(orClause);
  if (error) throw error;

  for (const row of (data || []) as HospitalRowLite[]) {
    const id = normalizeHospitalKey(row.id);
    const fid = row.facility_id != null ? normalizeHospitalKey(String(row.facility_id)) : '';
    if (id) byRef.set(id, row);
    if (fid) byRef.set(fid, row);
  }
  return byRef;
}

function hospitalRowMatchesRef(row: HospitalRowLite, ref: string): boolean {
  const key = normalizeHospitalKey(ref);
  if (!key) return false;
  return key === normalizeHospitalKey(row.id) || key === normalizeHospitalKey(row.facility_id);
}

async function fetchCrmHospitalRefsForMentorPeccs(
  mentorPeccs: Array<{ email?: string | null; hospital_facility_id?: string | null }>
): Promise<string[]> {
  const emailsNeedingCrm = mentorPeccs
    .filter((p) => !normalizeHospitalKey(p.hospital_facility_id) && String(p.email || '').trim())
    .map((p) => String(p.email).trim().toLowerCase());
  if (emailsNeedingCrm.length === 0) return [];

  const { data: crmRows, error: crmError } = await supabase
    .from('crm_organizations')
    .select('email, linked_hospital_ids')
    .eq('contact_type', 'pecc');
  if (crmError) throw crmError;

  const emailSet = new Set(emailsNeedingCrm);
  const refs = new Set<string>();
  for (const row of crmRows || []) {
    const em = String(row.email || '').trim().toLowerCase();
    if (!emailSet.has(em)) continue;
    for (const hid of Array.isArray(row.linked_hospital_ids) ? row.linked_hospital_ids : []) {
      const ref = normalizeHospitalKey(String(hid));
      if (ref) refs.add(ref);
    }
  }
  return [...refs];
}

async function fetchPeccHospitalRefsForMentor(mentorId: string): Promise<string[]> {
  const { data: primaryPeccs, error: primaryError } = await supabase
    .from('users')
    .select('id, email, hospital_facility_id')
    .eq('role', 'pecc')
    .eq('mentor_id', mentorId);
  if (primaryError) throw primaryError;

  const refs = new Set<string>();
  for (const row of primaryPeccs || []) {
    const ref = normalizeHospitalKey(row.hospital_facility_id);
    if (ref) refs.add(ref);
  }
  for (const ref of await fetchCrmHospitalRefsForMentorPeccs(primaryPeccs || [])) {
    refs.add(ref);
  }

  const { data: allPeccs, error: allError } = await supabase
    .from('users')
    .select('id, hospital_facility_id')
    .eq('role', 'pecc')
    .eq('is_active', true);
  if (allError) throw allError;

  const peccIds = (allPeccs || []).map((row) => row.id);
  const mentorLists = peccIds.length > 0
    ? await batchGetUserDataForKey<string[]>(peccIds, PECC_MENTOR_IDS_KEY)
    : new Map<string, string[] | null>();

  for (const pecc of allPeccs || []) {
    const extraMentors = mentorLists.get(pecc.id);
    const linkedToMentor =
      Array.isArray(extraMentors) && extraMentors.map((id) => normalizeHospitalKey(id)).includes(mentorId);
    if (!linkedToMentor) continue;
    const ref = normalizeHospitalKey(pecc.hospital_facility_id);
    if (ref) refs.add(ref);
  }

  return [...refs];
}

export interface MentorStoredHospitalLite {
  id: string;
  name?: string;
  city?: string;
  state?: string;
  isWorkingWith?: boolean;
}

export interface MergedMentorHospitalRow {
  /** Assignment row id, or synthetic stored-* id */
  id: string;
  hospital_id: string;
  mentor_id: string;
  is_active: boolean;
  hospital: {
    id: string;
    name?: string;
    facility_id?: string | null;
  };
  source: 'assignment' | 'pecc_linked' | 'stored';
  storedHospital?: { city?: string; state?: string };
}

function rowSeenKey(row: MergedMentorHospitalRow): string {
  const id = normalizeHospitalKey(row.hospital.id);
  const fid = normalizeHospitalKey(row.hospital.facility_id);
  return id || fid;
}

export async function fetchMergedMentorHospitals(mentorId: string): Promise<MergedMentorHospitalRow[]> {
  const [assignmentRes, storedMentorHospitals, peccHospitalRefs] = await Promise.all([
    supabase
      .from('mentor_hospital_assignments')
      .select(`
        *,
        hospital:hospital_id(id, name, facility_id)
      `)
      .eq('mentor_id', mentorId)
      .eq('is_active', true),
    getUserData<MentorStoredHospitalLite[]>(mentorId, 'mentorHospitals'),
    fetchPeccHospitalRefsForMentor(mentorId),
  ]);

  if (assignmentRes.error) throw assignmentRes.error;

  const normalized = (assignmentRes.data || []).map((row: Record<string, unknown>) => ({
    ...row,
    hospital: Array.isArray(row.hospital) ? (row.hospital as unknown[])[0] : row.hospital
  }));

  const merged: MergedMentorHospitalRow[] = normalized.map((row: Record<string, unknown>) => {
    const hosp = row.hospital as { id?: string; name?: string; facility_id?: string | null } | undefined;
    const hid = normalizeHospitalKey(String(hosp?.id ?? row.hospital_id ?? ''));
    return {
      id: String(row.id ?? ''),
      hospital_id: hid,
      mentor_id: mentorId,
      is_active: row.is_active !== false,
      hospital: {
        id: hid,
        name: hosp?.name,
        facility_id: hosp?.facility_id ?? null
      },
      source: 'assignment' as const
    };
  });

  const seen = new Set(merged.map((m) => rowSeenKey(m)).filter(Boolean));

  const peccRowsByRef = await resolveHospitalRowsByRefs(peccHospitalRefs);
  for (const ref of peccHospitalRefs) {
    const resolved = peccRowsByRef.get(ref);
    if (!resolved) continue;
    const hid = normalizeHospitalKey(resolved.id);
    const key = hid || ref;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const fid = resolved.facility_id != null ? normalizeHospitalKey(String(resolved.facility_id)) : null;
    if (fid) seen.add(fid);
    merged.push({
      id: `pecc-${hid}`,
      hospital_id: hid,
      mentor_id: mentorId,
      is_active: true,
      hospital: {
        id: hid,
        name: resolved.name || 'Assigned Hospital',
        facility_id: fid,
      },
      source: 'pecc_linked',
    });
  }

  const storedList = Array.isArray(storedMentorHospitals) ? storedMentorHospitals : [];
  const storedRefs = storedList.map((h) => normalizeHospitalKey(h?.id)).filter(Boolean);
  const storedRowsByRef = await resolveHospitalRowsByRefs(storedRefs);

  storedList.forEach((h) => {
    const hid = normalizeHospitalKey(h?.id);
    if (!hid) return;
    const resolved = [...storedRowsByRef.values()].find((row) => hospitalRowMatchesRef(row, hid));
    const canonicalId = normalizeHospitalKey(resolved?.id ?? hid);
    const canonicalFid =
      resolved?.facility_id != null ? normalizeHospitalKey(String(resolved.facility_id)) : null;
    const key = canonicalId || hid;
    if (seen.has(key) || (canonicalFid && seen.has(canonicalFid))) return;
    seen.add(key);
    if (canonicalFid) seen.add(canonicalFid);
    merged.push({
      id: `stored-${canonicalId}`,
      hospital_id: canonicalId,
      mentor_id: mentorId,
      is_active: true,
      hospital: {
        id: canonicalId,
        name: h?.name || resolved?.name || 'Assigned Hospital',
        facility_id: canonicalFid,
      },
      source: 'stored',
      storedHospital: { city: h?.city, state: h?.state }
    });
  });

  return merged;
}

export interface MentorHospitalContext {
  rowsByMentor: Map<string, MergedMentorHospitalRow[]>;
  allHospitalUuids: string[];
  allHospitalRefs: string[];
  refToCanonicalId: Map<string, string>;
  hospitalNameById: Map<string, string>;
}

/** Union merged mentor site lists (assignments + PECC-linked + CRM + stored). */
export async function buildMentorHospitalContext(mentorIds: string[]): Promise<MentorHospitalContext> {
  const rowsByMentor = new Map<string, MergedMentorHospitalRow[]>();
  const uuidSet = new Set<string>();
  const hospitalNameById = new Map<string, string>();

  await Promise.all(
    mentorIds.map(async (mentorId) => {
      const rows = await fetchMergedMentorHospitals(mentorId);
      rowsByMentor.set(mentorId, rows);
      rows.forEach((row) => {
        const id = normalizeHospitalKey(row.hospital.id);
        if (!id) return;
        uuidSet.add(id);
        const name = row.hospital.name?.trim();
        if (name) hospitalNameById.set(id, name);
      });
    })
  );

  const allHospitalUuids = [...uuidSet];
  const { refs, refToCanonicalId } = await expandHospitalRefsForPeccQuery(allHospitalUuids);
  return {
    rowsByMentor,
    allHospitalUuids,
    allHospitalRefs: refs,
    refToCanonicalId,
    hospitalNameById,
  };
}

/** Count portal PECCs per canonical hospital uuid (expanded id + facility_id refs). */
export async function countPeccsByCanonicalHospital(
  hospitalUuids: string[],
  refToCanonicalId: Map<string, string>
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  hospitalUuids.forEach((id) => counts.set(id, 0));
  if (hospitalUuids.length === 0) return counts;

  const { refs } = await expandHospitalRefsForPeccQuery(hospitalUuids);
  if (refs.length === 0) return counts;

  const { data: peccs, error } = await supabase
    .from('users')
    .select('id, hospital_facility_id')
    .eq('role', 'pecc')
    .or(buildPeccHospitalFacilityOrClause(refs));
  if (error) throw error;

  const seen = new Map<string, Set<string>>();
  (peccs || []).forEach((pecc: { id: string; hospital_facility_id?: string | null }) => {
    const ref = normalizeHospitalKey(pecc.hospital_facility_id);
    if (!ref) return;
    const canonical = refToCanonicalId.get(ref) || ref;
    if (!counts.has(canonical)) return;
    const bucket = seen.get(canonical) || new Set<string>();
    bucket.add(pecc.id);
    seen.set(canonical, bucket);
    counts.set(canonical, bucket.size);
  });
  return counts;
}

/** Dropdown row for activities / filters */
export function mergedRowsToHospitalOptions(rows: MergedMentorHospitalRow[]): Array<{ id: string; name: string }> {
  return rows.map((r) => ({
    id: r.hospital.id,
    name: r.hospital.name?.trim() || 'Hospital'
  }));
}
