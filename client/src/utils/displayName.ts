/**
 * Normalize hospital/organization display names: apostrophe + capital S -> apostrophe + lowercase s
 * e.g. "St. Mary'S" -> "St. Mary's"
 */
export function normalizeHospitalOrOrgName(name: string | null | undefined): string {
  if (name == null || typeof name !== 'string') return '';
  return name.replace(/'S\b/g, "'s");
}
