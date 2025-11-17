# ImPACTS Web App

Pediatric Emergency Care Coordination (PECC) and Pediatric Readiness Assessment tracking application.

**Live Application**: https://impacts-tracker.web.app

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase CLI (for deployment)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/BLMichaels/ImPACTS-Web-App.git
   cd ImPACTS-Web-App
   ```

2. **Install dependencies**
   ```bash
   # Root dependencies
   npm install
   
   # Client dependencies
   cd client
   npm install
   cd ..
   
   # Functions dependencies (if needed)
   cd functions
   npm install
   cd ..
   ```

3. **Set up environment variables**
   - Create `.env` files as needed (see Environment Variables section)
   - **Important**: Never commit credential files (`.json` service account files) to Git

4. **Run the development server**
   ```bash
   cd client
   npm start
   ```
   The app will open at [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
ImPACTS-Web-App/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React Context providers
│   │   ├── services/      # API and service integrations
│   │   └── utils/         # Utility functions
│   ├── public/            # Static assets
│   └── build/             # Production build (gitignored)
├── functions/             # Firebase Cloud Functions
├── server/                # Backend server (if applicable)
└── firebase.json          # Firebase configuration
```

## 🛠️ Available Scripts

### Client (React App)
```bash
cd client

npm start          # Start development server
npm run build      # Build for production
npm test           # Run tests
```

### Deployment
```bash
# Build the client
cd client
npm run build

# Deploy to Firebase
cd ..
firebase deploy --only hosting
```

## 👥 Team Workflow

### Getting the Latest Code

**Always pull before starting work:**
```bash
git pull origin main
```

### Making Changes

1. **Create a feature branch** (recommended for larger changes)
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Or work directly on main** (for small fixes)
   ```bash
   git checkout main
   git pull origin main
   ```

3. **Make your changes and test locally**

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

5. **Push to GitHub**
   ```bash
   git push origin main
   # Or for feature branches:
   git push origin feature/your-feature-name
   ```

### Best Practices

- ✅ **Always pull before starting work** to ensure you have the latest code
- ✅ **Test locally** before pushing
- ✅ **Write clear commit messages** describing what changed
- ✅ **Push frequently** so the team always has the latest code
- ❌ **Never commit**:
  - `node_modules/` folders
  - `build/` folders
  - `.env` files with secrets
  - Credential JSON files (service account keys)
  - Log files

## 🔐 Environment Variables

Create `.env` files in the appropriate directories as needed. These are gitignored and should not be committed.

**Important**: Credential files (like `peccactivitylog-*.json`) should be kept secure and never committed to Git.

## 🗄️ Data Storage

- **Primary Database**: Google BigQuery
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting

## 📚 Key Features

- **Dashboard**: PECC journey overview and resource management
- **PRS (Pediatric Readiness Score)**: Assessment and submission to pedsready.org
- **Gap Plans**: Track and manage improvement plans
- **Milestones**: Monitor progress through PECC stages
- **Activities**: Log and track activities
- **Education**: Educational content for PRS questions
- **Account Settings**: User profile and preferences

## 🚨 Troubleshooting

### Build Issues
```bash
# Clear cache and reinstall
cd client
rm -rf node_modules
npm install
CI=false GENERATE_SOURCEMAP=false npm run build
```

### Firebase Issues
```bash
# Reinstall Firebase CLI
npm install -g firebase-tools
firebase login
```

## 📝 Additional Documentation

- `BIGQUERY_SETUP.md` - BigQuery configuration
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `SETUP_INSTRUCTIONS.md` - Detailed setup guide

## 🔗 Links

- **Live App**: https://impacts-tracker.web.app
- **GitHub Repository**: https://github.com/BLMichaels/ImPACTS-Web-App
- **PedsReady.org**: https://pedsready.org/

## 📧 Support

For issues or questions, please create an issue in the GitHub repository or contact the development team.
