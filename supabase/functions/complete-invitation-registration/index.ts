/**
 * When a portal was pre-provisioned (CRM), signUp fails with "already registered".
 * Validates the invitation and sets the password via Admin API so the user can sign in.
 *
 * Security model (JWT verify disabled at gateway: `deploy --no-verify-jwt`):
 * - No user JWT is trusted; this endpoint is public.
 * - Rate limiting (DB-backed when `edge_function_rate_limits` exists, else in-memory per isolate).
 * - Body must match a pending invitation (code + email + expiry).
 * - Password is applied only after invitation row matches; invitation finalized with conditional update (409 on race).
 *
 * Deploy: supabase functions deploy complete-invitation-registration --no-verify-jwt
 * Secrets: set ALLOWED_ORIGINS=https://your-app.vercel.app,https://www.yourdomain.org (comma-separated). If unset, defaults to * for dev only.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const baseCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_LIMIT = 15;
const attemptMap = new Map<string, { count: number; windowStart: number }>();

function registerAttemptMemory(key: string): boolean {
  const now = Date.now();
  const row = attemptMap.get(key);
  if (!row || now - row.windowStart > ATTEMPT_WINDOW_MS) {
    attemptMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= ATTEMPT_LIMIT) return false;
  row.count += 1;
  attemptMap.set(key, row);
  return true;
}

async function registerAttemptDurable(
  admin: SupabaseClient,
  bucketKey: string
): Promise<boolean> {
  const now = Date.now();
  try {
    const { data: row, error: selErr } = await admin
      .from('edge_function_rate_limits')
      .select('hit_count, window_start_ms')
      .eq('bucket_key', bucketKey)
      .maybeSingle();
    if (selErr) throw selErr;
    const r = row as { hit_count?: number; window_start_ms?: number } | null;
    if (!r || now - Number(r.window_start_ms ?? 0) > ATTEMPT_WINDOW_MS) {
      const { error: upErr } = await admin.from('edge_function_rate_limits').upsert(
        { bucket_key: bucketKey, hit_count: 1, window_start_ms: now },
        { onConflict: 'bucket_key' }
      );
      if (upErr) throw upErr;
      return true;
    }
    if (Number(r.hit_count) >= ATTEMPT_LIMIT) return false;
    const { error: up2 } = await admin
      .from('edge_function_rate_limits')
      .update({ hit_count: Number(r.hit_count) + 1 })
      .eq('bucket_key', bucketKey);
    if (up2) throw up2;
    return true;
  } catch {
    return registerAttemptMemory(bucketKey);
  }
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

  const admin = createClient(supabaseUrl, serviceKey);

  let body: { invitation_code?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const code = typeof body.invitation_code === 'string' ? body.invitation_code.trim() : '';
  const emailNorm = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const codeLooksValid = /^[A-Z2-9]{8}$/i.test(code);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);

  if (!code || !emailNorm || password.length < 8 || !codeLooksValid || !emailLooksValid) {
    return json({ error: 'invitation_code, email, and password (min 8 chars) are required' }, 400);
  }

  const sourceIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
  const rateKey = `complete-invite:${emailNorm}:${sourceIp}`;
  if (!(await registerAttemptDurable(admin, rateKey))) {
    return json({ error: 'Too many attempts. Please wait and try again.' }, 429);
  }

  const { data: inv, error: invErr } = await admin
    .from('invitations')
    .select('id, email, status, expires_at, role, hospital_id')
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
    console.error('complete-invitation-registration: password update failed');
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

  // Continuity bootstrap for PECC invitations: ensure shared site membership + hospital_data keys exist.
  try {
    const role = String((inv as { role?: string }).role ?? '');
    const hospitalRef = String((inv as { hospital_id?: string }).hospital_id ?? '').trim();
    if (role === 'pecc' && hospitalRef) {
      const { data: hospital } = await admin
        .from('hospitals')
        .select('id, facility_id')
        .or(`id.eq.${hospitalRef},facility_id.eq.${hospitalRef}`)
        .maybeSingle();
      const h = hospital as { id?: string; facility_id?: string | null } | null;
      const hospitalId = String(h?.id ?? '');
      const siteId = String(h?.facility_id || h?.id || '');

      if (siteId) {
        await admin
          .from('site_members')
          .upsert({ site_id: siteId, user_id: userId }, { onConflict: 'site_id,user_id' });
      }

      if (hospitalId) {
        const continuityDefaults: [string, unknown][] = [
          ['activities', []],
          ['gapPlans', []],
          ['milestones', []],
          ['simulation_sessions', []],
          ['simulation_gaps', []],
          ['readinessScores', []],
          ['prsReadinessScores', []],
          ['prsQuestions', []],
          ['other_cases', []],
          ['gap_closure_question_notes', {}],
        ];
        for (const [key, defaultValue] of continuityDefaults) {
          const { data: existing } = await admin
            .from('hospital_data')
            .select('hospital_id')
            .eq('hospital_id', hospitalId)
            .eq('data_key', key)
            .maybeSingle();
          if (existing) continue;
          await admin.from('hospital_data').upsert(
            {
              hospital_id: hospitalId,
              data_key: key,
              value: defaultValue,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'hospital_id,data_key' }
          );
        }
      }
    }
  } catch {
    // Non-fatal: account creation should still succeed even if continuity bootstrap fails.
  }

  return json({ ok: true, user_id: userId });
});
