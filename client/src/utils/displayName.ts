/**
 * Normalize hospital/organization display names: apostrophe + capital S -> apostrophe + lowercase s
 * e.g. "St. Mary'S", "Children'S Hospital" -> "St. Mary's", "Children's Hospital".
 * Handles straight ('), curly ('), left quote (`), and modifier apostrophe.
 */
const POSSESSIVE_S_REGEX = /[\u0027\u2018\u2019\u02BC]S/gu;

export function normalizeHospitalOrOrgName(name: string | null | undefined): string {
  if (name == null || typeof name !== 'string') return '';
  return name.replace(POSSESSIVE_S_REGEX, "'s");
}

/** Display name for a user: "First Last" or email if no name, or "User" as fallback. */
export function getUserDisplayName(profile: { first_name?: string | null; last_name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null } | null | undefined): string {
  if (!profile) return 'User';
  const first = profile.first_name ?? profile.firstName ?? '';
  const last = profile.last_name ?? profile.lastName ?? '';
  const trimmed = `${(first || '').trim()} ${(last || '').trim()}`.trim();
  if (trimmed) return trimmed;
  if (profile.email?.trim()) return profile.email.trim();
  return 'User';
}
