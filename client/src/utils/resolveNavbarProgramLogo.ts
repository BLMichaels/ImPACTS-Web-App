import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves navbar program logo and which program id to use for branding (welcome text, etc.).
 *
 * Navbar branding must come only from active program memberships.
 * A stale `primary_program_id` must NOT keep showing a removed program's logo.
 * If the primary program is still active, prefer it; otherwise fall back to another active membership.
 */
export async function resolveNavbarProgramLogo(
  supabase: SupabaseClient,
  userId: string,
  primaryProgramId: string | null | undefined
): Promise<{ logoUrl: string | null; brandProgramId: string | null }> {
  const trimPid =
    typeof primaryProgramId === 'string' && primaryProgramId.trim()
      ? primaryProgramId.trim()
      : null;

  const logoFromUrl = (u: unknown): string | null =>
    typeof u === 'string' && u.trim() ? u.trim() : null;

  const { data: members, error: memErr } = await supabase
    .from('program_members')
    .select('program_id, added_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('added_at', { ascending: false });

  if (memErr) {
    console.warn('[resolveNavbarProgramLogo] program_members:', memErr.message);
  }

  const memberRows = (members ?? []) as { program_id: string; added_at?: string | null }[];

  const memberIdSet = new Set(memberRows.map((row) => String(row.program_id)));
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  if (trimPid && memberIdSet.has(trimPid)) {
    orderedIds.push(trimPid);
    seen.add(trimPid);
  }
  for (const row of memberRows) {
    const pid = String(row.program_id);
    if (!seen.has(pid)) {
      seen.add(pid);
      orderedIds.push(pid);
    }
  }

  if (orderedIds.length === 0) {
    return { logoUrl: null, brandProgramId: null };
  }

  const { data: progs } = await supabase
    .from('programs')
    .select('id, logo_url')
    .in('id', orderedIds);

  const logoById = new Map<string, string | null>();
  for (const row of progs ?? []) {
    const r = row as { id: string; logo_url?: string | null };
    logoById.set(r.id, r.logo_url ?? null);
  }

  for (const pid of orderedIds) {
    const logo = logoFromUrl(logoById.get(pid));
    if (logo) {
      return { logoUrl: logo, brandProgramId: pid };
    }
  }

  if (memberRows.length > 0) {
    return {
      logoUrl: null,
      brandProgramId: String(memberRows[0].program_id)
    };
  }

  return { logoUrl: null, brandProgramId: null };
}
