// Custom hook for data synchronization (local storage only)
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useSync } from '../context/SyncContext';

export const useDataSync = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const {
    syncUserProfile,
    syncActivities,
    syncGapPlans,
    syncMilestones,
    syncPRSAssessment,
    syncResources,
    loadUserData,
    bigQueryEnabled
  } = useSync();

  // Sync user profile when it changes (local storage only)
  useEffect(() => {
    if (currentUser && userProfile) {
      syncUserProfile({
        id: currentUser.uid,
        userId: currentUser.uid,
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        phone: userProfile.phone,
        tier: userProfile.tier,
        department: userProfile.department,
        hospitalName: (userProfile as any).hospitalName,
        hospitalType: (userProfile as any).hospitalType,
        hospitalAddress: (userProfile as any).hospitalAddress,
        hospitalCity: (userProfile as any).hospitalCity,
        hospitalState: (userProfile as any).hospitalState,
        hospitalZip: (userProfile as any).hospitalZip,
        hospitalPhone: (userProfile as any).hospitalPhone,
        emergencyDepartment: (userProfile as any).emergencyDepartment,
        pediatricVolume: (userProfile as any).pediatricVolume,
        createdAt: userProfile.createdAt,
        updatedAt: new Date().toISOString()
      });
    }
  }, [currentUser, userProfile, syncUserProfile]);

  return {
    syncActivities,
    syncGapPlans,
    syncMilestones,
    syncPRSAssessment,
    syncResources,
    loadUserData,
    bigQueryEnabled
  };
};

export default useDataSync;
