# ImPACTS Web App - Complete Project Context for Cursor AI

**Last Updated**: December 2024  
**Repository**: https://github.com/BLMichaels/ImPACTS-Web-App  
**Live Application**: https://impacts-tracker.web.app

---

## 🎯 Project Overview

ImPACTS (Pediatric Emergency Care Coordination and Pediatric Readiness Assessment Tracking System) is a web application designed to help Emergency Departments (EDs) track and improve their pediatric emergency care readiness. The application serves two primary user tiers:

1. **PECC (Pediatric Emergency Care Coordinator)**: Hospital staff who manage pediatric readiness at their facility
2. **PRISM (Pediatric Readiness Improvement Specialist)**: Regional coordinators who work with multiple hospitals

### Core Purpose
- Track Pediatric Readiness Score (PRS) assessments
- Manage gap plans for improvement
- Monitor milestones and activities
- Provide educational resources
- Submit official PRS data to pedsready.org

---

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend**: React 18.2.0 with TypeScript
- **UI Framework**: Material-UI (MUI) v5.15.10
- **Routing**: React Router v6.22.1
- **Authentication**: Firebase Auth (compat mode)
- **Database**: Google BigQuery (primary), Firebase Firestore (legacy/auth)
- **Hosting**: Firebase Hosting
- **Build Tool**: Create React App (react-scripts 5.0.1)
- **State Management**: React Context API
- **PDF Generation**: jsPDF + jspdf-autotable
- **Excel/CSV**: xlsx library
- **Date Handling**: date-fns, @mui/x-date-pickers

### Project Structure
```
ImPACTS-Web-App/
├── client/                    # React frontend (main application)
│   ├── src/
│   │   ├── components/        # Reusable components (Navbar, SyncStatus, etc.)
│   │   ├── pages/            # Page components (Dashboard, PRS, Education, etc.)
│   │   ├── context/          # React Context providers
│   │   │   ├── AuthContext.tsx
│   │   │   ├── UserProfileContext.tsx  # User tier management (PECC/PRISM)
│   │   │   └── SyncContext.tsx
│   │   ├── services/         # API integrations
│   │   │   ├── bigqueryService.ts
│   │   │   ├── bigqueryServiceBrowser.ts
│   │   │   └── syncService.ts
│   │   ├── config/           # Configuration files
│   │   ├── hooks/            # Custom React hooks
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Utility functions
│   ├── public/
│   │   ├── impacts-logo.png  # Application logo (CRITICAL: Must be present)
│   │   └── index.html
│   └── build/                # Production build output (gitignored)
├── functions/                # Firebase Cloud Functions (TypeScript)
├── server/                   # Node.js sync server (optional)
├── firebase.json             # Firebase configuration
└── .gitignore               # Git ignore rules
```

---

## 🔑 Critical Configuration Details

### Firebase Configuration
- **Project ID**: `impacts-tracker`
- **Auth Domain**: `impacts-tracker.firebaseapp.com`
- **Hosting URL**: `impacts-tracker.web.app`
- **Firebase SDK**: Using **compat mode** (`firebase/compat/app`, `firebase/compat/auth`, `firebase/compat/firestore`)
  - **IMPORTANT**: The project uses Firebase v12 but with compat APIs for backward compatibility
  - All imports must use `firebase/compat/*` paths, NOT `firebase/*` paths

### Firebase Hosting Configuration
- **Public Directory**: `client/build` (NOT `build` - this is critical!)
- **SPA Routing**: All routes rewrite to `/index.html`
- **Cache Control**: JS/CSS files have `no-cache` headers

### Theme Configuration
- **Primary Color**: `#455a64` (dark blue-grey, almost grey)
- **Secondary Color**: `#dc004e` (red)
- **Background**: `#f5f5f5` (light grey)
- **Logo**: Located at `client/public/impacts-logo.png` (PNG format, not SVG)

### User Tiers
The application supports two user tiers with different interfaces and permissions:

1. **PECC (UserTier.PECC)**:
   - Standard hospital staff view
   - Access to: Dashboard, PRS, Gap Plans, Milestones, Activities, Education, Account
   - PRS tab visibility can be toggled in Account settings (`prsTabVisible` property)
   - Has `gapPlanReminders` configuration

2. **PRISM (UserTier.PRISM)**:
   - Regional coordinator view
   - Access to: PRISM Dashboard, PRISM Activities, Education, Account
   - Different navigation items and dashboard layout
   - Can work with multiple hospitals

---

## 📋 Key Features & Implementation Details

### 1. PRS (Pediatric Readiness Score) Page
**Location**: `client/src/pages/PRSPage.tsx`

**Key Features**:
- Comprehensive assessment questionnaire (82 questions)
- Conditional question logic (questions hidden/shown based on previous answers)
- Score calculation based on answered questions
- Gap plan creation directly from questions
- Previous score tracking with PDF upload
- **Warning Banner**: Red alert at top stating "This score is not official until submitted through pedsready.org" with hyperlink
- **Upload Button**: Allows uploading official submission documents (currently placeholder - TODO: implement parsing)
- **API Submission**: Direct submission to Google Sheets via Apps Script

**Conditional Logic Rules** (CRITICAL for validation):
- If Q14 = "no" → Q15, Q16, Q17 are NOT required
- If Q22 contains "Our ED does NOT HAVE..." → Q23, Q24 are NOT required
- If Q25 contains "Our ED does NOT HAVE..." → Q26, Q27, Q28 are NOT required
- If Q28 = "no" → Q29 is NOT required
- If Q30 = "no" → Q31, Q32, Q33 are NOT required
- If Q34 = "no" → Q35, Q36, Q37 are NOT required
- If Q43 = "no" → Q39, Q40, Q41, Q42 are NOT required
- If Q39 = "no" → Q40, Q41, Q42 are NOT required
- If Q43 = "no" → Q44a, Q44b, Q44c, Q44d, Q44e are NOT required
- If Q60 = "no" → Q61a, Q61b, Q61c, Q61d, Q61e are NOT required
- If Q62 = "no" → Q63a, Q63b, Q63c, Q63d, Q64, Q65, Q66, Q67 are NOT required
- If Q68 = "no" → Q69a, Q69b, Q69c, Q69d, Q69e, Q69f, Q69g, Q69h are NOT required

**Google Sheets Integration**:
- **Apps Script URL**: `https://script.google.com/macros/s/AKfycbz17z-9FVVioi9kbEPd33X2pCWEIJmTq_xzHVaax-yV1II/exec`
- **Google Sheet**: `https://docs.google.com/spreadsheets/d/17z-9FVVioi9kbEPd33X2pCWEIJmTq_xzHVaax-yV1II/edit`
- Submission includes: questions array, hospitalName, submissionDate, score
- **Legal Warning**: When submitting, a dialog warns users about officially sharing data with pedsready.org

**Validation on Submission**:
- Checks all required questions are answered (respecting conditional logic)
- Shows popup with list of unanswered required questions
- Prevents submission if required questions are missing

### 2. Education Page
**Location**: `client/src/pages/EducationPage.tsx`

**Key Features**:
- Read-only display of PRS questions (no clickable answers)
- Questions filtered: **Starts at Q22, excludes Q1-21 and Q79-82**
- Each question clickable → opens popup with educational content
- Popup format includes:
  - Question text
  - Why (importance)
  - Background (context)
  - Example
  - Sustainability Practices
  - Additional Resources (with hyperlinks)
- Gap plan creation still available from education view

### 3. Navigation Bar
**Location**: `client/src/components/Navbar.tsx`

**Key Features**:
- Responsive design (mobile drawer, desktop menu)
- Logo: `impacts-logo.png` from `/public` directory
- Logo click navigates to appropriate dashboard based on user tier
- Navigation items change based on user tier:
  - **PECC**: Dashboard, PRS (if `prsTabVisible`), Gap Plans, Milestones, Activities, Education, Account
  - **PRISM**: PRISM Dashboard, PRISM Activities, Education, Account
- User avatar menu with Profile and Logout options
- Shows user tier label next to logo (except for PECC users)

### 4. Account Page
**Location**: `client/src/pages/AccountPage.tsx`

**Key Features**:
- User profile management
- **PRS Tab Visibility Toggle**: Allows PECC users to hide/show the PRS tab
- Gap plan reminder settings (for PECC users)
- User information editing

### 5. Dashboard Pages
- **PECC Dashboard**: `client/src/pages/DashboardPage.tsx`
- **PRISM Dashboard**: `client/src/pages/PRISMDashboardPage.tsx`
- Different layouts and features based on user tier

### 6. Gap Plans
- Can be created from PRS questions or Education page
- Support file attachments (PDF, images)
- Status tracking, priority, difficulty, due dates
- Export functionality (PDF, Excel)

---

## 🚨 Critical Nuances & Gotchas

### 1. Firebase Compat Mode
**CRITICAL**: The entire project uses Firebase compat APIs, NOT the modular v9+ APIs.
- ✅ Correct: `import firebase from 'firebase/compat/app'`
- ❌ Wrong: `import { initializeApp } from 'firebase/app'`
- All auth operations use `auth.createUserWithEmailAndPassword()` not modular functions
- User type is `firebase.User | null`, not `User | null` from modular SDK

### 2. Build Process
- **Build command must be run from `client/` directory**: `cd client && npm run build`
- If build hangs, use: `CI=false GENERATE_SOURCEMAP=false npm run build`
- Build output goes to `client/build/` (not root `build/`)
- Firebase hosting points to `client/build` in `firebase.json`

### 3. Logo File
- **MUST exist at**: `client/public/impacts-logo.png`
- Referenced in Navbar as `/impacts-logo.png`
- If missing, navigation bar will break visually

### 4. User Profile Context
- `UserProfileContext.tsx` defines two profile types: `PECCProfile` and `PRISMProfile`
- `prsTabVisible` property exists ONLY on `PECCProfile`, NOT on `PRISMProfile`
- Always check `userProfile?.tier === UserTier.PECC` before accessing PECC-specific properties

### 5. PECC2 Pages
- There are legacy "PECC2" pages in the codebase (`PECC2DashboardPage.tsx`, etc.)
- These are **NOT currently used** in the main app routing
- The user requested to remove them if they conflict with current PECC pages
- Current active pages are the non-PECC2 versions

### 6. BigQuery Integration
- Primary data storage is Google BigQuery
- Service account credentials file: `peccactivitylog-*.json` (gitignored, must be provided separately)
- Browser-side BigQuery access uses `bigqueryServiceBrowser.ts`
- Server-side sync uses `bigqueryService.ts`

### 7. Environment Variables
- Firebase config can use environment variables (REACT_APP_*)
- Default values are hardcoded in `firebase.ts` as fallback
- Credential files are gitignored and must be provided separately

### 8. Conditional Question Logic
- The `isQuestionRequired()` function in `PRSPage.tsx` contains ALL conditional logic
- This logic is critical for proper validation
- Any changes to question dependencies must be updated here

---

## 🛠️ Setup Instructions

### Prerequisites
- Node.js v14+ (project uses v18+ for server)
- npm or yarn
- Firebase CLI: `npm install -g firebase-tools`
- Git

### Initial Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/BLMichaels/ImPACTS-Web-App.git
   cd ImPACTS-Web-App
   ```

2. **Install Dependencies**
   ```bash
   # Root dependencies (sync server)
   npm install
   
   # Client dependencies (React app)
   cd client
   npm install
   cd ..
   
   # Functions dependencies (if needed)
   cd functions
   npm install
   cd ..
   ```

3. **Firebase Setup**
   ```bash
   firebase login
   firebase use impacts-tracker  # Or set project in .firebaserc
   ```

4. **Environment Variables** (if needed)
   - Create `.env` files in `client/` directory
   - Add Firebase config variables (optional, defaults are in code)
   - **NEVER commit credential JSON files**

5. **BigQuery Credentials** (if needed)
   - Place service account JSON file in root directory
   - File pattern: `peccactivitylog-*.json`
   - This file is gitignored for security

6. **Run Development Server**
   ```bash
   cd client
   npm start
   ```
   App opens at http://localhost:3000

---

## 🚀 Deployment Process

### Building for Production

1. **Build the React App**
   ```bash
   cd client
   CI=false GENERATE_SOURCEMAP=false npm run build
   ```
   - `CI=false` prevents build hangs in non-CI environments
   - `GENERATE_SOURCEMAP=false` speeds up build and reduces size

2. **Verify Build Output**
   - Check that `client/build/` directory exists
   - Verify `client/build/index.html` is present
   - Ensure static assets are in `client/build/static/`

### Deploying to Firebase Hosting

```bash
# From project root
firebase deploy --only hosting
```

**Important**: 
- Firebase hosting is configured to serve from `client/build`
- The `firebase.json` file must have `"public": "client/build"` (not `"build"`)

### Troubleshooting Deployment

**White Screen After Deployment**:
- Check browser console for errors
- Verify `client/build/index.html` exists and is correct
- Ensure Firebase hosting public directory is `client/build`
- Check that `client/public/index.html` is NOT the default Firebase welcome page

**Build Hangs**:
- Use `CI=false GENERATE_SOURCEMAP=false npm run build`
- Clear npm cache: `npm cache clean --force`
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

**Module Not Found Errors**:
- Ensure all dependencies are installed: `cd client && npm install`
- Check that Firebase is installed: `npm list firebase`
- Verify import paths use `firebase/compat/*` not `firebase/*`

---

## 📊 Current Project Status

### ✅ Completed Features
- User authentication (Firebase Auth)
- User tier management (PECC/PRISM)
- PRS assessment page with full question set
- Conditional question logic and validation
- Gap plan creation and management
- Education page with question popups
- Google Sheets API integration for PRS submission
- Warning banners and legal disclaimers
- PRS tab visibility toggle
- Responsive navigation with mobile support
- Logo integration
- Theme customization (dark blue-grey primary color)
- Previous score tracking with PDF upload
- Export functionality (PDF, Excel)

### 🚧 Known TODOs / Incomplete Features
- **PRS Document Upload Parsing**: The upload button exists but doesn't actually parse and populate questions yet (line 1860 in PRSPage.tsx)
- **Hospital Name**: Currently hardcoded as "ImPACTS Hospital" in API submission (line 1875)
- **PECC2 Pages**: Legacy pages exist but may need removal if they conflict

### ⚠️ Known Issues
- None currently documented, but watch for:
  - Build hangs (use CI=false flag)
  - Firebase compat vs modular API confusion
  - Missing logo file breaking navbar
  - Type errors when accessing PECC-specific properties on PRISM users

---

## 🔐 Security & Credentials

### Gitignored Files
- `node_modules/` (all instances)
- `build/` and `client/build/` directories
- `.env` files
- `*.log` files
- `peccactivitylog-*.json` (BigQuery credentials)
- `*-credentials.json`
- `service-account-*.json`
- `.firebase/` directory
- `.firebaserc` (may contain project-specific config)

### Required Credentials (Not in Repo)
- **BigQuery Service Account JSON**: Must be provided separately
- **Firebase Config**: Hardcoded with defaults, but can use env vars
- **Google Apps Script URL**: Hardcoded in PRSPage.tsx (line 1880)

---

## 📝 Development Workflow

### Git Workflow
1. **Always pull before starting work**:
   ```bash
   git pull origin main
   ```

2. **Create feature branch** (for larger changes):
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Or work directly on main** (for small fixes):
   ```bash
   git checkout main
   ```

4. **Test locally** before committing

5. **Commit and push**:
   ```bash
   git add .
   git commit -m "Clear description of changes"
   git push origin main  # or feature branch name
   ```

### Best Practices
- ✅ Always pull before starting work
- ✅ Test locally before pushing
- ✅ Write clear commit messages
- ✅ Push frequently so team has latest code
- ❌ Never commit: node_modules, build/, .env, credential files, logs

---

## 🔗 Important URLs & Resources

- **Live Application**: https://impacts-tracker.web.app
- **GitHub Repository**: https://github.com/BLMichaels/ImPACTS-Web-App
- **PedsReady.org**: https://pedsready.org/
- **Google Sheets (PRS Submissions)**: https://docs.google.com/spreadsheets/d/17z-9FVVioi9kbEPd33X2pCWEIJmTq_xzHVaax-yV1II/edit
- **Google Apps Script (PRS API)**: `https://script.google.com/macros/s/AKfycbz17z-9FVVioi9kbEPd33X2pCWEIJmTq_xzHVaax-yV1II/exec`

---

## 📚 Key Files Reference

### Critical Files to Understand
- `client/src/App.tsx` - Main app component, routing, theme
- `client/src/components/Navbar.tsx` - Navigation, logo, user menu
- `client/src/pages/PRSPage.tsx` - PRS assessment (largest file, ~3200 lines)
- `client/src/pages/EducationPage.tsx` - Education tab with popups
- `client/src/context/UserProfileContext.tsx` - User tier management
- `client/src/context/AuthContext.tsx` - Authentication
- `client/src/firebase.ts` - Firebase configuration
- `firebase.json` - Firebase hosting configuration
- `client/public/impacts-logo.png` - Application logo

### Configuration Files
- `client/package.json` - Client dependencies and scripts
- `package.json` - Root/server dependencies
- `functions/package.json` - Firebase Functions dependencies
- `tsconfig.json` - TypeScript configuration
- `.gitignore` - Git ignore rules

---

## 🎨 UI/UX Details

### Color Scheme
- **Primary**: `#455a64` (dark blue-grey, almost grey) - Used for navbar, buttons, accents
- **Secondary**: `#dc004e` (red) - Used for secondary actions
- **Background**: `#f5f5f5` (light grey) - Page background

### Logo
- **File**: `impacts-logo.png`
- **Location**: `client/public/impacts-logo.png`
- **Usage**: Referenced as `/impacts-logo.png` in Navbar
- **Size**: Responsive (35px mobile, 45px desktop)

### Responsive Breakpoints
- Mobile: `< md` (768px)
- Tablet: `< lg` (1024px)
- Small Desktop: `< xl` (1280px)
- Desktop: `>= xl`

---

## 🐛 Common Errors & Solutions

### Error: "Module not found: Can't resolve 'firebase/auth'"
**Solution**: Use compat imports: `import firebase from 'firebase/compat/app'`

### Error: "Property 'prsTabVisible' does not exist on type 'UserProfile'"
**Solution**: Check user tier first: `if (userProfile?.tier === UserTier.PECC) { ... }`

### Error: Build hangs at 54.1%
**Solution**: Use `CI=false GENERATE_SOURCEMAP=false npm run build`

### Error: White screen after deployment
**Solution**: 
1. Check `firebase.json` has `"public": "client/build"`
2. Verify `client/build/index.html` exists
3. Check browser console for errors
4. Ensure `client/public/index.html` is not Firebase welcome page

### Error: Logo not displaying
**Solution**: Verify `client/public/impacts-logo.png` exists and Navbar references `/impacts-logo.png`

---

## 📖 Additional Documentation

- `README.md` - General project overview and quick start
- `BIGQUERY_SETUP.md` - BigQuery configuration guide
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - Detailed deployment instructions
- `SETUP_INSTRUCTIONS.md` - Setup guide
- `MIGRATION_SUMMARY.md` - Migration notes (if applicable)

---

## 💡 Tips for Working with This Codebase

1. **Always check user tier** before accessing tier-specific properties
2. **Use Firebase compat APIs** - don't mix with modular APIs
3. **Test conditional logic** when modifying PRS questions
4. **Verify logo file exists** before deploying
5. **Build from client directory** - not root
6. **Use CI=false flag** if builds hang
7. **Check browser console** for runtime errors
8. **Verify firebase.json** public directory is `client/build`
9. **Pull before starting work** to get latest code
10. **Test locally** before pushing to GitHub

---

## 🎯 Quick Reference Commands

```bash
# Development
cd client && npm start

# Build
cd client && CI=false GENERATE_SOURCEMAP=false npm run build

# Deploy
firebase deploy --only hosting

# Install dependencies
cd client && npm install

# Clear and reinstall
cd client && rm -rf node_modules && npm install

# Git workflow
git pull origin main
git add .
git commit -m "Description"
git push origin main
```

---

**End of Context Document**

This document should provide comprehensive context for working with the ImPACTS Web App project. When starting a new Cursor session, reference this file to understand the project's architecture, nuances, and current status.
