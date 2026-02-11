# Automatic Deployment Setup

This repository is configured for automatic deployment to Vercel on every push to the `main` branch.

## How It Works

1. **GitHub Actions Workflow**: The `.github/workflows/vercel-deploy.yml` workflow automatically triggers on every push to `main`
2. **Vercel Integration**: If Vercel is connected to this GitHub repository, it will also auto-deploy (this is the primary method)

## Required GitHub Secrets

For the GitHub Actions workflow to work, you need to add these secrets to your GitHub repository:

1. Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

2. Add these secrets:
   - `VERCEL_TOKEN`: Your Vercel authentication token
     - Get it from: https://vercel.com/account/tokens
   - `VERCEL_ORG_ID`: Your Vercel organization ID
     - Find it in: Vercel Dashboard → Settings → General
   - `VERCEL_PROJECT_ID`: Your Vercel project ID
     - Find it in: Vercel Dashboard → Project Settings → General

## Alternative: Vercel GitHub Integration (Recommended)

The easiest way is to connect Vercel directly to your GitHub repository:

1. Go to Vercel Dashboard
2. Click "Add New Project"
3. Import your GitHub repository: `BLMichaels/ImPACTS-Web-App`
4. Vercel will automatically deploy on every push to `main`

This method doesn't require GitHub Actions or secrets - Vercel handles everything automatically.

## Verification

After setup, every time you push to `main`:
- ✅ Vercel will automatically build and deploy
- ✅ You'll see deployment status in the Vercel dashboard
- ✅ You'll receive deployment notifications (if configured)

## Manual Deployment

If you need to deploy manually:
```bash
git push origin main
```

The deployment will trigger automatically.
