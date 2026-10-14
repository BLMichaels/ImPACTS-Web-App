/**
 * Public password reset.
 * Prefer Resend; fall back to Supabase Auth mailer (Zoho SMTP) so delivery still works
 * while the Resend domain is pending DNS verification.
 *
 * Deploy: supabase functions deploy request-password-reset
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('INVITATION_FROM_EMAIL') ?? Deno.env.get('AUTH_FROM_EMAIL') ?? '';
const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') ?? 'https://peccsupporttool.com').replace(/\/+$/, '');
const RESET_REDIRECT = `${APP_BASE_URL}/reset-password`;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resetEmailHtml(actionLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1976d2;">Reset your PECC Support Tool password</h2>
  <p>You requested a password reset for your PECC Support Tool account.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(actionLink)}" style="display: inline-block; padding: 14px 28px; background: #1976d2; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Set a new password</a>
  </p>
  <p style="color: #666; font-size: 14px;">If the button does not work, copy and paste this link into your browser:</p>
  <p style="word-break: break-all; font-size: 13px; color: #1976d2;">${escapeHtml(actionLink)}</p>
  <p style="margin-top: 24px; color: #888; font-size: 12px;">This link expires after one use. Open it on the device where you will sign in.</p>
  <p style="color: #888; font-size: 12px;">If you did not request this, you can ignore this email.</p>
</body>
</html>`;
}

const GENERIC_OK = {
  ok: true,
  message:
    'If an account exists for this email, a password reset link was sent from no.reply@impactscollaborative.com. Check spam/junk and wait a few minutes.',
};

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  emailNorm: string
): Promise<string | null> {
  const { data: row } = await admin.from('users').select('id').eq('email', emailNorm).maybeSingle();
  if (row?.id) return row.id;

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

/** Send recovery email through Supabase Auth → configured Zoho SMTP. */
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
      redirect_to: RESET_REDIRECT,
      gotrue_meta_security: {},
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, detail: `${res.status} ${text.slice(0, 200)}` };
  }
  return { ok: true };
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
      subject: 'Reset your PECC Support Tool password',
      html: resetEmailHtml(actionLink),
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
  const userId = await findAuthUserIdByEmail(admin, emailNorm);
  if (!userId) {
    return json(GENERIC_OK);
  }

  // Prefer Resend (custom HTML) when domain is verified.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: emailNorm,
    options: { redirectTo: RESET_REDIRECT },
  });

  if (!linkErr && linkData?.properties?.action_link) {
    const resend = await sendViaResend(linkData.properties.action_link, emailNorm);
    if (resend.ok) return json(GENERIC_OK);
    console.warn('request-password-reset: Resend failed, falling back to Auth SMTP', resend.detail);
  } else {
    console.warn('request-password-reset: generateLink failed; using Auth SMTP only', linkErr);
  }

  const authSmtp = await sendViaAuthSmtp(supabaseUrl, serviceKey, emailNorm);
  if (!authSmtp.ok) {
    console.error('request-password-reset: Auth SMTP fallback failed', authSmtp.detail);
    return json({ error: 'Could not send reset email. Please try again or contact support.' }, 502);
  }

  return json(GENERIC_OK);
});
