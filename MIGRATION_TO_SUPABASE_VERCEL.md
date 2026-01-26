# Migration to Supabase and Vercel

This document outlines the migration from Firebase/BigQuery to Supabase and Vercel.

## Changes Made

### 1. Authentication
- **Removed**: Firebase Authentication
- **Added**: Supabase Authentication
- **Files Updated**:
  - `client/src/supabase.ts` - New Supabase client configuration
  - `client/src/context/AuthContext.tsx` - Updated to use Supabase Auth
  - `client/src/pages/RegisterPage.tsx` - Updated to use Supabase Auth
  - `client/src/firebase.ts` - **DELETED**

### 2. Database & Sync
- **Removed**: BigQuery integration and sync services
- **Removed**: Firebase Firestore (was imported but not actively used)
- **Files Removed**:
  - `client/src/services/bigqueryService.ts`
  - `client/src/services/bigqueryServiceBrowser.ts`
  - `client/src/config/bigquery.ts`
  - `client/src/types/bigquery.ts`
- **Files Updated**:
  - `client/src/services/syncService.ts` - Simplified to local storage only
  - `client/src/context/SyncContext.tsx` - Removed BigQuery dependencies
  - `client/src/hooks/useDataSync.ts` - Updated to remove BigQuery references

### 3. Dependencies
- **Removed**:
  - `firebase` (^12.4.0)
  - `@google-cloud/bigquery` (^8.1.1)
  - `buffer`, `crypto-browserify`, `process`, `stream-browserify`, `util` (BigQuery polyfills)
- **Added**:
  - `@supabase/supabase-js` (^2.39.0)

### 4. Deployment Configuration
- **Removed**: Firebase hosting configuration files
  - `firebase.json`
  - `client/firebase.json`
- **Updated**: Vercel configuration
  - `vercel.json` - Updated for client app deployment
  - `client/vercel.json` - Enhanced with build configuration and security headers

## Next Steps

### 1. Set Up Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Get your project URL and anon key from Settings > API
3. Set up authentication:
   - Go to Authentication > Settings
   - Enable Email provider
   - Configure email templates if needed

### 2. Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. You'll see:
   - **Project URL** - This is your `REACT_APP_SUPABASE_URL`
   - **anon public** key - This is your `REACT_APP_SUPABASE_ANON_KEY`

### 3. Configure Environment Variables Locally

Create a `.env` file in the `client` directory:

**File location:** `/client/.env`

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** 
- The `.env` file should be in the `client` folder (same level as `package.json`)
- Do NOT commit this file to git (it's already in `.gitignore`)
- Replace the values with your actual Supabase project URL and key

### 4. Configure Environment Variables in Vercel

When deploying to Vercel, you also need to add these environment variables:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add both variables:
   - `REACT_APP_SUPABASE_URL` = your Supabase project URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your Supabase anon key
4. Make sure to select all environments (Production, Preview, Development)

### 3. Set Up Supabase Database (Optional)

If you want to store user data in Supabase instead of just localStorage:

1. Create tables in Supabase SQL Editor:
   - `user_profiles`
   - `activities`
   - `gap_plans`
   - `milestones`
   - `prs_assessments`
   - `resources`

2. Set up Row Level Security (RLS) policies to ensure users can only access their own data

3. Update the sync service to use Supabase database instead of just localStorage

### 4. Deploy to Vercel

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Deploy from the project root:
   ```bash
   vercel
   ```

   Or connect your GitHub repository to Vercel for automatic deployments.

3. Make sure to set the environment variables in Vercel dashboard:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`

### 5. Update Code References (If Needed)

The codebase has been updated to use `currentUser.uid` which is now mapped to Supabase's `currentUser.id` for backward compatibility. All existing code should work without changes.

However, if you see any references to:
- Firebase Firestore (`db`)
- BigQuery services
- Firebase hosting

These should be removed or updated as needed.

## Notes

- **Local Storage**: The app currently uses localStorage for data persistence. Consider migrating to Supabase database for better data management.
- **Authentication**: Supabase Auth works similarly to Firebase Auth, but there may be slight differences in behavior (e.g., email confirmation).
- **Sync Service**: The sync service is now simplified and only manages local storage. If you need cloud sync, implement it using Supabase database.

## Testing

After migration, test the following:
1. User registration
2. User login
3. User logout
4. Protected routes
5. Data persistence in localStorage

## Support

For issues or questions:
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs

