#!/bin/bash

echo "🚀 Deploying ImPACTS Sync Server to Vercel..."

# Install Vercel CLI if not already installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Set environment variables for Vercel
echo "🔧 Setting up environment variables..."

# Read BigQuery credentials from .env file
if [ -f ".env" ]; then
    source .env
    echo "✅ Found .env file with BigQuery credentials"
else
    echo "❌ .env file not found. Please create one with your BigQuery credentials."
    exit 1
fi

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod --yes

echo "✅ Deployment complete!"
echo "🌐 Your sync server will be available at:"
echo "   https://impacts-sync-server.vercel.app"
echo ""
echo "📋 Next steps:"
echo "1. Update your React app to use the new sync server URL"
echo "2. Redeploy your React app to Firebase Hosting"
echo "3. Test data synchronization on production"





