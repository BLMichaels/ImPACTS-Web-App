import { formatCsvCell } from './csvFormat';

describe('formatCsvCell', () => {
  it('leaves plain numbers unquoted', () => {
    expect(formatCsvCell(42)).toBe('42');
    expect(formatCsvCell(-187.5)).toBe('-187.5');
  });
  it('quotes commas', () => {
    expect(formatCsvCell('a,b')).toBe('"a,b"');
  });
  it('quotes formula-like starts', () => {
    expect(formatCsvCell('=cmd')).toBe('"=cmd"');
  });
  it('handles empty', () => {
    expect(formatCsvCell(null)).toBe('');
    expect(formatCsvCell(undefined)).toBe('');
  });
});
