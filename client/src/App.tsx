import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Container, Box, CircularProgress } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { fontSans, fontMono } from './theme/fonts';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserProfileProvider, useUserProfile } from './context/UserProfileContext';
import { UsageAnalyticsProvider } from './context/UsageAnalyticsContext';
import { UserRole } from './types/database';

// Essential Components Only
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import IdleTimeout from './components/IdleTimeout';
import SecurityGateShell from './components/SecurityGateShell';
import { PhiGuardProvider } from './components/PhiGuard';
import LoginPage from './pages/LoginPage';
import AccessByInvitationPage from './pages/AccessByInvitationPage';
import NotFoundPage from './pages/NotFoundPage';
import AccountPage from './pages/AccountPage';
import LandingPage from './pages/LandingPage';

// PECC Pages
import DashboardPage from './pages/DashboardPage';
import MilestonesPage from './pages/MilestonesPage';
import ActivitiesPage from './pages/ActivitiesPage';
import GapPlanPage from './pages/GapPlanPage';
import SnapshotPage from './pages/SnapshotPage';
import SimulationPage from './pages/SimulationPage';

// Mentor Pages (lazy loaded)
const MentorDashboardPage = lazy(() => import('./pages/mentor/MentorDashboardPage'));
const MentorActivitiesPage = lazy(() => import('./pages/mentor/MentorActivitiesPage'));
const MentorHospitalContactsPage = lazy(() => import('./pages/mentor/MentorHospitalContactsPage'));
const MentorSiteMilestonesPage = lazy(() => import('./pages/mentor/MentorSiteMilestonesPage'));
const MentorWagesExpensesPage = lazy(() => import('./pages/mentor/MentorWagesExpensesPage'));
const MentorSnapshotPage = lazy(() => import('./pages/mentor/MentorSnapshotPage'));
const MentorReportsPage = lazy(() => import('./pages/mentor/MentorReportsPage'));

// Manager Pages (lazy loaded)
const ManagerSnapshotPage = lazy(() => import('./pages/manager/ManagerSnapshotPage'));
const ManagerOverviewPage = lazy(() => import('./pages/manager/ManagerOverviewPage'));
const ManagerMentorsPage = lazy(() => import('./pages/manager/ManagerMentorsPage'));
const ManagerCRMPage = lazy(() => import('./pages/manager/ManagerCRMPage'));
const ManagerCohortsPage = lazy(() => import('./pages/manager/ManagerCohortsPage'));

// Admin Pages (lazy loaded)
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminCRMPage = lazy(() => import('./pages/admin/AdminCRMPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminSnapshotPage = lazy(() => import('./pages/admin/AdminSnapshotPage'));
const AdminProjectPipelinePage = lazy(() => import('./pages/admin/AdminProjectPipelinePage'));
const AdminCohortsPage = lazy(() => import('./pages/admin/AdminCohortsPage'));

// Cohorts Page (shared for PECC/Mentor)
const CohortsPage = lazy(() => import('./pages/CohortsPage'));

// Programs Pages
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'));
const ManagerPermissionsPage = lazy(() => import('./pages/manager/ManagerPermissionsPage'));

// Hospital System & Hiring Group (lazy)
const HospitalSystemDashboardPage = lazy(() => import('./pages/hospital-system/HospitalSystemDashboardPage'));
const HiringGroupSnapshotPage = lazy(() => import('./pages/hiring-group/HiringGroupSnapshotPage'));

// Invitation Page
const InvitationPage = lazy(() => import('./pages/InvitationPage'));

// Create theme — cool clinical slate + teal accent (professional, crisp)
const theme = createTheme({
  palette: {
    primary: {
      main: '#3d5560',
      dark: '#2a3d45',
      light: '#5f7884',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0e7490',
      dark: '#0a5a70',
      light: '#22a0bd',
      contrastText: '#ffffff',
    },
    background: {
      default: '#e9eef2',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a2b33',
      secondary: '#5c7180',
    },
    divider: 'rgba(28, 55, 68, 0.12)',
  },
  typography: {
    fontFamily: fontSans,
    h1: { fontWeight: 600, letterSpacing: '-0.025em' },
    h2: { fontWeight: 600, letterSpacing: '-0.02em' },
    h3: { fontWeight: 600, letterSpacing: '-0.015em' },
    h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: fontSans,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          backgroundColor: '#e9eef2',
        },
        code: { fontFamily: fontMono },
        pre: { fontFamily: fontMono },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
    },
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
      return '/manager/overview';
    case UserRole.MENTOR:
      return '/mentor/dashboard';
    case UserRole.PECC:
      return '/dashboard';
    case UserRole.HOSPITAL_SYSTEM:
      return '/hospital-system/dashboard';
    case UserRole.HIRING_GROUP:
      return '/hiring-group/snapshot';
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
  const { userProfile, isLoading: profileLoading, userRole, actualRole, hasAdminAccess } = useUserProfile();
  
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
  
  // True platform admins always have access
  if (hasAdminAccess) return <>{children}</>;

  // Never allow "view as" to escalate a non-admin actor into admin-only routes.
  if (allowedRoles.includes(UserRole.ADMIN)) {
    return <Navigate to={getDefaultDashboard(actualRole)} />;
  }

  const effectiveNonAdminRole = userRole === UserRole.ADMIN ? actualRole : userRole;
  const isAllowed = allowedRoles.includes(effectiveNonAdminRole) || allowedRoles.includes(actualRole);
  if (!isAllowed) {
    // Redirect to appropriate dashboard based on actor's real role
    return <Navigate to={getDefaultDashboard(actualRole)} />;
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

function AppShell() {
  const location = useLocation();
  const isFullBleedPublic =
    location.pathname === '/' ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  return (
    <SecurityGateShell>
      <UserProfileProvider>
        <UsageAnalyticsProvider>
          <Suspense fallback={<LoadingSpinner />}>
            <ErrorBoundary>
              <Navbar />
              <ScrollToTop />
              <IdleTimeout />
              <Box
                component="a"
                href="#main-content"
                sx={{
                  position: 'fixed',
                  left: -9999,
                  top: 8,
                  zIndex: 9999,
                  padding: 2,
                  bgcolor: 'background.paper',
                  color: 'primary.main',
                  border: 1,
                  borderColor: 'divider',
                  textDecoration: 'none',
                  '&:focus': { left: 8 },
                }}
              >
                Skip to main content
              </Box>
              <Container
                maxWidth={isFullBleedPublic ? false : 'lg'}
                disableGutters={isFullBleedPublic}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: isFullBleedPublic ? '100vh' : 'calc(100vh - 64px)',
                  ...(isFullBleedPublic ? { width: '100%', maxWidth: '100%' } : {}),
                }}
              >
                <Box component="main" id="main-content" sx={{ flex: 1, ...(isFullBleedPublic ? { width: '100%' } : {}) }}>
                  <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/app" element={<RoleBasedRedirect />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<AccessByInvitationPage />} />
                  <Route path="/invite/:code" element={<InvitationPage />} />
                  
                  {/* PECC Routes */}
                  <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><DashboardPage /></ProtectedRoute>} />
                  <Route path="/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><ErrorBoundary><SnapshotPage /></ErrorBoundary></ProtectedRoute>} />
                  <Route path="/simulation" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><SimulationPage /></ProtectedRoute>} />
                  <Route path="/milestones" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><MilestonesPage /></ProtectedRoute>} />
                  <Route path="/activities" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><ActivitiesPage /></ProtectedRoute>} />
                  <Route path="/prs" element={<Navigate to="/snapshot" replace />} />
                  <Route path="/gap-plan" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><GapPlanPage /></ProtectedRoute>} />
                  <Route path="/education" element={<Navigate to="/gap-plan" replace />} />
                  <Route path="/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><CohortsPage /></ProtectedRoute>} />
                  <Route path="/programs" element={<ProtectedRoute allowedRoles={[UserRole.PECC]}><ProgramsPage /></ProtectedRoute>} />
                  
                  {/* Mentor Routes */}
                  <Route path="/mentor/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorDashboardPage /></ProtectedRoute>} />
                  <Route path="/mentor/activities" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorActivitiesPage /></ProtectedRoute>} />
                  <Route path="/mentor/hospitals" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorHospitalContactsPage /></ProtectedRoute>} />
                  <Route path="/mentor/milestones" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorSiteMilestonesPage /></ProtectedRoute>} />
                  <Route path="/mentor/wages" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorWagesExpensesPage /></ProtectedRoute>} />
                  <Route path="/mentor/overview" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorSnapshotPage /></ProtectedRoute>} />
                  <Route path="/mentor/reports" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><MentorReportsPage /></ProtectedRoute>} />
                  <Route path="/mentor/snapshot" element={<Navigate to="/mentor/overview" replace />} />
                  <Route path="/mentor/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.MENTOR]}><CohortsPage /></ProtectedRoute>} />
                  <Route path="/mentor/programs" element={<Navigate to="/mentor/dashboard" replace />} />
                  
                  {/* Manager Routes */}
                  <Route path="/manager/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerSnapshotPage /></ProtectedRoute>} />
                  <Route path="/manager/reports" element={<Navigate to="/manager/overview" replace />} />
                  <Route path="/manager/overview" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerOverviewPage /></ProtectedRoute>} />
                  <Route path="/manager/dashboard" element={<Navigate to="/manager/overview" replace />} />
                  <Route path="/manager/mentors" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerMentorsPage /></ProtectedRoute>} />
                  <Route path="/manager/activities" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><MentorActivitiesPage /></ProtectedRoute>} />
                  <Route path="/manager/hospitals" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><MentorHospitalContactsPage /></ProtectedRoute>} />
                  <Route path="/manager/milestones" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><MentorSiteMilestonesPage /></ProtectedRoute>} />
                  <Route path="/manager/crm" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerCRMPage /></ProtectedRoute>} />
                  <Route path="/manager/wages" element={<Navigate to="/manager/mentors" replace />} />
                  <Route path="/manager/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerCohortsPage /></ProtectedRoute>} />
                  <Route path="/manager/programs" element={<Navigate to="/manager/overview" replace />} />
                  <Route path="/manager/permissions" element={<ProtectedRoute allowedRoles={[UserRole.MANAGER]}><ManagerPermissionsPage /></ProtectedRoute>} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminDashboardPage /></ProtectedRoute>} />
                  <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminCRMPage /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<Navigate to="/admin/crm?tab=team" replace />} />
                  <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminSettingsPage /></ProtectedRoute>} />
                  <Route
                    path="/admin/reports"
                    element={
                      <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <ErrorBoundary>
                          <AdminSnapshotPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/admin/snapshot" element={<Navigate to="/admin/reports" replace />} />
                  <Route path="/admin/pipeline" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminProjectPipelinePage /></ProtectedRoute>} />
                  <Route path="/admin/cohorts" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><AdminCohortsPage /></ProtectedRoute>} />
                  {/* Programs is a tab in Settings - redirect old URL */}
                  <Route path="/admin/programs" element={<Navigate to="/admin/settings?tab=programs" replace />} />
                  
                  {/* Hospital System Routes */}
                  <Route path="/hospital-system/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.HOSPITAL_SYSTEM]}><HospitalSystemDashboardPage /></ProtectedRoute>} />
                  
                  {/* Hiring Group Routes */}
                  <Route path="/hiring-group/snapshot" element={<ProtectedRoute allowedRoles={[UserRole.HIRING_GROUP]}><HiringGroupSnapshotPage /></ProtectedRoute>} />
                  
                  {/* Common Routes */}
                  <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
                </Box>
                {!isFullBleedPublic && <Footer />}
              </Container>
            </ErrorBoundary>
          </Suspense>
        </UsageAnalyticsProvider>
      </UserProfileProvider>
    </SecurityGateShell>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <PhiGuardProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppShell />
          </Router>
        </PhiGuardProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
