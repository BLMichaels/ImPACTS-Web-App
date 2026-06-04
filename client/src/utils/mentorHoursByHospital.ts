import { hospitalKeysMatch } from './hospitalId';

export interface MentorHospitalRef {
  id: string;
  facilityId?: string;
  name: string;
}

export interface MentorHoursRollup {
  hospitalId: string;
  name: string;
  totalHours: number;
  hoursThisMonth: number;
  activityCount: number;
  activitiesThisMonth: number;
}

export type MentorActivityForHours = {
  date?: string;
  hours?: number;
  hospitalIds?: string[];
};

function activityMatchesHospital(activityHospitalIds: string[], hospital: MentorHospitalRef): boolean {
  const refs = new Set(
    [hospital.id, hospital.facilityId].map((ref) => String(ref || '').trim()).filter(Boolean)
  );
  if (refs.size === 0) return false;
  return activityHospitalIds.some((id) => [...refs].some((ref) => hospitalKeysMatch(ref, id)));
}

export function rollupMentorHoursByHospital(
  activities: MentorActivityForHours[],
  hospitals: MentorHospitalRef[],
  monthStart?: Date
): MentorHoursRollup[] {
  const start = monthStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return hospitals.map((hospital) => {
    let totalHours = 0;
    let hoursThisMonth = 0;
    let activityCount = 0;
    let activitiesThisMonth = 0;

    for (const activity of activities) {
      const ids = Array.isArray(activity.hospitalIds)
        ? activity.hospitalIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];
      if (!activityMatchesHospital(ids, hospital)) continue;

      const hrs = Number(activity.hours) || 0;
      activityCount += 1;
      totalHours += hrs;
      if (activity.date && new Date(activity.date) >= start) {
        activitiesThisMonth += 1;
        hoursThisMonth += hrs;
      }
    }

    return {
      hospitalId: hospital.id,
      name: hospital.name,
      totalHours,
      hoursThisMonth,
      activityCount,
      activitiesThisMonth,
    };
  });
}

export function sumUnlinkedMentorHours(activities: MentorActivityForHours[]): number {
  return activities
    .filter((a) => !Array.isArray(a.hospitalIds) || a.hospitalIds.length === 0)
    .reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
}
