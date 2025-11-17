/**
 * Utility to clear local storage data that might be causing quota exceeded errors
 */

export const clearLocalStorageData = () => {
  try {
    // Clear all ImPACTS-related local storage keys
    const keysToRemove = [
      'impacts_user_profile',
      'impacts_activities',
      'impacts_gap_plans',
      'impacts_milestones',
      'impacts_prs_assessment',
      'impacts_resources',
      'impacts_pending_sync',
      'impacts_sync_status',
      'impacts_last_sync'
    ];

    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log('Cleared ImPACTS local storage data');
    return true;
  } catch (error) {
    console.error('Error clearing local storage:', error);
    return false;
  }
};

export const getLocalStorageUsage = () => {
  try {
    let totalSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length + key.length;
      }
    }
    return {
      totalSize,
      totalSizeKB: Math.round(totalSize / 1024),
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
    };
  } catch (error) {
    console.error('Error calculating local storage usage:', error);
    return null;
  }
};
