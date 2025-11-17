import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Container, CircularProgress } from '@mui/material';
import { createTheme } from '@mui/material/styles';

// Essential Components Only
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MilestonesPage from './pages/MilestonesPage';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import ActivitiesPage from './pages/ActivitiesPage';
import PRSPage from './pages/PRSPage';
import GapPlanPage from './pages/GapPlanPage';
import SnapshotPage from './pages/SnapshotPage';
import SimulationPage from './pages/SimulationPage';

// PRISM Pages
import PRISMDashboardPage from './pages/PRISMDashboardPage';
import PRISMActivitiesPage from './pages/PRISMActivitiesPage';
import EducationPage from './pages/EducationPage';


// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserProfileProvider, useUserProfile, UserTier } from './context/UserProfileContext';
import { SyncProvider } from './context/SyncContext';

// Create theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#455a64', // Darker blue-grey (almost grey)
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
});

// Loading component
const LoadingSpinner = () => (
  <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
    <CircularProgress />
  </Container>
);

// Protected Route component with tier-based access
const ProtectedRoute = ({ children, requiredTier }: { children: React.ReactNode; requiredTier?: UserTier }) => {
  const { currentUser, loading } = useAuth();
  const { userProfile, isLoading: profileLoading } = useUserProfile();
  
  // Show loading while contexts are initializing
  if (loading || profileLoading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <p>Loading...</p>
      </Container>
    );
  }
  
  if (!currentUser) return <Navigate to="/login" />;
  
  // Ensure userProfile is available
  if (!userProfile) {
    return (
      <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <p>Loading user profile...</p>
      </Container>
    );
  }
  
  // If no specific tier required, allow access
  if (!requiredTier) return <>{children}</>;
  
  // Check if user has required tier
  if (userProfile.tier !== requiredTier) {
    // Redirect to appropriate dashboard based on user's tier
    if (userProfile.tier === UserTier.PRISM) {
      return <Navigate to="/prism/dashboard" />;
    } else {
      return <Navigate to="/dashboard" />;
    }
  }
  
  return <>{children}</>;
};



function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <UserProfileProvider>
          <SyncProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<LoadingSpinner />}>
              <Navbar />
              <Container>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute>
                        <DashboardPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* PRISM Dashboard Route */}
                  <Route 
                    path="/prism/dashboard" 
                    element={
                      <ProtectedRoute requiredTier={UserTier.PRISM}>
                        <PRISMDashboardPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* PRISM Activities Route */}
                  <Route 
                    path="/prism/activities" 
                    element={
                      <ProtectedRoute requiredTier={UserTier.PRISM}>
                        <PRISMActivitiesPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  
                  {/* PECC Routes - Available to all tiers */}
                  <Route 
                    path="/snapshot" 
                    element={
                      <ProtectedRoute>
                        <SnapshotPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/simulation" 
                    element={
                      <ProtectedRoute>
                        <SimulationPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/milestones" 
                    element={
                      <ProtectedRoute>
                        <MilestonesPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/activities" 
                    element={
                      <ProtectedRoute>
                        <ActivitiesPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/prs" 
                    element={
                      <ProtectedRoute>
                        <PRSPage />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/gap-plan" 
                    element={
                      <ProtectedRoute>
                        <GapPlanPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  
                  <Route 
                    path="/account" 
                    element={
                      <ProtectedRoute>
                        <AccountPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  <Route 
                    path="/education" 
                    element={
                      <ProtectedRoute>
                        <EducationPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Container>
            </Suspense>
            </Router>
          </SyncProvider>
        </UserProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
