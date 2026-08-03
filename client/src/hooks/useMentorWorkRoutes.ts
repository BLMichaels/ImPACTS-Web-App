import { useMemo } from 'react';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

/** Role-aware paths for mentor work pages reused under /manager/* routes. */
export function useMentorWorkRoutes() {
  const { userProfile } = useUserProfile();

  return useMemo(() => {
    const isManager = userProfile?.role === UserRole.MANAGER;
    const base = isManager ? '/manager' : '/mentor';
    return {
      hospitals: `${base}/hospitals`,
      activities: `${base}/activities`,
      milestones: `${base}/milestones`,
      dashboard: isManager ? '/manager/snapshot' : '/mentor/dashboard',
      overview: isManager ? '/manager/snapshot' : '/mentor/snapshot',
      hospitalsWithHospital: (hospitalId: string) =>
        `${base}/hospitals?hospital=${encodeURIComponent(hospitalId)}`,
    };
  }, [userProfile?.role]);
}
