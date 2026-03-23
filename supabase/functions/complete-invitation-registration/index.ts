/**
 * When a portal was pre-provisioned (CRM), signUp fails with "already registered".
 * This validates the invitation and sets the password via Admin API so the user can sign in.
 *
 * Deploy: supabase functions deploy complete-invitation-registration --no-verify-jwt
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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  let body: { invitation_code?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const code = typeof body.invitation_code === 'string' ? body.invitation_code.trim() : '';
  const emailNorm =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!code || !emailNorm || password.length < 8) {
    return json({ error: 'invitation_code, email, and password (min 8 chars) are required' }, 400);
  }

  const { data: inv, error: invErr } = await admin
    .from('invitations')
    .select('id, email, status, expires_at')
    .eq('code', code)
    .eq('status', 'pending')
    .maybeSingle();

  if (invErr || !inv) {
    return json({ error: 'Invalid or expired invitation' }, 400);
  }

  const invEmail = String((inv as { email?: string }).email ?? '')
    .trim()
    .toLowerCase();
  if (invEmail !== emailNorm) {
    return json({ error: 'Email does not match this invitation' }, 400);
  }

  const exp = new Date(String((inv as { expires_at?: string }).expires_at ?? ''));
  if (Number.isNaN(exp.getTime()) || exp < new Date()) {
    return json({ error: 'This invitation has expired' }, 400);
  }

  const { data: profile, error: profErr } = await admin
    .from('users')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle();

  if (profErr || !profile?.id) {
    return json(
      {
        error:
          'No account found for this email. Ask your administrator to save your CRM contact again to create your portal.',
      },
      400
    );
  }

  const userId = (profile as { id: string }).id;

  const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (pwdErr) {
    console.error('complete-invitation-registration: password update', pwdErr);
    return json({ error: pwdErr.message ?? 'Could not set password' }, 400);
  }

  const { data: accepted, error: acceptErr } = await admin
    .from('invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq('id', (inv as { id: string }).id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (acceptErr || !accepted?.id) {
    return json({ error: 'Invitation could not be finalized. Please retry.' }, 409);
  }

  return json({ ok: true, user_id: userId });
});
