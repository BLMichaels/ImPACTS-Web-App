/**
 * Mentor activities may be stored under either key (legacy vs current).
 * Use this helper so Snapshot, Overview, and Mentors pages all see the same data.
 */
export function getMentorActivitiesForUser(userId: string): any[] {
  if (!userId) return [];
  const fromNew = localStorage.getItem(`mentorActivities_${userId}`);
  if (fromNew) {
    try {
      const parsed = JSON.parse(fromNew);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // fall through to legacy
    }
  }
  const fromLegacy = localStorage.getItem(`mentor_activities_${userId}`);
  if (fromLegacy) {
    try {
      const parsed = JSON.parse(fromLegacy);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
