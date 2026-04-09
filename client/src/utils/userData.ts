/**
 * Per-user key/value storage in Supabase (replaces localStorage for user data).
 * All reads/writes go to public.user_data so data syncs across devices.
 * localStorage fallback is only for missing table / network errors — not RLS denials (see shouldFallbackUserDataToLocalStorage).
 */
import { supabase } from '../supabase';
import {
  logSupabaseError,
  shouldFallbackUserDataToLocalStorage,
} from './supabaseErrors';

const LS_PREFIX = 'ud_';
const LEGACY_MIRROR_OVERRIDE_KEY = 'impacts_disable_legacy_user_mirror';

function localStorageKey(userId: string, dataKey: string): string {
  return `${LS_PREFIX}${userId}_${dataKey}`;
}

export async function getUserData<T = unknown>(userId: string, dataKey: string): Promise<T | null> {
  if (!userId || !dataKey) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('value')
    .eq('user_id', userId)
    .eq('data_key', dataKey)
    .maybeSingle();
  if (!error) {
    return (data?.value as T) ?? null;
  }
  if (shouldFallbackUserDataToLocalStorage(error)) {
    try {
      const raw = localStorage.getItem(localStorageKey(userId, dataKey));
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function setUserData(userId: string, dataKey: string, value: unknown): Promise<void> {
  if (!userId || !dataKey) return;
  const { error } = await supabase
    .from('user_data')
    .upsert(
      {
        user_id: userId,
        data_key: dataKey,
        value: value as any,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id,data_key' }
    );
  if (error) {
    logSupabaseError('userData set error', error);
    if (shouldFallbackUserDataToLocalStorage(error)) {
      try {
        localStorage.setItem(localStorageKey(userId, dataKey), JSON.stringify(value));
      } catch {
        // ignore
      }
    }
  }
}

const USER_DATA_BATCH = 120;
const HOSPITAL_DATA_BATCH = 120;

/** Batch-load one data_key for many users (e.g. PECC activities for admin snapshot). */
export async function batchGetUserDataForKey<T = unknown>(
  userIds: string[],
  dataKey: string
): Promise<Map<string, T | null>> {
  const out = new Map<string, T | null>();
  const unique = [...new Set(userIds.filter(Boolean))];
  unique.forEach((id) => out.set(id, null));
  if (!dataKey || unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += USER_DATA_BATCH) {
    const part = unique.slice(i, i + USER_DATA_BATCH);
    const { data, error } = await supabase
      .from('user_data')
      .select('user_id, value')
      .eq('data_key', dataKey)
      .in('user_id', part);
    if (error) {
      logSupabaseError(`batchGetUserDataForKey(${dataKey})`, error);
      continue;
    }
    (data || []).forEach((row: { user_id: string; value: unknown }) => {
      out.set(row.user_id, row.value as T);
    });
  }
  return out;
}

const SITE_REF_MAP_CHUNK = 60;

/**
 * Map hospitals.id or hospitals.facility_id string refs → canonical hospitals.id
 * (for hospital_data keys and checklist joins).
 */
export async function mapSiteRefsToHospitalRowIds(refs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(refs.map((r) => String(r || '').trim()).filter(Boolean))];
  if (!unique.length) return map;
  for (let i = 0; i < unique.length; i += SITE_REF_MAP_CHUNK) {
    const part = unique.slice(i, i + SITE_REF_MAP_CHUNK);
    const orParts = part.flatMap((ref) => [`id.eq.${ref}`, `facility_id.eq.${ref}`]);
    if (!orParts.length) continue;
    const { data, error } = await supabase.from('hospitals').select('id, facility_id').or(orParts.join(','));
    if (error) {
      logSupabaseError('mapSiteRefsToHospitalRowIds', error);
      continue;
    }
    (data || []).forEach((h: { id: string; facility_id: string | null }) => {
      map.set(String(h.id), String(h.id));
      if (h.facility_id != null && String(h.facility_id).trim()) {
        map.set(String(h.facility_id).trim(), String(h.id));
      }
    });
  }
  return map;
}

/** Resolve facility_id / id-like site references to canonical hospitals.id (UUID text). */
export async function resolveHospitalUuid(siteRef: string): Promise<string | null> {
  const ref = String(siteRef || '').trim();
  if (!ref) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);

  if (isUuid) {
    const { data, error } = await supabase.from('hospitals').select('id').eq('id', ref).maybeSingle();
    if (!error && data?.id) return String(data.id);
  }

  const { data, error } = await supabase.from('hospitals').select('id, facility_id').eq('facility_id', ref).maybeSingle();
  if (error) {
    logSupabaseError(`resolveHospitalUuid(${ref})`, error);
    return null;
  }
  return data?.id ? String(data.id) : null;
}

/** Hospital-scoped key/value storage for PECC continuity across user turnover. */
export async function getHospitalData<T = unknown>(hospitalId: string, dataKey: string): Promise<T | null> {
  if (!hospitalId || !dataKey) return null;
  const { data, error } = await supabase
    .from('hospital_data')
    .select('value')
    .eq('hospital_id', hospitalId)
    .eq('data_key', dataKey)
    .maybeSingle();
  if (!error) return (data?.value as T) ?? null;
  logSupabaseError(`getHospitalData(${dataKey})`, error);
  return null;
}

/** Upsert hospital-scoped JSON value, preserving actor attribution server-side via auth.uid(). */
export async function setHospitalData(hospitalId: string, dataKey: string, value: unknown): Promise<void> {
  if (!hospitalId || !dataKey) return;
  const { error } = await supabase
    .from('hospital_data')
    .upsert(
      {
        hospital_id: hospitalId,
        data_key: dataKey,
        value: value as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'hospital_id,data_key' }
    );
  if (error) logSupabaseError(`setHospitalData(${dataKey})`, error);
}

/**
 * Feature flag for the final cutover:
 * - default: mirror writes to both hospital_data and user_data
 * - cutover on: set REACT_APP_DISABLE_LEGACY_USER_MIRROR=true (or localStorage override key)
 */
export function shouldMirrorLegacyUserData(): boolean {
  try {
    const override = localStorage.getItem(LEGACY_MIRROR_OVERRIDE_KEY);
    if (override === 'true') return false;
    if (override === 'false') return true;
  } catch {
    // ignore localStorage unavailability
  }
  return process.env.REACT_APP_DISABLE_LEGACY_USER_MIRROR !== 'true';
}

/** Write continuity keys to hospital_data and (optionally) legacy user_data mirror. */
export async function writeContinuityData(
  hospitalId: string | null | undefined,
  userId: string | null | undefined,
  dataKey: string,
  value: unknown
): Promise<void> {
  if (!dataKey) return;
  if (hospitalId) {
    if (shouldMirrorLegacyUserData() && userId) {
      await Promise.all([
        setHospitalData(hospitalId, dataKey, value),
        setUserData(userId, dataKey, value),
      ]);
      return;
    }
    await setHospitalData(hospitalId, dataKey, value);
    return;
  }
  if (userId) await setUserData(userId, dataKey, value);
}

/** Batch-load one key for many hospitals (e.g. hospital-owned PECC activities rollups). */
export async function batchGetHospitalDataForKey<T = unknown>(
  hospitalIds: string[],
  dataKey: string
): Promise<Map<string, T | null>> {
  const out = new Map<string, T | null>();
  const unique = [...new Set(hospitalIds.filter(Boolean))];
  unique.forEach((id) => out.set(id, null));
  if (!dataKey || unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += HOSPITAL_DATA_BATCH) {
    const part = unique.slice(i, i + HOSPITAL_DATA_BATCH);
    const { data, error } = await supabase
      .from('hospital_data')
      .select('hospital_id, value')
      .eq('data_key', dataKey)
      .in('hospital_id', part);
    if (error) {
      logSupabaseError(`batchGetHospitalDataForKey(${dataKey})`, error);
      continue;
    }
    (data || []).forEach((row: { hospital_id: string; value: unknown }) => {
      out.set(row.hospital_id, row.value as T);
    });
  }
  return out;
}

/** Migrate one key from localStorage to Supabase (call once on load if Supabase returns null). */
export async function migrateFromLocalStorage(
  userId: string,
  dataKey: string,
  lsKey: string,
  setFn: (value: unknown) => void
): Promise<void> {
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw === null) return;
    const value = JSON.parse(raw);
    await setUserData(userId, dataKey, value);
    setFn(value);
    localStorage.removeItem(lsKey);
  } catch {
    // ignore
  }
}
