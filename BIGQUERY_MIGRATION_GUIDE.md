# BigQuery Migration Guide for ImPACTS

This guide will help you complete the migration from Firestore to BigQuery for your ImPACTS application.

## Overview

The migration is designed to:
- Replace Firestore with BigQuery for data storage
- Maintain Firebase Authentication for user management
- Provide offline-first data synchronization
- Enable advanced analytics and reporting capabilities

## Prerequisites

1. **Google Cloud Project** with BigQuery API enabled
2. **Service Account** with BigQuery permissions
3. **Firebase Project** (for authentication only)

## Step 1: Set Up BigQuery

### 1.1 Enable BigQuery API
```bash
# Enable BigQuery API in your Google Cloud project
gcloud services enable bigquery.googleapis.com
```

### 1.2 Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin > Service Accounts
3. Click "Create Service Account"
4. Name: `impacts-bigquery-service`
5. Grant roles:
   - BigQuery Data Editor
   - BigQuery Job User
   - BigQuery Data Viewer

### 1.3 Generate Service Account Key
1. Click on the created service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Choose JSON format
5. Download and save as `bigquery-service-account.json`

## Step 2: Environment Configuration

Create a `.env` file in your project root with the following variables:

```env
# Firebase Configuration (for authentication only)
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

# BigQuery Configuration
REACT_APP_BIGQUERY_PROJECT_ID=your_bigquery_project_id
REACT_APP_BIGQUERY_DATASET_ID=impacts_data
REACT_APP_BIGQUERY_LOCATION=US
REACT_APP_BIGQUERY_CREDENTIALS={"client_email":"impacts-bigquery-service@impacts-tracker.iam.gserviceaccount.com","private_key":"your_private_key"}

# Optional: Development/Production flags
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG_MODE=true
```

## Step 3: Update Firebase Configuration

The Firebase configuration has been updated to remove Firestore dependencies. Only authentication is used from Firebase.

## Step 4: Data Migration

### 4.1 Export Existing Data (if any)
If you have existing Firestore data, export it first:
```bash
# Export Firestore data
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d-%H%M%S)
```

### 4.2 BigQuery Tables
The following tables will be automatically created:
- `user_profiles` - User account information
- `activities` - User activities and tasks
- `gap_plans` - Gap reduction plans
- `milestones` - Project milestones
- `prs_assessments` - PRS assessment results
- `resources` - User resources and tools
- `sync_status` - Synchronization status tracking

## Step 5: Testing the Migration

### 5.1 Start the Application
```bash
cd client
npm install
npm start
```

### 5.2 Verify BigQuery Connection
1. Open browser developer tools
2. Check console for "BigQuery service initialized successfully"
3. Verify no Firestore-related errors

### 5.3 Test Data Operations
1. Create a new user account
2. Add some activities
3. Check BigQuery console to verify data is being written

## Step 6: Cleanup

### 6.1 Remove Firestore Dependencies
The following files can be removed after successful migration:
- `client/src/services/firestoreSyncService.ts`
- `firestore.rules`
- `FIRESTORE_SECURITY_RULES_*.md`

### 6.2 Update Package Dependencies
Remove Firestore-related packages:
```bash
npm uninstall firebase/firestore
```

## Architecture Benefits

### BigQuery Advantages
1. **Analytics**: Built-in analytics and reporting capabilities
2. **Scalability**: Handles large datasets efficiently
3. **SQL Interface**: Familiar SQL queries for data analysis
4. **Cost Efficiency**: Pay-per-use pricing model
5. **Integration**: Easy integration with other Google Cloud services

### Offline-First Design
- Data is queued locally when offline
- Automatic sync when connection is restored
- Conflict resolution for concurrent edits
- Data integrity maintained across devices

## Troubleshooting

### Common Issues

1. **"BigQuery credentials are not configured"**
   - Check environment variables are set correctly
   - Verify service account key format

2. **"Permission denied" errors**
   - Ensure service account has proper BigQuery roles
   - Check project ID is correct

3. **"Dataset not found"**
   - Dataset will be created automatically on first use
   - Check project ID and location settings

### Debug Mode
Set `REACT_APP_DEBUG_MODE=true` to enable detailed logging.

## Security Considerations

1. **Service Account Key**: Keep the JSON key file secure
2. **Environment Variables**: Never commit `.env` files to version control
3. **Row-Level Security**: Consider implementing for multi-tenant scenarios
4. **Data Encryption**: BigQuery encrypts data at rest and in transit

## Performance Optimization

1. **Batch Operations**: Use batch sync for multiple records
2. **Query Optimization**: Use appropriate WHERE clauses
3. **Indexing**: BigQuery automatically optimizes queries
4. **Caching**: Implement local caching for frequently accessed data

## Monitoring and Maintenance

1. **BigQuery Console**: Monitor usage and costs
2. **Error Logging**: Check browser console for sync errors
3. **Data Validation**: Regular checks for data integrity
4. **Backup Strategy**: Consider regular data exports

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify BigQuery configuration
3. Review this migration guide
4. Check BigQuery documentation for advanced features





