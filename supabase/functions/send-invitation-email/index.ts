// Supabase Edge Function: send-invitation-email
// Sends invitation registration email via Resend. Requires RESEND_API_KEY in Supabase secrets.
// Deploy: supabase functions deploy send-invitation-email --no-verify-jwt
// Set secret: Supabase Dashboard → Edge Functions → send-invitation-email → Secrets → RESEND_API_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('INVITATION_FROM_EMAIL') || 'ImPACTS <onboarding@resend.dev>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_BASE_URL = (Deno.env.get('APP_BASE_URL') ?? 'https://impacts-tau.vercel.app').replace(/\/+$/, '');

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function htmlEmail(params: {
  invitationUrl: string;
  role: string;
  expiresAt: string;
  customMessage?: string | null;
}): string {
  const expDate = new Date(params.expiresAt).toLocaleDateString(undefined, {
    dateStyle: 'long',
  });
  const roleLabel = params.role.toUpperCase();
  const customBlock = params.customMessage
    ? `<p style="margin: 20px 0; padding: 12px; background: #f5f5f5; border-radius: 8px; border-left: 4px solid #1976d2;">${escapeHtml(params.customMessage)}</p>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1976d2;">You're invited to join ImPACTS</h2>
  <p>You have been invited to create an account as <strong>${escapeHtml(roleLabel)}</strong>.</p>
  ${customBlock}
  <p>Click the button below to complete your registration. This link expires on <strong>${escapeHtml(expDate)}</strong>.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(params.invitationUrl)}" style="display: inline-block; padding: 14px 28px; background: #1976d2; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Complete registration</a>
  </p>
  <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="word-break: break-all; font-size: 13px; color: #1976d2;">${escapeHtml(params.invitationUrl)}</p>
  <p style="margin-top: 32px; color: #888; font-size: 12px;">If you did not expect this invitation, you can ignore this email.</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight: must return 2xx with CORS headers so the browser allows the actual request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: jsonHeaders,
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user: actorAuth },
      error: actorErr,
    } = await admin.auth.getUser(jwt);
    if (actorErr || !actorAuth) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { data: actor } = await admin
      .from('users')
      .select('role, is_admin')
      .eq('id', actorAuth.id)
      .maybeSingle();
    const actorRole = String(actor?.role ?? '').toLowerCase();
    const hasInviteAccess = actor?.is_admin === true || actorRole === 'admin' || actorRole === 'manager' || actorRole === 'mentor';
    if (!hasInviteAccess) {
      return new Response(JSON.stringify({ error: 'Not authorized to send invitations' }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Email service not configured (RESEND_API_KEY missing)' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    let body: { email?: string; code?: string; role?: string; invitationUrl?: string; expiresAt?: string; customMessage?: string | null };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'email and code are required' }),
        { status: 400, headers: jsonHeaders }
      );
    }
    const invitationUrl = `${APP_BASE_URL}/invite/${encodeURIComponent(code)}`;

    const invitationRole = typeof body.role === 'string' ? body.role : 'user';
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const customMessage = body.customMessage != null ? body.customMessage : null;

    const html = htmlEmail({ invitationUrl, role: invitationRole, expiresAt, customMessage });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: 'Complete your ImPACTS registration',
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Resend API error:', res.status, data);
      return new Response(
        JSON.stringify({ error: data.message || data.error || 'Failed to send email', details: data }),
        { status: 502, headers: jsonHeaders }
      );
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('send-invitation-email error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
