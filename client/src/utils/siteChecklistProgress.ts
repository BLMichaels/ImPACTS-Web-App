import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { hospitalIdOrFacilityOrClause } from './hospitalId';

export interface SiteChecklistProgressRow {
  task_id: string;
  completed: boolean;
  completed_at: string | null;
}

export type SiteChecklistProgressPatch = SiteChecklistProgressRow;

/** Resolve any site ref (facility id or hospitals.id) to canonical hospitals.id UUID. */
export async function resolveSiteChecklistHospitalUuid(
  siteRef: string | null | undefined
): Promise<string | null> {
  const ref = String(siteRef || '').trim();
  if (!ref) return null;
  const { data, error } = await supabase
    .from('hospitals')
    .select('id')
    .or(hospitalIdOrFacilityOrClause(ref))
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[siteChecklistProgress] resolve hospital uuid failed:', error);
    return null;
  }
  return data?.id ? String(data.id) : null;
}

export async function fetchSiteChecklistProgress(
  hospitalUuid: string
): Promise<SiteChecklistProgressRow[]> {
  const { data, error } = await supabase
    .from('site_checklist_progress')
    .select('task_id, completed, completed_at')
    .eq('hospital_id', hospitalUuid);
  if (error) throw error;
  return (data || []) as SiteChecklistProgressRow[];
}

export async function upsertSiteChecklistTaskProgress(
  hospitalUuid: string,
  taskId: string,
  completed: boolean
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('site_checklist_progress').upsert(
    {
      hospital_id: hospitalUuid,
      task_id: taskId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'hospital_id,task_id' }
  );
  return { error: error ? new Error(error.message) : null };
}

export async function upsertSiteChecklistTasksProgress(
  hospitalUuid: string,
  taskIds: string[],
  completed: boolean
): Promise<{ error: Error | null }> {
  if (!taskIds.length) return { error: null };
  const completedAt = completed ? new Date().toISOString() : null;
  const { error } = await supabase.from('site_checklist_progress').upsert(
    taskIds.map((taskId) => ({
      hospital_id: hospitalUuid,
      task_id: taskId,
      completed,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'hospital_id,task_id' }
  );
  return { error: error ? new Error(error.message) : null };
}

function payloadToPatch(
  payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>
): SiteChecklistProgressPatch | null {
  if (payload.eventType === 'DELETE') {
    const oldRow = payload.old as { task_id?: string } | null;
    if (!oldRow?.task_id) return null;
    return { task_id: String(oldRow.task_id), completed: false, completed_at: null };
  }
  const newRow = payload.new as Record<string, unknown> | null;
  if (!newRow?.task_id) return null;
  return {
    task_id: String(newRow.task_id),
    completed: Boolean(newRow.completed),
    completed_at: newRow.completed_at != null ? String(newRow.completed_at) : null,
  };
}

/** Subscribe to checklist progress for one or more canonical hospital UUIDs. */
export function subscribeToSiteChecklistProgress(
  hospitalUuids: string[],
  onChange: (hospitalUuid: string, patch: SiteChecklistProgressPatch) => void
): () => void {
  const unique = [...new Set(hospitalUuids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return () => {};

  const channel = supabase.channel(`site-checklist-progress:${unique.join('|')}`);
  unique.forEach((hospitalUuid) => {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'site_checklist_progress',
        filter: `hospital_id=eq.${hospitalUuid}`,
      },
      (payload) => {
        const patch = payloadToPatch(payload);
        if (patch) onChange(hospitalUuid, patch);
      }
    );
  });
  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function completedByTaskMap(
  rows: SiteChecklistProgressRow[]
): Record<string, { completed: boolean; completed_at: string | null }> {
  const map: Record<string, { completed: boolean; completed_at: string | null }> = {};
  rows.forEach((row) => {
    map[row.task_id] = { completed: row.completed, completed_at: row.completed_at };
  });
  return map;
}
