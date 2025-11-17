# 🚀 Quick Render Deployment Guide

## **Option 1: Deploy to Render (Recommended)**

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
In Render dashboard, add:
- `NODE_ENV`: `production`

### **Step 4: Upload Credentials**
Upload your `peccactivitylog-c17bfeb5047c.json` file to Render

### **Step 5: Get Your URL**
Render will give you a URL like: `https://impacts-sync-server.onrender.com`

### **Step 6: Update Client**
Replace `YOUR_NGROK_URL` in the client code with your Render URL

## **Option 2: Use ngrok (If you prefer)**

1. Sign up at [ngrok.com](https://ngrok.com)
2. Get your authtoken
3. Run: `ngrok config add-authtoken YOUR_TOKEN`
4. Run: `ngrok http 3001`
5. Copy the ngrok URL
6. Update client code with ngrok URL





