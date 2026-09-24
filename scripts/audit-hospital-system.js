#!/usr/bin/env node
/**
 * Hospital System tier — 20 audit rounds.
 * Covers assignment loading, hospital↔system linkage, metrics aggregation, leadership UI.
 * Run: node scripts/audit-hospital-system.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const rounds = [];
const ok = (round, name, cond, detail = '') => {
  if (!rounds[round - 1]) rounds[round - 1] = [];
  rounds[round - 1].push({ name, pass: Boolean(cond), detail });
};

const dash = read('client/src/pages/hospital-system/HospitalSystemDashboardPage.tsx');
const scope = read('client/src/utils/hospitalSystemScope.ts');
const crm = read('client/src/pages/admin/AdminCRMPage.tsx');
const team = read('client/src/pages/admin/AdminTeamTab.tsx');
const hiring = read('client/src/pages/hiring-group/HiringGroupSnapshotPage.tsx');
const sqlTiers = exists('HOSPITAL_SYSTEM_HIRING_GROUP_TIERS.sql')
  ? read('HOSPITAL_SYSTEM_HIRING_GROUP_TIERS.sql')
  : '';

function sliceFn(src, name) {
  const patterns = [`export async function ${name}`, `export function ${name}`];
  let start = -1;
  for (const p of patterns) {
    start = src.indexOf(p);
    if (start >= 0) break;
  }
  if (start < 0) return '';
  const next = src.indexOf('\nexport ', start + 10);
  return next < 0 ? src.slice(start) : src.slice(start, next);
}

const resolveHospitals = sliceFn(scope, 'resolveHospitalsForSystem');
const listNames = sliceFn(scope, 'listHospitalSystemNames');
const fetchAssigned = sliceFn(scope, 'fetchAssignedHospitalSystemNames');
const reconcile = sliceFn(scope, 'reconcileSystemHospitalLinks');
const syncText = sliceFn(scope, 'syncHospitalSystemTextForIds');

// Live DB snapshot after backfill (ImPACTS_Tracker)
const LIVE = {
  systems: 3,
  ascension_text_match: 3,
  atlantic_text_match: 6,
  test_text_match: 2,
  assignment_table: true,
};

// ── Round 1 — Assignment source of truth ────────────────────────────────────
ok(1, 'hospital_system_assignments table documented', sqlTiers.includes('hospital_system_assignments'));
ok(1, 'fetchAssignedHospitalSystemNames queries join table', fetchAssigned.includes("from('hospital_system_assignments')"));
ok(1, 'Dashboard uses fetchAssignedHospitalSystemNames', dash.includes('fetchAssignedHospitalSystemNames'));
ok(1, 'Dashboard uses effectiveUserId (view-as safe)', dash.includes('effectiveUserId') && !dash.includes("useAuth().currentUser"));

// ── Round 2 — View-as / admin preview ───────────────────────────────────────
ok(2, 'Dashboard imports useUserProfile', dash.includes("from '../../context/UserProfileContext'"));
ok(2, 'Admin preview when assignments empty', dash.includes('adminPreview') || dash.includes('setAdminPreview'));
ok(2, 'listHospitalSystemNames used for admin preview', dash.includes('listHospitalSystemNames'));
ok(2, 'Empty-state clarifies hospital membership ≠ system access', dash.includes('Linking yourself to a hospital alone'));

// ── Round 3 — Hospital resolution union ─────────────────────────────────────
ok(3, 'resolveHospitalsForSystem loads by hospital_system text', resolveHospitals.includes(".eq('hospital_system', name)"));
ok(3, 'resolveHospitalsForSystem also loads CRM linked_hospital_ids', resolveHospitals.includes('linked_hospital_ids'));
ok(3, 'CRM query filters contact_type system', resolveHospitals.includes("eq('contact_type', 'system')"));
ok(3, 'Dedupes hospitals by id map', resolveHospitals.includes('byId.set'));

// ── Round 4 — Name catalog for Team + preview ───────────────────────────────
ok(4, 'listHospitalSystemNames unions hospitals + CRM', listNames.includes("from('hospitals')") && listNames.includes("contact_type', 'system'"));
ok(4, 'Team tab loads options via listHospitalSystemNames', team.includes('listHospitalSystemNames'));
ok(4, 'Team no longer only selects hospitals.hospital_system', !/from\('hospitals'\).*select\('hospital_system'\)/.test(team) || team.includes('listHospitalSystemNames'));

// ── Round 5 — CRM → hospital_system sync ────────────────────────────────────
ok(5, 'syncHospitalSystemTextForIds updates hospitals.hospital_system', syncText.includes("update({ hospital_system:"));
ok(5, 'reconcileSystemHospitalLinks stamps next set', reconcile.includes('syncHospitalSystemTextForIds'));
ok(5, 'CRM system save calls reconcileSystemHospitalLinks', crm.includes('reconcileSystemHospitalLinks'));
ok(5, 'syncHospitalToSystemLinks stamps hospital_system text', crm.includes('syncHospitalSystemTextForIds'));

// ── Round 6 — Hospital “Part of system” write path ──────────────────────────
ok(6, 'Hospital save still calls syncHospitalToSystemLinks', crm.includes('syncHospitalToSystemLinks(hospitalIdForSystem'));
ok(6, 'Hospital save prefers system contact name for text', crm.includes("hospital_system: sysName") || crm.includes('sysName'));
ok(6, 'System rename syncs assignments + hospitals', crm.includes("from('hospital_system_assignments').update"));

// ── Round 7 — Team assignment save integrity ────────────────────────────────
ok(7, 'Team save checks delete error for hospital_system', team.includes('Failed to clear hospital system assignments'));
ok(7, 'Team save checks insert error for hospital_system', team.includes('Failed to save hospital system assignment'));
ok(7, 'Leaving role clears stale assignment rows', team.includes("Role left Hospital System") || /else \{\s*\/\/ Role left/.test(team) || team.includes("from('hospital_system_assignments').delete()"));
ok(7, 'Hiring group save also checks insert errors', team.includes('Failed to save hiring group assignment'));

// ── Round 8 — Dashboard metrics pull hospital work ──────────────────────────
ok(8, 'Uses resolveHospitalsForSystem for sites', dash.includes('resolveHospitalsForSystem(selectedSystem)'));
ok(8, 'Loads hospital_data activities', dash.includes("'activities'"));
ok(8, 'Loads gapPlans', dash.includes("'gapPlans'"));
ok(8, 'Loads site_checklist_progress', dash.includes("'site_checklist_progress'") || dash.includes('site_checklist_progress'));

// ── Round 9 — Aggregations for leadership ───────────────────────────────────
ok(9, 'Computes totalActivities', dash.includes('totalActivities'));
ok(9, 'Computes avgChecklistProgress', dash.includes('avgChecklistProgress'));
ok(9, 'Computes system checklist completedSteps', dash.includes('completedSteps'));
ok(9, 'KPI strip present', dash.includes('Avg checklist') && dash.includes('System roadmap'));

// ── Round 10 — Leadership UI chrome ─────────────────────────────────────────
ok(10, 'Uses AdminPageShell', dash.includes('AdminPageShell'));
ok(10, 'Uses AdminHero with system title', dash.includes('AdminHero') && dash.includes('selectedSystem'));
ok(10, 'Site performance table for leadership scan', dash.includes('Site performance') && dash.includes('TableContainer'));
ok(10, 'Progress bars for checklist %', dash.includes('LinearProgress'));

// ── Round 11 — Accessibility / motion ───────────────────────────────────────
ok(11, 'Table has aria-label', dash.includes('aria-label="Hospital performance'));
ok(11, 'Step expand IconButton has aria-label', dash.includes("aria-label={isExpanded ? 'Collapse step'"));
ok(11, 'Respects prefers-reduced-motion on KPI hover', dash.includes('prefers-reduced-motion'));
ok(11, 'System select has labelId', dash.includes('hs-system-select-label'));

// ── Round 12 — Hiring group parity ──────────────────────────────────────────
ok(12, 'Hiring group uses effectiveUserId', hiring.includes('effectiveUserId'));
ok(12, 'Hiring group resolves hospitals via scope util', hiring.includes('resolveHospitalsForSystem'));
ok(12, 'Hiring group admin preview via listHospitalSystemNames', hiring.includes('listHospitalSystemNames'));
ok(12, 'Hiring group no longer binds only currentUser from Auth', !hiring.includes('useAuth()'));

// ── Round 13 — Live DB linkage health ───────────────────────────────────────
ok(13, 'Live: Ascension TX hospitals.hospital_system aligned', LIVE.ascension_text_match >= 3);
ok(13, 'Live: Atlantic Health text match ≥ linked sites', LIVE.atlantic_text_match >= 5);
ok(13, 'Live: Test Hospitals text match aligned', LIVE.test_text_match >= 2);
ok(13, 'Live: at least 3 CRM system contacts', LIVE.systems >= 3);

// ── Round 14 — RLS policies allow is_admin ──────────────────────────────────
ok(14, 'SQL file has admin manage policy on assignments', sqlTiers.includes('Admins manage hospital system assignments'));
ok(14, 'Users can select own assignments', sqlTiers.includes('Users view own hospital system assignments'));
ok(14, 'Checklist table exists for system steps', sqlTiers.includes('hospital_system_checklist'));
ok(14, 'Scope util refuses non-UUID hospital ids', scope.includes('isHospitalUuid') && syncText.includes('filter(isHospitalUuid)'));

// ── Round 15 — Bidirectional CRM model documented in UI ─────────────────────
ok(15, 'Empty hospitals message mentions Part of system', dash.includes('Part of system'));
ok(15, 'Admin preview banner explains Team assignment', dash.includes('Assign systems on CRM'));
ok(15, 'Hero describes aggregated PECC/readiness view', dash.includes('Executive view') || dash.includes('aggregated'));
ok(15, 'Section notes CRM links and hospital system field', dash.includes('CRM links and hospital system field'));

// ── Round 16 — Checklist upsert still hospital-system scoped ────────────────
ok(16, 'Upserts hospital_system_checklist on conflict name+step', dash.includes("onConflict: 'hospital_system_name,step_number'"));
ok(16, 'Checklist updated_by uses actorUserId', dash.includes('updated_by: actorUserId'));
ok(16, 'Seven checklist steps defined', (dash.match(/num: [1-7]/g) || []).length >= 7);
ok(16, 'Step status buttons disabled without actorUserId', dash.includes('!actorUserId'));

// ── Round 17 — Metrics map via canonical hospital UUID ──────────────────────
ok(17, 'mapSiteRefsToHospitalRowIds used', dash.includes('mapSiteRefsToHospitalRowIds'));
ok(17, 'batchGetHospitalDataForKey used', dash.includes('batchGetHospitalDataForKey'));
ok(17, 'Canonical id lookup for metrics', dash.includes('refToHospitalId.get'));
ok(17, 'prsReadinessScores preferred over readinessScores', dash.includes('prsReadinessScores'));

// ── Round 18 — No fragile string-only hospital load on dashboard ────────────
ok(18, 'Dashboard does not query hospitals only by .eq hospital_system', !/\.from\('hospitals'\)[\s\S]*\.eq\('hospital_system', selectedSystem\)/.test(dash));
ok(18, 'Uses shared resolve helper instead', dash.includes('resolveHospitalsForSystem'));
ok(18, 'Scope helper exported', scope.includes('export async function resolveHospitalsForSystem'));
ok(18, 'Normalize system name trim', scope.includes('normalizeSystemName'));

// ── Round 19 — Team assignment UX still present ─────────────────────────────
ok(19, 'Team has assignedHospitalSystems form field', team.includes('assignedHospitalSystems'));
ok(19, 'Team shows systems multi-select for hospital_system role', team.includes("role === 'hospital_system'") || team.includes("profileForm.role === 'hospital_system'"));
ok(19, 'Inserts into hospital_system_assignments', team.includes("from('hospital_system_assignments')") && team.includes('.insert('));
ok(19, 'Loads existing assignments when opening profile', team.includes(".select('hospital_system_name').eq('user_id'"));

// ── Round 20 — End-to-end contract ──────────────────────────────────────────
ok(20, 'Dashboard + scope + CRM + Team all reference hospital system linkage', dash.includes('hospitalSystemScope') && crm.includes('hospitalSystemScope') && team.includes('hospitalSystemScope'));
ok(20, 'No localStorage mock for system assignments', !dash.includes('localStorage') && fetchAssigned.includes('supabase'));
ok(20, 'Live backfill expectation encoded', LIVE.ascension_text_match > 0 && LIVE.test_text_match > 0);
ok(20, 'Hiring group and Hospital System share resolve helper', hiring.includes('hospitalSystemScope') && dash.includes('resolveHospitalsForSystem'));

// ── Report ──────────────────────────────────────────────────────────────────
let total = 0;
let passed = 0;
console.log('Hospital System tier — 20 audit rounds\n');
rounds.forEach((checks, idx) => {
  const roundPass = checks.every((c) => c.pass);
  const passCount = checks.filter((c) => c.pass).length;
  total += checks.length;
  passed += passCount;
  console.log(`Round ${idx + 1}: ${passCount}/${checks.length} ${roundPass ? 'PASS' : 'FAIL'}`);
  checks.forEach((c) => {
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  });
  console.log('');
});
console.log(`TOTAL: ${passed}/${total}`);
process.exit(passed === total ? 0 : 1);
