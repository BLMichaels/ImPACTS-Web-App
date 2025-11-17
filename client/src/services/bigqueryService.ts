// BigQuery service for data synchronization
import { BigQuery } from '@google-cloud/bigquery';
import { 
  BigQueryConfig, 
  BigQueryUserProfile, 
  BigQueryActivity, 
  BigQueryGapPlan, 
  BigQueryMilestone, 
  BigQueryPRSAssessment, 
  BigQueryResource,
  BigQuerySyncStatus,
  BIGQUERY_SCHEMAS,
  SyncRecord
} from '../types/bigquery';

class BigQueryService {
  private bigquery: BigQuery;
  private config: BigQueryConfig;
  private dataset: any;
  private isInitialized: boolean = false;

  constructor(config: BigQueryConfig) {
    this.config = config;
    this.bigquery = new BigQuery({
      projectId: config.projectId,
      credentials: config.credentials,
      location: config.location || 'US'
    });
  }

  async initialize(): Promise<void> {
    try {
      // Get or create dataset
      this.dataset = this.bigquery.dataset(this.config.datasetId);
      const [exists] = await this.dataset.exists();
      
      if (!exists) {
        await this.dataset.create({
          location: this.config.location || 'US',
          description: 'ImPACTS application data'
        });
        console.log(`Created dataset ${this.config.datasetId}`);
      }

      // Create tables if they don't exist
      await this.createTables();
      this.isInitialized = true;
      console.log('BigQuery service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BigQuery service:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const tableNames = Object.keys(BIGQUERY_SCHEMAS);
    
    for (const tableName of tableNames) {
      try {
        const table = this.dataset.table(tableName);
        const [exists] = await table.exists();
        
        if (!exists) {
          await table.create({
            schema: BIGQUERY_SCHEMAS[tableName as keyof typeof BIGQUERY_SCHEMAS].fields,
            description: `ImPACTS ${tableName} data`
          });
          console.log(`Created table ${tableName}`);
        }
      } catch (error) {
        console.error(`Failed to create table ${tableName}:`, error);
      }
    }
  }

  // User Profile operations
  async syncUserProfile(userProfile: BigQueryUserProfile): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('user_profiles');
    const now = new Date().toISOString();
    
    const data = {
      ...userProfile,
      updated_at: now,
      last_sync_at: now
    };

    try {
      await table.insert([data]);
      console.log('User profile synced to BigQuery');
    } catch (error) {
      console.error('Failed to sync user profile:', error);
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<BigQueryUserProfile | null> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.user_profiles\`
      WHERE user_id = @userId
      ORDER BY last_sync_at DESC
      LIMIT 1
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId }
      });
      
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  // Activities operations
  async syncActivities(activities: BigQueryActivity[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('activities');
    const now = new Date().toISOString();
    
    const data = activities.map(activity => ({
      ...activity,
      updated_at: now,
      last_sync_at: now
    }));

    try {
      await table.insert(data);
      console.log(`${activities.length} activities synced to BigQuery`);
    } catch (error) {
      console.error('Failed to sync activities:', error);
      throw error;
    }
  }

  async getActivities(userId: string): Promise<BigQueryActivity[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.activities\`
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId }
      });
      
      return rows;
    } catch (error) {
      console.error('Failed to get activities:', error);
      return [];
    }
  }

  // Gap Plans operations
  async syncGapPlans(gapPlans: BigQueryGapPlan[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('gap_plans');
    const now = new Date().toISOString();
    
    const data = gapPlans.map(plan => ({
      ...plan,
      updated_at: now,
      last_sync_at: now
    }));

    try {
      await table.insert(data);
      console.log(`${gapPlans.length} gap plans synced to BigQuery`);
    } catch (error) {
      console.error('Failed to sync gap plans:', error);
      throw error;
    }
  }

  async getGapPlans(userId: string): Promise<BigQueryGapPlan[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.gap_plans\`
      WHERE user_id = @userId
      ORDER BY rank ASC, created_at DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId }
      });
      
      return rows;
    } catch (error) {
      console.error('Failed to get gap plans:', error);
      return [];
    }
  }

  // Milestones operations
  async syncMilestones(milestones: BigQueryMilestone[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('milestones');
    const now = new Date().toISOString();
    
    const data = milestones.map(milestone => ({
      ...milestone,
      updated_at: now,
      last_sync_at: now
    }));

    try {
      await table.insert(data);
      console.log(`${milestones.length} milestones synced to BigQuery`);
    } catch (error) {
      console.error('Failed to sync milestones:', error);
      throw error;
    }
  }

  async getMilestones(userId: string): Promise<BigQueryMilestone[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.milestones\`
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId }
      });
      
      return rows;
    } catch (error) {
      console.error('Failed to get milestones:', error);
      return [];
    }
  }

  // PRS Assessment operations
  async syncPRSAssessment(assessment: BigQueryPRSAssessment): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('prs_assessments');
    const now = new Date().toISOString();
    
    const data = {
      ...assessment,
      updated_at: now,
      last_sync_at: now
    };

    try {
      await table.insert([data]);
      console.log('PRS assessment synced to BigQuery');
    } catch (error) {
      console.error('Failed to sync PRS assessment:', error);
      throw error;
    }
  }

  async getPRSAssessments(userId: string): Promise<BigQueryPRSAssessment[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.prs_assessments\`
      WHERE user_id = @userId
      ORDER BY assessment_date DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId }
      });
      
      return rows;
    } catch (error) {
      console.error('Failed to get PRS assessments:', error);
      return [];
    }
  }

  // Resources operations
  async syncResources(resources: BigQueryResource[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('resources');
    const now = new Date().toISOString();
    
    const data = resources.map(resource => ({
      ...resource,
      updated_at: now,
      last_sync_at: now
    }));

    try {
      await table.insert(data);
      console.log(`${resources.length} resources synced to BigQuery`);
    } catch (error) {
      console.error('Failed to sync resources:', error);
      throw error;
    }
  }

  async getResources(userId: string): Promise<BigQueryResource[]> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT *
      FROM \`${this.config.projectId}.${this.config.datasetId}.resources\`
      WHERE user_id = @userId
      ORDER BY created_at DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId }
      });
      
      return rows;
    } catch (error) {
      console.error('Failed to get resources:', error);
      return [];
    }
  }

  // Sync status tracking
  async updateSyncStatus(status: BigQuerySyncStatus): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = this.dataset.table('sync_status');
    
    try {
      await table.insert([status]);
      console.log('Sync status updated');
    } catch (error) {
      console.error('Failed to update sync status:', error);
      throw error;
    }
  }

  async getLastSyncTime(userId: string, tableName: string): Promise<string | null> {
    if (!this.isInitialized) await this.initialize();
    
    const query = `
      SELECT last_sync_timestamp
      FROM \`${this.config.projectId}.${this.config.datasetId}.sync_status\`
      WHERE user_id = @userId AND table_name = @tableName
      ORDER BY last_sync_timestamp DESC
      LIMIT 1
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        params: { userId, tableName }
      });
      
      return rows.length > 0 ? rows[0].last_sync_timestamp : null;
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return null;
    }
  }

  // Batch operations for offline sync
  async batchSync(records: SyncRecord[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const groupedRecords = records.reduce((acc, record) => {
      if (!acc[record.table]) {
        acc[record.table] = [];
      }
      acc[record.table].push(record);
      return acc;
    }, {} as Record<string, SyncRecord[]>);

    for (const [tableName, tableRecords] of Object.entries(groupedRecords)) {
      try {
        const table = this.dataset.table(tableName);
        const data = tableRecords.map(record => ({
          ...record.data,
          last_sync_at: new Date().toISOString()
        }));

        await table.insert(data);
        console.log(`Batch synced ${data.length} records to ${tableName}`);
      } catch (error) {
        console.error(`Failed to batch sync ${tableName}:`, error);
      }
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const query = 'SELECT 1 as test';
      await this.bigquery.query(query);
      return true;
    } catch (error) {
      console.error('BigQuery health check failed:', error);
      return false;
    }
  }
}

export default BigQueryService;
