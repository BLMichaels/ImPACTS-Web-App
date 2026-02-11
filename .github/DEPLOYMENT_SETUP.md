# Automatic Deployment Setup

This repository is configured for automatic deployment to Vercel on every push to the `main` branch.

## How It Works

**Vercel GitHub Integration** (Primary Method):
- Vercel is connected directly to this GitHub repository
- Every push to `main` automatically triggers a deployment to the **impacts** project
- No GitHub Actions or secrets required - Vercel handles everything automatically

## Verification

To verify Vercel is connected:
1. Go to Vercel Dashboard → Project Settings → Git
2. Confirm the repository `BLMichaels/ImPACTS-Web-App` is connected
3. Check that "Production Branch" is set to `main`

## Deployment Process

Every time you push to `main`:
- ✅ Vercel automatically detects the push
- ✅ Builds the project using `vercel.json` configuration
- ✅ Deploys to production (impacts project)
- ✅ You'll see deployment status in the Vercel dashboard

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
