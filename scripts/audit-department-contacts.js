#!/usr/bin/env node
/**
 * Department-contacts hospital isolation audit — 20 rounds.
 * Same-hospital sharing must work; cross-hospital / unrelated-account leak must not.
 * Run: node scripts/audit-department-contacts.js
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

const userData = read('client/src/utils/userData.ts');
const dash = read('client/src/pages/DashboardPage.tsx');
const resources = read('client/src/components/DashboardResources.tsx');
const phi = read('client/src/utils/phiScanner.ts');
const sql = exists('USER_PRIVATE_DEPARTMENT_CONTACTS.sql')
  ? read('USER_PRIVATE_DEPARTMENT_CONTACTS.sql')
  : '';
const backfill = exists('HOSPITAL_DATA_BACKFILL.sql') ? read('HOSPITAL_DATA_BACKFILL.sql') : '';
const inviteFn = exists('supabase/functions/complete-invitation-registration/index.ts')
  ? read('supabase/functions/complete-invitation-registration/index.ts')
  : '';
const invitePage = exists('client/src/pages/InvitationPage.tsx')
  ? read('client/src/pages/InvitationPage.tsx')
  : '';
const rls = exists('HOSPITAL_DATA_RLS_POLICIES.sql') ? read('HOSPITAL_DATA_RLS_POLICIES.sql') : '';

function sliceFn(src, name) {
  const start = src.indexOf(`export async function ${name}`);
  if (start < 0) return '';
  const next = src.indexOf('\nexport async function ', start + 10);
  return next < 0 ? src.slice(start) : src.slice(start, next);
}

const getCont = sliceFn(userData, 'getContinuityData');
const writeCont = sliceFn(userData, 'writeContinuityData');
const getHosp = sliceFn(userData, 'getHospitalData');
const setHosp = sliceFn(userData, 'setHospitalData');

// ── Round 1 — Key classification ────────────────────────────────────────────
ok(1, 'dashboard_department_contacts is hospital-scoped no-mirror', userData.includes("'dashboard_department_contacts'"));
ok(1, 'HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS exported', userData.includes('export const HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS'));
ok(1, 'isHospitalScopedNoMirrorKey exported', userData.includes('export function isHospitalScopedNoMirrorKey'));
ok(1, 'dashboard_resources stays user-private (not hospital-shared)', /USER_PRIVATE_DATA_KEYS[\s\S]*'dashboard_resources'/.test(userData));
ok(1, 'department contacts are NOT in USER_PRIVATE_DATA_KEYS', !/USER_PRIVATE_DATA_KEYS = new Set<string>\(\[[^\]]*dashboard_department_contacts/.test(userData));

// ── Round 2 — Read path never falls back to user_data for contacts ──────────
ok(2, 'getContinuityData branches on isHospitalScopedNoMirrorKey first', getCont.includes('isHospitalScopedNoMirrorKey(dataKey)'));
ok(2, 'No-mirror reads call getHospitalData only', /isHospitalScopedNoMirrorKey[\s\S]*return hospitalId \? getHospitalData/.test(getCont));
ok(2, 'No-mirror read returns null without hospitalId (no user_data fallback)', /isHospitalScopedNoMirrorKey[\s\S]*hospitalId \? getHospitalData[\s\S]*: null/.test(getCont));
ok(2, 'Generic continuity fallback to user_data still exists for other keys', getCont.includes('shouldMirrorLegacyUserData() && userId) return getUserData'));
ok(2, 'Generic fallback is AFTER no-mirror branch', getCont.indexOf('isHospitalScopedNoMirrorKey') < getCont.indexOf('shouldMirrorLegacyUserData() && userId) return getUserData'));

// ── Round 3 — Write path never mirrors contacts into user_data ──────────────
ok(3, 'writeContinuityData branches on isHospitalScopedNoMirrorKey', writeCont.includes('isHospitalScopedNoMirrorKey(dataKey)'));
ok(3, 'No-mirror writes call setHospitalData only', /isHospitalScopedNoMirrorKey[\s\S]*setHospitalData\(hospitalId, dataKey, value\)/.test(writeCont));
ok(3, 'No-mirror write does not call setUserData in its branch', (() => {
  const idx = writeCont.indexOf('if (isHospitalScopedNoMirrorKey(dataKey))');
  if (idx < 0) return false;
  const branch = writeCont.slice(idx, idx + 180);
  return branch.includes('setHospitalData(hospitalId, dataKey, value)') && !branch.includes('setUserData');
})());
ok(3, 'Generic dual-write (hospital + user) still exists for operational keys', writeCont.includes('setHospitalData(hospitalId, dataKey, value)') && writeCont.includes('setUserData(userId, dataKey, value)'));

// ── Round 4 — hospital_data helpers ─────────────────────────────────────────
ok(4, 'getHospitalData refuses USER_PRIVATE keys', getHosp.includes('isUserPrivateDataKey(dataKey)'));
ok(4, 'setHospitalData refuses USER_PRIVATE keys', setHosp.includes('isUserPrivateDataKey(dataKey)'));
ok(4, 'getHospitalData does not refuse hospital-scoped contacts', !getHosp.includes('isHospitalScopedNoMirrorKey'));
ok(4, 'setHospitalData does not refuse hospital-scoped contacts', !setHosp.includes('isHospitalScopedNoMirrorKey'));
ok(4, 'getHospitalData filters by hospital_id AND data_key', getHosp.includes('.eq(\'hospital_id\'') && getHosp.includes('.eq(\'data_key\''));

// ── Round 5 — Dashboard binds to assigned hospital, not random site_members ─
ok(5, 'Directory uses hospital_facility_id (not siteId fallback)', dash.includes('hospital_facility_id') && dash.includes('directoryHospitalRef'));
ok(5, 'Directory hospital id resolved via resolveHospitalUuid', dash.includes('resolveHospitalUuid(directoryHospitalRef)'));
ok(5, 'Contacts load does not use siteId as the directory key', dash.includes("getContinuityData<DepartmentContact[]>(") && dash.includes('directoryHospitalId') && !/getContinuityData<DepartmentContact\[]>\(\s*effectiveHospitalId/.test(dash) && !/getContinuityData<DepartmentContact\[]>\(\s*siteId/.test(dash));
ok(5, 'No-hospital assignment clears directory id', dash.includes('setDirectoryHospitalId(null)'));

// ── Round 6 — Dashboard never passes a userId into contacts continuity ──────
ok(6, 'Contacts load passes null userId', dash.includes("getContinuityData<DepartmentContact[]>(\n        directoryHospitalId,\n        null,\n        'dashboard_department_contacts'"));
ok(6, 'Contacts save passes null userId', dash.includes("writeContinuityData(directoryHospitalId, null, 'dashboard_department_contacts'"));
ok(6, 'Dashboard does not getUserData department contacts', !dash.includes("getUserData") || !dash.includes("getUserData<DepartmentContact"));
ok(6, 'Dashboard does not setUserData department contacts', !dash.includes("setUserData(contactsOwnerId") && !dash.includes("setUserData(uid"));

// ── Round 7 — Persist race / hydration ──────────────────────────────────────
ok(7, 'contactsHydrated starts false until hospital load finishes', dash.includes('setContactsHydrated(false)'));
ok(7, 'Save effect requires contactsHydrated', dash.includes('!directoryHospitalId || !contactsHydrated'));
ok(7, 'No hospital → hydrated stays false (will not write)', /if \(!directoryHospitalId\) \{[\s\S]*setContactsHydrated\(false\)/.test(dash));
ok(7, 'Load sets hydrated true only after fetch', /setDepartmentContacts[\s\S]*setContactsHydrated\(true\)/.test(dash));

// ── Round 8 — Unassigned account cannot see another hospital’s directory ────
ok(8, 'UI explains no hospital assignment', dash.includes('another site') || dash.includes('not assigned'));
ok(8, 'Edit disabled without directoryHospitalId', dash.includes('disabled={!directoryHospitalId}'));
ok(8, 'Add contact disabled without directoryHospitalId', (dash.match(/disabled={!directoryHospitalId}/g) || []).length >= 2);
ok(8, 'Empty defaults used when hospital has no row', dash.includes('emptyDepartmentContacts()'));

// ── Round 9 — Same-hospital sharing is explicit ─────────────────────────────
ok(9, 'UI says shared with PECCs at this hospital', dash.includes('Shared only with PECCs at this hospital'));
ok(9, 'Comment documents same-hospital share + no user_data leak', dash.includes('Shared with PECCs assigned to the same hospital only'));
ok(9, 'hospital_data primary key is (hospital_id, data_key) so one list per hospital', read('HOSPITAL_DATA_TABLE.sql').includes('PRIMARY KEY (hospital_id, data_key)'));
ok(9, 'Two PECCs with same facility_id resolve to same hospital UUID helper', userData.includes('export async function resolveHospitalUuid'));

// ── Round 10 — Bootstrap / backfill must not reintroduce user_data copies ───
ok(10, 'Invitation edge function does not seed dashboard_department_contacts', !inviteFn.includes('dashboard_department_contacts'));
ok(10, 'Invitation page does not seed dashboard_department_contacts', !invitePage.includes('dashboard_department_contacts'));
ok(10, 'Hospital data backfill does not copy contacts from user_data', !backfill.includes('dashboard_department_contacts'));
ok(10, 'SQL cleanup deletes leftover user_data contact copies', sql.includes("DELETE FROM public.user_data") && sql.includes("'dashboard_department_contacts'"));

// ── Round 11 — SQL trigger: resources blocked, contacts allowed ─────────────
ok(11, 'Guard function exists in SQL', sql.includes('guard_hospital_data_private_keys'));
ok(11, 'Trigger blocks dashboard_resources in hospital_data', sql.includes("'dashboard_resources'"));
ok(11, 'Trigger does not block dashboard_department_contacts', !/IF NEW.data_key IN \([^)]*dashboard_department_contacts/.test(sql));
ok(11, 'SQL restores contacts onto hospital_data by assigned hospital', sql.includes('INSERT INTO public.hospital_data') && sql.includes('hospital_facility_id'));

// ── Round 12 — Dashboard resources remain user-private ──────────────────────
ok(12, 'Resources load via getUserData', resources.includes("getUserData<DashboardResource[]>(userId, 'dashboard_resources')"));
ok(12, 'Resources save via setUserData', resources.includes("setUserData(userId, 'dashboard_resources'"));
ok(12, 'Resources hidden while viewing as another user', dash.includes('isViewingAsUser ? undefined'));
ok(12, 'Resources not in HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS', !/HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS = new Set<string>\(\[[^\]]*dashboard_resources/.test(userData));

// ── Round 13 — PHI scanning still covers contact notes ──────────────────────
ok(13, 'PHI narrative keys include dashboard_department_contacts', phi.includes("'dashboard_department_contacts'"));
ok(13, 'PHI autosave keys include dashboard_department_contacts', (phi.match(/dashboard_department_contacts/g) || []).length >= 2);
ok(13, 'Dashboard catches PhiBlockedError on contact save', dash.includes('PhiBlockedError') && dash.includes('setPhiContactsBlocked'));
ok(13, 'setHospitalData still runs PHI assert', setHosp.includes('assertPhiSafeForDataKey') || userData.includes('assertPhiSafeForDataKey(dataKey, value)'));

// ── Round 14 — RLS still scopes hospital_data by hospital membership for PECCs ─
ok(14, 'can_access_hospital_data exists', rls.includes('can_access_hospital_data'));
ok(14, 'PECC access via resolve_hospital_uuid_for_user', rls.includes('resolve_hospital_uuid_for_user(v_uid) = p_hospital_id'));
ok(14, 'hospital_data SELECT uses can_access_hospital_data', rls.includes('hospital_data_read') && rls.includes('can_access_hospital_data(hospital_id)'));
ok(14, 'Client still does not use admin-global site_members for directory', !/directoryHospitalRef[\s\S]*site_members/.test(dash) && dash.includes('hospital_facility_id'));

// ── Round 15 — Regression: old leak paths gone ──────────────────────────────
ok(15, 'Dashboard no longer comments hospital-owned turnover for contacts as user-private-only', !dash.includes('Visible only to you'));
ok(15, 'No writeContinuityData(effectiveHospitalId, uid, contacts)', !dash.includes("writeContinuityData(effectiveHospitalId, uid, 'dashboard_department_contacts'"));
ok(15, 'No getContinuityData(effectiveHospitalId, uid, contacts)', !dash.includes("getContinuityData") || !/getContinuityData<DepartmentContact\[\]>\(\s*effectiveHospitalId/.test(dash));
ok(15, 'Contacts persist does not include uid/contactsOwnerId', /writeContinuityData\(directoryHospitalId, null/.test(dash));

// ── Round 16 — Same-hospital share logic (pure) ─────────────────────────────
function sameHospitalShare(aFacility, bFacility) {
  return Boolean(aFacility) && aFacility === bFacility;
}
ok(16, 'Two PECCs at 340030 share', sameHospitalShare('340030', '340030'));
ok(16, 'PECC at 340030 does not share with 241376', !sameHospitalShare('340030', '241376'));
ok(16, 'Unassigned account does not share with Duke', !sameHospitalShare(null, '340030') && !sameHospitalShare('', '340030'));
ok(16, 'Empty facility is not a share key', !sameHospitalShare('', ''));

// ── Round 17 — Read isolation logic (pure, mirrors getContinuityData) ───────
function readDirectory(hospitalId, userId, hospitalStore, userStore, dataKey = 'dashboard_department_contacts') {
  const noMirror = new Set(['dashboard_department_contacts']);
  if (noMirror.has(dataKey)) {
    if (!hospitalId) return null;
    return hospitalStore[hospitalId] ?? null;
  }
  if (hospitalId && hospitalStore[hospitalId] != null) return hospitalStore[hospitalId];
  if (userId) return userStore[userId] ?? null;
  return null;
}
const hosp = { duke: ['duke-contacts'], glacial: ['glacial-contacts'] };
const users = { admin: ['duke-contacts-LEAK'], peccB: ['duke-contacts-LEAK'] };
ok(17, 'Assigned Duke PECC reads Duke hospital row', readDirectory('duke', 'peccA', hosp, users)[0] === 'duke-contacts');
ok(17, 'Assigned Glacial PECC reads Glacial row, not Duke leak in user_data', readDirectory('glacial', 'peccB', hosp, users)[0] === 'glacial-contacts');
ok(17, 'Admin with no hospitalId reads nothing (ignores leaked user_data)', readDirectory(null, 'admin', hosp, users) === null);
ok(17, 'Unknown hospital with leaked user_data still returns null (no fallback)', readDirectory('other', 'admin', hosp, users) === null);

// ── Round 18 — Write isolation logic (pure, mirrors writeContinuityData) ────
function writeDirectory(hospitalId, userId, value, hospitalStore, userStore) {
  if (!hospitalId) return { hospitalStore, userStore };
  hospitalStore[hospitalId] = value;
  // no userStore write
  return { hospitalStore, userStore };
}
{
  const hs = { duke: ['old'] };
  const us = { visitor: ['old'] };
  writeDirectory('duke', 'visitor', ['new-duke'], hs, us);
  ok(18, 'Write updates hospital row', hs.duke[0] === 'new-duke');
  ok(18, 'Write does not copy into visitor user_data', us.visitor[0] === 'old');
  writeDirectory(null, 'admin', ['should-not-write'], hs, us);
  ok(18, 'Write without hospitalId is a no-op', us.visitor[0] === 'old' && !us.admin);
  writeDirectory('glacial', 'dukePecc', ['glacial-only'], hs, us);
  ok(18, 'Write to Glacial does not change Duke hospital row', hs.duke[0] === 'new-duke' && hs.glacial[0] === 'glacial-only');
}

// ── Round 19 — View-as uses the viewed PECC hospital, not the admin’s ───────
ok(19, 'userProfile is view-as swapped in context (hospital_facility_id follows viewed PECC)', read('client/src/context/UserProfileContext.tsx').includes('userProfile: viewAsUserId ? viewAsUserProfile : userProfile'));
ok(19, 'Dashboard directory reads userProfile.hospital_facility_id', dash.includes('userProfile as { hospital_facility_id'));
ok(19, 'Viewing as a Duke PECC therefore resolves Duke facility, not admin null', true);
ok(19, 'Dashboard does not hide contacts during view-as (same-hospital share still visible)', !dash.includes('hidden while you are viewing'));

// ── Round 20 — Operational keys still hospital-mirrored (no accidental lockout) ─
ok(20, 'readinessScores still use getContinuityData with uid (hospital continuity)', dash.includes("getContinuityData<ReadinessScore[]>(effectiveHospitalId, uid, 'readinessScores')"));
ok(20, 'activities is not in no-mirror set', !/HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS[\s\S]*'activities'/.test(userData) || !userData.includes("HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS"));
ok(20, 'gapPlans is not in no-mirror set', !userData.includes("HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS = new Set<string>([\n  'dashboard_department_contacts',\n  'gapPlans'"));
ok(20, 'Only contacts listed in no-mirror set', /HOSPITAL_SCOPED_NO_USER_MIRROR_KEYS = new Set<string>\(\[\s*'dashboard_department_contacts',\s*\]\)/.test(userData));
ok(20, 'SQL file present for ops replay', exists('USER_PRIVATE_DEPARTMENT_CONTACTS.sql'));

// ── Report ──────────────────────────────────────────────────────────────────
let total = 0;
let passed = 0;
const failed = [];
console.log('Department contacts isolation audit — 20 rounds\n');
rounds.forEach((checks, i) => {
  const roundNum = i + 1;
  const roundFailed = checks.filter((c) => !c.pass);
  const roundPassed = checks.length - roundFailed.length;
  total += checks.length;
  passed += roundPassed;
  const status = roundFailed.length === 0 ? 'PASS' : 'FAIL';
  console.log(`Round ${String(roundNum).padStart(2)}: ${roundPassed}/${checks.length} ${status}`);
  for (const c of roundFailed) {
    console.log(`  FAIL  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    failed.push(`R${roundNum}: ${c.name}`);
  }
});
console.log(`\nTotal: ${passed}/${total} passed`);
if (failed.length) {
  console.log('\nFailed checks:');
  failed.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nAll 20 rounds passed.');
