# Permanent Deployment Guide - ImPACTS Sync Server

## Deploy to Render (Recommended)

Render is a reliable, permanent hosting platform that will keep your sync server running 24/7.

### Step 1: Create Render Account
1. Go to [https://render.com](https://render.com)
2. Sign up for a free account
3. Connect your GitHub account (recommended)

### Step 2: Deploy Your Sync Server

#### Option A: Deploy from GitHub (Recommended)
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add sync server for permanent deployment"
   git push origin main
   ```

2. In Render dashboard:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your ImPACTS repository
   - Configure:
     - **Name**: `impacts-sync-server`
     - **Environment**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `node sync-server.js`
     - **Plan**: Free

#### Option B: Deploy from Files
1. In Render dashboard:
   - Click "New +" → "Web Service"
   - Choose "Build and deploy from a Git repository"
   - Upload your project files

### Step 3: Set Environment Variables
In Render dashboard, go to your service → Environment tab:

1. **REACT_APP_BIGQUERY_PROJECT_ID**: `impacts-tracker`
2. **REACT_APP_BIGQUERY_CREDENTIALS**: Your full BigQuery service account JSON (as a single line)

### Step 4: Get Your Permanent URL
After deployment, Render will give you a URL like:
`https://impacts-sync-server-abc123.onrender.com`

### Step 5: Update Your Client Code
Replace the ngrok URLs in `client/src/services/bigqueryServiceBrowser.ts`:

```typescript
// Replace these lines:
const syncUrl = 'https://55a554ae7c15.ngrok-free.app/api/sync-activities';
const getUrl = `https://55a554ae7c15.ngrok-free.app/api/activities/${userId}`;

// With your Render URL:
const syncUrl = 'https://impacts-sync-server-abc123.onrender.com/api/sync-activities';
const getUrl = `https://impacts-sync-server-abc123.onrender.com/api/activities/${userId}`;
```

### Step 6: Redeploy Client
```bash
cd client
npm run build
firebase deploy --only hosting
```

## Alternative: Deploy to Railway

If you prefer Railway:

1. Go to [https://railway.app](https://railway.app)
2. Sign up and connect GitHub
3. Create new project from your repository
4. Set environment variables:
   - `REACT_APP_BIGQUERY_PROJECT_ID`: `impacts-tracker`
   - `REACT_APP_BIGQUERY_CREDENTIALS`: Your BigQuery credentials
5. Deploy automatically

## Benefits of Permanent Deployment

✅ **Always Available**: Server runs 24/7
✅ **Reliable**: Professional hosting infrastructure  
✅ **Scalable**: Handles multiple users simultaneously
✅ **Secure**: HTTPS endpoints
✅ **Maintainable**: Easy to update and monitor
✅ **Cost-Effective**: Free tier available

## Monitoring Your Deployment

- **Render**: Check service status in dashboard
- **Railway**: Monitor logs and metrics
- **Health Check**: Visit `https://your-url.onrender.com/api/health`

Your BigQuery integration will now work permanently without any temporary solutions!





