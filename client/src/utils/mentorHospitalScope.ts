/**
 * Canonical merge for mentor site lists:
 * 1) Active rows from mentor_hospital_assignments (authoritative for ops/admin assignments)
 * 2) mentorHospitals in user_data (Hospitals page / legacy; fills gaps before PECC accounts exist)
 * Order: assignment rows first, then stored-only sites not already represented by hospital id.
 */
import { supabase } from '../supabase';
import { getUserData } from './userData';
import { normalizeHospitalKey } from './hospitalId';

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
  source: 'assignment' | 'stored';
  storedHospital?: { city?: string; state?: string };
}

export async function fetchMergedMentorHospitals(mentorId: string): Promise<MergedMentorHospitalRow[]> {
  const [assignmentRes, storedMentorHospitals] = await Promise.all([
    supabase
      .from('mentor_hospital_assignments')
      .select(`
        *,
        hospital:hospital_id(id, name, facility_id)
      `)
      .eq('mentor_id', mentorId)
      .eq('is_active', true),
    getUserData<MentorStoredHospitalLite[]>(mentorId, 'mentorHospitals')
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

  const seen = new Set(merged.map((m) => normalizeHospitalKey(m.hospital.id)).filter(Boolean));

  (Array.isArray(storedMentorHospitals) ? storedMentorHospitals : []).forEach((h) => {
    const hid = normalizeHospitalKey(h?.id);
    if (!hid || seen.has(hid)) return;
    seen.add(hid);
    merged.push({
      id: `stored-${hid}`,
      hospital_id: hid,
      mentor_id: mentorId,
      is_active: true,
      hospital: {
        id: hid,
        name: h?.name || 'Assigned Hospital',
        facility_id: hid
      },
      source: 'stored',
      storedHospital: { city: h?.city, state: h?.state }
    });
  });

  return merged;
}

/** Dropdown row for activities / filters */
export function mergedRowsToHospitalOptions(rows: MergedMentorHospitalRow[]): Array<{ id: string; name: string }> {
  return rows.map((r) => ({
    id: r.hospital.id,
    name: r.hospital.name?.trim() || 'Hospital'
  }));
}
