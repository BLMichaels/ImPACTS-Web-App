/**
 * Machine-to-machine: SimBox session completions → PECC hospital Activities.
 *
 * Auth: header `x-simbox-ingest-secret` (or Authorization: Bearer <secret>)
 * Secret: SIMBOX_INGEST_SECRET
 *
 * Deploy:
 *   npx supabase functions deploy ingest-simbox-activity --project-ref ftpifgzzfwpujlvbqqhu
 *
 * Called from SimBox Analytics when event_type === 'case_completed' and siteKey is present:
 *   POST https://ftpifgzzfwpujlvbqqhu.supabase.co/functions/v1/ingest-simbox-activity
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const SIMBOX_INGEST_SECRET = Deno.env.get('SIMBOX_INGEST_SECRET') ?? '';

const SITE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

/** Keep in sync with ActivitiesPage SIMULATION_TYPES (minus Other). */
const SIMULATION_TYPES = [
  'Diabetic Ketoacidosis (DKA)',
  'Bronchiolitis',
  'Asthma',
  'Traumatic Brain Injury',
  'Non-Accidental Trauma',
  'Pediatric Tracheostomy Emergency',
  'Newborn Resuscitation',
  'Postpartum Hemorrhage',
  'A Scald Burn',
  'Agitation',
  'A Seizing Infant',
  'Supraventricular Tachycardia',
  'Blunt Abdominal Trauma',
  'Neonatal Sepsis',
  'A Seizing Child',
  'Pediatric Anaphylaxis',
  'Altered Mental Status',
] as const;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-simbox-ingest-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

type IngestBody = {
  site_key?: string;
  case_key?: string;
  case_display_name?: string;
  session_id?: string;
  occurred_at?: string;
  participants?: number | null;
  hours?: number | null;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function extractSecret(req: Request): string {
  const header = req.headers.get('x-simbox-ingest-secret')?.trim() ?? '';
  if (header) return header;
  const auth = req.headers.get('Authorization') ?? '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() ?? '';
}

function toDateYmd(isoOrDate: string | undefined): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function humanizeCaseKey(caseKey: string): string {
  return caseKey
    .replace(/^SimBox[_-]?/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapSimulation(
  caseKey: string,
  caseDisplayName?: string
): { simulation: string; simulationOther?: string; activityTitle: string } {
  const display = (caseDisplayName || humanizeCaseKey(caseKey) || caseKey).trim();
  const activityTitle = display.toLowerCase().startsWith('simbox')
    ? display
    : `SimBox: ${display}`;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const needle = norm(display);
  const exact = SIMULATION_TYPES.find((t) => norm(t) === needle);
  if (exact) return { simulation: exact, activityTitle };

  const partial = SIMULATION_TYPES.find(
    (t) => needle.includes(norm(t)) || norm(t).includes(needle)
  );
  if (partial) return { simulation: partial, activityTitle };

  return { simulation: 'Other', simulationOther: display, activityTitle };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!SIMBOX_INGEST_SECRET) {
    console.error('ingest-simbox-activity: SIMBOX_INGEST_SECRET is not set');
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const provided = extractSecret(req);
  if (!provided || !timingSafeEqual(provided, SIMBOX_INGEST_SECRET)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  let body: IngestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const siteKey = typeof body.site_key === 'string' ? body.site_key.trim() : '';
  const caseKey = typeof body.case_key === 'string' ? body.case_key.trim() : '';
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
  const caseDisplayName =
    typeof body.case_display_name === 'string' ? body.case_display_name.trim() : '';

  if (!siteKey || !SITE_KEY_RE.test(siteKey)) {
    return json(
      {
        error: 'Invalid site_key',
        detail: 'site_key must match ^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$',
      },
      422
    );
  }
  if (!caseKey) return json({ error: 'case_key is required' }, 422);
  if (!sessionId) return json({ error: 'session_id is required' }, 422);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: mapping, error: mapErr } = await admin
    .from('simbox_site_hospitals')
    .select('site_key, facility_id, active, notes')
    .eq('site_key', siteKey)
    .maybeSingle();

  if (mapErr) {
    console.error('ingest-simbox-activity: mapping lookup failed', mapErr);
    return json({ error: 'Mapping lookup failed' }, 500);
  }
  if (!mapping || mapping.active !== true) {
    return json(
      {
        error: 'Unmapped site_key',
        site_key: siteKey,
        detail:
          'No active row in public.simbox_site_hospitals. Insert site_key ↔ hospitals.facility_id (see SIMBOX_SITE_HOSPITALS.sql).',
      },
      404
    );
  }

  const facilityId = String(mapping.facility_id);
  const { simulation, simulationOther, activityTitle } = mapSimulation(caseKey, caseDisplayName);
  const hours =
    typeof body.hours === 'number' && Number.isFinite(body.hours) && body.hours >= 0
      ? body.hours
      : 0;
  const participants =
    typeof body.participants === 'number' && Number.isFinite(body.participants)
      ? Math.max(0, Math.floor(body.participants))
      : undefined;

  const occurredAt = body.occurred_at || new Date().toISOString();
  const activity = {
    id: `simbox_${sessionId}`.slice(0, 120),
    date: toDateYmd(occurredAt),
    activity: activityTitle,
    categories: ['Simulation Facilitation'],
    hours,
    simulation,
    ...(simulationOther ? { simulationOther } : {}),
    ...(participants != null ? { participants } : {}),
    notes: [
      `Auto-logged from SimBox`,
      `session_id=${sessionId}`,
      `case_key=${caseKey}`,
      `site_key=${siteKey}`,
    ].join(' | '),
    simbox_session_id: sessionId,
    simbox_case_key: caseKey,
    simbox_site_key: siteKey,
    created_at: new Date().toISOString(),
    submitted_by: null,
  };

  const { data: rpcResult, error: rpcErr } = await admin.rpc('append_simbox_hospital_activity', {
    p_facility_id: facilityId,
    p_activity: activity,
  });

  if (rpcErr) {
    console.error('ingest-simbox-activity: RPC failed', rpcErr);
    const msg = rpcErr.message || 'Could not append activity';
    if (/hospital not found/i.test(msg)) {
      return json({ error: 'Hospital not found for mapped facility_id', facility_id: facilityId }, 404);
    }
    return json({ error: msg }, 500);
  }

  const result = (rpcResult ?? {}) as {
    status?: string;
    hospital_id?: string;
    facility_id?: string;
    activity?: Record<string, unknown>;
  };

  if (result.status === 'duplicate') {
    return json({
      ok: true,
      duplicate: true,
      site_key: siteKey,
      facility_id: facilityId,
      hospital_id: result.hospital_id,
      activity: result.activity,
    });
  }

  return json({
    ok: true,
    duplicate: false,
    site_key: siteKey,
    facility_id: facilityId,
    hospital_id: result.hospital_id,
    activity: result.activity ?? activity,
  });
});
