/**
 * Security event logging (failed logins, password changes, idle timeouts).
 * Best-effort: never throws, so auth flows are not blocked by logging failures.
 * Requires SECURITY_EVENTS_AND_AUDIT_HARDENING.sql to be applied in Supabase.
 */
import { supabase } from '../supabase';

export type SecurityEventType =
  | 'login_failed'
  | 'password_updated'
  | 'password_update_required'
  | 'idle_timeout_logout'
  | 'password_reset_requested'
  | 'mfa_enrolled'
  | 'mfa_challenge_failed';

export async function logSecurityEvent(
  eventType: SecurityEventType,
  options?: { email?: string | null; userId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    const { error } = await supabase.from('security_events').insert({
      event_type: eventType,
      email: String(options?.email || '').trim().toLowerCase() || null,
      user_id: options?.userId || null,
      metadata: options?.metadata ?? {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    });
    if (error) {
      console.warn('[securityEvents] insert failed', eventType, error.message);
    }
  } catch (err) {
    console.warn('[securityEvents] failed to log event', eventType, err);
  }
}
