// Sync context for managing data synchronization (local storage only)
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import syncService from '../services/syncService';

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  syncInProgress: boolean;
  lastSyncTime: string | null;
  bigQueryEnabled: boolean;
  forceSync: () => Promise<void>;
  syncUserProfile: (userProfile: any) => Promise<void>;
  syncActivities: (activities: any[]) => Promise<void>;
  syncGapPlans: (gapPlans: any[]) => Promise<void>;
  syncMilestones: (milestones: any[]) => Promise<void>;
  syncPRSAssessment: (assessment: any) => Promise<void>;
  syncResources: (resources: any[]) => Promise<void>;
  loadUserData: (userId: string) => Promise<any>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [bigQueryEnabled, setBigQueryEnabled] = useState(false);

  useEffect(() => {
    // Initialize sync service
    syncService.initialize();

    // Update sync status periodically
    const updateSyncStatus = () => {
      const status = syncService.getSyncStatus();
      setIsOnline(status.isOnline);
      setPendingCount(status.pendingCount);
      setSyncInProgress(status.syncInProgress);
      setBigQueryEnabled(false); // BigQuery removed
      
      if (status.pendingCount === 0 && !status.syncInProgress) {
        setLastSyncTime(new Date().toISOString());
      }
    };

    // Initial status update
    updateSyncStatus();

    // Update status every 5 seconds
    const interval = setInterval(updateSyncStatus, 5000);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const forceSync = async (): Promise<void> => {
    setSyncInProgress(true);
    try {
      await syncService.forceSync();
      setLastSyncTime(new Date().toISOString());
    } finally {
      setSyncInProgress(false);
    }
  };

  const syncUserProfile = async (userProfile: any): Promise<void> => {
    await syncService.syncUserProfile(userProfile);
  };

  const syncActivities = async (activities: any[]): Promise<void> => {
    await syncService.syncActivities(activities);
  };

  const syncGapPlans = async (gapPlans: any[]): Promise<void> => {
    await syncService.syncGapPlans(gapPlans);
  };

  const syncMilestones = async (milestones: any[]): Promise<void> => {
    await syncService.syncMilestones(milestones);
  };

  const syncPRSAssessment = async (assessment: any): Promise<void> => {
    await syncService.syncPRSAssessment(assessment);
  };

  const syncResources = async (resources: any[]): Promise<void> => {
    await syncService.syncResources(resources);
  };

  const loadUserData = async (userId: string): Promise<any> => {
    return await syncService.loadUserData(userId);
  };

  const value: SyncContextType = {
    isOnline,
    pendingCount,
    syncInProgress,
    lastSyncTime,
    bigQueryEnabled,
    forceSync,
    syncUserProfile,
    syncActivities,
    syncGapPlans,
    syncMilestones,
    syncPRSAssessment,
    syncResources,
    loadUserData
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export default SyncContext;
