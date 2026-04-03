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
