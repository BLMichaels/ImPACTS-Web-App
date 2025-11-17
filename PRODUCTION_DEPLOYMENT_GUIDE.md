# 🚀 Production Deployment Guide for ImPACTS Sync Server

## ✅ **Current Status**

Your ImPACTS application is now deployed to production at [https://impacts-tracker.web.app/](https://impacts-tracker.web.app/) with:

- ✅ **Production-ready client** with graceful fallback for sync server unavailability
- ✅ **BigQuery integration** ready for when sync server is deployed
- ✅ **Conflict resolution** logic implemented
- ✅ **Offline support** - users can continue working even if sync server is down

## 🔧 **Sync Server Deployment Options**

### **Option 1: Google Cloud Run (Recommended)**

1. **Install Google Cloud CLI:**
   ```bash
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   ```

2. **Deploy using the provided script:**
   ```bash
   ./deploy-sync-server.sh
   ```

3. **Update client endpoints** (already done):
   - Sync: `https://sync-server-[hash]-uc.a.run.app/api/sync-activities`
   - Get: `https://sync-server-[hash]-uc.a.run.app/api/activities/:userId`

### **Option 2: Firebase Functions (Alternative)**

1. **Upgrade Firebase Functions:**
   ```bash
   cd functions
   npm install --save firebase-functions@latest
   ```

2. **Deploy functions:**
   ```bash
   firebase deploy --only functions
   ```

3. **Endpoints will be:**
   - Sync: `https://us-central1-impacts-tracker.cloudfunctions.net/syncActivities`
   - Get: `https://us-central1-impacts-tracker.cloudfunctions.net/getActivities`

### **Option 3: Vercel (Easiest)**

1. **Create `vercel.json`:**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "sync-server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/sync-server.js"
       }
     ]
   }
   ```

2. **Deploy:**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

## 📊 **Current Data Status**

Your BigQuery data is ready and accessible:

- **Table**: `impacts-tracker.impacts_data.activities`
- **Current records**: 12+ activities
- **Schema**: Complete with timestamps for conflict resolution
- **Reports**: Ready for SQL queries (see `bigquery-report-examples.sql`)

## 🔄 **How It Works Now**

1. **Production Site**: [https://impacts-tracker.web.app/](https://impacts-tracker.web.app/)
2. **Data Storage**: Google BigQuery (when sync server is deployed)
3. **Fallback**: Local storage (works offline)
4. **Conflict Resolution**: Timestamp-based "last modified wins"

## 🧪 **Testing Production**

1. **Visit**: [https://impacts-tracker.web.app/](https://impacts-tracker.web.app/)
2. **Login**: Use your existing account
3. **Add activities**: They'll be stored locally
4. **Check console**: You'll see sync attempts (will fail gracefully until server is deployed)

## 📈 **Next Steps**

1. **Deploy sync server** using one of the options above
2. **Test data synchronization** on production
3. **Verify BigQuery reports** are working
4. **Monitor sync performance** and adjust as needed

## 🆘 **Troubleshooting**

- **Sync not working**: Check browser console for error messages
- **Data not appearing**: Verify BigQuery credentials and table schema
- **Deployment issues**: Try different deployment platform (Vercel is often easiest)

Your application is production-ready and will work seamlessly once the sync server is deployed!





