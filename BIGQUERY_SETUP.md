# Cross-Device Data Synchronization Setup Guide

This guide will help you set up cross-device data synchronization for your ImPACTS application using Firebase Firestore.

## Prerequisites

- Firebase project (already set up)
- Node.js and npm installed

## Step 1: Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your ImPACTS project
3. Go to "Firestore Database" in the left sidebar
4. Click "Create database"
5. Choose "Start in test mode" (for development) or "Start in production mode" (for production)
6. Select a location for your database (choose the closest to your users)
7. Click "Done"

## Step 2: Configure Firestore Security Rules

1. In the Firestore Database section, go to "Rules" tab
2. Replace the default rules with the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles - users can only access their own data
    match /userProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Activities - users can only access their own data
    match /activities/{activityId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Gap plans - users can only access their own data
    match /gapPlans/{gapPlanId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Milestones - users can only access their own data
    match /milestones/{milestoneId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // PRS assessments - users can only access their own data
    match /prsAssessments/{assessmentId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Resources - users can only access their own data
    match /resources/{resourceId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

3. Click "Publish"

## Step 3: Test the Integration

1. The integration is already configured and ready to use
2. No additional environment variables are needed
3. The sync status indicator will appear in the navigation bar

## Features Enabled

Once configured, your application will have:

- **Cross-device synchronization**: Data syncs across all your devices
- **Offline support**: Changes are queued when offline and sync when online
- **Real-time sync status**: Visual indicator in the navigation bar
- **Automatic backup**: All data is backed up to Firestore
- **Data consistency**: Same data everywhere you log in

## Troubleshooting

### Common Issues

1. **"Permission denied" errors**
   - Check that Firestore security rules are properly configured
   - Ensure the user is authenticated

2. **Sync status shows "Offline"**
   - Check your internet connection
   - Verify Firestore is enabled in your Firebase project

3. **Data not syncing**
   - Check the browser console for error messages
   - Verify Firestore security rules allow the operation

### Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Firebase project settings
3. Ensure Firestore is enabled and properly configured
4. Check that security rules are correctly set

## Security Notes

- Firestore security rules ensure users can only access their own data
- All data is encrypted in transit and at rest
- Authentication is required for all data access
- Regular security rule reviews are recommended

## Data Collections

The application uses the following Firestore collections:
- `userProfiles`: User account information
- `activities`: User activities and tasks
- `gapPlans`: Gap reduction plans
- `milestones`: Project milestones
- `prsAssessments`: PRS assessment results
- `resources`: User resources and tools

Each document includes timestamps for creation, updates, and last sync for data integrity.
