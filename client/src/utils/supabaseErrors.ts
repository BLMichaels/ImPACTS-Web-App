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
