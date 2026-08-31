import { supabase } from '../supabase';

export type AdminResetUserMfaResult =
  | { user_id: string; removed: number; had_factors: number }
  | { error: string };

/** Admin-only: remove all MFA factors for a user (CRM support action). */
export async function adminResetUserMfa(params: {
  user_id?: string;
  email?: string;
}): Promise<AdminResetUserMfaResult> {
  const { data, error } = await supabase.functions.invoke('admin-reset-user-mfa', {
    body: {
      user_id: params.user_id?.trim() || undefined,
      email: params.email?.trim().toLowerCase() || undefined,
    },
  });

  if (error) {
    return { error: error.message || 'Failed to reset MFA' };
  }

  const payload = data as
    | { error?: string; user_id?: string; removed?: number; had_factors?: number }
    | null;

  if (payload?.error) {
    return { error: payload.error };
  }
  if (!payload?.user_id) {
    return { error: 'Unexpected response from server' };
  }

  return {
    user_id: payload.user_id,
    removed: payload.removed ?? 0,
    had_factors: payload.had_factors ?? 0,
  };
}
