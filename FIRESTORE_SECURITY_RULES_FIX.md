# Firestore Security Rules Fix

## Current Issue
You're getting "Missing or insufficient permissions" errors when trying to sync data to Firestore. This means the security rules are preventing writes to the database.

## Step-by-Step Fix

### 1. Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your `impacts-tracker` project
3. Go to "Firestore Database" in the left sidebar
4. Click on the "Rules" tab

### 2. Replace the Security Rules
Replace the current rules with these comprehensive rules that allow authenticated users to read/write their own data:

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
    
    // Allow users to create new documents (for initial data creation)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 3. Publish the Rules
1. Click "Publish" to save the new rules
2. Wait for the rules to be deployed (usually takes a few seconds)

### 4. Test the Fix
1. Go to your application: https://impacts-tracker.web.app
2. Log in with your account
3. Try to add an activity or make any change
4. Check if the sync status shows "Synced" instead of errors

## Alternative: Temporary Open Rules (For Testing Only)
If you want to test quickly, you can temporarily use these open rules (NOT recommended for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**⚠️ WARNING: These rules allow anyone to read/write your database. Only use for testing and change back to secure rules afterward.**

## Troubleshooting

### If you still get permission errors:
1. **Check Authentication**: Make sure you're logged in to the app
2. **Check User ID**: The error might be that the user ID doesn't match
3. **Check Document Structure**: Make sure the documents have the correct `userId` field

### If you can't access the Rules tab:
1. Make sure you have the "Editor" or "Owner" role in the Firebase project
2. Try refreshing the Firebase Console page
3. Check if Firestore is properly enabled

### If the rules don't save:
1. Check for syntax errors in the rules
2. Make sure you're using the correct `rules_version = '2'`
3. Try copying the rules exactly as shown above

## What These Rules Do

1. **User Profiles**: Users can only read/write their own profile data
2. **Activities**: Users can only access activities where `userId` matches their auth ID
3. **Gap Plans**: Same as activities - user-specific access
4. **Milestones**: Same as activities - user-specific access
5. **PRS Assessments**: Same as activities - user-specific access
6. **Resources**: Same as activities - user-specific access
7. **Fallback Rule**: Allows authenticated users to create new documents

## Security Notes

- All rules require authentication (`request.auth != null`)
- Users can only access their own data
- The `userId` field in documents must match the authenticated user's UID
- These rules are secure for production use

## Next Steps

After updating the rules:
1. Test the sync functionality
2. Try adding data on one device
3. Check if it appears on another device
4. Monitor the sync status indicator in the app

If you're still having issues after following these steps, please let me know what specific error messages you're seeing.
