import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Chip,
  Button,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, UserRole } from '../../types/database';

interface PermissionState {
  [role: string]: {
    [permission: string]: boolean;
  };
}

// Group permissions by category for better organization
const PERMISSION_GROUPS = {
  'Tool & Views': [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_AGGREGATED_DATA,
    PERMISSIONS.VIEW_SNAPSHOT,
    PERMISSIONS.EXPORT_DATA
  ],
  'Activities': [
    PERMISSIONS.VIEW_OWN_ACTIVITIES,
    PERMISSIONS.VIEW_TEAM_ACTIVITIES,
    PERMISSIONS.VIEW_ALL_ACTIVITIES,
    PERMISSIONS.MANAGE_OWN_ACTIVITIES
  ],
  'Hospitals': [
    PERMISSIONS.VIEW_OWN_HOSPITALS,
    PERMISSIONS.VIEW_ALL_HOSPITALS,
    PERMISSIONS.MANAGE_HOSPITALS
  ],
  'Contacts & CRM': [
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.MANAGE_CONTACTS
  ],
  'User Management': [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.SEND_INVITATIONS
  ],
  'Assessments & Plans': [
    PERMISSIONS.VIEW_PRS,
    PERMISSIONS.VIEW_GAP_PLANS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_SIMULATIONS
  ],
  'Wages & Expenses': [
    PERMISSIONS.VIEW_OWN_WAGES,
    PERMISSIONS.VIEW_TEAM_WAGES,
    PERMISSIONS.MANAGE_WAGES
  ],
  'Administration': [
    PERMISSIONS.MANAGE_PERMISSIONS,
    PERMISSIONS.SYSTEM_SETTINGS
  ]
};

// Format permission key to readable label
const formatPermissionLabel = (key: string): string => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const AdminPermissionsPage: React.FC = () => {
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const roles: UserRole[] = [UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC];

  useEffect(() => {
    // Initialize with default permissions
    const initialPermissions: PermissionState = {};
    roles.forEach(role => {
      initialPermissions[role] = {};
      Object.values(PERMISSIONS).forEach(perm => {
        initialPermissions[role][perm] = DEFAULT_ROLE_PERMISSIONS[role]?.includes(perm) || false;
      });
    });
    setPermissions(initialPermissions);
  }, []);

  const handleTogglePermission = (role: UserRole, permission: string) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permission]: !prev[role][permission]
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // In production, this would save to Supabase
    console.log('Saving permissions:', permissions);
    setSnackbar({ open: true, message: 'Permissions saved successfully', severity: 'success' });
    setHasChanges(false);
  };

  const handleReset = () => {
    const initialPermissions: PermissionState = {};
    roles.forEach(role => {
      initialPermissions[role] = {};
      Object.values(PERMISSIONS).forEach(perm => {
        initialPermissions[role][perm] = DEFAULT_ROLE_PERMISSIONS[role]?.includes(perm) || false;
      });
    });
    setPermissions(initialPermissions);
    setHasChanges(false);
    setSnackbar({ open: true, message: 'Permissions reset to defaults', severity: 'success' });
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      manager: '#9c27b0',
      mentor: '#ff9800',
      pecc: '#2196f3'
    };
    return colors[role] || '#757575';
  };

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Role Permissions</Typography>
          <Typography color="textSecondary">
            Configure which features each user role can access
          </Typography>
        </Box>
        <Box>
          <Button 
            startIcon={<RefreshIcon />} 
            onClick={handleReset}
            sx={{ mr: 1 }}
          >
            Reset to Defaults
          </Button>
          <Button 
            variant="contained" 
            startIcon={<SaveIcon />} 
            onClick={handleSave}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You have unsaved changes. Click "Save Changes" to apply them.
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>Note:</strong> Admin users always have full access to all features. These settings only affect Manager, Mentor, and PECC roles.
      </Alert>

      {/* Permissions by Group */}
      {Object.entries(PERMISSION_GROUPS).map(([groupName, groupPermissions]) => (
        <Accordion key={groupName} defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">{groupName}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '40%' }}>Permission</TableCell>
                    {roles.map(role => (
                      <TableCell key={role} align="center">
                        <Chip 
                          label={role.toUpperCase()} 
                          size="small" 
                          sx={{ bgcolor: getRoleColor(role), color: 'white' }}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupPermissions.map(permission => (
                    <TableRow key={permission}>
                      <TableCell>
                        <Typography variant="body2">
                          {formatPermissionLabel(permission)}
                        </Typography>
                      </TableCell>
                      {roles.map(role => (
                        <TableCell key={`${role}-${permission}`} align="center">
                          <Switch
                            checked={permissions[role]?.[permission] || false}
                            onChange={() => handleTogglePermission(role, permission)}
                            color="primary"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Summary */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" gutterBottom>Permission Summary</Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          {roles.map(role => {
            const enabledCount = Object.values(permissions[role] || {}).filter(Boolean).length;
            const totalCount = Object.values(PERMISSIONS).length;
            return (
              <Box key={role}>
                <Chip 
                  label={role.toUpperCase()} 
                  size="small" 
                  sx={{ bgcolor: getRoleColor(role), color: 'white', mb: 1 }}
                />
                <Typography variant="body2">
                  {enabledCount} of {totalCount} permissions enabled
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPermissionsPage;
