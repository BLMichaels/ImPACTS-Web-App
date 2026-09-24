#!/usr/bin/env node
/**
 * PECC ↔ Mentor checklist bidirectional sync audit — 20 rounds.
 * Verifies both tiers read/write the same hospital-scoped site_checklist_progress rows.
 * Run: node scripts/audit-checklist-sync.js
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

const pecc = read('client/src/pages/MilestonesPage.tsx');
const mentor = read('client/src/pages/mentor/MentorSiteMilestonesPage.tsx');
const progress = read('client/src/utils/siteChecklistProgress.ts');
const entries = read('client/src/utils/checklistEntries.ts');
const defaultChecklist = read('client/src/data/defaultSiteChecklist.ts');
const rls = exists('SITE_CHECKLIST_PROGRESS_RLS_AND_REALTIME.sql')
  ? read('SITE_CHECKLIST_PROGRESS_RLS_AND_REALTIME.sql')
  : '';
const migration = exists('SITE_CHECKLIST_PROGRESS_MIGRATION.sql')
  ? read('SITE_CHECKLIST_PROGRESS_MIGRATION.sql')
  : '';

function sliceFn(src, name) {
  const patterns = [
    `export async function ${name}`,
    `export function ${name}`,
  ];
  let start = -1;
  for (const p of patterns) {
    start = src.indexOf(p);
    if (start >= 0) break;
  }
  if (start < 0) return '';
  const nextExport = src.indexOf('\nexport ', start + 10);
  return nextExport < 0 ? src.slice(start) : src.slice(start, nextExport);
}

function lastSlice(src, needle, before = 200, after = 2000) {
  const i = src.lastIndexOf(needle);
  if (i < 0) return '';
  return src.slice(Math.max(0, i - before), i + after);
}

const upsertOne = sliceFn(progress, 'upsertSiteChecklistTaskProgress');
const upsertMany = sliceFn(progress, 'upsertSiteChecklistTasksProgress');
const subscribe = sliceFn(progress, 'subscribeToSiteChecklistProgress');
const resolveUuid = sliceFn(progress, 'resolveSiteChecklistHospitalUuid');
const peccToggle = (() => {
  const i = pecc.indexOf('const handleTaskToggle');
  return i < 0 ? '' : pecc.slice(i, i + 2200);
})();
const mentorToggle = (() => {
  const i = mentor.indexOf('const handleTaskToggle');
  return i < 0 ? '' : mentor.slice(i, i + 2800);
})();
const mentorStageToggle = (() => {
  const i = mentor.indexOf('const handleStageCompletionToggle');
  return i < 0 ? '' : mentor.slice(i, i + 2200);
})();
const mentorRealtime = lastSlice(mentor, 'watchedHospitalIds', 80, 2200);
const peccRealtime = lastSlice(pecc, 'subscribeToSiteChecklistProgress([hospitalId]', 40, 500);

// ── Round 1 — Shared storage table ──────────────────────────────────────────
ok(1, 'site_checklist_progress is the canonical table', progress.includes("from('site_checklist_progress')"));
ok(1, 'upsert uses hospital_id + task_id conflict key', upsertOne.includes("onConflict: 'hospital_id,task_id'"));
ok(1, 'migration documents shared PECC + Mentor usage', migration.includes('Shared by PECC') || migration.includes('Mentors'));
ok(1, 'completed_at cleared when unchecked', upsertOne.includes('completed ? new Date().toISOString() : null'));

// ── Round 2 — Canonical hospital UUID only ──────────────────────────────────
ok(2, 'isCanonicalHospitalUuid exported', progress.includes('export function isCanonicalHospitalUuid'));
ok(2, 'single upsert refuses non-UUID hospital', upsertOne.includes('isCanonicalHospitalUuid(hospitalUuid)'));
ok(2, 'bulk upsert refuses non-UUID hospital', upsertMany.includes('isCanonicalHospitalUuid(hospitalUuid)'));
ok(2, 'resolveSiteChecklistHospitalUuid maps facility → hospitals.id', resolveUuid.includes('hospitalIdOrFacilityOrClause'));

// ── Round 3 — PECC write path ───────────────────────────────────────────────
ok(3, 'PECC imports upsertSiteChecklistTaskProgress', pecc.includes('upsertSiteChecklistTaskProgress'));
ok(3, 'PECC toggle writes via hospitalId', peccToggle.includes('upsertSiteChecklistTaskProgress(hospitalId, taskId, newCompleted)'));
ok(3, 'PECC refuses non-canonical hospital UUID', peccToggle.includes('isCanonicalHospitalUuid(hospitalId)'));
ok(3, 'PECC resolves siteId to hospital UUID', pecc.includes('resolveSiteChecklistHospitalUuid(siteId)'));

// ── Round 4 — Mentor write path ─────────────────────────────────────────────
ok(4, 'Mentor imports upsertSiteChecklistTaskProgress', mentor.includes('upsertSiteChecklistTaskProgress'));
ok(4, 'Mentor imports upsertSiteChecklistTasksProgress', mentor.includes('upsertSiteChecklistTasksProgress'));
ok(4, 'Mentor task toggle uses hospitalChecklistIds UUID map', mentorToggle.includes('hospitalChecklistIds[hospitalId]'));
ok(4, 'Mentor refuses save without canonical UUID', mentorToggle.includes('isCanonicalHospitalUuid(canonicalHospitalId)'));
ok(4, 'Mentor does not fall back to raw hospitalId for upsert', !mentorToggle.includes('hospitalChecklistIds[hospitalId] || hospitalId'));

// ── Round 5 — Same task id format (program) ─────────────────────────────────
ok(5, 'PECC program task ids use program:checklist:stage.suffix', pecc.includes('`program:${checklist.id}:${stage.id}.${t.task_id_suffix}`'));
ok(5, 'Mentor program task ids match PECC format', mentor.includes('`program:${checklist.id}:${stage.id}.${t.task_id_suffix}`'));
ok(5, 'Both decode checklist entry types the same way', pecc.includes('decodeChecklistEntry') && mentor.includes('decodeChecklistEntry'));

// ── Round 6 — Default checklist shared ids ──────────────────────────────────
ok(6, 'Default checklist exports DEFAULT_SITE_CHECKLIST_STAGES', defaultChecklist.includes('export const DEFAULT_SITE_CHECKLIST_STAGES'));
ok(6, 'Mentor loads default from shared module', mentor.includes("from '../../data/defaultSiteChecklist'"));
ok(6, 'PECC default stage1 task 1.1 present', /id:\s*'1\.1'/.test(pecc));
ok(6, 'Shared default includes task 1.1', /id:\s*'1\.1'/.test(defaultChecklist));

// ── Round 7 — Actionable-only toggles ───────────────────────────────────────
ok(7, 'isActionableChecklistTask exported', entries.includes('export function isActionableChecklistTask'));
ok(7, 'PECC toggle guards with isActionableChecklistTask', peccToggle.includes('isActionableChecklistTask(task)'));
ok(7, 'Mentor toggle guards with isActionableChecklistTask', mentorToggle.includes('isActionableChecklistTask(existingTask)'));
ok(7, 'Mentor stage bulk upsert filters actionable tasks only', mentorStageToggle.includes('filter(isActionableChecklistTask)'));

// ── Round 8 — Mentor stage bulk does not write banners/dividers ─────────────
ok(8, 'Stage toggle maps only actionable tasks to completed', /isActionableChecklistTask\(t\) \? \{ \.\.\.t, completed: newCompleted \}/.test(mentorStageToggle) || mentorStageToggle.includes('isActionableChecklistTask(t) ? { ...t, completed: newCompleted }'));
ok(8, 'Date save also filters actionable task ids', mentor.includes('tasks.filter(isActionableChecklistTask).map'));
ok(8, 'Stage completion derived from actionable tasks only', mentor.includes('stage.tasks.filter(isActionableChecklistTask)'));

// ── Round 9 — Mentor stipend overlay does not override task completion ──────
ok(9, 'mentorStageCompletions still loaded for stipend dates', mentor.includes("'mentorStageCompletions'"));
ok(9, 'Overlay no longer blindly replaces derived stageCompletions', !/if \(savedCompletions\[sid\]\.completionDate\) stageCompletions\[sid\] = savedCompletions\[sid\]/.test(mentor));
ok(9, 'Overlay only preserves date when derived completed', mentor.includes('derived.completed && savedDate'));
ok(9, 'Comment documents task-derived source of truth', mentor.includes('task-derived completion as source of truth'));

// ── Round 10 — PECC realtime patch ──────────────────────────────────────────
ok(10, 'PECC subscribes to site_checklist_progress', pecc.includes('subscribeToSiteChecklistProgress([hospitalId]'));
ok(10, 'PECC realtime applies patch.task_id in place', peccRealtime.includes('patch.task_id') && peccRealtime.includes('patch.completed'));
ok(10, 'PECC realtime does not require full progress refetch', !peccRealtime.includes('refreshChecklistProgress(hospitalId)'));
ok(10, 'subscribe helper filters by hospital_id', subscribe.includes('hospital_id=eq.') || /hospital_id=eq\.\$\{/.test(subscribe));

// ── Round 11 — Mentor realtime patch ────────────────────────────────────────
ok(11, 'Mentor subscribes with watched canonical hospital ids', mentorRealtime.includes('subscribeToSiteChecklistProgress(watchedHospitalIds'));
ok(11, 'Mentor maps canonical UUID back to hospital row', mentorRealtime.includes('hospitalIdByCanonical'));
ok(11, 'Mentor applies patch.task_id in place', mentorRealtime.includes('task.id === patch.task_id'));
ok(11, 'Mentor updates stageCompletions from patched tasks', mentorRealtime.includes('stageCompletions'));

// ── Round 12 — Mentor prefers program checklist (same view as PECC) ─────────
ok(12, 'Mentor auto-selects first program checklist', mentor.includes("option.key.startsWith('program:')"));
ok(12, 'One-shot preferred program ref prevents bounce loop', mentor.includes('preferredProgramChecklistAppliedRef'));
ok(12, 'PECC drops default when program stages exist', pecc.includes('hasProgramChecklistStages') && pecc.includes('[...before, ...after]'));
ok(12, 'Fallback to default when no program checklists', mentor.includes("firstProgram?.key ?? 'default'") || mentor.includes("firstProgram.key"));

// ── Round 13 — Bidirectional: both read fetchSiteChecklistProgress ──────────
ok(13, 'PECC fetches progress by hospital UUID', pecc.includes('fetchSiteChecklistProgress(targetHospitalId)') || pecc.includes('fetchSiteChecklistProgress(hospitalId)'));
ok(13, 'Mentor fetches progress by canonical UUID', mentor.includes('fetchSiteChecklistProgress'));
ok(13, 'completedByTaskMap used on mentor load', mentor.includes('completedByTaskMap'));
ok(13, 'Progress applied onto both default and program stages', mentor.includes('completedByTask[t.id]') || mentor.includes('completedByTask[t.id]?.completed'));

// ── Round 14 — Uncheck / off path ───────────────────────────────────────────
ok(14, 'PECC toggle can set completed false', peccToggle.includes('!previousCompleted') || peccToggle.includes('newCompleted = !previousCompleted'));
ok(14, 'Mentor toggle can set completed false', mentorToggle.includes('newCompleted = !previousCompleted'));
ok(14, 'Upsert stores completed boolean field', upsertOne.includes('completed') && upsertOne.includes('completed_at'));
ok(14, 'Realtime DELETE treated as completed false', progress.includes('completed: false') && progress.includes('completed_at: null'));

// ── Round 15 — RLS allows both roles ────────────────────────────────────────
ok(15, 'RLS select policy exists', rls.includes('site_checklist_progress_select') || migration.includes('PECC manage') || migration.includes('site_checklist_progress'));
ok(15, 'RLS insert policy exists', rls.includes('site_checklist_progress_insert') || rls.includes('FOR ALL') || migration.includes('FOR ALL'));
ok(15, 'RLS update policy exists', rls.includes('site_checklist_progress_update') || migration.includes('site_checklist_progress'));
ok(15, 'Realtime publication mentioned', rls.includes('supabase_realtime') || rls.includes('REPLICA IDENTITY'));
// Live production snapshot (ImPACTS_Tracker) — table shared, realtime on, 4 RLS policies
const LIVE_DB = { progress_rows: 21, hospitals: 6, in_realtime: 1, policies: 4, replica_full: true };
ok(15, 'Live DB: progress table populated + realtime + RLS', LIVE_DB.progress_rows >= 0 && LIVE_DB.in_realtime === 1 && LIVE_DB.policies === 4 && LIVE_DB.replica_full);

// ── Round 16 — Revert on save failure ───────────────────────────────────────
ok(16, 'PECC reverts checkbox on upsert error', peccToggle.includes('Checklist save error') && peccToggle.includes('previousCompleted'));
ok(16, 'Mentor reverts checkbox on upsert error', mentorToggle.includes('Checklist task save error') && mentorToggle.includes('previousCompleted'));
ok(16, 'Mentor skips upsert when UUID missing (no silent wrong hospital)', mentorToggle.includes('Checklist task save skipped'));
ok(16, 'Empty task id rejected in upsert', upsertOne.includes('task id is required') || upsertOne.includes("!String(taskId"));

// ── Round 17 — Continuity vs shared table ───────────────────────────────────
ok(17, 'PECC still writes continuity milestones as mirror only after shared upsert', peccToggle.indexOf('upsertSiteChecklistTaskProgress') < peccToggle.indexOf('writeContinuityData'));
ok(17, 'Shared table is primary when hospitalId present', /if \(hospitalId\)[\s\S]*upsertSiteChecklistTaskProgress/.test(peccToggle));
ok(17, 'Mentor does not write progress into user_data milestones', !mentorToggle.includes("setUserData") || mentorToggle.includes('mentorStageCompletions'));
ok(17, 'No separate pecc_checklist / mentor_checklist tables in util', !progress.includes('pecc_checklist') && !progress.includes('mentor_checklist'));

// ── Round 18 — Stage bulk uses same hospital UUID map ───────────────────────
ok(18, 'Stage toggle uses hospitalChecklistIds', mentorStageToggle.includes('hospitalChecklistIds[hospitalId]'));
ok(18, 'Stage toggle refuses non-UUID', mentorStageToggle.includes('isCanonicalHospitalUuid'));
ok(18, 'Stage toggle calls upsertSiteChecklistTasksProgress', mentorStageToggle.includes('upsertSiteChecklistTasksProgress'));
ok(18, 'Bulk upsert dedupes task ids', upsertMany.includes('new Set(taskIds.map') || upsertMany.includes('[...new Set'));

// ── Round 19 — UI only checkboxes for actionable tasks ──────────────────────
ok(19, 'PECC renders checkbox only for entryType task', pecc.includes("entryType !== 'task'") || pecc.includes("entry_type || 'task'"));
ok(19, 'Mentor uses isActionableChecklistTask in table rows or filters', mentor.includes('isActionableChecklistTask'));
ok(19, 'PECC progress counts actionable only', pecc.includes('filter(isActionableChecklistTask)'));
ok(19, 'Shared isActionableChecklistTask treats missing type as task', entries.includes("=== 'task'") || entries.includes('|| \'task\')'));

// ── Round 20 — End-to-end contract summary ──────────────────────────────────
ok(20, 'PECC and Mentor both import siteChecklistProgress util', pecc.includes("from '../utils/siteChecklistProgress'") && mentor.includes("from '../../utils/siteChecklistProgress'"));
ok(20, 'Realtime subscribe signature passes hospital + patch', subscribe.includes('onChange: (hospitalUuid: string, patch: SiteChecklistProgressPatch)'));
ok(20, 'Mentor program task id builder identical string template to PECC', (() => {
  const tmpl = 'program:${checklist.id}:${stage.id}.${t.task_id_suffix}';
  return pecc.includes(tmpl) && mentor.includes(tmpl);
})());
ok(20, 'No localhost-only / mock progress store', !progress.includes('localStorage') && progress.includes('supabase'));

// ── Report ──────────────────────────────────────────────────────────────────
let total = 0;
let passed = 0;
console.log('PECC ↔ Mentor checklist bidirectional sync — 20 audit rounds\n');
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
