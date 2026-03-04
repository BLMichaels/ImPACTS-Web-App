/**
 * Per-user key/value storage in Supabase (replaces localStorage for user data).
 * All reads/writes go to public.user_data so data syncs across devices.
 * When the user_data table is missing (404), we fall back to localStorage so
 * Activities, Gap Plans, Simulation, Milestones, Snapshot, etc. still persist across refresh.
 */
import { supabase } from '../supabase';

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
  // Table missing or RLS error: fall back to localStorage so data persists across refresh
  if (error) {
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
    console.error('userData set error:', error);
    // Persist to localStorage so data survives refresh when user_data table is missing
    try {
      localStorage.setItem(localStorageKey(userId, dataKey), JSON.stringify(value));
    } catch {
      // ignore
    }
  }
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
