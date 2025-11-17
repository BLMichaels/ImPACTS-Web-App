// BigQuery configuration
import { BigQueryConfig } from '../types/bigquery';

// Environment variables for BigQuery configuration
const BIGQUERY_CONFIG: BigQueryConfig = {
  projectId: process.env.REACT_APP_BIGQUERY_PROJECT_ID || '',
  datasetId: process.env.REACT_APP_BIGQUERY_DATASET_ID || 'impacts_data',
  location: process.env.REACT_APP_BIGQUERY_LOCATION || 'US',
  credentials: process.env.REACT_APP_BIGQUERY_CREDENTIALS ? 
    JSON.parse(process.env.REACT_APP_BIGQUERY_CREDENTIALS) : 
    undefined
};

// Validation function
export const validateBigQueryConfig = (): boolean => {
  if (!BIGQUERY_CONFIG.projectId) {
    console.error('BigQuery project ID is not configured');
    return false;
  }
  
  if (!BIGQUERY_CONFIG.credentials) {
    console.error('BigQuery credentials are not configured');
    return false;
  }
  
  return true;
};

// Get configuration
export const getBigQueryConfig = (): BigQueryConfig => {
  return BIGQUERY_CONFIG;
};

// Check if BigQuery is enabled
export const isBigQueryEnabled = (): boolean => {
  return validateBigQueryConfig();
};

export default BIGQUERY_CONFIG;
