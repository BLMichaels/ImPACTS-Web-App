/**
 * Admin-only: create auth user + public.users row for a CRM contact (PECC / Manager / Mentor / Staff)
 * so admins can "View as user" and pre-load data before the invite is sent.
 *
 * Deploy: supabase functions deploy provision-crm-portal-user
 *   (use verify_jwt = false in supabase/config.toml — gateway JWT verify breaks CORS preflight.)
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto in Supabase)
 * Auth: POST body is only processed after Bearer JWT is validated (admin only).
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

const ALLOWED_ROLES = new Set(['pecc', 'manager', 'mentor', 'admin']);

async function clearPasswordUpdateFlag(admin: ReturnType<typeof createClient>, userId: string) {
  const { error } = await admin.rpc('service_clear_password_update_required', {
    p_user_id: userId,
  });
  if (error) {
    console.warn('provision-crm-portal-user: could not clear password_update_required', error.message);
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

async function upsertPublicUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  emailNorm: string,
  roleRaw: string,
  firstName: string,
  lastName: string
) {
  const row = {
    id: userId,
    email: emailNorm,
    first_name: firstName,
    last_name: lastName,
    role: roleRaw,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await admin.from('users').upsert(row, { onConflict: 'id' });
  if (upsertErr) {
    const { error: updErr } = await admin
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        role: roleRaw,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (updErr) {
      throw new Error(updErr.message ?? 'Profile update failed');
    }
  }
}

async function verifyLogin(
  supabaseUrl: string,
  emailNorm: string,
  password: string
): Promise<string | null> {
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!anonKey) return null;
  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({ email: emailNorm, password });
  if (error) return error.message;
  await client.auth.signOut();
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
    starting_password?: string;
    verify_login?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';
  const roleRaw = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
  const startingPassword = typeof body.starting_password === 'string' ? body.starting_password.trim() : '';
  const verifyLoginFlag = body.verify_login === true;
  const firstName = body.first_name?.trim() ?? '';
  const lastName = body.last_name?.trim() ?? '';

  if (!emailRaw || !roleRaw || !ALLOWED_ROLES.has(roleRaw)) {
    return json({ error: 'email and role (pecc | manager | mentor | admin) are required' }, 400);
  }
  if (startingPassword && startingPassword.length < 12) {
    return json({ error: 'starting_password must be at least 12 characters' }, 400);
  }

  const emailNorm = emailRaw.toLowerCase();

  let userId = await findAuthUserIdByEmail(admin, emailNorm);
  let created = false;

  if (userId) {
    if (startingPassword) {
      const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, {
        password: startingPassword,
        email_confirm: true,
      });
      if (pwdErr) {
        return json({ error: pwdErr.message ?? 'Failed to set starting password' }, 400);
      }
      await clearPasswordUpdateFlag(admin, userId);
    }

    try {
      await upsertPublicUser(admin, userId, emailNorm, roleRaw, firstName, lastName);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Profile update failed' }, 500);
    }
  } else {
    if (!startingPassword) {
      return json(
        {
          error:
            'starting_password is required to create a new portal login. Enter a password of at least 12 characters.',
        },
        400
      );
    }

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email: emailNorm,
      password: startingPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (createErr) {
      const msg = createErr.message?.toLowerCase() ?? '';
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists') ||
        (createErr as { status?: number }).status === 422
      ) {
        userId = await findAuthUserIdByEmail(admin, emailNorm);
        if (userId) {
          const { error: pwdErr } = await admin.auth.admin.updateUserById(userId, {
            password: startingPassword,
            email_confirm: true,
          });
          if (pwdErr) {
            return json({ error: pwdErr.message ?? 'Failed to set starting password' }, 400);
          }
          await clearPasswordUpdateFlag(admin, userId);
          try {
            await upsertPublicUser(admin, userId, emailNorm, roleRaw, firstName, lastName);
          } catch (err) {
            return json({ error: err instanceof Error ? err.message : 'Profile update failed' }, 500);
          }
        } else {
          return json({ error: createErr.message ?? 'Failed to create user' }, 400);
        }
      } else {
        return json({ error: createErr.message ?? 'Failed to create user' }, 400);
      }
    } else {
      userId = createdUser.user?.id ?? null;
      if (!userId) {
        return json({ error: 'Auth user created but no id returned' }, 500);
      }
      created = true;
      try {
        await upsertPublicUser(admin, userId, emailNorm, roleRaw, firstName, lastName);
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Profile update failed' }, 500);
      }
      await clearPasswordUpdateFlag(admin, userId);
    }
  }

  let verified = false;
  if (startingPassword && (verifyLoginFlag || created)) {
    const loginErr = await verifyLogin(supabaseUrl, emailNorm, startingPassword);
    if (loginErr) {
      return json(
        {
          error: `Password was saved but sign-in verification failed: ${loginErr}. Try resetting the password again.`,
          user_id: userId,
          created,
          verified: false,
        },
        400
      );
    }
    verified = true;
  }

  return json({ user_id: userId, created, verified });
});
