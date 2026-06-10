/** CSV export helpers for Reports — including research-ready de-identified mode. */

export interface ReportCsvBuildOptions {
  title: string;
  scope?: string;
  exportMode?: string;
  deidentified?: boolean;
  columnLabels: string[];
  columnIds: string[];
  rows: Array<{ id?: string; cells: Record<string, string> }>;
}

function escapeCsvCell(value: string): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function simpleStableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `P${(h >>> 0).toString(16).padStart(8, '0')}`;
}

function isPiiColumn(columnId: string): boolean {
  const id = columnId.toLowerCase();
  return (
    id.includes('email') ||
    id.includes('phone') ||
    id === 'name' ||
    id === 'contactname' ||
    id.endsWith('name') ||
    id === 'notes'
  );
}

function deidentifyCell(columnId: string, value: string, rowIndex: number, rowKey: string): string {
  const v = String(value || '').trim();
  if (!v) return '';
  const id = columnId.toLowerCase();
  if (id.includes('email') && v.includes('@')) return `${simpleStableHash(v)}@redacted.local`;
  if (id.includes('phone')) return '';
  if (id === 'name' || id === 'contactname' || id.endsWith('name')) {
    return `Participant ${rowIndex + 1}`;
  }
  if (id === 'notes') return '';
  if (id === 'facilityid' || id === 'hospitalname' || id === 'orgname') {
    return `Site ${simpleStableHash(`${rowKey}:${v}`).slice(0, 10)}`;
  }
  return v;
}

export function buildReportCsvContent(options: ReportCsvBuildOptions): string {
  const { title, scope, exportMode, deidentified, columnLabels, columnIds, rows } = options;
  const lines: string[] = [
    `# ImPACTS report export`,
    `# Title: ${title}`,
    `# Generated: ${new Date().toISOString()}`,
    scope ? `# Scope: ${scope}` : '',
    exportMode ? `# Export mode: ${exportMode}` : '',
    `# De-identified: ${deidentified ? 'yes' : 'no'}`,
    `# Row count: ${rows.length}`,
    '',
    columnLabels.map(escapeCsvCell).join(','),
  ].filter(Boolean);

  rows.forEach((row, rowIndex) => {
    const rowKey = row.id || `row-${rowIndex}`;
    const cells = columnIds.map((colId, colIndex) => {
      const raw = row.cells[colId] ?? '';
      const value =
        deidentified && isPiiColumn(colId) ? deidentifyCell(colId, raw, rowIndex, rowKey) : raw;
      return escapeCsvCell(value);
    });
    lines.push(cells.join(','));
  });

  return lines.join('\n');
}

export function downloadReportCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadTableCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map((c) => escapeCsvCell(String(c))).join(',')),
  ];
  downloadReportCsv(filename, lines.join('\n'));
}
