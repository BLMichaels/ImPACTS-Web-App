/**
 * Public: first-time account setup for people already in the CRM.
 * If the email matches a CRM person contact and no starting password was set,
 * create (or reuse) the portal login and email a one-time link to choose a password.
 * After they set the password and sign in, MFA enrollment is required by the app gate.
 *
 * Deploy: supabase functions deploy crm-first-login-setup
 * verify_jwt = false (public; always returns a generic OK to avoid email enumeration)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('INVITATION_FROM_EMAIL') ?? Deno.env.get('AUTH_FROM_EMAIL') ?? '';
const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') ?? 'https://peccsupporttool.com').replace(/\/+$/, '');
const SETUP_REDIRECT = `${APP_BASE_URL}/reset-password`;

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

const GENERIC_OK = {
  ok: true,
  message:
    'If this email is in our CRM, we sent a link to create your password from no.reply@impactscollaborative.com. Check spam/junk. After you set a password and sign in, you will enroll MFA.',
};

const PERSON_CONTACT_TYPES = new Set(['pecc', 'manager', 'mentor', 'staff']);

function contactTypeToRole(contactType: string): 'pecc' | 'manager' | 'mentor' | 'admin' | null {
  if (contactType === 'pecc') return 'pecc';
  if (contactType === 'manager') return 'manager';
  if (contactType === 'mentor') return 'mentor';
  if (contactType === 'staff') return 'admin';
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupEmailHtml(actionLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1976d2;">Create your PECC Support Tool password</h2>
  <p>Your contact is already in the ImPACTS CRM. Use the button below to create your password (at least 12 characters).</p>
  <p>After you save your password, sign in on the website. You will then set up MFA with a free authenticator app before you can use the tool.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(actionLink)}" style="display: inline-block; padding: 14px 28px; background: #1976d2; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Create password</a>
  </p>
  <p style="color: #666; font-size: 14px;">If the button does not work, copy and paste this link into your browser:</p>
  <p style="word-break: break-all; font-size: 13px; color: #1976d2;">${escapeHtml(actionLink)}</p>
  <p style="margin-top: 24px; color: #888; font-size: 12px;">This link expires after one use.</p>
  <p style="color: #888; font-size: 12px;">If you did not expect this email, you can ignore it.</p>
</body>
</html>`;
}

function randomTempPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `${out}Aa1!`;
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  emailNorm: string
): Promise<string | null> {
  const { data: row } = await admin.from('users').select('id').ilike('email', emailNorm).limit(1).maybeSingle();
  if (row?.id) return String(row.id);

  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 10; i += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? '').toLowerCase() === emailNorm);
    if (match?.id) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function sendViaResend(actionLink: string, emailNorm: string): Promise<{ ok: boolean; detail?: string }> {
  if (!RESEND_API_KEY || !FROM_EMAIL.includes('@')) {
    return { ok: false, detail: 'Resend not configured' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [emailNorm],
      subject: 'Create your PECC Support Tool password',
      html: setupEmailHtml(actionLink),
    }),
  });
  if (!res.ok) {
    const resendBody = await res.json().catch(() => ({}));
    return {
      ok: false,
      detail: (resendBody as { message?: string }).message ?? `HTTP ${res.status}`,
    };
  }
  return { ok: true };
}

async function sendViaAuthSmtp(
  supabaseUrl: string,
  serviceKey: string,
  emailNorm: string
): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: emailNorm,
      redirect_to: SETUP_REDIRECT,
      gotrue_meta_security: {},
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, detail: `${res.status} ${text.slice(0, 200)}` };
  }
  return { ok: true };
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const emailNorm = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return json({ error: 'A valid email is required' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: crmRows, error: crmErr } = await admin
    .from('crm_organizations')
    .select('id, contact_type, first_name, last_name, name, email, user_id')
    .ilike('email', emailNorm)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (crmErr) {
    console.error('crm-first-login-setup: CRM lookup failed', crmErr.message);
    return json(GENERIC_OK);
  }

  const crmContact = (crmRows || []).find((row) =>
    PERSON_CONTACT_TYPES.has(String(row.contact_type || '').toLowerCase())
  );
  if (!crmContact) {
    // Not in CRM as a portal person — do not create an account.
    return json(GENERIC_OK);
  }

  const role = contactTypeToRole(String(crmContact.contact_type || '').toLowerCase());
  if (!role) return json(GENERIC_OK);

  const firstName = String(crmContact.first_name || '').trim();
  const lastName = String(crmContact.last_name || '').trim();
  const displayParts = String(crmContact.name || '').trim().split(/\s+/).filter(Boolean);
  const resolvedFirst = firstName || displayParts[0] || '';
  const resolvedLast = lastName || (displayParts.length > 1 ? displayParts.slice(1).join(' ') : '');

  let userId =
    crmContact.user_id && String(crmContact.user_id).trim()
      ? String(crmContact.user_id)
      : await findAuthUserIdByEmail(admin, emailNorm);

  if (!userId) {
    const tempPassword = randomTempPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: emailNorm,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: resolvedFirst,
        last_name: resolvedLast,
        role,
        crm_first_login: true,
      },
    });
    if (createErr || !created?.user?.id) {
      console.error('crm-first-login-setup: createUser failed', createErr?.message);
      return json(GENERIC_OK);
    }
    userId = created.user.id;
  }

  const { error: upsertErr } = await admin.from('users').upsert(
    {
      id: userId,
      email: emailNorm,
      first_name: resolvedFirst || null,
      last_name: resolvedLast || null,
      role,
      is_admin: role === 'admin',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (upsertErr) {
    console.warn('crm-first-login-setup: users upsert', upsertErr.message);
  }

  if (crmContact.id) {
    await admin
      .from('crm_organizations')
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', crmContact.id);
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: emailNorm,
    options: { redirectTo: SETUP_REDIRECT },
  });

  if (!linkErr && linkData?.properties?.action_link) {
    const resend = await sendViaResend(linkData.properties.action_link, emailNorm);
    if (resend.ok) return json(GENERIC_OK);
    console.warn('crm-first-login-setup: Resend failed, falling back to Auth SMTP', resend.detail);
  } else {
    console.warn('crm-first-login-setup: generateLink failed; using Auth SMTP', linkErr);
  }

  const authSmtp = await sendViaAuthSmtp(supabaseUrl, serviceKey, emailNorm);
  if (!authSmtp.ok) {
    console.error('crm-first-login-setup: Auth SMTP failed', authSmtp.detail);
    return json({ error: 'Could not send setup email. Please try again or contact support.' }, 502);
  }

  return json(GENERIC_OK);
});
