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
  Assessment as AssessmentIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Assignment as AssignmentIcon,
  Menu as MenuIcon,
  PlayArrow as PlayIcon,
  School as SchoolIcon,
  Dashboard as DashboardIcon,
  LocalHospital as HospitalIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Timeline as TimelineIcon,
  AttachMoney as MoneyIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { userProfile, userRole } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
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
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Navigation items based on user role
  const getNavigationItems = (): NavItem[] => {
    if (!userProfile) return [];

    switch (userRole) {
      case UserRole.ADMIN:
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { path: '/admin/users', label: 'Users', icon: <PeopleIcon /> },
          { path: '/admin/crm', label: 'CRM', icon: <BusinessIcon /> },
          { path: '/admin/permissions', label: 'Permissions', icon: <SecurityIcon /> }
        ];

      case UserRole.MANAGER:
        return [
          { path: '/manager/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { path: '/manager/mentors', label: 'Mentors', icon: <PeopleIcon /> },
          { path: '/manager/crm', label: 'CRM', icon: <BusinessIcon /> }
        ];

      case UserRole.MENTOR:
        return [
          { path: '/mentor/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { path: '/mentor/activities', label: 'Activities', icon: <WorkIcon /> },
          { path: '/mentor/hospitals', label: 'Hospitals', icon: <HospitalIcon /> },
          { path: '/mentor/milestones', label: 'Milestones', icon: <AssignmentIcon /> },
          { path: '/mentor/snapshot', label: 'Snapshot', icon: <TimelineIcon /> },
          { path: '/mentor/wages', label: 'Wages', icon: <MoneyIcon /> }
        ];

      case UserRole.PECC:
      default:
        const peccItems: NavItem[] = [
          { path: '/snapshot', label: 'Snapshot', icon: <TimelineIcon /> },
          { path: '/simulation', label: 'Simulation', icon: <PlayIcon /> },
          { path: '/activities', label: 'Activities', icon: <WorkIcon /> },
          { path: '/milestones', label: 'Checklist', icon: <AssignmentIcon /> },
          { path: '/education', label: 'Education', icon: <SchoolIcon /> },
          { path: '/gap-plan', label: 'Gap Plan', icon: <AssignmentIcon /> }
        ];
        
        // Add PRS if enabled
        if ((userProfile as any).prsTabVisible !== false) {
          peccItems.splice(3, 0, { path: '/prs', label: 'PRS', icon: <AssessmentIcon /> });
        }
        
        return peccItems;
    }
  };

  const getDashboardPath = (): string => {
    switch (userRole) {
      case UserRole.ADMIN: return '/admin/dashboard';
      case UserRole.MANAGER: return '/manager/dashboard';
      case UserRole.MENTOR: return '/mentor/dashboard';
      default: return '/dashboard';
    }
  };

  const getRoleColor = (): string => {
    switch (userRole) {
      case UserRole.ADMIN: return '#d32f2f';
      case UserRole.MANAGER: return '#9c27b0';
      case UserRole.MENTOR: return '#ff9800';
      default: return '#1976d2';
    }
  };

  const getRoleLabel = (): string => {
    switch (userRole) {
      case UserRole.ADMIN: return 'Admin';
      case UserRole.MANAGER: return 'Manager';
      case UserRole.MENTOR: return 'Mentor';
      default: return 'PECC';
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
            label={getRoleLabel()} 
            size="small" 
            sx={{ bgcolor: getRoleColor(), color: 'white' }}
          />
        </Box>
        
        <List>
          {navigationItems.map((item) => (
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
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                sx={{ color: location.pathname === item.path ? 'primary.main' : 'inherit' }}
              />
            </ListItem>
          ))}
        </List>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {getRoleLabel()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {userProfile?.first_name} {userProfile?.last_name}
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
    <AppBar position="static">
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
          onClick={() => navigate(getDashboardPath())}
        >
          <img 
            src="/impacts-logo.png" 
            alt="ImPACTS Logo" 
            style={{ 
              height: isMobile ? '35px' : '45px',
              width: 'auto'
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <Typography 
            variant="h6" 
            sx={{ 
              ml: 1,
              fontWeight: 'bold',
              display: { xs: 'none', sm: 'block' }
            }}
          >
            ImPACTS
          </Typography>
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
            {navigationItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                startIcon={isTablet ? null : item.icon}
                onClick={() => navigate(item.path)}
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
            ))}
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
              label={getRoleLabel()} 
              size="small"
              sx={{ 
                bgcolor: getRoleColor(), 
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
              {userProfile?.first_name} {userProfile?.last_name}
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
  );
};

export default Navbar;
