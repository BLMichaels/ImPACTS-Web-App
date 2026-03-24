import { formatCsvCell } from './csvFormat';

/** Build CSV string for CRM export (headers + rows of string cells). */
export function buildCrmExportCsv(labels: string[], rows: string[][]): string {
  return [
    labels.map(formatCsvCell).join(','),
    ...rows.map((r) => r.map((x) => formatCsvCell(x)).join(','))
  ].join('\n');
}
