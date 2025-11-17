# 🚀 Quick Deployment Solution for ImPACTS Sync Server

## 🎯 **The Problem**
Your production site at [https://impacts-tracker.web.app/](https://impacts-tracker.web.app/) can't access your BigQuery data because the sync server isn't deployed yet.

## ✅ **Quick Solution: Deploy to Render (Free)**

### **Step 1: Create Render Account**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your ImPACTS repository

### **Step 2: Deploy Sync Server**
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Use these settings:
   - **Name**: `impacts-sync-server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node simple-sync-server.js`
   - **Plan**: Free

### **Step 3: Add Environment Variables**
In Render dashboard, add these environment variables:
- `NODE_ENV`: `production`
- `REACT_APP_BIGQUERY_PROJECT_ID`: `impacts-tracker`

### **Step 4: Upload Credentials File**
1. In Render dashboard, go to "Environment"
2. Upload your `peccactivitylog-c17bfeb5047c.json` file
3. Or add the credentials as environment variables

### **Step 5: Update Client URLs**
Once deployed, Render will give you a URL like `https://impacts-sync-server.onrender.com`

Update these files:
- `client/src/services/bigqueryServiceBrowser.ts`
- Replace `https://impacts-sync-server.vercel.app` with your Render URL

### **Step 6: Redeploy Client**
```bash
cd client
npm run build
firebase deploy --only hosting
```

## 🔄 **Alternative: Use Your Local Server Temporarily**

If you want to test immediately, you can temporarily expose your local server:

### **Option A: ngrok (Easiest)**
```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3001
```

This will give you a public URL like `https://abc123.ngrok.io`

### **Option B: Update Client to Use ngrok URL**
Update `client/src/services/bigqueryServiceBrowser.ts`:
```javascript
const syncUrl = 'https://your-ngrok-url.ngrok.io/api/sync-activities';
const getUrl = `https://your-ngrok-url.ngrok.io/api/activities/${userId}`;
```

## 📊 **Current Status**
- ✅ **Local sync server**: Working perfectly with BigQuery (12 activities)
- ✅ **BigQuery data**: Ready and accessible
- ✅ **Client**: Deployed to production
- ⚠️ **Sync server**: Needs deployment to cloud

## 🎯 **Expected Result**
Once deployed, your production site will:
1. ✅ Load activities from BigQuery instantly
2. ✅ Sync new activities in real-time
3. ✅ Work across all devices
4. ✅ Maintain conflict resolution

## 🆘 **Need Help?**
If you get stuck, the quickest solution is:
1. Use ngrok to expose your local server
2. Update the client URLs
3. Redeploy the client
4. Test on production

Your data is safe in BigQuery and ready to be accessed!





