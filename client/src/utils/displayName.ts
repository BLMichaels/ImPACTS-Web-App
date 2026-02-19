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
