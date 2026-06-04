import { computeChecklistMetrics, computeWorkHours, mergeReadinessScoreSources } from './snapshotMetrics';

describe('snapshotMetrics', () => {
  it('prefers site checklist progress over legacy milestones', () => {
    const metrics = computeChecklistMetrics([{ completed: true }, { completed: false }], {
      total: 10,
      completed: 4,
    });
    expect(metrics.source).toBe('site_checklist');
    expect(metrics.overallPct).toBe(40);
    expect(metrics.kpiLabel).toBe('4/10');
  });

  it('merges readiness sources preferring longer series', () => {
    const merged = mergeReadinessScoreSources(
      [{ date: '2026-01-01', score: 50 }],
      [
        { date: '2026-01-01', score: 50 },
        { date: '2026-02-01', score: 60 },
      ]
    );
    expect(merged).toHaveLength(2);
    expect(merged[1].score).toBe(60);
  });

  it('computes work hours with valid dates only', () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const hours = computeWorkHours([
      { date: new Date(year, month, 5).toISOString(), hours: 2 },
      { date: 'not-a-date', hours: 5 },
    ]);
    expect(hours.thisMonthHours).toBe(2);
    expect(hours.totalHours).toBe(7);
  });
});
