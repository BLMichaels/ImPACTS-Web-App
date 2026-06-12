/** Shared idle-timeout activity timestamp (synced across tabs via localStorage). */
export const LAST_ACTIVITY_KEY = 'impacts_last_activity_at';

export function markSessionActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearSessionActivity(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* ignore */
  }
}
