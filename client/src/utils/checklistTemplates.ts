/**
 * Template-aware site checklist progress.
 *
 * A site shows either the built-in default checklist or the custom checklists
 * configured for its program(s). `site_checklist_progress` only stores rows for
 * tasks that were toggled, so a percentage must be measured against the template
 * item list rather than against the stored rows.
 */
import { supabase } from '../supabase';
import { decodeChecklistEntry } from './checklistEntries';
import { DEFAULT_SITE_CHECKLIST_STAGES } from '../data/defaultSiteChecklist';

/** Task ids of the built-in 4-stage checklist rendered when a program has no custom checklist. */
export const DEFAULT_CHECKLIST_TASK_IDS: string[] = DEFAULT_SITE_CHECKLIST_STAGES.flatMap((stage) =>
  stage.tasks.map((task) => task.id)
);

const PROGRAM_CHECKLIST_OVERRIDES_KEY = 'program_checklist_enabled_overrides';
const CHUNK = 80;

export type ChecklistTemplateSource = 'default' | 'custom';

export interface SiteChecklistStats {
  total: number;
  completed: number;
  source: ChecklistTemplateSource;
  /** Names of the custom checklists in use, empty for the default checklist. */
  templateNames: string[];
  byStage: Map<string, { total: number; completed: number }>;
}

interface TemplateTask {
  taskId: string;
  stageLabel: string;
  text: string;
  checklistName: string;
}

export interface SiteChecklistItem extends TemplateTask {
  hospitalId: string;
  completed: boolean;
  completedAt: string | null;
  source: ChecklistTemplateSource;
}

function chunked<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function defaultTemplateTasks(): TemplateTask[] {
  return DEFAULT_SITE_CHECKLIST_STAGES.flatMap((stage) =>
    stage.tasks.map((task) => ({
      taskId: task.id,
      stageLabel: stage.title,
      text: task.text,
      checklistName: 'Default checklist',
    }))
  );
}

/** Custom checklist ids referenced by stored progress rows (`program:<checklistId>:<stageId>.<suffix>`). */
function referencedChecklistIds(taskIds: Iterable<string>): Set<string> {
  const ids = new Set<string>();
  for (const raw of taskIds) {
    const value = String(raw || '');
    if (!value.startsWith('program:')) continue;
    const checklistId = value.split(':')[1];
    if (checklistId) ids.add(checklistId);
  }
  return ids;
}

async function fetchEnabledOverrides(): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', PROGRAM_CHECKLIST_OVERRIDES_KEY)
    .maybeSingle();
  const raw = (data?.value ?? null) as Record<string, unknown> | null;
  return raw && typeof raw === 'object' ? raw : null;
}

interface ChecklistRow {
  id: string;
  program_id: string | null;
  name: string | null;
  sort_order: number | null;
}

/**
 * Load custom checklist definitions, keyed by checklist id, for the given programs
 * plus any checklist ids already referenced by stored progress.
 */
async function loadCustomChecklists(
  programIds: string[],
  extraChecklistIds: string[]
): Promise<{
  byId: Map<string, { row: ChecklistRow; tasks: TemplateTask[] }>;
  byProgram: Map<string, string[]>;
}> {
  const byId = new Map<string, { row: ChecklistRow; tasks: TemplateTask[] }>();
  const byProgram = new Map<string, string[]>();
  if (!programIds.length && !extraChecklistIds.length) return { byId, byProgram };

  const overrides = await fetchEnabledOverrides();
  const isEnabled = (checklistId: string) => !overrides || overrides[checklistId] !== false;

  const rows: ChecklistRow[] = [];
  for (const part of chunked(programIds)) {
    const { data, error } = await supabase
      .from('program_checklists')
      .select('id, program_id, name, sort_order')
      .in('program_id', part)
      .order('sort_order');
    if (error) throw error;
    rows.push(...((data || []) as ChecklistRow[]));
  }
  const known = new Set(rows.map((r) => r.id));
  const missing = extraChecklistIds.filter((id) => !known.has(id));
  for (const part of chunked(missing)) {
    const { data, error } = await supabase
      .from('program_checklists')
      .select('id, program_id, name, sort_order')
      .in('id', part);
    if (error) throw error;
    rows.push(...((data || []) as ChecklistRow[]));
  }

  const enabled = rows.filter((r) => isEnabled(r.id));
  if (!enabled.length) return { byId, byProgram };

  const checklistIds = enabled.map((r) => r.id);
  const stages: { id: string; checklist_id: string; title: string | null; sort_order: number | null }[] = [];
  for (const part of chunked(checklistIds)) {
    const { data, error } = await supabase
      .from('program_checklist_stages')
      .select('id, checklist_id, title, sort_order')
      .in('checklist_id', part)
      .order('sort_order');
    if (error) throw error;
    stages.push(...((data || []) as typeof stages));
  }

  const stageIds = stages.map((s) => s.id);
  const tasks: { id: string; stage_id: string; task_id_suffix: string; text_content: string | null }[] = [];
  for (const part of chunked(stageIds)) {
    const { data, error } = await supabase
      .from('program_checklist_tasks')
      .select('id, stage_id, task_id_suffix, text_content')
      .in('stage_id', part)
      .order('sort_order');
    if (error) throw error;
    tasks.push(...((data || []) as typeof tasks));
  }

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const checklistNameById = new Map(enabled.map((r) => [r.id, String(r.name || 'Custom checklist')]));
  const tasksByChecklist = new Map<string, TemplateTask[]>();
  tasks.forEach((task) => {
    const stage = stageById.get(task.stage_id);
    if (!stage) return;
    // Banners, footnotes, and dividers are display-only and must not count toward progress.
    if (decodeChecklistEntry(String(task.text_content || '')).type !== 'task') return;
    const checklistName = String(checklistNameById.get(stage.checklist_id) || 'Custom checklist');
    const list = tasksByChecklist.get(stage.checklist_id) || [];
    list.push({
      taskId: `program:${stage.checklist_id}:${stage.id}.${task.task_id_suffix}`,
      stageLabel: String(stage.title || '').trim() || 'Stage',
      text: decodeChecklistEntry(String(task.text_content || '')).content,
      checklistName,
    });
    tasksByChecklist.set(stage.checklist_id, list);
  });

  enabled.forEach((row) => {
    const checklistTasks = tasksByChecklist.get(row.id) || [];
    if (!checklistTasks.length) return;
    byId.set(row.id, { row, tasks: checklistTasks });
    if (row.program_id) {
      const list = byProgram.get(row.program_id) || [];
      list.push(row.id);
      byProgram.set(row.program_id, list);
    }
  });

  return { byId, byProgram };
}

interface ResolvedSiteTemplate {
  tasks: TemplateTask[];
  source: ChecklistTemplateSource;
  templateNames: string[];
  completedByTask: Map<string, { completed: boolean; completedAt: string | null }>;
}

/**
 * Resolve, per hospital, the checklist template the site is measured against plus its stored progress.
 * A site uses the custom checklists of its program(s) when configured, otherwise the default checklist.
 */
async function resolveSiteTemplates(hospitalUuids: string[]): Promise<Map<string, ResolvedSiteTemplate>> {
  const resolved = new Map<string, ResolvedSiteTemplate>();
  const ids = [...new Set(hospitalUuids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return resolved;

  const progress: { hospital_id: string; task_id: string; completed: boolean; completed_at: string | null }[] = [];
  for (const part of chunked(ids)) {
    const { data, error } = await supabase
      .from('site_checklist_progress')
      .select('hospital_id, task_id, completed, completed_at')
      .in('hospital_id', part);
    if (error) throw error;
    progress.push(...((data || []) as typeof progress));
  }

  const hospitals: { id: string; facility_id: string | null; programs: string[] | null }[] = [];
  for (const part of chunked(ids)) {
    const { data, error } = await supabase.from('hospitals').select('id, facility_id, programs').in('id', part);
    if (error) throw error;
    hospitals.push(...((data || []) as typeof hospitals));
  }

  // Also discover programs from PECCs assigned to these sites (matches what the PECC UI uses).
  const peccProgramByHospital = new Map<string, Set<string>>();
  const facilityToHospital = new Map<string, string>();
  const facilityRefs: string[] = [];
  hospitals.forEach((h) => {
    facilityToHospital.set(h.id, h.id);
    if (h.facility_id != null && String(h.facility_id).trim()) {
      facilityToHospital.set(String(h.facility_id).trim(), h.id);
      facilityRefs.push(String(h.facility_id).trim());
    }
  });
  {
    const peccRefs = [...new Set([...ids, ...facilityRefs])];
    const peccs: { id: string; hospital_facility_id: string | null; primary_program_id: string | null }[] = [];
    for (const part of chunked(peccRefs)) {
      const { data, error } = await supabase
        .from('users')
        .select('id, hospital_facility_id, primary_program_id')
        .eq('role', 'pecc')
        .eq('is_active', true)
        .in('hospital_facility_id', part);
      if (error) throw error;
      peccs.push(...((data || []) as typeof peccs));
    }
    const peccIds = peccs.map((p) => p.id);
    const membershipByUser = new Map<string, string[]>();
    for (const part of chunked(peccIds)) {
      const { data, error } = await supabase
        .from('program_members')
        .select('user_id, program_id')
        .in('user_id', part)
        .eq('status', 'active');
      if (error) {
        // Older schemas may not have status; fall back without it.
        const retry = await supabase.from('program_members').select('user_id, program_id').in('user_id', part);
        if (retry.error) throw retry.error;
        (retry.data || []).forEach((row: { user_id: string; program_id: string }) => {
          const list = membershipByUser.get(row.user_id) || [];
          list.push(row.program_id);
          membershipByUser.set(row.user_id, list);
        });
      } else {
        (data || []).forEach((row: { user_id: string; program_id: string }) => {
          const list = membershipByUser.get(row.user_id) || [];
          list.push(row.program_id);
          membershipByUser.set(row.user_id, list);
        });
      }
    }
    peccs.forEach((p) => {
      const hospitalId = facilityToHospital.get(String(p.hospital_facility_id || '').trim());
      if (!hospitalId) return;
      const set = peccProgramByHospital.get(hospitalId) || new Set<string>();
      if (p.primary_program_id) set.add(p.primary_program_id);
      (membershipByUser.get(p.id) || []).forEach((pid) => set.add(pid));
      peccProgramByHospital.set(hospitalId, set);
    });
  }

  const programIds = [
    ...new Set([
      ...hospitals.flatMap((h) => (Array.isArray(h.programs) ? h.programs : [])).filter(Boolean),
      ...[...peccProgramByHospital.values()].flatMap((set) => [...set]),
    ]),
  ];
  const referenced = referencedChecklistIds(progress.map((p) => p.task_id));
  const { byId, byProgram } = await loadCustomChecklists(programIds, [...referenced]);

  const completedByHospital = new Map<string, Map<string, { completed: boolean; completedAt: string | null }>>();
  progress.forEach((row) => {
    const map =
      completedByHospital.get(row.hospital_id) ||
      new Map<string, { completed: boolean; completedAt: string | null }>();
    map.set(row.task_id, { completed: Boolean(row.completed), completedAt: row.completed_at ?? null });
    completedByHospital.set(row.hospital_id, map);
  });
  const programsByHospital = new Map(
    hospitals.map((h) => {
      const fromHospital = (Array.isArray(h.programs) ? h.programs : []).filter(Boolean);
      const fromPecc = [...(peccProgramByHospital.get(h.id) || [])];
      return [h.id, [...new Set([...fromHospital, ...fromPecc])]] as const;
    })
  );

  ids.forEach((hospitalId) => {
    const completedByTask =
      completedByHospital.get(hospitalId) || new Map<string, { completed: boolean; completedAt: string | null }>();

    const checklistIds = new Set<string>();
    (programsByHospital.get(hospitalId) || []).forEach((programId) => {
      (byProgram.get(programId) || []).forEach((cid) => checklistIds.add(cid));
    });
    // Sites whose program link is missing still report against the checklist their progress references.
    if (checklistIds.size === 0) {
      referencedChecklistIds(completedByTask.keys()).forEach((cid) => {
        if (byId.has(cid)) checklistIds.add(cid);
      });
    }

    const templateNames: string[] = [];
    let tasks: TemplateTask[] = [];
    [...checklistIds]
      .map((cid) => byId.get(cid))
      .filter((entry): entry is { row: ChecklistRow; tasks: TemplateTask[] } => Boolean(entry))
      .sort((a, b) => (a.row.sort_order ?? 0) - (b.row.sort_order ?? 0))
      .forEach((entry) => {
        templateNames.push(String(entry.row.name || 'Custom checklist'));
        tasks.push(...entry.tasks);
      });

    const source: ChecklistTemplateSource = tasks.length > 0 ? 'custom' : 'default';
    if (!tasks.length) tasks = defaultTemplateTasks();

    resolved.set(hospitalId, { tasks, source, templateNames, completedByTask });
  });

  return resolved;
}

/**
 * Checklist completion per hospital measured against the template each site actually uses.
 * Falls back to the default checklist when a site's program has no custom checklist.
 */
export async function loadSiteChecklistStats(
  hospitalUuids: string[]
): Promise<Map<string, SiteChecklistStats>> {
  const resolved = await resolveSiteTemplates(hospitalUuids);
  const result = new Map<string, SiteChecklistStats>();

  resolved.forEach((template, hospitalId) => {
    const byStage = new Map<string, { total: number; completed: number }>();
    let completed = 0;
    template.tasks.forEach((task) => {
      const isDone = template.completedByTask.get(task.taskId)?.completed === true;
      if (isDone) completed += 1;
      const stage = byStage.get(task.stageLabel) || { total: 0, completed: 0 };
      stage.total += 1;
      if (isDone) stage.completed += 1;
      byStage.set(task.stageLabel, stage);
    });

    result.set(hospitalId, {
      total: template.tasks.length,
      completed,
      source: template.source,
      templateNames: template.templateNames,
      byStage,
    });
  });

  return result;
}

/**
 * One entry per checklist item per site, including items never toggled (reported as not complete).
 */
export async function loadSiteChecklistItems(hospitalUuids: string[]): Promise<SiteChecklistItem[]> {
  const resolved = await resolveSiteTemplates(hospitalUuids);
  const items: SiteChecklistItem[] = [];

  resolved.forEach((template, hospitalId) => {
    template.tasks.forEach((task) => {
      const stored = template.completedByTask.get(task.taskId);
      items.push({
        ...task,
        hospitalId,
        source: template.source,
        completed: stored?.completed === true,
        completedAt: stored?.completed ? stored.completedAt : null,
      });
    });
  });

  return items;
}
