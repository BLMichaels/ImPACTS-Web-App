#!/bin/bash

# Deploy sync server to Google Cloud Run
echo "🚀 Deploying sync server to Google Cloud Run..."

# Set project ID
PROJECT_ID="impacts-tracker"

# Enable required APIs
echo "📡 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy using Cloud Build
echo "🔨 Building and deploying..."
gcloud builds submit --config cloudbuild.yaml --project=$PROJECT_ID

echo "✅ Deployment complete!"
echo "🌐 Your sync server will be available at:"
echo "   https://sync-server-[hash]-uc.a.run.app"
echo ""
echo "📋 Next steps:"
echo "1. Update your React app to use the new sync server URL"
echo "2. Redeploy your React app to Firebase Hosting"





