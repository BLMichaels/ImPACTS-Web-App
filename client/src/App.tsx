import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Container, CircularProgress } from '@mui/material';
import { createTheme } from '@mui/material/styles';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserProfileProvider, useUserProfile } from './context/UserProfileContext';
import { UserRole } from './types/database';

// Essential Components Only
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import AccountPage from './pages/AccountPage';

// PECC Pages
import DashboardPage from './pages/DashboardPage';
import MilestonesPage from './pages/MilestonesPage';
import ActivitiesPage from './pages/ActivitiesPage';
import GapPlanPage from './pages/GapPlanPage';
import SnapshotPage from './pages/SnapshotPage';
import SimulationPage from './pages/SimulationPage';
import EducationPage from './pages/EducationPage';

// Mentor Pages (lazy loaded)
const MentorDashboardPage = lazy(() => import('./pages/mentor/MentorDashboardPage'));
const MentorActivitiesPage = lazy(() => import('./pages/mentor/MentorActivitiesPage'));
const MentorHospitalContactsPage = lazy(() => import('./pages/mentor/MentorHospitalContactsPage'));
const MentorSiteMilestonesPage = lazy(() => import('./pages/mentor/MentorSiteMilestonesPage'));
const MentorWagesExpensesPage = lazy(() => import('./pages/mentor/MentorWagesExpensesPage'));

// Manager Pages (lazy loaded)
const ManagerDashboardPage = lazy(() => import('./pages/manager/ManagerDashboardPage'));
const ManagerMentorsPage = lazy(() => import('./pages/manager/ManagerMentorsPage'));
const ManagerCRMPage = lazy(() => import('./pages/manager/ManagerCRMPage'));

// Admin Pages (lazy loaded)
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminCRMPage = lazy(() => import('./pages/admin/AdminCRMPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));

// Invitation Page
const InvitationPage = lazy(() => import('./pages/InvitationPage'));

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

// Get default dashboard route based on user role
const getDefaultDashboard = (role: UserRole): string => {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin/dashboard';
    case UserRole.MANAGER:
      return '/manager/dashboard';
    case UserRole.MENTOR:
      return '/mentor/dashboard';
    case UserRole.PECC:
    default:
      return '/dashboard';
  }
};

// Protected Route component with role-based access
const ProtectedRoute = ({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles?: UserRole[];
}) => {
  const { currentUser, loading } = useAuth();
  const { userProfile, isLoading: profileLoading, userRole } = useUserProfile();
  
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
  
  // If no specific roles required, allow access
  if (!allowedRoles || allowedRoles.length === 0) return <>{children}</>;
  
  // Admin always has access
  if (userRole === UserRole.ADMIN) return <>{children}</>;
  
  // Check if user has one of the allowed roles
  if (!allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on user's role
    return <Navigate to={getDefaultDashboard(userRole)} />;
  }
  
  return <>{children}</>;
};



// Smart redirect: logged-out -> /login; logged-in -> role dashboard (e.g. /admin/dashboard, /mentor/dashboard)
const RoleBasedRedirect = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const { userProfile, isLoading: profileLoading } = useUserProfile();

  if (authLoading || profileLoading) {
    return <LoadingSpinner />;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  const dashboard = getDefaultDashboard(userProfile?.role ?? UserRole.PECC);
  return <Navigate to={dashboard} replace />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <UserProfileProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<LoadingSpinner />}>
              <Navbar />
              <ScrollToTop />
              <Container>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<RoleBasedRedirect />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/invite/:code" element={<InvitationPage />} />
                  
                  {/* PECC Routes */}
                  <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><DashboardPage /></ProtectedRoute>} />
                  <Route path="/snapshot" element={<ProtectedRoute><SnapshotPage /></ProtectedRoute>} />
                  <Route path="/simulation" element={<ProtectedRoute><SimulationPage /></ProtectedRoute>} />
                  <Route path="/milestones" element={<ProtectedRoute><MilestonesPage /></ProtectedRoute>} />
                  <Route path="/activities" element={<ProtectedRoute><ActivitiesPage /></ProtectedRoute>} />
                  <Route path="/prs" element={<Navigate to="/snapshot" replace />} />
                  <Route path="/gap-plan" element={<ProtectedRoute><GapPlanPage /></ProtectedRoute>} />
                  <Route path="/education" element={<ProtectedRoute><EducationPage /></ProtectedRoute>} />
                  
                  {/* Mentor Routes */}
                  <Route path="/mentor/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorDashboardPage /></ProtectedRoute>} />
                  <Route path="/mentor/activities" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorActivitiesPage /></ProtectedRoute>} />
                  <Route path="/mentor/hospitals" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorHospitalContactsPage /></ProtectedRoute>} />
                  <Route path="/mentor/milestones" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorSiteMilestonesPage /></ProtectedRoute>} />
                  <Route path="/mentor/wages" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorWagesExpensesPage /></ProtectedRoute>} />
                  <Route path="/mentor/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><SnapshotPage /></ProtectedRoute>} />
                  
                  {/* Manager Routes */}
                  <Route path="/manager/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerDashboardPage /></ProtectedRoute>} />
                  <Route path="/manager/mentors" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerMentorsPage /></ProtectedRoute>} />
                  <Route path="/manager/crm" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerCRMPage /></ProtectedRoute>} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminDashboardPage /></ProtectedRoute>} />
                  <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminCRMPage /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminUsersPage /></ProtectedRoute>} />
                  <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminSettingsPage /></ProtectedRoute>} />
                  
                  {/* Common Routes */}
                  <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Container>
            </Suspense>
          </Router>
        </UserProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
