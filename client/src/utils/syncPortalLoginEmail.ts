import { supabase } from '../supabase';

export const BACKUP_EMAIL_CUSTOM_FIELD_KEY = 'backup_email';

export function normalizeContactEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function resolveBackupEmail(
  customFields: Record<string, string> | undefined,
  primaryEmail: string,
  previousPrimaryEmail?: string
): string {
  const primary = normalizeContactEmail(primaryEmail);
  const fromField = normalizeContactEmail(
    customFields?.[BACKUP_EMAIL_CUSTOM_FIELD_KEY] ?? customFields?.secondary_email
  );
  if (fromField && fromField !== primary) return fromField;
  const previous = normalizeContactEmail(previousPrimaryEmail);
  if (previous && previous !== primary) return previous;
  return '';
}

export function withBackupEmailCustomFields(
  customFields: Record<string, string> | undefined,
  backupEmail: string
): Record<string, string> {
  const next = { ...(customFields || {}) };
  const backup = normalizeContactEmail(backupEmail);
  if (backup) next[BACKUP_EMAIL_CUSTOM_FIELD_KEY] = backup;
  else delete next[BACKUP_EMAIL_CUSTOM_FIELD_KEY];
  delete next.secondary_email;
  return next;
}

export type SyncPortalLoginEmailResult =
  | {
      user_id: string;
      primary_email: string;
      backup_email: string | null;
      demoted_emails?: string[];
    }
  | { error: string };

/**
 * Admin-only: sync auth login email + public.users + CRM primary email.
 * Backup email is CRM-only and never used for login.
 */
export async function syncPortalLoginEmail(params: {
  userId: string;
  primaryEmail: string;
  backupEmail?: string;
  demoteEmails?: string[];
}): Promise<SyncPortalLoginEmailResult> {
  const primaryEmail = normalizeContactEmail(params.primaryEmail);
  if (!params.userId || !primaryEmail) {
    return { error: 'userId and primaryEmail are required' };
  }

  const backupEmail = normalizeContactEmail(params.backupEmail);
  const demoteEmails = [...new Set(
    (params.demoteEmails ?? [])
      .map(normalizeContactEmail)
      .filter((email) => email && email !== primaryEmail)
  )];
  if (backupEmail && backupEmail !== primaryEmail && !demoteEmails.includes(backupEmail)) {
    demoteEmails.push(backupEmail);
  }

  const { data, error } = await supabase.functions.invoke('sync-portal-login-email', {
    body: {
      user_id: params.userId,
      primary_email: primaryEmail,
      backup_email: backupEmail && backupEmail !== primaryEmail ? backupEmail : '',
      demote_emails: demoteEmails,
    },
  });

  if (error) {
    return { error: error.message || 'Failed to sync login email' };
  }

  const payload = data as { error?: string; user_id?: string; primary_email?: string; backup_email?: string | null };
  if (payload?.error) return { error: payload.error };
  if (!payload?.user_id || !payload?.primary_email) return { error: 'Unexpected response from server' };
  return {
    user_id: payload.user_id,
    primary_email: payload.primary_email,
    backup_email: payload.backup_email ?? null,
  };
}
