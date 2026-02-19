/**
 * Mentor activities: stored in Supabase user_data. Use this helper so Snapshot, Overview, and Mentors pages all see the same data.
 */
import { getUserData, setUserData } from './userData';

async function migrateMentorActivitiesFromLocalStorage(userId: string): Promise<any[]> {
  const fromNew = localStorage.getItem(`mentorActivities_${userId}`);
  if (fromNew) {
    try {
      const parsed = JSON.parse(fromNew);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
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

export async function getMentorActivitiesForUser(userId: string): Promise<any[]> {
  if (!userId) return [];
  const fromSupabase = await getUserData<any[]>(userId, 'mentorActivities');
  if (fromSupabase != null && Array.isArray(fromSupabase)) return fromSupabase;
  const fromLs = await migrateMentorActivitiesFromLocalStorage(userId);
  if (fromLs.length > 0) {
    await setUserData(userId, 'mentorActivities', fromLs);
    try {
      localStorage.removeItem(`mentorActivities_${userId}`);
      localStorage.removeItem(`mentor_activities_${userId}`);
    } catch {}
    return fromLs;
  }
  return [];
}
