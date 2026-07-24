import React, { useState, useRef } from 'react';
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
  Chip,
  Collapse,
  Badge
} from '@mui/material';
import {
  Work as WorkIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Assignment as AssignmentIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  LocalHospital as HospitalIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Timeline as TimelineIcon,
  AttachMoney as MoneyIcon,
  Settings as SettingsIcon,
  Groups as CohortsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { UserRole } from '../types/database';
import { getRoleColorHex, getRoleLabel } from '../utils/roleUtils';
import { getUserDisplayName } from '../utils/displayName';
import { useCohortNotifications } from '../hooks/useCohortNotifications';

interface NavChild {
  path: string;
  label: string;
  tab?: string; // view_tabs key for filtering
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  tab?: string;
  children?: NavChild[];
}

const HOVER_MENU_CLOSE_DELAY_MS = 150;

function filterNavItemByTabs(item: NavItem, visibleTabs: string[]): NavItem | null {
  if (!item.children?.length) {
    if (item.tab && !visibleTabs.includes(item.tab)) return null;
    return item;
  }

  const visibleChildren = item.children.filter(
    (c) => !c.tab || visibleTabs.includes(c.tab)
  );
  const parentVisible = !item.tab || visibleTabs.includes(item.tab);

  if (!parentVisible && visibleChildren.length === 0) return null;

  const effectivePath =
    parentVisible
      ? item.path
      : (visibleChildren[0]?.path ?? item.path);

  return {
    ...item,
    path: effectivePath,
    children: visibleChildren.length > 0 ? visibleChildren : undefined
  };
}

function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.path) return true;
  return Boolean(item.children?.some((c) => c.path === pathname));
}

function findNavLabel(items: NavItem[], path: string): string | undefined {
  for (const item of items) {
    if (item.path === path) return item.label;
    const child = item.children?.find((c) => c.path === path);
    if (child) return child.label;
  }
  return undefined;
}

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { userProfile, userRole, isViewingAs, viewAsRole, setViewAsRole, visibleTabs, primaryProgramLogoUrl, isViewingAsUser, viewAsUserProfile, clearViewAsUser, isLoading: profileLoading, mentorWorkMode, canToggleMentorWorkMode, setMentorWorkMode } = useUserProfile();
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
  const [expandedMobilePaths, setExpandedMobilePaths] = useState<Record<string, boolean>>({});
  const [hoverMenuKey, setHoverMenuKey] = useState<string | null>(null);
  const [hoverAnchorEl, setHoverAnchorEl] = useState<null | HTMLElement>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const openHoverMenu = (key: string, el: HTMLElement) => {
    clearHoverCloseTimer();
    setHoverMenuKey(key);
    setHoverAnchorEl(el);
  };

  const scheduleCloseHoverMenu = () => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = setTimeout(() => {
      setHoverMenuKey(null);
      setHoverAnchorEl(null);
      hoverCloseTimerRef.current = null;
    }, HOVER_MENU_CLOSE_DELAY_MS);
  };

  const closeHoverMenu = () => {
    clearHoverCloseTimer();
    setHoverMenuKey(null);
    setHoverAnchorEl(null);
  };

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

  const handleMobileNavigation = (path: string, label?: string) => {
    const items = getNavigationItems();
    const resolvedLabel = label ?? findNavLabel(items, path) ?? path;
    trackLinkClick(path, resolvedLabel, 'navbar');
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleDesktopNavigation = (path: string, label: string) => {
    trackLinkClick(path, label, 'navbar');
    navigate(path);
    closeHoverMenu();
  };

  const toggleMobileExpand = (path: string) => {
    setExpandedMobilePaths((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleToggleMentorWorkMode = () => {
    if (!canToggleMentorWorkMode) return;
    const nextMode = mentorWorkMode === 'mentor' ? 'pecc' : 'mentor';
    setMentorWorkMode(nextMode);
    const nextPath = nextMode === 'pecc' ? '/dashboard' : '/mentor/dashboard';
    trackLinkClick(nextPath, `Switch to ${nextMode.toUpperCase()} mode`, 'navbar-role-chip');
    navigate(nextPath);
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
          { path: '/admin/reports', label: 'Reports', icon: <TimelineIcon /> },
          { path: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> }
        ];

      case UserRole.MANAGER: {
        const managerItems: NavItem[] = [
          { path: '/manager/overview', label: 'Overview', icon: <DashboardIcon /> },
          { path: '/manager/mentors', label: 'Mentors', icon: <PeopleIcon /> },
          { path: '/manager/crm', label: 'CRM', icon: <BusinessIcon /> },
          { path: '/manager/cohorts', label: 'Cohorts', icon: <CohortsIcon /> },
          { path: '/manager/permissions', label: 'Team Permissions', icon: <SettingsIcon /> }
        ];
        
        // If manager has hospital assignments (working as mentor), add mentor-like tabs
        if (userProfile?.has_hospital_assignments) {
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
          { path: '/mentor/reports', label: 'Reports', icon: <TimelineIcon /> },
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
          { path: '/snapshot', label: 'Snapshot', icon: <TimelineIcon />, tab: 'snapshot' },
          {
            path: '/activities',
            label: 'Activities',
            icon: <WorkIcon />,
            tab: 'activities',
            children: [
              { path: '/activities', label: 'Activity Log', tab: 'activities' },
              { path: '/milestones', label: 'PECC Checklist', tab: 'milestones' }
            ]
          },
          {
            path: '/gap-plan',
            label: 'Gap Closures',
            icon: <AssignmentIcon />,
            tab: 'gap-plan',
            children: [
              { path: '/gap-plan', label: 'Assessment Gaps', tab: 'gap-plan' },
              { path: '/simulation', label: 'Simulation Gaps', tab: 'simulation' }
            ]
          }
        ];
        // During profile hydration and any unexpected empty tab visibility state,
        // keep core PECC tabs visible (with children) instead of leaving only Cohorts in nav.
        let filteredItems: NavItem[];
        if (profileLoading) {
          filteredItems = peccItems;
        } else {
          filteredItems = peccItems
            .map((item) => filterNavItemByTabs(item, visibleTabs))
            .filter((item): item is NavItem => item !== null);
          if (filteredItems.length === 0) {
            filteredItems = peccItems;
          }
        }
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
  const hoverMenuItem = navigationItems.find((i) => i.label === hoverMenuKey && i.children?.length);

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
label={canToggleMentorWorkMode ? `${getRoleLabel(userRole)} (switch)` : getRoleLabel(userRole)}
            size="small"
            onClick={canToggleMentorWorkMode ? handleToggleMentorWorkMode : undefined}
            clickable={canToggleMentorWorkMode}
            sx={{ bgcolor: getRoleColorHex(userRole), color: 'white' }}
          />
        </Box>
        
        <List>
          {navigationItems.map((item) => {
            const isCohorts = item.path === '/cohorts' || item.path === '/mentor/cohorts' || item.path === '/manager/cohorts';
            const icon = isCohorts && cohortNotifications > 0 ? (
              <Badge badgeContent={cohortNotifications} color="error" max={99}>
                {item.icon}
              </Badge>
            ) : item.icon;
            const active = isNavItemActive(item, location.pathname);
            const hasChildren = Boolean(item.children?.length);
            const expanded = Boolean(expandedMobilePaths[item.path]);

            return (
              <React.Fragment key={`${item.path}-${item.label}`}>
                <ListItem
                  button
                  onClick={() => handleMobileNavigation(item.path, item.label)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    backgroundColor: active ? 'primary.light' : 'transparent',
                    '&:hover': { backgroundColor: 'primary.light' },
                    pr: hasChildren ? 0.5 : undefined
                  }}
                >
                  <ListItemIcon sx={{ color: active ? 'primary.main' : 'inherit' }}>
                    {icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    sx={{ color: active ? 'primary.main' : 'inherit' }}
                  />
                  {hasChildren && (
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMobileExpand(item.path);
                      }}
                      sx={{ color: active ? 'primary.main' : 'inherit' }}
                    >
                      {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  )}
                </ListItem>
                {hasChildren && (
                  <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.children!.map((child) => {
                        const childActive = location.pathname === child.path;
                        return (
                          <ListItem
                            key={`${child.path}-${child.label}`}
                            button
                            onClick={() => handleMobileNavigation(child.path, child.label)}
                            sx={{
                              pl: 4,
                              borderRadius: 1,
                              mb: 0.5,
                              backgroundColor: childActive ? 'primary.light' : 'transparent',
                              '&:hover': { backgroundColor: 'primary.light' }
                            }}
                          >
                            <ListItemText
                              primary={child.label}
                              sx={{ color: childActive ? 'primary.main' : 'inherit' }}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Collapse>
                )}
              </React.Fragment>
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
          role="status"
          aria-live="polite"
          sx={{
            bgcolor: isViewingAsUser ? 'info.main' : 'warning.main',
            color: isViewingAsUser ? 'info.contrastText' : 'warning.contrastText',
            py: 0.75,
            px: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            width: '100%',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
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
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Exit view as
            </Button>
          </Box>
          {isViewingAsUser && (
            <Typography variant="caption" sx={{ opacity: 0.92, textAlign: 'center', maxWidth: 720, px: 1 }}>
              Some data still loads under your signed-in account (database row-level security). Counts and lists may not exactly match what this user sees when they log in themselves.
            </Typography>
          )}
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
            // Base gap keeps Activities ↔ Gap Closures tight; PECC group gaps applied via ml below.
            gap: isSmallDesktop ? 0.5 : 1, 
            mr: 2,
            flexWrap: 'nowrap',
            overflow: 'hidden',
            minWidth: 0,
            flexGrow: 1,
            justifyContent: 'center'
          }}>
            {navigationItems.map((item) => {
              const isCohorts = item.path === '/cohorts' || item.path === '/mentor/cohorts' || item.path === '/manager/cohorts';
              const icon = isCohorts && cohortNotifications > 0 ? (
                <Badge badgeContent={cohortNotifications} color="error" max={99}>
                  {item.icon}
                </Badge>
              ) : item.icon;
              const active = isNavItemActive(item, location.pathname);
              const hasVisibleChildren = Boolean(item.children?.length);
              // PECC grouping: Snapshot | Activities + Gap Closures | Cohorts
              const peccGroupGap = isSmallDesktop ? 6.5 : 11;
              const peccMarginLeft =
                userRole === UserRole.PECC && (item.path === '/activities' || item.path === '/cohorts')
                  ? peccGroupGap
                  : 0;

              return (
                <Button
                  key={`${item.path}-${item.label}`}
                  color="inherit"
                  startIcon={isTablet ? null : icon}
                  endIcon={hasVisibleChildren && !isTablet ? <ExpandMoreIcon sx={{ fontSize: '1rem !important', ml: -0.5 }} /> : undefined}
                  onClick={() => handleDesktopNavigation(item.path, item.label)}
                  onMouseEnter={(e) => {
                    if (hasVisibleChildren) {
                      openHoverMenu(item.label, e.currentTarget);
                    }
                  }}
                  onMouseLeave={() => {
                    if (hasVisibleChildren) scheduleCloseHoverMenu();
                  }}
                  sx={{
                    backgroundColor: active ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
                    borderRadius: 1,
                    px: isSmallDesktop ? 1 : 2,
                    py: 1,
                    minWidth: 'auto',
                    fontSize: isSmallDesktop ? '0.875rem' : '0.9rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    ml: peccMarginLeft
                  }}
                >
                  {item.label}
                </Button>
              );
            })}

            {/* Hover dropdown for items with children */}
            <Menu
              anchorEl={hoverAnchorEl}
              open={Boolean(hoverMenuItem && hoverAnchorEl)}
              onClose={closeHoverMenu}
              MenuListProps={{
                onMouseEnter: clearHoverCloseTimer,
                onMouseLeave: scheduleCloseHoverMenu,
                sx: { py: 0.5 }
              }}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              disableAutoFocusItem
              disableRestoreFocus
              slotProps={{
                paper: {
                  onMouseEnter: clearHoverCloseTimer,
                  onMouseLeave: scheduleCloseHoverMenu,
                  sx: { mt: 0.5, minWidth: 180 }
                }
              }}
              sx={{ pointerEvents: 'none', '& .MuiPaper-root': { pointerEvents: 'auto' } }}
            >
              {hoverMenuItem?.children?.map((child) => (
                <MenuItem
                  key={`${child.path}-${child.label}`}
                  selected={location.pathname === child.path}
                  onClick={() => handleDesktopNavigation(child.path, child.label)}
                >
                  {child.label}
                </MenuItem>
              ))}
            </Menu>
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
              label={canToggleMentorWorkMode ? `${getRoleLabel(userRole)} (switch)` : getRoleLabel(userRole)} 
              size="small"
              onClick={canToggleMentorWorkMode ? handleToggleMentorWorkMode : undefined}
              clickable={canToggleMentorWorkMode}
              sx={{ 
                bgcolor: getRoleColorHex(userRole), 
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                ...(canToggleMentorWorkMode ? { cursor: 'pointer' } : {})
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
