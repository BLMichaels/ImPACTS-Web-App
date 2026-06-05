import { supabase } from '../supabase';
import { hospitalKeysMatch, normalizeHospitalKey } from './hospitalId';
import { buildPeccHospitalFacilityOrClause, expandHospitalRefsForPeccQuery } from './mentorHospitalAssignments';
import type { PeccUserLike } from './mentorPeccHospitalMatch';

export interface AssignedHospitalPecc {
  source: 'portal' | 'hospital_contact' | 'crm';
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mentorId?: string | null;
  contactStatus: string;
  roleAtHospital: string;
}

type HospitalContactRow = {
  id: string;
  hospital_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role_at_hospital: string | null;
  contact_status?: string | null;
};

type CrmPeccRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linked_hospital_ids?: string[] | null;
  status?: string | null;
};

function isPeccHospitalContactRecord(
  contact: HospitalContactRow,
  linkedUserRole: Map<string, string>
): boolean {
  const status = (contact.contact_status || '').toLowerCase();
  const roleAt = (contact.role_at_hospital || '').toLowerCase();
  const userRole = contact.user_id ? (linkedUserRole.get(contact.user_id) || '').toLowerCase() : '';
  if (userRole === 'pecc') return true;
  if (status.includes('new pecc') || status.includes('already a pecc')) return true;
  if (roleAt.includes('pecc')) return true;
  return false;
}

function crmLinkMatchesHospitalRefs(link: string, hospitalRefSet: Set<string>, canonicalUuids: Set<string>): boolean {
  const ref = normalizeHospitalKey(link);
  if (!ref) return false;
  if (hospitalRefSet.has(ref)) return true;
  return [...hospitalRefSet].some((hospitalRef) => hospitalKeysMatch(hospitalRef, ref));
}

function dedupeKey(email: string, firstName: string, lastName: string, id: string): string {
  const em = email.trim().toLowerCase();
  if (em) return `email:${em}`;
  const name = `${firstName} ${lastName}`.trim().toLowerCase();
  if (name) return `name:${name}`;
  return `id:${id}`;
}

/** Load every PECC assigned to a hospital (portal users, hospital_contacts, CRM links). */
export async function loadAssignedPeccsForHospital(
  hospitalId: string,
  hospitalFacilityId?: string | null
): Promise<AssignedHospitalPecc[]> {
  const seeds = [hospitalId, hospitalFacilityId].map((ref) => normalizeHospitalKey(ref)).filter(Boolean);
  if (seeds.length === 0) return [];

  const { refs, refToCanonicalId } = await expandHospitalRefsForPeccQuery(seeds);
  const hospitalRefSet = new Set(refs);
  const canonicalUuids = [...new Set([...refToCanonicalId.values()].filter(Boolean))];

  const peccClause = buildPeccHospitalFacilityOrClause(refs);
  const [{ data: portalUsers }, { data: hospitalContacts }, { data: crmRows }] = await Promise.all([
    peccClause
      ? supabase
          .from('users')
          .select('id, first_name, last_name, email, hospital_facility_id, mentor_id')
          .eq('role', 'pecc')
          .or(peccClause)
      : Promise.resolve({ data: [] as PeccUserLike[], error: null }),
    canonicalUuids.length > 0
      ? supabase
          .from('hospital_contacts')
          .select('id, hospital_id, user_id, first_name, last_name, email, phone, role_at_hospital, contact_status')
          .in('hospital_id', canonicalUuids)
      : Promise.resolve({ data: [] as HospitalContactRow[], error: null }),
    supabase
      .from('crm_organizations')
      .select('id, first_name, last_name, name, email, phone, linked_hospital_ids, status')
      .eq('contact_type', 'pecc'),
  ]);

  const linkedUserIds = [...new Set((hospitalContacts || []).map((c) => c.user_id).filter(Boolean))] as string[];
  const linkedUserRole = new Map<string, string>();
  if (linkedUserIds.length > 0) {
    const { data: linkedUsers } = await supabase.from('users').select('id, role').in('id', linkedUserIds);
    (linkedUsers || []).forEach((u: { id: string; role: string }) => linkedUserRole.set(u.id, u.role || ''));
  }

  const merged = new Map<string, AssignedHospitalPecc>();

  for (const pecc of (portalUsers || []) as PeccUserLike[]) {
    if (!pecc?.id) continue;
    if (![...hospitalRefSet].some((ref) => hospitalKeysMatch(pecc.hospital_facility_id, ref))) continue;
    const email = String(pecc.email || '').trim();
    const firstName = String(pecc.first_name || '').trim();
    const lastName = String(pecc.last_name || '').trim();
    merged.set(dedupeKey(email, firstName, lastName, pecc.id), {
      source: 'portal',
      id: pecc.id,
      firstName,
      lastName,
      email,
      phone: '',
      mentorId: pecc.mentor_id,
      contactStatus: 'Portal account',
      roleAtHospital: 'PECC',
    });
  }

  for (const contact of (hospitalContacts || []) as HospitalContactRow[]) {
    if (!isPeccHospitalContactRecord(contact, linkedUserRole)) continue;
    const email = String(contact.email || '').trim();
    const firstName = String(contact.first_name || '').trim();
    const lastName = String(contact.last_name || '').trim();
    const key = dedupeKey(email, firstName, lastName, contact.id);
    if (merged.has(key)) continue;
    merged.set(key, {
      source: 'hospital_contact',
      id: contact.id,
      firstName,
      lastName,
      email,
      phone: String(contact.phone || '').trim(),
      contactStatus: contact.contact_status || 'Hospital contact',
      roleAtHospital: contact.role_at_hospital || 'PECC',
    });
  }

  for (const row of (crmRows || []) as CrmPeccRow[]) {
    const links = Array.isArray(row.linked_hospital_ids) ? row.linked_hospital_ids : [];
    const matches = links.some((link) => crmLinkMatchesHospitalRefs(String(link), hospitalRefSet, new Set(canonicalUuids)));
    if (!matches) continue;
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.name || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = nameParts.slice(0, -1).join(' ') || fullName;
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const email = String(row.email || '').trim();
    const key = dedupeKey(email, firstName, lastName, row.id);
    if (merged.has(key)) continue;
    merged.set(key, {
      source: 'crm',
      id: row.id,
      firstName,
      lastName,
      email,
      phone: String(row.phone || '').trim(),
      contactStatus: row.status ? `CRM · ${row.status}` : 'CRM PECC',
      roleAtHospital: 'PECC',
    });
  }

  return [...merged.values()].sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
  );
}

export function assignedPeccToContact(
  pecc: AssignedHospitalPecc,
  hospitalId: string,
  mentorId: string
): {
  id: string;
  hospitalId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactStatus: string;
  roleAtHospital: string;
  isPrimaryContact: boolean;
  isActivelyEngaged: boolean;
  isWorkingWithMentor: boolean;
  notes: string;
  assignedPeccSource: AssignedHospitalPecc['source'];
} {
  const workingWithMentor =
    pecc.source === 'portal' && String(pecc.mentorId || '').trim() === mentorId;
  return {
    id:
      pecc.source === 'portal'
        ? `pecc-${pecc.id}`
        : pecc.source === 'hospital_contact'
          ? `hc-${pecc.id}`
          : `crm-${pecc.id}`,
    hospitalId,
    firstName: pecc.firstName,
    lastName: pecc.lastName,
    email: pecc.email,
    phone: pecc.phone,
    contactStatus: pecc.contactStatus,
    roleAtHospital: pecc.roleAtHospital,
    isPrimaryContact: false,
    isActivelyEngaged: pecc.source === 'portal',
    isWorkingWithMentor: workingWithMentor,
    notes: '',
    assignedPeccSource: pecc.source,
  };
}
