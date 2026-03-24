/** Safe parse for activity dates (ISO strings, YYYY-MM-DD, etc.) used in filters. */
export function parseActivityDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
