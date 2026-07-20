/** Shared session security policy (keep IdleTimeout + public copy in sync). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export const IDLE_TIMEOUT_MINUTES = Math.round(IDLE_TIMEOUT_MS / 60_000);
