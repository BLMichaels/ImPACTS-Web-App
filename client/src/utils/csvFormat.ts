/**
 * RFC 4180–style CSV cell formatting for exports.
 * Quote only when needed so Excel and other tools treat plain numbers as numeric.
 */
export function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s === '') return '';
  const needsQuote =
    /[",\r\n]/.test(s) ||
    s.startsWith('=') ||
    s.startsWith('@') ||
    s.startsWith('+') ||
    s.startsWith('\t');
  if (needsQuote) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
