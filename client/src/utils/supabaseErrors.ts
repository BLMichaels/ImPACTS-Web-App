/**
 * Detect PostgREST "table not found" / not exposed (404 / PGRST205).
 * If these fire in production, run `supabase-schema.sql` (or equivalent migrations) in the Supabase SQL editor.
 */
export function isSupabaseMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  if (e.code === 'PGRST205' || e.code === '42P01') return true;
  const msg = `${e.message || ''} ${e.details || ''} ${e.hint || ''}`;
  return /Could not find the table|schema cache|does not exist|relation .* does not exist/i.test(msg);
}

/** RLS / permission failures must not fall back to localStorage (would mask misconfiguration). */
export function isRlsOrPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '42501' || e.code === 'PGRST301') return true;
  const msg = String(e.message || '');
  return /permission denied|row-level security|new row violates row-level security|JWT expired|not authorized/i.test(msg);
}

/**
 * When user_data Supabase calls fail, only fall back to localStorage for "offline / schema missing" cases.
 * Never for RLS denials — those should surface as empty or errors so misconfiguration is visible.
 */
export function shouldFallbackUserDataToLocalStorage(error: unknown): boolean {
  if (isRlsOrPermissionDeniedError(error)) return false;
  if (isSupabaseMissingRelationError(error)) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { message?: string; code?: string };
  const msg = String(e.message || '');
  if (/Failed to fetch|NetworkError|Load failed|network|ECONNREFUSED|timeout/i.test(msg)) return true;
  return false;
}

/** Log Supabase errors in production without dumping row payloads. */
export function logSupabaseError(context: string, error: unknown): void {
  if (!error || typeof error !== 'object') {
    if (process.env.NODE_ENV === 'development') console.error(context, error);
    else console.error(context);
    return;
  }
  const e = error as { code?: string; message?: string };
  if (process.env.NODE_ENV === 'development') console.error(context, error);
  else console.error(context, e.code || 'error', (e.message || '').slice(0, 200));
}
