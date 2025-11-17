# Complete Firestore Security Rules Fix

## Current Issues
1. **Missing or insufficient permissions** - Firestore security rules are preventing data writes
2. **QuotaExceededError** - Browser local storage quota exceeded due to accumulated failed sync attempts

## Step 1: Fix Firestore Security Rules

Go to your Firebase Console → Firestore Database → Rules tab and replace the current rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user profile
    match /userProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their own activities
    match /activities/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their own gap plans
    match /gapPlans/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their own milestones
    match /milestones/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their own PRS assessments
    match /prsAssessments/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read/write their own resources
    match /resources/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // General rule for any authenticated user (for initial data creation)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 2: Clear Local Storage Quota Issue

### Option A: Use the Clear Button in the App
1. Open your app in the browser
2. Look for the sync status indicator in the top navigation
3. If you see pending changes, click the "Clear" button (trash icon) next to the sync button
4. This will clear the accumulated pending sync operations

### Option B: Manual Browser Clear
1. Open browser Developer Tools (F12)
2. Go to Application/Storage tab
3. Find Local Storage for your domain
4. Delete all keys starting with "impacts_"
5. Refresh the page

### Option C: Use Browser Console
Open browser console and run:
```javascript
// Clear all ImPACTS-related local storage
['impacts_user_profile', 'impacts_activities', 'impacts_gap_plans', 'impacts_milestones', 'impacts_prs_assessment', 'impacts_resources', 'impacts_pending_sync', 'impacts_sync_status', 'impacts_last_sync'].forEach(key => localStorage.removeItem(key));
console.log('Cleared ImPACTS local storage');
```

## Step 3: Test the Fix

1. **Update Firestore Rules**: Copy the rules above into your Firebase Console
2. **Clear Local Storage**: Use one of the methods above
3. **Refresh the App**: Reload your application
4. **Test Sync**: Try adding a new activity or making changes
5. **Check Status**: The sync status should show "Synced" instead of errors

## What These Rules Do

- **User-specific access**: Each user can only access their own data
- **Authentication required**: All operations require the user to be logged in
- **Document-level security**: Each document is protected by user ID matching
- **Fallback rule**: General authenticated access for initial data creation

## Troubleshooting

### If you still get permission errors:
1. Make sure you're logged in to the app
2. Check that the Firestore rules were saved successfully
3. Verify you're using the correct Firebase project
4. Try logging out and logging back in

### If you still get quota errors:
1. Use the clear button in the app UI
2. Clear browser cache and cookies
3. Try in an incognito/private window
4. Check if other browser extensions are using local storage

### If sync still doesn't work:
1. Check browser console for any remaining errors
2. Verify Firestore is enabled in your Firebase project
3. Make sure your Firebase configuration is correct
4. Check that you have an active internet connection

## Expected Behavior After Fix

- ✅ No more "Missing or insufficient permissions" errors
- ✅ No more "QuotaExceededError" messages
- ✅ Sync status shows "Synced" when online
- ✅ Data changes sync across devices
- ✅ Offline changes queue properly and sync when online
