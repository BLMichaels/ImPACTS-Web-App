/**
 * Per-user key/value storage in Supabase (replaces localStorage for user data).
 * All reads/writes go to public.user_data so data syncs across devices.
 */
import { supabase } from '../supabase';

export async function getUserData<T = unknown>(userId: string, dataKey: string): Promise<T | null> {
  if (!userId || !dataKey) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('value')
    .eq('user_id', userId)
    .eq('data_key', dataKey)
    .maybeSingle();
  if (error) {
    console.error('userData get error:', error);
    return null;
  }
  return (data?.value as T) ?? null;
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
  if (error) console.error('userData set error:', error);
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
