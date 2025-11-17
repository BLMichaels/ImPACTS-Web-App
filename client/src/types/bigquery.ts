// BigQuery data models and schemas for ImPACTS application

export interface BigQueryUserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  tier: 'PECC' | 'PRISM';
  department?: string;
  hospital_name?: string;
  hospital_type?: string;
  hospital_address?: string;
  hospital_city?: string;
  hospital_state?: string;
  hospital_zip?: string;
  hospital_phone?: string;
  emergency_department?: string;
  pediatric_volume?: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export interface BigQueryActivity {
  activity_id: string;
  user_id: string;
  title: string;
  description?: string;
  activity_type: 'assessment' | 'training' | 'meeting' | 'documentation' | 'other';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  completed_date?: string;
  hospital_id?: string;
  hospital_name?: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export interface BigQueryGapPlan {
  gap_plan_id: string;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled';
  rank: number;
  due_date?: string;
  completed_date?: string;
  action_items: string[];
  responsible_party?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export interface BigQueryMilestone {
  milestone_id: string;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  status: 'not_started' | 'in_progress' | 'completed';
  due_date?: string;
  completed_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export interface BigQueryPRSAssessment {
  assessment_id: string;
  user_id: string;
  hospital_id?: string;
  hospital_name?: string;
  assessment_date: string;
  total_score: number;
  max_score: number;
  percentage_score: number;
  category_scores: {
    [category: string]: number;
  };
  responses: {
    [question_id: string]: {
      score: number;
      max_score: number;
      notes?: string;
    };
  };
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export interface BigQueryResource {
  resource_id: string;
  user_id: string;
  title: string;
  description?: string;
  url: string;
  category: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
  last_sync_at: string;
}

export interface BigQuerySyncStatus {
  user_id: string;
  table_name: string;
  last_sync_timestamp: string;
  sync_status: 'success' | 'error' | 'pending';
  error_message?: string;
  records_synced: number;
}

// BigQuery table schemas
export const BIGQUERY_SCHEMAS = {
  user_profiles: {
    fields: [
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'email', type: 'STRING', mode: 'REQUIRED' },
      { name: 'first_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'last_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'phone', type: 'STRING', mode: 'NULLABLE' },
      { name: 'tier', type: 'STRING', mode: 'REQUIRED' },
      { name: 'department', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_type', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_address', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_city', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_state', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_zip', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_phone', type: 'STRING', mode: 'NULLABLE' },
      { name: 'emergency_department', type: 'STRING', mode: 'NULLABLE' },
      { name: 'pediatric_volume', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]
  },
  activities: {
    fields: [
      { name: 'activity_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'activity_type', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'priority', type: 'STRING', mode: 'REQUIRED' },
      { name: 'due_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'completed_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'hospital_id', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]
  },
  gap_plans: {
    fields: [
      { name: 'gap_plan_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'category', type: 'STRING', mode: 'REQUIRED' },
      { name: 'priority', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'rank', type: 'INTEGER', mode: 'REQUIRED' },
      { name: 'due_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'completed_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'action_items', type: 'STRING', mode: 'REPEATED' },
      { name: 'responsible_party', type: 'STRING', mode: 'NULLABLE' },
      { name: 'notes', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]
  },
  milestones: {
    fields: [
      { name: 'milestone_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'category', type: 'STRING', mode: 'REQUIRED' },
      { name: 'status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'due_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'completed_date', type: 'TIMESTAMP', mode: 'NULLABLE' },
      { name: 'notes', type: 'STRING', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]
  },
  prs_assessments: {
    fields: [
      { name: 'assessment_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'hospital_id', type: 'STRING', mode: 'NULLABLE' },
      { name: 'hospital_name', type: 'STRING', mode: 'NULLABLE' },
      { name: 'assessment_date', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'total_score', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'max_score', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'percentage_score', type: 'FLOAT', mode: 'REQUIRED' },
      { name: 'category_scores', type: 'JSON', mode: 'NULLABLE' },
      { name: 'responses', type: 'JSON', mode: 'NULLABLE' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]
  },
  resources: {
    fields: [
      { name: 'resource_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING', mode: 'REQUIRED' },
      { name: 'description', type: 'STRING', mode: 'NULLABLE' },
      { name: 'url', type: 'STRING', mode: 'REQUIRED' },
      { name: 'category', type: 'STRING', mode: 'REQUIRED' },
      { name: 'tags', type: 'STRING', mode: 'REPEATED' },
      { name: 'is_public', type: 'BOOLEAN', mode: 'REQUIRED' },
      { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'updated_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'last_sync_at', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ]
  },
  sync_status: {
    fields: [
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'table_name', type: 'STRING', mode: 'REQUIRED' },
      { name: 'last_sync_timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'sync_status', type: 'STRING', mode: 'REQUIRED' },
      { name: 'error_message', type: 'STRING', mode: 'NULLABLE' },
      { name: 'records_synced', type: 'INTEGER', mode: 'REQUIRED' }
    ]
  }
};

// Configuration for BigQuery
export interface BigQueryConfig {
  projectId: string;
  datasetId: string;
  location?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
}

// Sync operation types
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncRecord {
  operation: SyncOperation;
  table: string;
  data: any;
  timestamp: string;
  id: string;
}
