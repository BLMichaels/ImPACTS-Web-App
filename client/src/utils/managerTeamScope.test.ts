import { describe, expect, it } from 'vitest';
import { normalizeManagerIds } from './managerTeamScope';

describe('normalizeManagerIds', () => {
  it('returns unique trimmed string ids', () => {
    expect(normalizeManagerIds([' a ', 'b', 'a', '', null])).toEqual(['a', 'b']);
  });

  it('returns empty array for non-arrays', () => {
    expect(normalizeManagerIds(null)).toEqual([]);
    expect(normalizeManagerIds('x')).toEqual([]);
    expect(normalizeManagerIds(undefined)).toEqual([]);
    expect(normalizeManagerIds({ id: 'x' })).toEqual([]);
  });

  it('keeps secondary/additional manager list entries usable for includes checks', () => {
    // Documents expected behavior when reading USER_DATA_MENTOR_MANAGER_IDS-style lists:
    // primary manager_id is separate; secondary lists are normalized arrays of user ids.
    const secondary = normalizeManagerIds(['mgr-1', ' mgr-2 ', 'mgr-1', '', null, 42]);
    expect(secondary).toEqual(['mgr-1', 'mgr-2', '42']);
    expect(secondary.includes('mgr-2')).toBe(true);
    expect(secondary.includes('mgr-missing')).toBe(false);
  });

  it('treats empty secondary lists as no additional managers', () => {
    expect(normalizeManagerIds([])).toEqual([]);
    expect(normalizeManagerIds([null, '', '   '])).toEqual([]);
  });

  it('merges primary + secondary the way invitations/helpers do', () => {
    const primary = 'primary-mgr';
    const secondary = normalizeManagerIds(['secondary-a', 'primary-mgr', ' secondary-b ']);
    const merged = normalizeManagerIds([...(secondary || []), primary || '']);
    expect(merged).toEqual(['secondary-a', 'primary-mgr', 'secondary-b']);
  });
});

describe('manager report cohort helpers exist', () => {
  it('exports cohort scoping functions', async () => {
    const mod = await import('./managerTeamScope');
    expect(typeof mod.getManagedCohortIdsForManager).toBe('function');
    expect(typeof mod.fetchManagedCohortsForManager).toBe('function');
    expect(typeof mod.getManagedCohortPeopleIdsForManager).toBe('function');
    expect(typeof mod.fetchManagedProgramsForManager).toBe('function');
    expect(typeof mod.getManagedHospitalScopeKeysForManager).toBe('function');
    expect(typeof mod.getRosterMentorUsersForManager).toBe('function');
    expect(typeof mod.fetchManagerVisibleUserIdsSet).toBe('function');
    expect(typeof mod.fetchManagerPermissionsTargetIdsSet).toBe('function');
    expect(typeof mod.fetchUsersForManagerPermissions).toBe('function');
  });
});
