import type { SupabaseClient } from '@supabase/supabase-js';

const HOSPITAL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trimmed string key for comparing hospital row id vs facility id in UI and filters. */
export function normalizeHospitalKey(id: string | null | undefined): string {
  return String(id ?? '').trim();
}

export function isHospitalUuid(value: string | null | undefined): boolean {
  return HOSPITAL_UUID_RE.test(normalizeHospitalKey(value));
}

export function hospitalKeysMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeHospitalKey(a);
  const nb = normalizeHospitalKey(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * PostgREST .or() for hospitals table: only use id.eq for valid UUIDs.
 * Numeric facility ids (e.g. 50740) must not be compared to the uuid id column.
 */
export function hospitalIdOrFacilityOrClause(value: string): string {
  const v = normalizeHospitalKey(value);
  if (!v) return 'facility_id.eq.__no_match__';
  if (isHospitalUuid(v)) {
    return `id.eq.${v},facility_id.eq.${v}`;
  }
  return `facility_id.eq.${v}`;
}

/** Batch hospitals.or() with deduped safe clauses. */
export function buildHospitalsTableOrClause(refs: string[]): string {
  const parts = new Set<string>();
  for (const ref of refs) {
    hospitalIdOrFacilityOrClause(ref)
      .split(',')
      .forEach((part) => parts.add(part));
  }
  const joined = [...parts].join(',');
  return joined || 'facility_id.eq.__no_match__';
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
    .or(hospitalIdOrFacilityOrClause(raw))
    .maybeSingle();
  if (error || !data) {
    return raw;
  }
  const row = data as { id: string; facility_id?: string | null };
  const fid = row.facility_id != null ? String(row.facility_id).trim() : '';
  return fid || String(row.id);
}
