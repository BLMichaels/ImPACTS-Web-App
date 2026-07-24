import { ABSOLUTE_SESSION_MS, IDLE_TIMEOUT_MS } from './sessionPolicy';

/** Idle-timeout activity timestamp (synced across tabs via localStorage). */
export const LAST_ACTIVITY_KEY = 'impacts_last_activity_at';

/** Wall-clock session start (set once per login; not refreshed on activity). */
export const SESSION_STARTED_KEY = 'impacts_session_started_at';

export type SessionExpiryReason = 'idle' | 'absolute';

export function markSessionActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** Call on successful password login — starts absolute session clock + activity. */
export function beginSessionClock(): void {
  try {
    localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  markSessionActive();
}

/** If absolute clock was never set (upgrade path), seed it without extending idle. */
export function ensureSessionClock(): void {
  if (getSessionStartedAt() > 0) return;
  try {
    const seed = getLastActivityAt() || Date.now();
    localStorage.setItem(SESSION_STARTED_KEY, String(seed));
  } catch {
    /* ignore */
  }
}

export function clearSessionActivity(): void {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_STARTED_KEY);
  } catch {
    /* ignore */
  }
}

export function getLastActivityAt(): number {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function getSessionStartedAt(): number {
  try {
    const raw = localStorage.getItem(SESSION_STARTED_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/**
 * Whether the browser session should be ended.
 * @param requireActivityStamp When true (session restore / refresh), a missing
 *   activity stamp is treated as expired — tokens alone are not enough proof of
 *   recent human use (fixes overnight refresh staying logged in).
 */
export function getSessionExpiryReason(
  now = Date.now(),
  opts?: { requireActivityStamp?: boolean }
): SessionExpiryReason | null {
  const started = getSessionStartedAt();
  if (started > 0 && now - started >= ABSOLUTE_SESSION_MS) {
    return 'absolute';
  }

  const last = getLastActivityAt();
  if (last > 0 && now - last >= IDLE_TIMEOUT_MS) {
    return 'idle';
  }
  if (opts?.requireActivityStamp && !last) {
    return 'idle';
  }
  return null;
}

export function isSessionExpired(
  now = Date.now(),
  opts?: { requireActivityStamp?: boolean }
): boolean {
  return getSessionExpiryReason(now, opts) != null;
}
