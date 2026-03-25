import { buildExportRowsForMode } from './reportExportHelpers';

describe('buildExportRowsForMode', () => {
  const mk = (id: string) => ({ id, cells: {} });

  it('filtered returns sorted', () => {
    const sorted = [mk('a'), mk('b')];
    const rows = [mk('a'), mk('b'), mk('c')];
    expect(
      buildExportRowsForMode({
        mode: 'filtered',
        sorted,
        displayRows: sorted,
        rows,
        selectedRowIds: ['c'],
      })
    ).toEqual(sorted);
  });

  it('visible returns displayRows', () => {
    const sorted = [mk('a'), mk('b')];
    const displayRows = [mk('a')];
    expect(
      buildExportRowsForMode({
        mode: 'visible',
        sorted,
        displayRows,
        rows: sorted,
        selectedRowIds: [],
      })
    ).toEqual(displayRows);
  });

  it('selected orders by sorted then appends off-filter rows', () => {
    const sorted = [mk('a'), mk('b')];
    const rows = [mk('a'), mk('b'), mk('c')];
    const out = buildExportRowsForMode({
      mode: 'selected',
      sorted,
      displayRows: sorted,
      rows,
      selectedRowIds: ['b', 'c', 'a'],
    });
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('selected with empty selection falls back to sorted', () => {
    const sorted = [mk('a')];
    expect(
      buildExportRowsForMode({
        mode: 'selected',
        sorted,
        displayRows: sorted,
        rows: sorted,
        selectedRowIds: [],
      })
    ).toEqual(sorted);
  });
});
