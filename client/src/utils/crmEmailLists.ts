import { supabase } from '../supabase';
import { normalizeContactEmail } from './syncPortalLoginEmail';

export type CrmEmailListSourceKind =
  | 'hospital'
  | 'crm_organization'
  | 'user'
  | 'invitation'
  | 'manual';

export interface CrmEmailList {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface CrmEmailListMember {
  id: string;
  list_id: string;
  email: string;
  display_name: string | null;
  organization: string | null;
  contact_type: string | null;
  source_kind: string;
  source_id: string | null;
  created_at: string;
}

export interface CrmListContactInput {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  email?: string;
  type?: string;
  user_id?: string;
}

function displayNameFor(c: CrmListContactInput): string {
  const first = (c.firstName || '').trim();
  const last = (c.lastName || '').trim();
  if (first || last) return `${first} ${last}`.trim();
  return (c.name || '').trim();
}

export function sourceKindForContact(c: CrmListContactInput): CrmEmailListSourceKind {
  if (c.id.startsWith('invitation:')) return 'invitation';
  if (c.id.startsWith('manual:')) return 'manual';
  if (c.type === 'hospital') return 'hospital';
  if (c.user_id && c.id === c.user_id) return 'user';
  return 'crm_organization';
}

export async function fetchCrmEmailLists(): Promise<CrmEmailList[]> {
  const { data: lists, error } = await supabase
    .from('crm_email_lists')
    .select('id, name, description, created_by, created_at, updated_at')
    .order('name', { ascending: true });
  if (error) throw error;

  const { data: counts, error: countError } = await supabase
    .from('crm_email_list_members')
    .select('list_id');
  if (countError) throw countError;

  const byList = new Map<string, number>();
  for (const row of counts || []) {
    const id = (row as { list_id: string }).list_id;
    byList.set(id, (byList.get(id) || 0) + 1);
  }

  return (lists || []).map((list) => ({
    ...list,
    member_count: byList.get(list.id) || 0,
  }));
}

export async function fetchCrmEmailListMembers(listId: string): Promise<CrmEmailListMember[]> {
  const { data, error } = await supabase
    .from('crm_email_list_members')
    .select('id, list_id, email, display_name, organization, contact_type, source_kind, source_id, created_at')
    .eq('list_id', listId)
    .order('display_name', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []) as CrmEmailListMember[];
}

export async function createCrmEmailList(name: string, description?: string): Promise<CrmEmailList> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('List name is required.');
  const { data, error } = await supabase
    .from('crm_email_lists')
    .insert({
      name: trimmed,
      description: description?.trim() || null,
    })
    .select('id, name, description, created_by, created_at, updated_at')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('A list with that name already exists.');
    throw error;
  }
  return { ...data, member_count: 0 };
}

export async function renameCrmEmailList(id: string, name: string, description?: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('List name is required.');
  const { error } = await supabase
    .from('crm_email_lists')
    .update({
      name: trimmed,
      description: description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error('A list with that name already exists.');
    throw error;
  }
}

export async function deleteCrmEmailList(id: string): Promise<void> {
  const { error } = await supabase.from('crm_email_lists').delete().eq('id', id);
  if (error) throw error;
}

export async function addContactsToCrmEmailList(
  listId: string,
  contacts: CrmListContactInput[]
): Promise<{ added: number; skippedNoEmail: number; skippedDuplicate: number }> {
  const seen = new Set<string>();
  const rows: Array<{
    list_id: string;
    email: string;
    display_name: string | null;
    organization: string | null;
    contact_type: string | null;
    source_kind: CrmEmailListSourceKind;
    source_id: string | null;
  }> = [];
  let skippedNoEmail = 0;

  for (const c of contacts) {
    const email = normalizeContactEmail(c.email);
    if (!email || !email.includes('@')) {
      skippedNoEmail += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    rows.push({
      list_id: listId,
      email,
      display_name: displayNameFor(c) || null,
      organization: (c.organization || '').trim() || null,
      contact_type: c.type || null,
      source_kind: sourceKindForContact(c),
      source_id: c.id.startsWith('invitation:') ? c.id.slice('invitation:'.length) : c.id,
    });
  }

  if (rows.length === 0) {
    return { added: 0, skippedNoEmail, skippedDuplicate: 0 };
  }

  const { data: existing, error: existingError } = await supabase
    .from('crm_email_list_members')
    .select('email')
    .eq('list_id', listId);
  if (existingError) throw existingError;
  const have = new Set((existing || []).map((r) => normalizeContactEmail(r.email)));
  const fresh = rows.filter((r) => !have.has(r.email));
  if (fresh.length === 0) {
    return { added: 0, skippedNoEmail, skippedDuplicate: rows.length };
  }
  const { data: inserted, error: insertError } = await supabase
    .from('crm_email_list_members')
    .insert(fresh)
    .select('id');
  if (insertError) throw insertError;
  await supabase.from('crm_email_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId);
  return {
    added: inserted?.length || 0,
    skippedNoEmail,
    skippedDuplicate: rows.length - (inserted?.length || 0),
  };
}

export async function addManualEmailsToCrmEmailList(
  listId: string,
  rawText: string
): Promise<{ added: number; skipped: number }> {
  const emails = Array.from(
    new Set(
      rawText
        .split(/[\s,;]+/)
        .map((part) => normalizeContactEmail(part))
        .filter((e) => e.includes('@'))
    )
  );
  if (emails.length === 0) return { added: 0, skipped: 0 };
  return addContactsToCrmEmailList(
    listId,
    emails.map((email) => ({ id: `manual:${email}`, email, name: email, type: 'other' }))
  ).then((r) => ({ added: r.added, skipped: r.skippedNoEmail + r.skippedDuplicate }));
}

export async function removeCrmEmailListMember(memberId: string): Promise<void> {
  const { error } = await supabase.from('crm_email_list_members').delete().eq('id', memberId);
  if (error) throw error;
}

export function emailsForMailto(emails: string[], maxChars = 1800): { href: string; truncated: boolean } {
  const unique = Array.from(new Set(emails.map((e) => normalizeContactEmail(e)).filter(Boolean)));
  const included: string[] = [];
  let used = 'mailto:?bcc='.length;
  for (const email of unique) {
    const next = included.length === 0 ? encodeURIComponent(email) : encodeURIComponent(`,${email}`);
    if (used + next.length > maxChars) {
      return { href: `mailto:?bcc=${encodeURIComponent(included.join(','))}`, truncated: true };
    }
    included.push(email);
    used += next.length;
  }
  return { href: `mailto:?bcc=${encodeURIComponent(included.join(','))}`, truncated: false };
}

export function buildEmailListCsv(members: CrmEmailListMember[]): string {
  const header = ['Email', 'Name', 'Organization', 'Type'];
  const lines = members.map((m) =>
    [m.email, m.display_name || '', m.organization || '', m.contact_type || '']
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}
