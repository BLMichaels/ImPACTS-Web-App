-- Allow PHI screening security event types (apply in Supabase if not already migrated).
ALTER TABLE public.security_events DROP CONSTRAINT IF EXISTS security_events_event_type_check;
ALTER TABLE public.security_events ADD CONSTRAINT security_events_event_type_check
  CHECK (event_type IN (
    'login_failed',
    'password_updated',
    'password_update_required',
    'idle_timeout_logout',
    'password_reset_requested',
    'mfa_enrolled',
    'mfa_challenge_failed',
    'phi_input_blocked',
    'phi_input_warned',
    'phi_input_acknowledged'
  ));
