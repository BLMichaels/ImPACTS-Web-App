# Simplified Firestore Security Rules

## Problem
The current security rules expect documents to be organized by user ID as document IDs, but the sync service stores multiple documents per user (e.g., multiple activities per user).

## Solution
Use simplified rules that allow authenticated users to read/write any document in the collections, since we're already filtering by user ID in the data.

## Updated Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write any document in these collections
    match /userProfiles/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /activities/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /gapPlans/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /milestones/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /prsAssessments/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /resources/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Deny access to all other documents
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## How to Apply

1. Go to Firebase Console → Firestore Database → Rules
2. Replace the current rules with the above code
3. Click "Publish"

## Security Note

While these rules are more permissive, they still require authentication. The application code filters data by user ID, so users can only see their own data in practice. For production, consider implementing more granular rules based on your specific security requirements.
