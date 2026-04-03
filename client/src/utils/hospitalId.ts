import type { SupabaseClient } from '@supabase/supabase-js';

/** Trimmed string key for comparing hospital row id vs facility id in UI and filters. */
export function normalizeHospitalKey(id: string | null | undefined): string {
  return String(id ?? '').trim();
}

export function hospitalKeysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeHospitalKey(a);
  const nb = normalizeHospitalKey(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Resolve a hospitals.id or hospitals.facility_id value to the canonical string stored in
 * users.hospital_facility_id (prefer facility_id when set; else row id).
 */
export async function resolvePeccFacilityId(
  supabase: SupabaseClient,
  hospitalIdOrFacility: string | null | undefined
): Promise<string | null> {
  const raw = normalizeHospitalKey(hospitalIdOrFacility);
  if (!raw) return null;
  const { data, error } = await supabase
    .from('hospitals')
    .select('id, facility_id')
    .or(`id.eq.${raw},facility_id.eq.${raw}`)
    .maybeSingle();
  if (error || !data) {
    return raw;
  }
  const row = data as { id: string; facility_id?: string | null };
  const fid = row.facility_id != null ? String(row.facility_id).trim() : '';
  return fid || String(row.id);
}

/** Build a PostgREST .or() clause for id or facility_id (escape not needed for UUID/numeric facility ids). */
export function hospitalIdOrFacilityOrClause(value: string): string {
  const v = normalizeHospitalKey(value);
  if (!v) return 'id.eq.__none__';
  return `id.eq.${v},facility_id.eq.${v}`;
}
