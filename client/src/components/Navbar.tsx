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
  Tooltip,
  Divider,
  useMediaQuery,
  useTheme,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
  import {
    Work as WorkIcon,
    Assessment as AssessmentIcon,
    AccountCircle as AccountCircleIcon,
    Logout as LogoutIcon,
    Settings as SettingsIcon,
    Business as BusinessIcon,
    People as PeopleIcon,
    Timeline as TimelineIcon,
    AttachMoney as AttachMoneyIcon,
    AdminPanelSettings as AdminPanelSettingsIcon,
    SupervisorAccount as SupervisorAccountIcon,
    Assignment as AssignmentIcon,
    Work as ActivityIcon,
    Menu as MenuIcon,
    PlayArrow as PlayIcon,
    School as SchoolIcon
  } from '@mui/icons-material';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile, UserTier } from '../context/UserProfileContext';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Responsive breakpoints
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

  // Navigation items based on user tier
  const getNavigationItems = () => {
    const baseItems = [
      { path: '/activities', label: 'Activities', icon: <WorkIcon /> },
      { path: '/milestones', label: 'Checklist', icon: <AssignmentIcon /> },
      { path: '/education', label: 'Education', icon: <SchoolIcon /> },
      { path: '/gap-plan', label: 'Gap Plan', icon: <AssignmentIcon /> }
    ];

    // Add PRS tab only if it's enabled in user settings (PECC users only)
    if (userProfile?.tier === UserTier.PECC && (userProfile as any).prsTabVisible !== false) {
      baseItems.splice(2, 0, { path: '/prs', label: 'PRS', icon: <AssessmentIcon /> });
    }

    // Default to PECC navigation if userProfile is not loaded yet
    if (!userProfile) {
      return baseItems;
    }

    switch (userProfile.tier) {
      case UserTier.PECC:
        return [
          { path: '/snapshot', label: 'Snapshot', icon: <TimelineIcon /> },
          { path: '/simulation', label: 'Simulation', icon: <PlayIcon /> },
          ...baseItems
        ];

      case UserTier.PRISM:
        return [
          { path: '/prism/activities', label: 'PRISM Activities', icon: <WorkIcon /> }
        ];

      default:
        return baseItems;
    }
  };



  const navigationItems = getNavigationItems();

  // Mobile Drawer Component
  const MobileDrawer = () => (
    <Drawer
      anchor="left"
      open={mobileMenuOpen}
      onClose={handleMobileMenuClose}
      PaperProps={{
        sx: { width: 280 }
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
            ImPACTS {userProfile && userProfile.tier !== UserTier.PECC && `- ${userProfile.tier}`}
          </Typography>
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
                '&:hover': {
                  backgroundColor: 'primary.light',
                }
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
            {userProfile.tier}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {userProfile.firstName} {userProfile.lastName}
          </Typography>
        </Box>
        
        <Button
          fullWidth
          startIcon={<AccountCircleIcon />}
          onClick={() => {
            handleProfile();
            handleMobileMenuClose();
          }}
          sx={{ mt: 2 }}
        >
          Profile
        </Button>
        
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => {
            handleLogout();
            handleMobileMenuClose();
          }}
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
          onClick={() => {
            if (userProfile && userProfile.tier === UserTier.PRISM) {
              navigate('/prism/dashboard');
            } else {
              navigate('/dashboard');
            }
          }}
        >
          <img 
            src="/impacts-logo.png" 
            alt="ImPACTS Logo" 
            style={{ 
              height: isMobile ? '35px' : '45px',
              width: 'auto'
            }}
          />
          {userProfile && userProfile.tier !== UserTier.PECC && (
            <Typography 
              variant="body2" 
              sx={{ 
                ml: 1,
                color: '#666',
                fontSize: '0.8rem'
              }}
            >
              - {userProfile.tier}
            </Typography>
          )}
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
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  },
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


        {/* User Menu - Desktop Only */}
        {!isMobile && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isSmallDesktop ? 1 : 2,
            flexShrink: 0
          }}>
            {/* User Tier Badge */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: isSmallDesktop ? 1 : 2,
              py: 0.5,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: isSmallDesktop ? '0.7rem' : '0.75rem'
              }}>
                {userProfile.tier}
              </Typography>
            </Box>

            {/* User Info */}
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: isSmallDesktop ? '0.8rem' : '0.875rem',
                display: isTablet ? 'none' : 'block'
              }}
            >
              {userProfile.firstName} {userProfile.lastName}
            </Typography>

            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <Avatar sx={{ 
                width: isSmallDesktop ? 28 : 32, 
                height: isSmallDesktop ? 28 : 32, 
                bgcolor: 'rgba(255, 255, 255, 0.2)' 
              }}>
                {userProfile.firstName.charAt(0)}{userProfile.lastName.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>
        )}

        {/* Mobile User Avatar */}
        {isMobile && (
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255, 255, 255, 0.2)' }}>
              {userProfile.firstName.charAt(0)}{userProfile.lastName.charAt(0)}
            </Avatar>
          </IconButton>
        )}

        {/* User Menu Dropdown */}
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          keepMounted
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          open={Boolean(anchorEl)}
          onClose={handleClose}
        >
          <MenuItem onClick={handleProfile}>
            <AccountCircleIcon sx={{ mr: 1 }} />
            Profile
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
      
      {/* Mobile Drawer */}
      <MobileDrawer />
    </AppBar>
  );
};

export default Navbar; 