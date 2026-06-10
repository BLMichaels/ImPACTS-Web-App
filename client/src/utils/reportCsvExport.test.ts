import { buildReportCsvContent } from './reportCsvExport';

describe('buildReportCsvContent', () => {
  it('includes metadata and headers', () => {
    const csv = buildReportCsvContent({
      title: 'PECC report',
      scope: 'admin',
      columnLabels: ['Name', 'Hours'],
      columnIds: ['name', 'hours'],
      rows: [{ id: '1', cells: { name: 'Ada Lovelace', hours: '12' } }],
    });
    expect(csv).toContain('# ImPACTS report export');
    expect(csv).toContain('Name,Hours');
    expect(csv).toContain('Ada Lovelace,12');
  });

  it('de-identifies PII columns when enabled', () => {
    const csv = buildReportCsvContent({
      title: 'PECC report',
      deidentified: true,
      columnLabels: ['Name', 'Email'],
      columnIds: ['name', 'email'],
      rows: [{ id: 'u1', cells: { name: 'Ada Lovelace', email: 'ada@example.com' } }],
    });
    expect(csv).toContain('Participant 1');
    expect(csv).not.toContain('ada@example.com');
    expect(csv).toContain('@redacted.local');
  });
});
