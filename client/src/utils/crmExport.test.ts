import { buildCrmExportCsv } from './crmExport';

describe('buildCrmExportCsv', () => {
  it('joins headers and rows', () => {
    const csv = buildCrmExportCsv(['A', 'B'], [['1', 'two'], ['x,y', 'z']]);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('x,y');
  });
});
