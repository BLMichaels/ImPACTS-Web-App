import { describe, expect, it } from 'vitest';
import { normalizeManagerIds } from './managerTeamScope';

describe('normalizeManagerIds', () => {
  it('returns unique trimmed string ids', () => {
    expect(normalizeManagerIds([' a ', 'b', 'a', '', null])).toEqual(['a', 'b']);
  });

  it('returns empty array for non-arrays', () => {
    expect(normalizeManagerIds(null)).toEqual([]);
    expect(normalizeManagerIds('x')).toEqual([]);
  });
});
