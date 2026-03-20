/**
 * Admin-only: create auth user + public.users row for a CRM contact (PECC / Manager / Mentor)
 * so admins can "View as user" and pre-load data before the invite is sent.
 *
 * Deploy: supabase functions deploy provision-crm-portal-user
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto in Supabase)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const ALLOWED_ROLES = new Set(['pecc', 'manager', 'mentor']);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
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
    actor?.is_admin === true ||
    String(actor?.role ?? '').toLowerCase() === 'admin';
  if (!isAdmin) {
    return json({ error: 'Only administrators can provision portal accounts' }, 403);
  }

  let body: {
    email?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const roleRaw = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
  if (!emailRaw || !roleRaw || !ALLOWED_ROLES.has(roleRaw)) {
    return json({ error: 'email and role (pecc | manager | mentor) are required' }, 400);
  }

  const emailNorm = emailRaw.toLowerCase();

  const { data: existingRow } = await admin
    .from('users')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle();

  if (existingRow?.id) {
    await admin
      .from('users')
      .update({
        first_name: body.first_name?.trim() ?? '',
        last_name: body.last_name?.trim() ?? '',
        role: roleRaw,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRow.id);

    return json({ user_id: existingRow.id, created: false });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: emailNorm,
    email_confirm: true,
    user_metadata: {
      first_name: body.first_name?.trim() ?? '',
      last_name: body.last_name?.trim() ?? '',
    },
  });

  if (createErr) {
    const msg = createErr.message?.toLowerCase() ?? '';
    if (
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists') ||
      (createErr as { status?: number }).status === 422
    ) {
      const { data: again } = await admin
        .from('users')
        .select('id')
        .eq('email', emailNorm)
        .maybeSingle();
      if (again?.id) {
        await admin
          .from('users')
          .update({
            first_name: body.first_name?.trim() ?? '',
            last_name: body.last_name?.trim() ?? '',
            role: roleRaw,
            updated_at: new Date().toISOString(),
          })
          .eq('id', again.id);
        return json({ user_id: again.id, created: false });
      }
    }
    return json({ error: createErr.message ?? 'Failed to create user' }, 400);
  }

  const newId = created.user?.id;
  if (!newId) {
    return json({ error: 'Auth user created but no id returned' }, 500);
  }

  const { error: updErr } = await admin
    .from('users')
    .update({
      first_name: body.first_name?.trim() ?? '',
      last_name: body.last_name?.trim() ?? '',
      role: roleRaw,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', newId);

  if (updErr) {
    console.error('provision-crm-portal-user: profile update failed', updErr);
    return json({ error: updErr.message ?? 'Profile update failed' }, 500);
  }

  return json({ user_id: newId, created: true });
});
