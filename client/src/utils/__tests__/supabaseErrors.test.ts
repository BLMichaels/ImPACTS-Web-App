import {
  isRlsOrPermissionDeniedError,
  shouldFallbackUserDataToLocalStorage,
  isSupabaseMissingRelationError,
} from '../supabaseErrors';

describe('supabaseErrors', () => {
  it('detects RLS / permission errors', () => {
    expect(isRlsOrPermissionDeniedError({ code: '42501', message: 'permission denied' })).toBe(true);
    expect(isRlsOrPermissionDeniedError({ message: 'new row violates row-level security policy' })).toBe(true);
    expect(isRlsOrPermissionDeniedError({ code: 'PGRST301' })).toBe(true);
    expect(isRlsOrPermissionDeniedError({ message: 'something else' })).toBe(false);
  });

  it('does not fall back to localStorage on RLS', () => {
    expect(shouldFallbackUserDataToLocalStorage({ code: '42501', message: 'denied' })).toBe(false);
  });

  it('falls back on missing relation', () => {
    expect(shouldFallbackUserDataToLocalStorage({ code: 'PGRST205' })).toBe(true);
    expect(isSupabaseMissingRelationError({ code: 'PGRST205' })).toBe(true);
  });

  it('falls back on network-style errors', () => {
    expect(shouldFallbackUserDataToLocalStorage({ message: 'Failed to fetch' })).toBe(true);
  });
});
