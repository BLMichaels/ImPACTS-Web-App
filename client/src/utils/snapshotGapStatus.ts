/**
 * Case-insensitive gap plan / milestone status helpers for Snapshot + PDF export.
 */

export function normalizeGapPlanStatus(status: unknown): string {
  if (status == null) return '';
  return String(status).trim().toLowerCase();
}

export function isGapPlanCompleted(plan: { status?: unknown }): boolean {
  return normalizeGapPlanStatus(plan.status) === 'completed';
}

export function gapPlanHasStatus(plan: { status?: unknown }, expectedLabel: string): boolean {
  return normalizeGapPlanStatus(plan.status) === expectedLabel.trim().toLowerCase();
}

export function isMilestoneCompleted(m: { status?: unknown; completed?: unknown }): boolean {
  if (m.completed === true) return true;
  return normalizeGapPlanStatus(m.status) === 'completed';
}

export function isSimulationGapCompleted(g: { status?: unknown }): boolean {
  return normalizeGapPlanStatus(g.status) === 'completed';
}
