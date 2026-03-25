export type ReportExportMode = 'filtered' | 'visible' | 'selected';

/** Minimal row shape for export assembly (matches `ReportDataRow`). */
export interface ExportableReportRow {
  id: string;
  cells: Record<string, string>;
}

/**
 * Builds the row list for PDF/Excel export based on mode.
 * - filtered: all rows matching current filters & sort (the `sorted` list).
 * - visible: exactly what the table shows (`displayRows`, respects "Selected only").
 * - selected: checked rows in table sort order; selected ids not in the current filtered set are appended after.
 */
export function buildExportRowsForMode(options: {
  mode: ReportExportMode;
  sorted: ExportableReportRow[];
  displayRows: ExportableReportRow[];
  rows: ExportableReportRow[];
  selectedRowIds: string[];
}): ExportableReportRow[] {
  const { mode, sorted, displayRows, rows, selectedRowIds } = options;

  if (mode === 'filtered') {
    return sorted;
  }
  if (mode === 'visible') {
    return displayRows;
  }

  const idSet = new Set(selectedRowIds);
  if (idSet.size === 0) {
    return sorted;
  }

  const selectedInSorted = sorted.filter((r) => idSet.has(r.id));
  const sortedIdSet = new Set(sorted.map((r) => r.id));
  const selectedRest = rows.filter((r) => idSet.has(r.id) && !sortedIdSet.has(r.id));
  return [...selectedInSorted, ...selectedRest];
}

export function exportModeDescription(mode: ReportExportMode, counts: { filtered: number; visible: number; selected: number }): string {
  switch (mode) {
    case 'filtered':
      return `All filtered rows (${counts.filtered})`;
    case 'visible':
      return `Visible table rows (${counts.visible})`;
    case 'selected':
      return counts.selected > 0 ? `Selected rows (${counts.selected})` : 'Selected rows (none — using all filtered)';
    default:
      return '';
  }
}
