/** Shared session security policy (keep IdleTimeout + public copy in sync). */

/** Sign out after this much inactivity (shared workstations). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const IDLE_TIMEOUT_MINUTES = Math.round(IDLE_TIMEOUT_MS / 60_000);

/**
 * Hard cap on session lifetime from login, even if the user stays active.
 * Prevents indefinitely refreshed sessions on shared machines.
 */
export const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000;

export const ABSOLUTE_SESSION_HOURS = Math.round(ABSOLUTE_SESSION_MS / 3_600_000);
