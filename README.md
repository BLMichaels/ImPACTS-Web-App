# ImPACTS Web App

Pediatric Emergency Care Coordination (PECC) and Pediatric Readiness Assessment tracking application.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Material-UI
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL) + localStorage
- **Hosting**: Vercel

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/BLMichaels/ImPACTS-Web-App.git
cd ImPACTS-Web-App

# Install dependencies
cd client
npm install
```

### Environment Variables

Create a `.env` file in the `client/` directory:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
cd client
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
cd client
npm run build
```

## Project Structure

```
ImPACTS-Web-App/
├── client/                    # React application
│   ├── public/               # Static assets (logo, icons)
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   │   ├── Navbar.tsx
│   │   │   ├── SyncStatus.tsx
│   │   │   └── ...
│   │   ├── context/          # React Context providers
│   │   │   ├── AuthContext.tsx      # Supabase authentication
│   │   │   ├── UserProfileContext.tsx
│   │   │   └── SyncContext.tsx
│   │   ├── pages/            # Page components
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── PRSPage.tsx
│   │   │   ├── GapPlanPage.tsx
│   │   │   ├── ActivitiesPage.tsx
│   │   │   └── ...
│   │   ├── services/         # Service layer
│   │   ├── supabase.ts       # Supabase client config
│   │   └── App.tsx           # Main app component
│   ├── package.json
│   └── vercel.json           # Vercel deployment config
└── README.md
```

## Features

- **Dashboard**: PECC journey overview and resource management
- **PRS Assessment**: Pediatric Readiness Score tracking (82 questions)
- **Gap Plans**: Create and manage improvement action plans
- **Activities**: Log PECC activities and time tracking
- **Milestones**: Progress through PECC stages (Establish, Implement, Lead, Sustain)
- **Education**: Educational content for PRS questions
- **Simulation**: Track simulation exercises and identify gaps
- **Snapshot**: Analytics and progress visualization

## User Tiers

- **PECC**: Hospital staff managing pediatric readiness
- **PRISM**: Regional coordinators working with multiple hospitals

## Deployment

### Vercel (Recommended)

We deploy only to the Vercel project **impacts** (not impacts-web-app). The repo is linked via `.vercel/project.json`.

1. Connect your GitHub repository to the Vercel project **impacts**
2. Set environment variables in the Vercel dashboard for that project:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
3. Deploy from project root: `npx vercel --prod --yes` (or rely on auto-deploy on push to main)

### Manual Deploy

```bash
npm i -g vercel
npx vercel --prod --yes
```
(Run from project root; deploys to the linked project **impacts**.)

## Git Workflow

```bash
# Always pull before starting
git pull origin main

# Make changes and commit
git add .
git commit -m "Description of changes"
git push origin main
```

**Never commit:**
- `node_modules/`
- `.env` files
- Credential files

## Links

- **GitHub**: https://github.com/BLMichaels/ImPACTS-Web-App
- **PedsReady.org**: https://pedsready.org/
