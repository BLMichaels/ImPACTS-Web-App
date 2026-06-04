import { format } from 'date-fns';
import { isMilestoneCompleted } from './snapshotGapStatus';
import { parseActivityDate } from './snapshotActivityDate';

export interface ChecklistDbProgress {
  total: number;
  completed: number;
}

export interface ChecklistDisplayMetrics {
  totalTasks: number;
  completedTasks: number;
  overallPct: number;
  kpiLabel: string;
  source: 'site_checklist' | 'milestones_flat' | 'milestones_staged';
}

export function computeChecklistMetrics(
  milestones: Array<{ tasks?: Array<{ completed?: boolean }>; completed?: unknown; status?: unknown }>,
  dbProgress: ChecklistDbProgress | null
): ChecklistDisplayMetrics {
  if (dbProgress && dbProgress.total > 0) {
    const overallPct = Math.round((dbProgress.completed / dbProgress.total) * 100);
    return {
      totalTasks: dbProgress.total,
      completedTasks: dbProgress.completed,
      overallPct,
      kpiLabel: `${dbProgress.completed}/${dbProgress.total}`,
      source: 'site_checklist',
    };
  }

  if (milestones.length > 0 && milestones[0]?.tasks != null) {
    const totalTasks = milestones.reduce((sum, s) => sum + (s.tasks?.length || 0), 0);
    const completedTasks = milestones.reduce(
      (sum, s) => sum + (s.tasks?.filter((t) => t.completed)?.length || 0),
      0
    );
    const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return {
      totalTasks,
      completedTasks,
      overallPct,
      kpiLabel: `${completedTasks}/${totalTasks}`,
      source: 'milestones_staged',
    };
  }

  if (milestones.length > 0) {
    const completedTasks = milestones.filter((m) => isMilestoneCompleted(m)).length;
    const totalTasks = milestones.length;
    const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return {
      totalTasks,
      completedTasks,
      overallPct,
      kpiLabel: `${completedTasks}/${totalTasks}`,
      source: 'milestones_flat',
    };
  }

  return {
    totalTasks: 0,
    completedTasks: 0,
    overallPct: 0,
    kpiLabel: '0',
    source: 'milestones_flat',
  };
}

export function sortReadinessScores<T extends { date?: string; score?: number }>(scores: T[]): T[] {
  return [...scores].sort((a, b) => {
    const ta = new Date(a.date || 0).getTime();
    const tb = new Date(b.date || 0).getTime();
    return ta - tb;
  });
}

export function mergeReadinessScoreSources(
  readinessScores: unknown,
  prsReadinessScores: unknown
): Array<{ id?: string; date: string; score: number; notes?: string }> {
  const a = Array.isArray(readinessScores) ? readinessScores : [];
  const b = Array.isArray(prsReadinessScores) ? prsReadinessScores : [];
  const merged = b.length >= a.length ? b : a.length > 0 ? a : b;
  return sortReadinessScores(
    merged
      .map((row: { id?: string; date?: string; score?: number; notes?: string }) => ({
        id: row.id,
        date: String(row.date || ''),
        score: Number(row.score) || 0,
        notes: row.notes,
      }))
      .filter((row) => row.date)
  );
}

export function computeWorkHours(activities: Array<{ date?: string; hours?: number }>) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  let thisMonthHours = 0;
  let lastMonthHours = 0;
  let thisYearHours = 0;
  let totalHours = 0;

  for (const activity of activities) {
    const hrs = Number(activity.hours) || 0;
    totalHours += hrs;
    const activityDate = parseActivityDate(activity.date);
    if (!activityDate) continue;
    if (activityDate.getFullYear() === currentYear) {
      thisYearHours += hrs;
      if (activityDate.getMonth() === currentMonth) thisMonthHours += hrs;
      if (activityDate.getMonth() === lastMonth && activityDate.getFullYear() === lastMonthYear) {
        lastMonthHours += hrs;
      }
    }
  }

  return { thisMonthHours, lastMonthHours, thisYearHours, totalHours };
}

export function formatActivityDateLabel(dateValue: unknown): string {
  const parsed = parseActivityDate(dateValue);
  if (!parsed) return String(dateValue || '—');
  try {
    return format(parsed, 'MMM d, yyyy');
  } catch {
    return String(dateValue || '—');
  }
}
