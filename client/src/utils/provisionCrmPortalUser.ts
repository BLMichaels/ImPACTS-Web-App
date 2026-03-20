import { supabase } from '../supabase';

export type ProvisionCrmPortalRole = 'pecc' | 'manager' | 'mentor';

export type ProvisionCrmPortalResult =
  | { user_id: string; created: boolean }
  | { error: string };

/**
 * Creates auth + public.users for a CRM contact (admin-only Edge Function).
 * Enables "View as user" and pre-loading data before the user completes registration.
 */
export async function provisionCrmPortalUser(params: {
  email: string;
  role: ProvisionCrmPortalRole;
  first_name?: string;
  last_name?: string;
}): Promise<ProvisionCrmPortalResult> {
  const { data, error } = await supabase.functions.invoke('provision-crm-portal-user', {
    body: {
      email: params.email.trim(),
      role: params.role,
      first_name: params.first_name?.trim() ?? '',
      last_name: params.last_name?.trim() ?? '',
    },
  });

  if (error) {
    return { error: error.message || 'Failed to provision portal account' };
  }

  const payload = data as { error?: string; user_id?: string; created?: boolean } | null;
  if (payload?.error) {
    return { error: payload.error };
  }
  if (!payload?.user_id) {
    return { error: 'Unexpected response from server' };
  }

  return { user_id: payload.user_id, created: Boolean(payload.created) };
}
