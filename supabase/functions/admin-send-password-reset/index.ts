/**
 * Admin-only: generate a password-reset link and deliver it via Resend (reliable delivery).
 * Falls back to returning the link for manual copy when email fails.
 *
 * Deploy: supabase functions deploy admin-send-password-reset
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
  <p style="margin-top: 24px; color: #888; font-size: 12px;">This link expires after one use. Open it on the device where you will sign in. If your organization scans email links automatically, ask your IT team to allow links to peccsupporttool.com or use the link within a few minutes.</p>
  <p style="color: #888; font-size: 12px;">If you did not request this, you can ignore this email.</p>
</body>
</html>`;
}

async function assertAdmin(admin: ReturnType<typeof createClient>, jwt: string) {
  const {
    data: { user: actorAuth },
    error: jwtErr,
  } = await admin.auth.getUser(jwt);
  if (jwtErr || !actorAuth) {
    throw new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401 });
  }

  const { data: actor } = await admin
    .from('users')
    .select('role, is_admin')
    .eq('id', actorAuth.id)
    .maybeSingle();

  const isAdmin =
    actor?.is_admin === true || String(actor?.role ?? '').toLowerCase() === 'admin';
  if (!isAdmin) {
    throw new Response(JSON.stringify({ error: 'Only administrators can send password reset emails' }), {
      status: 403,
    });
  }
}

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

  try {
    await assertAdmin(admin, jwt);
  } catch (err) {
    if (err instanceof Response) return err;
    return json({ error: 'Unauthorized' }, 401);
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

  const userId = await findAuthUserIdByEmail(admin, emailNorm);
  if (!userId) {
    return json(
      {
        error:
          'No portal login exists for this email yet. Save the CRM contact with a starting password, or send an invitation first.',
      },
      404
    );
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: emailNorm,
    options: { redirectTo: RESET_REDIRECT },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    return json({ error: linkErr?.message ?? 'Could not generate password reset link' }, 400);
  }

  const actionLink = linkData.properties.action_link;

  if (!RESEND_API_KEY || !FROM_EMAIL.includes('@')) {
    return json({
      ok: true,
      email_sent: false,
      action_link: actionLink,
      message:
        'Reset link generated. Email service is not configured — copy the link below and send it to the user manually.',
    });
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

  const resendBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Resend password reset error:', res.status, resendBody);
    return json({
      ok: true,
      email_sent: false,
      action_link: actionLink,
      message: `Email could not be sent (${(resendBody as { message?: string }).message ?? 'delivery error'}). Copy the link below and send it manually.`,
    });
  }

  return json({
    ok: true,
    email_sent: true,
    action_link: actionLink,
    message: `Password reset email sent to ${emailNorm} from ${FROM_EMAIL}. If they do not see it within 5 minutes, check spam or copy the link below.`,
    resend_id: (resendBody as { id?: string }).id ?? null,
  });
});
