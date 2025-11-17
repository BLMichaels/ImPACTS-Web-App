// Synchronization service for offline/online data sync
import BigQueryServiceBrowser from './bigqueryServiceBrowser';
import { 
  BigQueryUserProfile, 
  BigQueryActivity, 
  BigQueryGapPlan, 
  BigQueryMilestone, 
  BigQueryPRSAssessment, 
  BigQueryResource,
  SyncRecord,
  SyncOperation
} from '../types/bigquery';
import { getBigQueryConfig, isBigQueryEnabled } from '../config/bigquery';

class SyncService {
  private bigqueryService: BigQueryServiceBrowser | null = null;
  private isOnline: boolean = navigator.onLine;
  private pendingSync: SyncRecord[] = [];
  private syncInProgress: boolean = false;

  constructor() {
    this.setupEventListeners();
    this.initializeBigQuery();
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processPendingSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Listen for visibility change to sync when user returns
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.processPendingSync();
      }
    });
  }

  private async initializeBigQuery(): Promise<void> {
    if (isBigQueryEnabled()) {
      try {
        this.bigqueryService = new BigQueryServiceBrowser(getBigQueryConfig());
        await this.bigqueryService.initialize();
        console.log('Sync service initialized with BigQuery');
      } catch (error) {
        console.error('Failed to initialize BigQuery service:', error);
      }
    } else {
      console.warn('BigQuery is not configured. Data will only be stored locally.');
    }
  }

  // Add record to sync queue
  private addToSyncQueue(operation: SyncOperation, table: string, data: any): void {
    const record: SyncRecord = {
      operation,
      table,
      data,
      timestamp: new Date().toISOString(),
      id: `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    console.log(`🔄 Adding to sync queue: ${operation} ${table} (${Array.isArray(data) ? data.length : 1} items)`);
    this.pendingSync.push(record);
    this.savePendingSyncToLocalStorage();

    // Try to sync immediately if online
    if (this.isOnline && !this.syncInProgress) {
      console.log(`🔄 Triggering immediate sync (online: ${this.isOnline}, syncInProgress: ${this.syncInProgress})`);
      this.processPendingSync();
    } else {
      console.log(`⏳ Queuing for later sync (online: ${this.isOnline}, syncInProgress: ${this.syncInProgress})`);
    }
  }

  // Process pending sync operations
  private async processPendingSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || !this.bigqueryService || this.pendingSync.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`Processing ${this.pendingSync.length} pending sync operations`);

    try {
      await this.bigqueryService.batchSync(this.pendingSync);
      this.pendingSync = [];
      this.savePendingSyncToLocalStorage();
      console.log('Pending sync completed successfully');
    } catch (error) {
      console.error('Failed to process pending sync:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Save pending sync to localStorage
  private savePendingSyncToLocalStorage(): void {
    try {
      localStorage.setItem('impacts_pending_sync', JSON.stringify(this.pendingSync));
    } catch (error) {
      console.error('Failed to save pending sync to localStorage:', error);
    }
  }

  // Load pending sync from localStorage
  private loadPendingSyncFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('impacts_pending_sync');
      if (stored) {
        this.pendingSync = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load pending sync from localStorage:', error);
    }
  }

  // User Profile sync
  async syncUserProfile(userProfile: any): Promise<void> {
    const bigQueryProfile: BigQueryUserProfile = {
      user_id: userProfile.id || userProfile.userId,
      email: userProfile.email,
      first_name: userProfile.firstName,
      last_name: userProfile.lastName,
      phone: userProfile.phone,
      tier: userProfile.tier,
      department: userProfile.department,
      hospital_name: userProfile.hospitalName,
      hospital_type: userProfile.hospitalType,
      hospital_address: userProfile.hospitalAddress,
      hospital_city: userProfile.hospitalCity,
      hospital_state: userProfile.hospitalState,
      hospital_zip: userProfile.hospitalZip,
      hospital_phone: userProfile.hospitalPhone,
      emergency_department: userProfile.emergencyDepartment,
      pediatric_volume: userProfile.pediatricVolume,
      created_at: userProfile.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString()
    };

    this.addToSyncQueue('update', 'user_profiles', bigQueryProfile);
  }

  // Activities sync
  async syncActivities(activities: any[]): Promise<void> {
    console.log(`🔄 SyncService: Processing ${activities.length} activities for sync`);
    
    const bigQueryActivities: BigQueryActivity[] = activities.map(activity => ({
      activity_id: activity.activity_id || activity.id || activity.activityId,
      user_id: activity.user_id || activity.userId,
      title: activity.title,
      description: activity.description,
      activity_type: activity.activity_type || activity.type || activity.activityType,
      status: activity.status,
      priority: activity.priority,
      due_date: activity.due_date || activity.dueDate,
      completed_date: activity.completed_date || activity.completedDate,
      hospital_id: activity.hospital_id || activity.hospitalId,
      hospital_name: activity.hospital_name || activity.hospitalName,
      created_at: activity.created_at || activity.createdAt || new Date().toISOString(),
      updated_at: activity.updated_at || activity.updatedAt || new Date().toISOString(),
      last_sync_at: activity.last_sync_at || activity.lastSyncAt || new Date().toISOString()
    }));

    console.log(`🔄 SyncService: Converted to ${bigQueryActivities.length} BigQuery activities:`, bigQueryActivities.map(a => a.title));
    this.addToSyncQueue('update', 'activities', bigQueryActivities);
  }

  // Gap Plans sync
  async syncGapPlans(gapPlans: any[]): Promise<void> {
    const bigQueryGapPlans: BigQueryGapPlan[] = gapPlans.map(plan => ({
      gap_plan_id: plan.id || plan.gapPlanId,
      user_id: plan.userId,
      title: plan.title,
      description: plan.description,
      category: plan.category,
      priority: plan.priority,
      status: plan.status,
      rank: plan.rank,
      due_date: plan.dueDate,
      completed_date: plan.completedDate,
      action_items: plan.actionItems || [],
      responsible_party: plan.responsibleParty,
      notes: plan.notes,
      created_at: plan.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString()
    }));

    this.addToSyncQueue('update', 'gap_plans', bigQueryGapPlans);
  }

  // Milestones sync
  async syncMilestones(milestones: any[]): Promise<void> {
    const bigQueryMilestones: BigQueryMilestone[] = milestones.map(milestone => ({
      milestone_id: milestone.id || milestone.milestoneId,
      user_id: milestone.userId,
      title: milestone.title,
      description: milestone.description,
      category: milestone.category,
      status: milestone.status,
      due_date: milestone.dueDate,
      completed_date: milestone.completedDate,
      notes: milestone.notes,
      created_at: milestone.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString()
    }));

    this.addToSyncQueue('update', 'milestones', bigQueryMilestones);
  }

  // PRS Assessment sync
  async syncPRSAssessment(assessment: any): Promise<void> {
    const bigQueryAssessment: BigQueryPRSAssessment = {
      assessment_id: assessment.id || assessment.assessmentId,
      user_id: assessment.userId,
      hospital_id: assessment.hospitalId,
      hospital_name: assessment.hospitalName,
      assessment_date: assessment.assessmentDate || new Date().toISOString(),
      total_score: assessment.totalScore,
      max_score: assessment.maxScore,
      percentage_score: assessment.percentageScore,
      category_scores: assessment.categoryScores || {},
      responses: assessment.responses || {},
      created_at: assessment.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString()
    };

    this.addToSyncQueue('update', 'prs_assessments', bigQueryAssessment);
  }

  // Resources sync
  async syncResources(resources: any[]): Promise<void> {
    const bigQueryResources: BigQueryResource[] = resources.map(resource => ({
      resource_id: resource.id || resource.resourceId || resource.resource_id,
      user_id: resource.userId || resource.user_id,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      category: resource.category,
      tags: resource.tags || [],
      is_public: resource.isPublic || resource.is_public || false,
      created_at: resource.createdAt || resource.created_at || new Date().toISOString(),
      updated_at: resource.updatedAt || resource.updated_at || new Date().toISOString(),
      last_sync_at: resource.lastSyncAt || resource.last_sync_at || new Date().toISOString()
    }));

    this.addToSyncQueue('update', 'resources', bigQueryResources);
  }

  // Force sync all pending operations
  async forceSync(): Promise<void> {
    if (this.isOnline && this.bigqueryService) {
      await this.processPendingSync();
    }
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
      pendingCount: this.pendingSync.length,
      syncInProgress: this.syncInProgress,
      bigQueryEnabled: isBigQueryEnabled()
    };
  }

  // Load user data from BigQuery
  async loadUserData(userId: string): Promise<{
    userProfile?: BigQueryUserProfile;
    activities: BigQueryActivity[];
    gapPlans: BigQueryGapPlan[];
    milestones: BigQueryMilestone[];
    prsAssessments: BigQueryPRSAssessment[];
    resources: BigQueryResource[];
  }> {
    if (!this.bigqueryService) {
      return {
        activities: [],
        gapPlans: [],
        milestones: [],
        prsAssessments: [],
        resources: []
      };
    }

    try {
      const [userProfile, activities, gapPlans, milestones, prsAssessments, resources] = await Promise.all([
        this.bigqueryService.getUserProfile(userId),
        this.bigqueryService.getActivities(userId),
        this.bigqueryService.getGapPlans(userId),
        this.bigqueryService.getMilestones(userId),
        this.bigqueryService.getPRSAssessments(userId),
        this.bigqueryService.getResources(userId)
      ]);

      return {
        userProfile: userProfile || undefined,
        activities,
        gapPlans,
        milestones,
        prsAssessments,
        resources
      };
    } catch (error) {
      console.error('Failed to load user data from BigQuery:', error);
      return {
        activities: [],
        gapPlans: [],
        milestones: [],
        prsAssessments: [],
        resources: []
      };
    }
  }

  // Initialize sync service
  async initialize(): Promise<void> {
    this.loadPendingSyncFromLocalStorage();
    await this.initializeBigQuery();
    
    if (this.isOnline) {
      await this.processPendingSync();
    }
  }
}

// Create singleton instance
const syncService = new SyncService();

export default syncService;
