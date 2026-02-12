/**
 * Normalize hospital/organization display names: apostrophe + capital S -> apostrophe + lowercase s
 * e.g. "St. Mary'S" -> "St. Mary's". Handles straight (') and curly (') apostrophes.
 */
export function normalizeHospitalOrOrgName(name: string | null | undefined): string {
  if (name == null || typeof name !== 'string') return '';
  return name
    .replace(/'S\b/g, "'s")
    .replace(/\u2019S\b/g, "\u2019s"); // curly apostrophe
}
