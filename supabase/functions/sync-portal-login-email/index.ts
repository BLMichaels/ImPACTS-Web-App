/**
 * Admin-only: set the canonical login email on auth + public.users + CRM.
 * Secondary/backup emails are stored on CRM only (custom_fields.backup_email).
 *
 * Deploy: supabase functions deploy sync-portal-login-email
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const baseCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  if (allowedOrigins.length === 0) {
    return { ...baseCorsHeaders, 'Access-Control-Allow-Origin': '*' };
  }
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return { ...baseCorsHeaders, 'Access-Control-Allow-Origin': allowed, Vary: 'Origin' };
}

function normEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = corsHeadersFor(req);
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const jwt = authHeader.replace(/^Bearer\s+/i, '');

  const {
    data: { user: actorAuth },
    error: jwtErr,
  } = await admin.auth.getUser(jwt);
  if (jwtErr || !actorAuth) {
    return json({ error: 'Invalid session' }, 401);
  }

  const { data: actor } = await admin
    .from('users')
    .select('role, is_admin')
    .eq('id', actorAuth.id)
    .maybeSingle();

  const isAdmin =
    actor?.is_admin === true || String(actor?.role ?? '').toLowerCase() === 'admin';
  if (!isAdmin) {
    return json({ error: 'Only administrators can sync login emails' }, 403);
  }

  let body: {
    user_id?: string;
    primary_email?: string;
    backup_email?: string;
    demote_emails?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const userId = String(body.user_id || '').trim();
  const primaryEmail = normEmail(body.primary_email);
  const backupEmailRaw = normEmail(body.backup_email);
  const backupEmail =
    backupEmailRaw && backupEmailRaw !== primaryEmail ? backupEmailRaw : '';
  const demoteEmails = [...new Set(
    (Array.isArray(body.demote_emails) ? body.demote_emails : [])
      .map(normEmail)
      .filter((email) => email && email !== primaryEmail)
  )];

  if (!userId || !primaryEmail) {
    return json({ error: 'user_id and primary_email are required' }, 400);
  }

  const { data: targetUser, error: targetErr } = await admin
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle();
  if (targetErr || !targetUser?.id) {
    return json({ error: targetErr?.message || 'User not found' }, 404);
  }

  const oldPrimary = normEmail(targetUser.email);
  if (oldPrimary && oldPrimary !== primaryEmail && !demoteEmails.includes(oldPrimary)) {
    demoteEmails.push(oldPrimary);
  }

  // Remove orphan accounts that would block the canonical login email.
  for (const email of [primaryEmail, ...demoteEmails]) {
    if (!email) continue;
    const { data: conflictingUsers } = await admin
      .from('users')
      .select('id')
      .ilike('email', email);
    for (const row of conflictingUsers ?? []) {
      if (row.id === userId) continue;
      const { error: delErr } = await admin.auth.admin.deleteUser(row.id);
      if (delErr) {
        console.warn('sync-portal-login-email: could not delete conflicting auth user', delErr);
      }
      await admin
        .from('users')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
    email: primaryEmail,
    email_confirm: true,
  });
  if (authErr) {
    return json({ error: authErr.message ?? 'Failed to update auth login email' }, 400);
  }

  const { error: usersErr } = await admin
    .from('users')
    .update({ email: primaryEmail, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (usersErr) {
    return json({ error: usersErr.message ?? 'Failed to update users email' }, 400);
  }

  // Deactivate duplicate public.users rows that still claim the login email.
  const { data: dupRows } = await admin
    .from('users')
    .select('id')
    .eq('email', primaryEmail)
    .neq('id', userId);
  for (const row of dupRows ?? []) {
    await admin
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', row.id);
  }

  const { data: crmRows } = await admin
    .from('crm_organizations')
    .select('id, custom_fields')
    .eq('user_id', userId);

  for (const row of crmRows ?? []) {
    const customFields =
      row.custom_fields && typeof row.custom_fields === 'object'
        ? { ...(row.custom_fields as Record<string, unknown>) }
        : {};
    if (backupEmail) customFields.backup_email = backupEmail;
    else delete customFields.backup_email;

    await admin
      .from('crm_organizations')
      .update({
        email: primaryEmail,
        custom_fields: customFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
  }

  // Also update CRM rows matched only by old email (pre-link).
  for (const email of demoteEmails) {
    if (!email) continue;
    const { data: legacyRows } = await admin
      .from('crm_organizations')
      .select('id, custom_fields, user_id')
      .ilike('email', email);
    for (const row of legacyRows ?? []) {
      if (row.user_id && row.user_id !== userId) continue;
      const customFields =
        row.custom_fields && typeof row.custom_fields === 'object'
          ? { ...(row.custom_fields as Record<string, unknown>) }
          : {};
      if (backupEmail && !customFields.backup_email) customFields.backup_email = email;
      await admin
        .from('crm_organizations')
        .update({
          user_id: userId,
          email: primaryEmail,
          custom_fields: customFields,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  }

  return json({
    user_id: userId,
    primary_email: primaryEmail,
    backup_email: backupEmail || null,
    demoted_emails: demoteEmails,
  });
});
