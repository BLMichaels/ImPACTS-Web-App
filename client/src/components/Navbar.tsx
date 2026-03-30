import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip
} from '@mui/material';
import {
  Work as WorkIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Assignment as AssignmentIcon,
  Menu as MenuIcon,
  PlayArrow as PlayIcon,
  Dashboard as DashboardIcon,
  LocalHospital as HospitalIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Timeline as TimelineIcon,
  AttachMoney as MoneyIcon,
  Settings as SettingsIcon,
  AccountTree as PipelineIcon,
  Groups as CohortsIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { UserRole } from '../types/database';
import { getRoleColorHex, getRoleLabel } from '../utils/roleUtils';
import { getUserDisplayName } from '../utils/displayName';
import { useCohortNotifications } from '../hooks/useCohortNotifications';
import { Badge } from '@mui/material';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { userProfile, userRole, isViewingAs, viewAsRole, setViewAsRole, visibleTabs, primaryProgramLogoUrl, isViewingAsUser, viewAsUserProfile, clearViewAsUser } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackLinkClick } = useUsageAnalytics();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const cohortNotifications = useCohortNotifications();
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  const isSmallDesktop = useMediaQuery(theme.breakpoints.down('xl'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
    handleClose();
  };

  const handleProfile = () => {
    navigate('/account');
    handleClose();
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const handleMobileNavigation = (path: string) => {
    const items = getNavigationItems();
    const item = items.find((i) => i.path === path);
    trackLinkClick(path, item?.label ?? path, 'navbar');
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Navigation items based on user role
  const getNavigationItems = (): NavItem[] => {
    if (!userProfile) return [];

    switch (userRole) {
      case UserRole.ADMIN:
        // No Dashboard tab: Admins reach home by clicking the logo in the top left.
        return [
          { path: '/admin/crm', label: 'CRM', icon: <BusinessIcon /> },
          { path: '/admin/cohorts', label: 'Cohorts', icon: <CohortsIcon /> },
          { path: '/admin/pipeline', label: 'Project Pipeline', icon: <PipelineIcon /> },
          { path: '/admin/reports', label: 'Reports', icon: <TimelineIcon /> },
          { path: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> }
        ];

      case UserRole.MANAGER: {
        const managerItems: NavItem[] = [
          { path: '/manager/overview', label: 'Overview', icon: <DashboardIcon /> },
          { path: '/manager/snapshot', label: 'Team snapshot', icon: <TimelineIcon /> },
          { path: '/manager/mentors', label: 'Mentors', icon: <PeopleIcon /> },
          { path: '/manager/crm', label: 'CRM', icon: <BusinessIcon /> },
          { path: '/manager/cohorts', label: 'Cohorts', icon: <CohortsIcon /> },
          { path: '/manager/permissions', label: 'Team Permissions', icon: <SettingsIcon /> }
        ];
        
        // If manager has hospital assignments (working as mentor), add mentor-like tabs
        if (userProfile && (userProfile as any).has_hospital_assignments) {
          managerItems.splice(1, 0, 
            { path: '/manager/activities', label: 'My Activities', icon: <WorkIcon /> },
            { path: '/manager/hospitals', label: 'My Hospitals', icon: <HospitalIcon /> },
            { path: '/manager/milestones', label: 'Site Milestones', icon: <AssignmentIcon /> }
          );
        }
        
        return managerItems;
      }

      case UserRole.MENTOR: {
        const mentorItems: NavItem[] = [
          { path: '/mentor/overview', label: 'Overview', icon: <DashboardIcon /> },
          { path: '/mentor/activities', label: 'Activities', icon: <WorkIcon /> },
          { path: '/mentor/hospitals', label: 'Hospitals', icon: <HospitalIcon /> },
          { path: '/mentor/milestones', label: 'Site Milestones', icon: <AssignmentIcon /> },
          { path: '/mentor/cohorts', label: 'Cohorts', icon: <CohortsIcon /> }
        ];
        // Only show wages tab if admin has enabled it for this mentor
        if (userProfile && (userProfile as any).wages_enabled) {
          mentorItems.push({ path: '/mentor/wages', label: 'Wages', icon: <MoneyIcon /> });
        }
        return mentorItems;
      }

      case UserRole.PECC:
      default: {
        const peccItems: NavItem[] = [
          { path: '/snapshot', label: 'Snapshot', icon: <TimelineIcon /> },
          { path: '/activities', label: 'Activities', icon: <WorkIcon /> },
          { path: '/milestones', label: 'Checklist', icon: <AssignmentIcon /> },
          { path: '/gap-plan', label: 'Gap Closure', icon: <AssignmentIcon /> },
          { path: '/simulation', label: 'Simulation', icon: <PlayIcon /> }
        ];
        const pathToTab: Record<string, string> = { '/snapshot': 'snapshot', '/activities': 'activities', '/milestones': 'milestones', '/gap-plan': 'gap-plan', '/simulation': 'simulation' };
        // Empty visibleTabs = show all PECC tabs (e.g. view-as before load or no restrictions). Non-empty = filter to allowed tabs.
        let filteredItems = visibleTabs && visibleTabs.length > 0
          ? peccItems.filter(item => visibleTabs.includes(pathToTab[item.path] ?? ''))
          : peccItems;
        // Cohorts is always available (not site-specific)
        filteredItems.push({ path: '/cohorts', label: 'Cohorts', icon: <CohortsIcon /> });
        return filteredItems;
      }

      case UserRole.HOSPITAL_SYSTEM:
        return [
          { path: '/hospital-system/dashboard', label: 'Support Tool', icon: <DashboardIcon /> }
        ];

      case UserRole.HIRING_GROUP:
        return [
          { path: '/hiring-group/snapshot', label: 'Snapshot', icon: <TimelineIcon /> }
        ];
    }
  };

  const getDashboardPath = (): string => {
    switch (userRole) {
      case UserRole.ADMIN: return '/admin/dashboard';
      case UserRole.MANAGER: return '/manager/overview';
      case UserRole.MENTOR: return '/mentor/dashboard';
      case UserRole.HOSPITAL_SYSTEM: return '/hospital-system/dashboard';
      case UserRole.HIRING_GROUP: return '/hiring-group/snapshot';
      default: return '/dashboard';
    }
  };

  const navigationItems = getNavigationItems();

  // Mobile Drawer
  const MobileDrawer = () => (
    <Drawer
      anchor="left"
      open={mobileMenuOpen}
      onClose={handleMobileMenuClose}
      PaperProps={{ sx: { width: 280 } }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
            ImPACTS
          </Typography>
          <Chip 
label={getRoleLabel(userRole)}
            size="small"
            sx={{ bgcolor: getRoleColorHex(userRole), color: 'white' }}
          />
        </Box>
        
        <List>
          {navigationItems.map((item) => {
            const isCohorts = item.path === '/cohorts' || item.path === '/mentor/cohorts';
            const icon = isCohorts && cohortNotifications > 0 ? (
              <Badge badgeContent={cohortNotifications} color="error" max={99}>
                {item.icon}
              </Badge>
            ) : item.icon;
            
            return (
              <ListItem 
                key={item.path}
                button
                onClick={() => handleMobileNavigation(item.path)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  backgroundColor: location.pathname === item.path ? 'primary.light' : 'transparent',
                  '&:hover': { backgroundColor: 'primary.light' }
                }}
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'inherit' }}>
                  {icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  sx={{ color: location.pathname === item.path ? 'primary.main' : 'inherit' }}
                />
              </ListItem>
            );
          })}
        </List>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {getRoleLabel(userRole)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getUserDisplayName(userProfile)}
          </Typography>
        </Box>
        
        <Button
          fullWidth
          startIcon={<AccountCircleIcon />}
          onClick={() => { handleProfile(); handleMobileMenuClose(); }}
          sx={{ mt: 2 }}
        >
          Profile
        </Button>
        
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => { handleLogout(); handleMobileMenuClose(); }}
          sx={{ mt: 1 }}
        >
          Logout
        </Button>
      </Box>
    </Drawer>
  );

  if (!currentUser) {
    return null;
  }

  return (
    <>
      {/* View As Banner - viewing as another role or as a specific user */}
      {(isViewingAsUser || isViewingAs) && (
        <Box 
          sx={{ 
            bgcolor: isViewingAsUser ? 'info.main' : 'warning.main', 
            color: isViewingAsUser ? 'info.contrastText' : 'warning.contrastText',
            py: 0.5,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            {isViewingAsUser && viewAsUserProfile
              ? `👁️ Viewing as ${getUserDisplayName(viewAsUserProfile)} (${(userRole ?? viewAsUserProfile.role)?.toString().toUpperCase().replace('_', ' ') ?? 'User'})`
              : `👁️ Viewing as ${viewAsRole?.toUpperCase()}`}
          </Typography>
          <Button 
            size="small" 
            variant="outlined" 
            color="inherit"
            onClick={() => {
              if (isViewingAsUser) clearViewAsUser();
              else setViewAsRole(null);
            }}
            sx={{ 
              py: 0, 
              minHeight: '24px',
              borderColor: 'inherit',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            Exit
          </Button>
        </Box>
      )}
      <AppBar
        position="sticky"
        elevation={1}
        sx={{
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar
        }}
      >
      <Toolbar sx={{ 
        minHeight: '64px',
        paddingX: { xs: 1, sm: 2 },
        justifyContent: 'space-between',
        overflow: 'hidden'
      }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setMobileMenuOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Logo/Brand */}
        <Box
          sx={{ 
            cursor: 'pointer',
            flexShrink: 0,
            mr: 2,
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={() => {
            const dashboardPath = getDashboardPath();
            trackLinkClick(dashboardPath, 'Support Tool', 'navbar');
            navigate(dashboardPath);
          }}
        >
          <img 
            key={primaryProgramLogoUrl || 'default-brand'}
            src={primaryProgramLogoUrl || '/impacts-logo.png'} 
            alt="Logo" 
            style={{ 
              height: isMobile ? '35px' : '45px',
              width: 'auto'
            }}
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              const url = primaryProgramLogoUrl;
              if (!url) {
                el.style.display = 'none';
                return;
              }
              // One retry with cache-bust (stale CDN/browser cache after logo re-upload)
              const sep = url.includes('?') ? '&' : '?';
              if (!el.dataset.retried) {
                el.dataset.retried = '1';
                el.src = `${url}${sep}t=${Date.now()}`;
                return;
              }
              console.warn('[Navbar] Program logo failed to load; using default.', url);
              el.src = '/impacts-logo.png';
              el.alt = 'ImPACTS Logo';
            }}
          />
        </Box>

        {/* Desktop Navigation Items */}
        {!isMobile && (
          <Box sx={{ 
            display: 'flex', 
            gap: isSmallDesktop ? 0.5 : 1, 
            mr: 2,
            flexWrap: 'nowrap',
            overflow: 'hidden',
            minWidth: 0,
            flexGrow: 1,
            justifyContent: 'center'
          }}>
            {navigationItems.map((item) => {
              const isCohorts = item.path === '/cohorts' || item.path === '/mentor/cohorts';
              const icon = isCohorts && cohortNotifications > 0 ? (
                <Badge badgeContent={cohortNotifications} color="error" max={99}>
                  {item.icon}
                </Badge>
              ) : item.icon;
              
              return (
                <Button
                  key={item.path}
                  color="inherit"
                  startIcon={isTablet ? null : icon}
                  onClick={() => {
                    trackLinkClick(item.path, item.label, 'navbar');
                    navigate(item.path);
                  }}
                  sx={{
                    backgroundColor: location.pathname === item.path ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                    borderRadius: 1,
                    px: isSmallDesktop ? 1 : 2,
                    py: 1,
                    minWidth: 'auto',
                    fontSize: isSmallDesktop ? '0.875rem' : '0.9rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>
        )}

        {/* User Menu - Desktop */}
        {!isMobile && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isSmallDesktop ? 1 : 2,
            flexShrink: 0
          }}>
            {/* Role Badge */}
            <Chip 
              label={getRoleLabel(userRole)} 
              size="small"
              sx={{ 
                bgcolor: getRoleColorHex(userRole), 
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem'
              }}
            />

            {/* User Info */}
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: isSmallDesktop ? '0.8rem' : '0.875rem',
                display: isTablet ? 'none' : 'block'
              }}
            >
              {getUserDisplayName(userProfile)}
            </Typography>

            <IconButton
              size="large"
              aria-label="account menu"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar sx={{ 
                width: isSmallDesktop ? 28 : 32, 
                height: isSmallDesktop ? 28 : 32, 
                bgcolor: 'rgba(255, 255, 255, 0.2)' 
              }}>
                {userProfile?.first_name?.charAt(0)}{userProfile?.last_name?.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>
        )}

        {/* Mobile User Avatar */}
        {isMobile && (
          <IconButton
            size="large"
            aria-label="account menu"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              {userProfile?.first_name?.charAt(0)}{userProfile?.last_name?.charAt(0)}
            </Avatar>
          </IconButton>
        )}

        {/* User Menu Dropdown */}
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          keepMounted
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
          <MenuItem onClick={handleProfile}>
            <AccountCircleIcon sx={{ mr: 1 }} />
            Profile
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutIcon sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
      
      <MobileDrawer />
    </AppBar>
    </>
  );
};

export default Navbar;
