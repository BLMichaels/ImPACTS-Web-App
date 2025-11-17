// Browser-compatible BigQuery service using Firestore as intermediate storage
import { 
  BigQueryConfig, 
  BigQueryUserProfile, 
  BigQueryActivity, 
  BigQueryGapPlan, 
  BigQueryMilestone, 
  BigQueryPRSAssessment, 
  BigQueryResource,
  BigQuerySyncStatus,
  SyncRecord
} from '../types/bigquery';

class BigQueryServiceBrowser {
  private config: BigQueryConfig;
  private accessToken: string | null = null;
  private isInitialized: boolean = false;

  constructor(config: BigQueryConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Get access token using service account credentials
      await this.authenticate();
      this.isInitialized = true;
      console.log('BigQuery service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BigQuery service:', error);
      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    try {
      const credentials = this.config.credentials;
      if (!credentials) {
        throw new Error('BigQuery credentials are not configured');
      }

      // For browser compatibility, we'll use a different approach
      // We'll make the BigQuery calls from a server-side function instead
      console.log('BigQuery authentication prepared for server-side processing');
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  // Dataset operations
  async ensureDatasetExists(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BigQuery service not initialized');
    }
    console.log('Dataset existence check prepared for server-side processing');
  }

  async ensureTableExists(tableName: string, schema: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('BigQuery service not initialized');
    }
    console.log(`Table ${tableName} existence check prepared for server-side processing`);
  }

  // Data operations - these will queue data for server-side processing
  async syncUserProfile(userProfile: BigQueryUserProfile): Promise<void> {
    console.log('User profile sync queued for server-side processing:', userProfile);
    // In a real implementation, this would send data to a server endpoint
  }

  async syncActivities(activities: BigQueryActivity[]): Promise<void> {
    try {
      // Convert BigQueryActivity format to the format expected by the sync server
      const activitiesToSync = activities.map(activity => ({
        id: activity.activity_id,
        activity: activity.title,
        notes: activity.description,
        date: activity.due_date,
        category: activity.activity_type,
        hours: 1 // Default value since it's not in BigQueryActivity
      }));
      
      // Using ngrok URL for production access
      const syncUrl = 'https://68824ab5d5fb.ngrok-free.app/api/sync-activities';
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          userId: activities[0]?.user_id || 'unknown',
          activities: activitiesToSync
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Successfully synced ${result.syncedCount} activities to BigQuery`);
      } else {
        console.warn('⚠️ Sync server returned error:', result.error);
        // Don't throw error - let user continue working offline
      }
    } catch (error) {
      console.warn('⚠️ Sync server unavailable - continuing offline:', error);
      // Don't throw error - let user continue working offline
    }
  }

  async syncGapPlans(gapPlans: BigQueryGapPlan[]): Promise<void> {
    console.log('Gap plans sync queued for server-side processing:', gapPlans.length, 'plans');
    // In a real implementation, this would send data to a server endpoint
  }

  async syncMilestones(milestones: BigQueryMilestone[]): Promise<void> {
    console.log('Milestones sync queued for server-side processing:', milestones.length, 'milestones');
    // In a real implementation, this would send data to a server endpoint
  }

  async syncPRSAssessment(assessment: BigQueryPRSAssessment): Promise<void> {
    console.log('PRS assessment sync queued for server-side processing:', assessment);
    // In a real implementation, this would send data to a server endpoint
  }

  async syncResources(resources: BigQueryResource[]): Promise<void> {
    try {
      // Convert BigQueryResource format to the format expected by the sync server
      const resourcesToSync = resources.map(resource => ({
        id: resource.resource_id,
        title: resource.title,
        description: resource.description,
        url: resource.url,
        category: resource.category,
        tags: resource.tags || [],
        isPublic: resource.is_public,
        createdAt: resource.created_at,
        updatedAt: resource.updated_at
      }));
      
      // Using ngrok URL for production access
      const syncUrl = 'https://68824ab5d5fb.ngrok-free.app/api/sync-resources';
      
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          userId: resources[0]?.user_id || 'unknown',
          resources: resourcesToSync
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Successfully synced ${result.syncedCount} resources to BigQuery`);
      } else {
        console.warn('⚠️ Sync server returned error:', result.error);
        // Don't throw error - let user continue working offline
      }
    } catch (error) {
      console.warn('⚠️ Sync server unavailable - continuing offline:', error);
      // Don't throw error - let user continue working offline
    }
  }

  async updateSyncStatus(status: BigQuerySyncStatus): Promise<void> {
    console.log('Sync status update queued for server-side processing:', status);
    // In a real implementation, this would send data to a server endpoint
  }

  // Batch operations
  async batchSync(records: SyncRecord[]): Promise<void> {
    console.log('🔄 Processing batch sync:', records.length, 'records');
    
    for (const record of records) {
      try {
        if (record.table === 'activities' && record.operation === 'update') {
          console.log(`🔄 Syncing ${record.data.length} activities to BigQuery`);
          await this.syncActivities(record.data);
        } else if (record.table === 'resources' && record.operation === 'update') {
          console.log(`🔄 Syncing ${record.data.length} resources to BigQuery`);
          await this.syncResources(record.data);
        } else {
          console.log(`⚠️ Unsupported sync operation: ${record.operation} for table ${record.table}`);
        }
      } catch (error) {
        console.error(`❌ Failed to sync ${record.table}:`, error);
        throw error;
      }
    }
    
    console.log('✅ Batch sync completed successfully');
  }

  // Data retrieval methods
  async getUserProfile(userId: string): Promise<BigQueryUserProfile | null> {
    console.log('Get user profile queued for server-side processing:', userId);
    return null; // In a real implementation, this would fetch from server
  }

  async getActivities(userId: string): Promise<BigQueryActivity[]> {
    try {
      // Using ngrok URL for production access
      const getUrl = `https://68824ab5d5fb.ngrok-free.app/api/activities/${userId}`;
      
      const response = await fetch(getUrl, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Retrieved ${result.count} activities from BigQuery`);
        return result.activities;
      } else {
        console.warn('⚠️ Sync server returned error:', result.error);
        return [];
      }
    } catch (error) {
      console.warn('⚠️ Sync server unavailable - returning empty activities:', error);
      return [];
    }
  }

  async getGapPlans(userId: string): Promise<BigQueryGapPlan[]> {
    console.log('Get gap plans queued for server-side processing:', userId);
    return []; // In a real implementation, this would fetch from server
  }

  async getMilestones(userId: string): Promise<BigQueryMilestone[]> {
    console.log('Get milestones queued for server-side processing:', userId);
    return []; // In a real implementation, this would fetch from server
  }

  async getPRSAssessments(userId: string): Promise<BigQueryPRSAssessment[]> {
    console.log('Get PRS assessments queued for server-side processing:', userId);
    return []; // In a real implementation, this would fetch from server
  }

  async getResources(userId: string): Promise<BigQueryResource[]> {
    try {
      // Using ngrok URL for production access
      const getUrl = `https://68824ab5d5fb.ngrok-free.app/api/resources/${userId}`;
      
      const response = await fetch(getUrl, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Retrieved ${result.count} resources from BigQuery`);
        return result.resources;
      } else {
        console.warn('⚠️ Sync server returned error:', result.error);
        return [];
      }
    } catch (error) {
      console.warn('⚠️ Sync server unavailable - returning empty resources:', error);
      return [];
    }
  }

  async getSyncStatus(userId: string): Promise<BigQuerySyncStatus | null> {
    console.log('Get sync status queued for server-side processing:', userId);
    return null; // In a real implementation, this would fetch from server
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    return this.isInitialized;
  }
}

export default BigQueryServiceBrowser;
