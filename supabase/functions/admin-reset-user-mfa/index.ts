/**
 * Admin-only: remove all MFA factors for a portal user so they can enroll again on next sign-in.
 *
 * Deploy: supabase functions deploy admin-reset-user-mfa
 * Auth: Bearer JWT validated in-function (admin only).
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
    throw new Response(JSON.stringify({ error: 'Only administrators can reset user MFA' }), {
      status: 403,
    });
  }
  return actorAuth;
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

  let body: { user_id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  let userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!userId && emailRaw) {
    const { data: row } = await admin.from('users').select('id').eq('email', emailRaw).maybeSingle();
    userId = row?.id ?? '';
  }

  if (!userId) {
    return json({ error: 'user_id or email is required' }, 400);
  }

  const { data: factorsData, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId });
  if (listErr) {
    return json({ error: listErr.message ?? 'Could not list MFA factors' }, 400);
  }

  const factors = [...(factorsData?.factors ?? [])];
  let removed = 0;
  for (const factor of factors) {
    const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
    if (!delErr) removed += 1;
  }

  return json({ user_id: userId, removed, had_factors: factors.length });
});
