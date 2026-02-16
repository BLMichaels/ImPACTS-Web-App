import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Container, Box, CircularProgress } from '@mui/material';
import { createTheme } from '@mui/material/styles';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserProfileProvider, useUserProfile } from './context/UserProfileContext';
import { UsageAnalyticsProvider } from './context/UsageAnalyticsContext';
import { UserRole } from './types/database';

// Essential Components Only
import Navbar from './components/Navbar';
import Footer from './components/Footer';
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
const MentorSnapshotPage = lazy(() => import('./pages/mentor/MentorSnapshotPage'));

// Manager Pages (lazy loaded)
const ManagerSnapshotPage = lazy(() => import('./pages/manager/ManagerSnapshotPage'));
const ManagerOverviewPage = lazy(() => import('./pages/manager/ManagerOverviewPage'));
const ManagerMentorsPage = lazy(() => import('./pages/manager/ManagerMentorsPage'));
const ManagerCRMPage = lazy(() => import('./pages/manager/ManagerCRMPage'));
const ManagerWagesExpensesPage = lazy(() => import('./pages/manager/ManagerWagesExpensesPage'));
const ManagerCohortsPage = lazy(() => import('./pages/manager/ManagerCohortsPage'));

// Admin Pages (lazy loaded)
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminCRMPage = lazy(() => import('./pages/admin/AdminCRMPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminSnapshotPage = lazy(() => import('./pages/admin/AdminSnapshotPage'));
const AdminProjectPipelinePage = lazy(() => import('./pages/admin/AdminProjectPipelinePage'));
const AdminCohortsPage = lazy(() => import('./pages/admin/AdminCohortsPage'));
const AdminProgramsPage = lazy(() => import('./pages/admin/AdminProgramsPage'));

// Cohorts Page (shared for PECC/Mentor)
const CohortsPage = lazy(() => import('./pages/CohortsPage'));

// Programs Pages
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'));
const ManagerProgramsPage = lazy(() => import('./pages/manager/ManagerProgramsPage'));
const ManagerPermissionsPage = lazy(() => import('./pages/manager/ManagerPermissionsPage'));

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
      return '/manager/snapshot';
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
            <UsageAnalyticsProvider>
            <Suspense fallback={<LoadingSpinner />}>
              <Navbar />
              <ScrollToTop />
              <Container sx={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)' }}>
                <Box component="main" sx={{ flex: 1 }}>
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
                  <Route path="/education" element={<Navigate to="/gap-plan" replace />} />
                  <Route path="/cohorts" element={<ProtectedRoute><CohortsPage /></ProtectedRoute>} />
                  <Route path="/programs" element={<ProtectedRoute><ProgramsPage /></ProtectedRoute>} />
                  
                  {/* Mentor Routes */}
                  <Route path="/mentor/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorDashboardPage /></ProtectedRoute>} />
                  <Route path="/mentor/activities" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorActivitiesPage /></ProtectedRoute>} />
                  <Route path="/mentor/hospitals" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorHospitalContactsPage /></ProtectedRoute>} />
                  <Route path="/mentor/milestones" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorSiteMilestonesPage /></ProtectedRoute>} />
                  <Route path="/mentor/wages" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorWagesExpensesPage /></ProtectedRoute>} />
                  <Route path="/mentor/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorSnapshotPage /></ProtectedRoute>} />
                  <Route path="/mentor/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><CohortsPage /></ProtectedRoute>} />
                  <Route path="/mentor/programs" element={<Navigate to="/mentor/dashboard" replace />} />
                  
                  {/* Manager Routes */}
                  <Route path="/manager/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerSnapshotPage /></ProtectedRoute>} />
                  <Route path="/manager/overview" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerOverviewPage /></ProtectedRoute>} />
                  <Route path="/manager/dashboard" element={<Navigate to="/manager/snapshot" replace />} />
                  <Route path="/manager/mentors" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerMentorsPage /></ProtectedRoute>} />
                  <Route path="/manager/activities" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><MentorActivitiesPage /></ProtectedRoute>} />
                  <Route path="/manager/hospitals" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><MentorHospitalContactsPage /></ProtectedRoute>} />
                  <Route path="/manager/milestones" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><MentorSiteMilestonesPage /></ProtectedRoute>} />
                  <Route path="/manager/crm" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerCRMPage /></ProtectedRoute>} />
                  <Route path="/manager/wages" element={<Navigate to="/manager/mentors" replace />} />
                  <Route path="/manager/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerCohortsPage /></ProtectedRoute>} />
                  <Route path="/manager/programs" element={<Navigate to="/manager/snapshot" replace />} />
                  <Route path="/manager/permissions" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerPermissionsPage /></ProtectedRoute>} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminDashboardPage /></ProtectedRoute>} />
                  <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminCRMPage /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<Navigate to="/admin/crm?tab=team" replace />} />
                  <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminSettingsPage /></ProtectedRoute>} />
                  <Route path="/admin/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminSnapshotPage /></ProtectedRoute>} />
                  <Route path="/admin/pipeline" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminProjectPipelinePage /></ProtectedRoute>} />
                  <Route path="/admin/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminCohortsPage /></ProtectedRoute>} />
                  {/* Programs is a tab in Settings - redirect old URL */}
                  <Route path="/admin/programs" element={<Navigate to="/admin/settings?tab=programs" replace />} />
                  
                  {/* Common Routes */}
                  <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Box>
                <Footer />
              </Container>
            </Suspense>
            </UsageAnalyticsProvider>
          </Router>
        </UserProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
