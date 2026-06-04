import { hospitalKeysMatch } from './hospitalId';

export interface MentorContactLike {
  hospitalId?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isWorkingWithMentor?: boolean;
  isPrimaryContact?: boolean;
}

export interface PeccUserLike {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  hospital_facility_id?: string | null;
  mentor_id?: string | null;
}

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

/** Match emails when domains differ by a small typo (e.g. pipeline vs pipline). */
export function emailsLikelySame(aRaw: unknown, bRaw: unknown): boolean {
  const a = normalizeEmail(aRaw);
  const b = normalizeEmail(bRaw);
  if (!a || !b) return false;
  if (a === b) return true;
  const atA = a.lastIndexOf('@');
  const atB = b.lastIndexOf('@');
  if (atA < 1 || atB < 1) return false;
  const localA = a.slice(0, atA);
  const localB = b.slice(0, atB);
  const domainA = a.slice(atA + 1);
  const domainB = b.slice(atB + 1);
  if (localA !== localB) return false;
  if (domainA === domainB) return true;
  return levenshtein(domainA, domainB) <= 2;
}

export function contactNameMatchesPecc(contact: MentorContactLike, pecc: PeccUserLike): boolean {
  const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim().toLowerCase();
  const peccName = [pecc.first_name, pecc.last_name].filter(Boolean).join(' ').trim().toLowerCase();
  return Boolean(contactName && peccName && contactName === peccName);
}

export function contactMatchesPeccAtHospital(
  contact: MentorContactLike,
  pecc: PeccUserLike,
  hospitalRefs: Set<string>
): boolean {
  const contactHospitalId = String(contact.hospitalId || '').trim();
  if (!contactHospitalId) return false;
  const hospitalMatch = [...hospitalRefs].some((ref) => hospitalKeysMatch(ref, contactHospitalId));
  if (!hospitalMatch) return false;
  return emailsLikelySame(contact.email, pecc.email) || contactNameMatchesPecc(contact, pecc);
}

export function peccLinkedToHospitalRefs(pecc: PeccUserLike, hospitalRefs: Set<string>): boolean {
  const linkedRef = String(pecc.hospital_facility_id || '').trim();
  if (!linkedRef) return false;
  return [...hospitalRefs].some((ref) => hospitalKeysMatch(ref, linkedRef));
}

export function resolvePeccsForMentorHospital(params: {
  hospitalRefs: Set<string>;
  contacts: MentorContactLike[];
  mentorLinkedPeccs: PeccUserLike[];
  peccUsersByHospital: PeccUserLike[];
  siteMemberPeccIds: string[];
  mentorId: string;
  extraPeccProfiles?: PeccUserLike[];
}): {
  contactsForHospital: MentorContactLike[];
  mergedPeccUsers: PeccUserLike[];
  uniquePeccUserIds: string[];
  directMentorPeccIds: string[];
} {
  const { hospitalRefs, contacts, mentorLinkedPeccs, peccUsersByHospital, siteMemberPeccIds, mentorId, extraPeccProfiles } =
    params;

  const contactsForHospital = contacts.filter((contact) => {
    const contactHospitalId = String(contact.hospitalId || '').trim();
    if (!contactHospitalId) return false;
    return [...hospitalRefs].some((ref) => hospitalKeysMatch(ref, contactHospitalId));
  });

  const mentorLinkedPeccsForHospital = mentorLinkedPeccs.filter((pecc) => {
    if (peccLinkedToHospitalRefs(pecc, hospitalRefs)) return true;
    return contactsForHospital.some((contact) => contactMatchesPeccAtHospital(contact, pecc, hospitalRefs));
  });

  if (
    mentorLinkedPeccsForHospital.length === 0 &&
    mentorLinkedPeccs.length === 1 &&
    contactsForHospital.length === 1
  ) {
    const contact = contactsForHospital[0];
    const onlyPecc = mentorLinkedPeccs[0];
    if (
      contact.isWorkingWithMentor === true ||
      contact.isPrimaryContact === true ||
      contactNameMatchesPecc(contact, onlyPecc) ||
      emailsLikelySame(contact.email, onlyPecc.email)
    ) {
      mentorLinkedPeccsForHospital.push(onlyPecc);
    }
  }

  const mergedById = new Map<string, PeccUserLike>();
  [...peccUsersByHospital, ...mentorLinkedPeccsForHospital, ...(extraPeccProfiles || [])].forEach((row) => {
    if (row?.id) mergedById.set(row.id, row);
  });

  siteMemberPeccIds.forEach((id) => {
    if (!mergedById.has(id)) {
      mergedById.set(id, { id });
    }
  });

  const mergedPeccUsers = [...mergedById.values()];
  const uniquePeccUserIds = [...mergedById.keys()];
  const directMentorPeccIds = mergedPeccUsers
    .filter((u) => String(u.mentor_id || '').trim() === mentorId)
    .map((u) => u.id);

  return { contactsForHospital, mergedPeccUsers, uniquePeccUserIds, directMentorPeccIds };
}
