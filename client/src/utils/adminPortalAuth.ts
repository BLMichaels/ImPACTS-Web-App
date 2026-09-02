import { supabase } from '../supabase';

export type AdminSendPasswordResetResult =
  | {
      ok: true;
      email_sent: boolean;
      action_link: string;
      message: string;
      resend_id?: string | null;
    }
  | { error: string };

/** Admin-only: send password reset via Resend + return copyable link. */
export async function adminSendPasswordReset(email: string): Promise<AdminSendPasswordResetResult> {
  const { data, error } = await supabase.functions.invoke('admin-send-password-reset', {
    body: { email: email.trim().toLowerCase() },
  });

  if (error) {
    return { error: error.message || 'Failed to send password reset' };
  }

  const payload = data as
    | { error?: string; ok?: boolean; email_sent?: boolean; action_link?: string; message?: string }
    | null;

  if (payload?.error) {
    return { error: payload.error };
  }
  if (!payload?.action_link) {
    return { error: payload?.message ?? 'Unexpected response from server' };
  }

  return {
    ok: true,
    email_sent: Boolean(payload.email_sent),
    action_link: payload.action_link,
    message: payload.message ?? 'Password reset link generated.',
    resend_id: (payload as { resend_id?: string }).resend_id ?? null,
  };
}

/** Admin-only: set or reset portal password and verify it works. */
export async function adminSetPortalPassword(params: {
  email: string;
  role: 'pecc' | 'manager' | 'mentor' | 'admin';
  password: string;
  first_name?: string;
  last_name?: string;
}): Promise<{ user_id: string; created: boolean; verified: boolean } | { error: string }> {
  const { data, error } = await supabase.functions.invoke('provision-crm-portal-user', {
    body: {
      email: params.email.trim().toLowerCase(),
      role: params.role,
      first_name: params.first_name?.trim() ?? '',
      last_name: params.last_name?.trim() ?? '',
      starting_password: params.password.trim(),
      verify_login: true,
    },
  });

  if (error) {
    return { error: error.message || 'Failed to set portal password' };
  }

  const payload = data as {
    error?: string;
    user_id?: string;
    created?: boolean;
    verified?: boolean;
  } | null;

  if (payload?.error) {
    return { error: payload.error };
  }
  if (!payload?.user_id) {
    return { error: 'Unexpected response from server' };
  }

  return {
    user_id: payload.user_id,
    created: Boolean(payload.created),
    verified: Boolean(payload.verified),
  };
}
