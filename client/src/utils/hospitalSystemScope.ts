/**
 * Hospital System scope: keep CRM system contacts and hospitals.hospital_system aligned,
 * and resolve the full hospital set for a system name (text match ∪ CRM linked ids).
 */
import { supabase } from '../supabase';

export interface HospitalSystemSite {
  id: string;
  name: string;
  facility_id?: string | null;
  city?: string | null;
  state?: string | null;
  hospital_system?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHospitalUuid(value: string | null | undefined): boolean {
  return UUID_RE.test(String(value || '').trim());
}

export function normalizeSystemName(value: string | null | undefined): string {
  return String(value || '').trim();
}

/** Distinct system names from hospitals.hospital_system ∪ CRM system contact names. */
export async function listHospitalSystemNames(): Promise<string[]> {
  const [{ data: hospitalRows }, { data: systemContacts }] = await Promise.all([
    supabase.from('hospitals').select('hospital_system').not('hospital_system', 'is', null),
    supabase.from('crm_organizations').select('name').eq('contact_type', 'system'),
  ]);
  const names = new Set<string>();
  (hospitalRows || []).forEach((r: { hospital_system: string | null }) => {
    const n = normalizeSystemName(r.hospital_system);
    if (n) names.add(n);
  });
  (systemContacts || []).forEach((r: { name: string | null }) => {
    const n = normalizeSystemName(r.name);
    if (n) names.add(n);
  });
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Assigned system names for a Hospital System user (Team tab join table). */
export async function fetchAssignedHospitalSystemNames(userId: string): Promise<string[]> {
  const id = String(userId || '').trim();
  if (!id) return [];
  const { data, error } = await supabase
    .from('hospital_system_assignments')
    .select('hospital_system_name')
    .eq('user_id', id);
  if (error) throw error;
  return [
    ...new Set(
      (data || [])
        .map((a: { hospital_system_name: string }) => normalizeSystemName(a.hospital_system_name))
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/**
 * Resolve hospitals for a system:
 * 1) hospitals.hospital_system exact match
 * 2) CRM system contact(s) with matching name → linked_hospital_ids
 */
export async function resolveHospitalsForSystem(systemName: string): Promise<HospitalSystemSite[]> {
  const name = normalizeSystemName(systemName);
  if (!name) return [];

  const byId = new Map<string, HospitalSystemSite>();

  const { data: byText, error: textErr } = await supabase
    .from('hospitals')
    .select('id, name, facility_id, city, state, hospital_system')
    .eq('hospital_system', name)
    .order('name');
  if (textErr) throw textErr;
  (byText || []).forEach((h: HospitalSystemSite) => {
    if (h?.id) byId.set(h.id, h);
  });

  const { data: systemContacts, error: crmErr } = await supabase
    .from('crm_organizations')
    .select('id, name, linked_hospital_ids')
    .eq('contact_type', 'system')
    .eq('name', name);
  if (crmErr) throw crmErr;

  const linkedIds = [
    ...new Set(
      (systemContacts || []).flatMap((c: { linked_hospital_ids?: string[] | null }) =>
        Array.isArray(c.linked_hospital_ids) ? c.linked_hospital_ids : []
      ).map((id) => String(id || '').trim()).filter(isHospitalUuid)
    ),
  ].filter((id) => !byId.has(id));

  if (linkedIds.length > 0) {
    const { data: linkedRows, error: linkedErr } = await supabase
      .from('hospitals')
      .select('id, name, facility_id, city, state, hospital_system')
      .in('id', linkedIds)
      .order('name');
    if (linkedErr) throw linkedErr;
    (linkedRows || []).forEach((h: HospitalSystemSite) => {
      if (h?.id) byId.set(h.id, h);
    });
  }

  return [...byId.values()].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  );
}

/** Stamp hospitals.hospital_system so Support Tool text queries stay aligned with CRM links. */
export async function syncHospitalSystemTextForIds(
  hospitalIds: string[],
  systemName: string | null
): Promise<void> {
  const ids = [...new Set(hospitalIds.map((id) => String(id || '').trim()).filter(isHospitalUuid))];
  if (!ids.length) return;
  const name = systemName ? normalizeSystemName(systemName) : null;
  const { error } = await supabase
    .from('hospitals')
    .update({ hospital_system: name || null, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) {
    console.error('[hospitalSystemScope] syncHospitalSystemTextForIds failed:', error);
  }
}

/**
 * When a CRM system contact's hospital list changes: set hospital_system on added hospitals,
 * and clear it on removed hospitals that still pointed at this system name.
 */
export async function reconcileSystemHospitalLinks(params: {
  systemName: string;
  nextHospitalIds: string[];
  previousHospitalIds?: string[];
}): Promise<void> {
  const systemName = normalizeSystemName(params.systemName);
  if (!systemName) return;
  const next = new Set(
    (params.nextHospitalIds || []).map((id) => String(id || '').trim()).filter(isHospitalUuid)
  );
  const prev = new Set(
    (params.previousHospitalIds || []).map((id) => String(id || '').trim()).filter(isHospitalUuid)
  );

  const added = [...next].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !next.has(id));

  // Always stamp the full next set so one-way CRM links heal hospital_system text.
  if (next.size > 0) {
    await syncHospitalSystemTextForIds([...next], systemName);
  }

  if (removed.length > 0) {
    // Only clear if hospital still labeled with this system (don't wipe a manual reassignment).
    const { data: toClear } = await supabase
      .from('hospitals')
      .select('id')
      .in('id', removed)
      .eq('hospital_system', systemName);
    const clearIds = (toClear || []).map((r: { id: string }) => r.id);
    if (clearIds.length) {
      await syncHospitalSystemTextForIds(clearIds, null);
    }
  }

  // Heal: if we only have "added" empty but next is populated (first save), already stamped above.
  void added;
}
