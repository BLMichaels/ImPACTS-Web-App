// Simplified synchronization service - BigQuery removed
// This service now only manages local storage sync status

class SyncService {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Get sync status
  getSyncStatus(): {
    isOnline: boolean;
    pendingCount: number;
    syncInProgress: boolean;
    bigQueryEnabled: boolean;
  } {
    return {
      isOnline: this.isOnline,
      pendingCount: 0,
      syncInProgress: this.syncInProgress,
      bigQueryEnabled: false
    };
  }

  // Placeholder methods for backward compatibility
  async syncUserProfile(userProfile: any): Promise<void> {
    console.log('User profile sync (local storage only):', userProfile);
  }

  async syncActivities(activities: any[]): Promise<void> {
    console.log('Activities sync (local storage only):', activities.length, 'activities');
  }

  async syncGapPlans(gapPlans: any[]): Promise<void> {
    console.log('Gap plans sync (local storage only):', gapPlans.length, 'plans');
  }

  async syncMilestones(milestones: any[]): Promise<void> {
    console.log('Milestones sync (local storage only):', milestones.length, 'milestones');
  }

  async syncPRSAssessment(assessment: any): Promise<void> {
    console.log('PRS assessment sync (local storage only):', assessment);
  }

  async syncResources(resources: any[]): Promise<void> {
    console.log('Resources sync (local storage only):', resources.length, 'resources');
  }

  async forceSync(): Promise<void> {
    console.log('Force sync called (no-op, BigQuery removed)');
  }

  async loadUserData(userId: string): Promise<{
    userProfile?: any;
    activities: any[];
    gapPlans: any[];
    milestones: any[];
    prsAssessments: any[];
    resources: any[];
  }> {
    return {
      activities: [],
      gapPlans: [],
      milestones: [],
      prsAssessments: [],
      resources: []
    };
  }

  // Initialize sync service
  async initialize(): Promise<void> {
    console.log('Sync service initialized (local storage only)');
  }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService;
