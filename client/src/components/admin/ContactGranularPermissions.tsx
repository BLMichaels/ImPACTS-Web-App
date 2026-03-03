/**
 * Compact Granular Permissions for a single user - shown in CRM contact detail.
 * Allows managing permissions and tab visibility without leaving the CRM.
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControlLabel,
  Switch,
  Grid,
  CircularProgress,
  Snackbar,
  Alert,
  Divider
} from '@mui/material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { PERMISSIONS, PECC_TAB_KEYS, UserPermission, ViewTab } from '../../types/database';
import { DEFAULT_ROLE_PERMISSIONS } from '../../types/database';
import { UserRole, normalizeUserRole } from '../../types/database';

const PERMISSION_GROUPS: Record<string, string[]> = {
  'Dashboard & Views': [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_AGGREGATED_DATA, PERMISSIONS.VIEW_SNAPSHOT, PERMISSIONS.EXPORT_DATA],
  'Activities': [PERMISSIONS.VIEW_OWN_ACTIVITIES, PERMISSIONS.VIEW_TEAM_ACTIVITIES, PERMISSIONS.VIEW_ALL_ACTIVITIES, PERMISSIONS.MANAGE_OWN_ACTIVITIES],
  'Hospitals': [PERMISSIONS.VIEW_OWN_HOSPITALS, PERMISSIONS.VIEW_ALL_HOSPITALS, PERMISSIONS.MANAGE_HOSPITALS],
  'Contacts & CRM': [PERMISSIONS.VIEW_CONTACTS, PERMISSIONS.MANAGE_CONTACTS],
  'User Management': [PERMISSIONS.VIEW_USERS, PERMISSIONS.MANAGE_USERS, PERMISSIONS.SEND_INVITATIONS],
  'Assessments & Plans': [PERMISSIONS.VIEW_PRS, PERMISSIONS.VIEW_GAP_PLANS, PERMISSIONS.VIEW_MILESTONES, PERMISSIONS.VIEW_SIMULATIONS],
  'Wages & Expenses': [PERMISSIONS.VIEW_OWN_WAGES, PERMISSIONS.VIEW_TEAM_WAGES, PERMISSIONS.MANAGE_WAGES],
  'Cohorts': [PERMISSIONS.VIEW_COHORTS, PERMISSIONS.MANAGE_COHORTS, PERMISSIONS.COHORT_INVITE, PERMISSIONS.COHORT_ANNOUNCE, PERMISSIONS.COHORT_MODERATE],
  'Programs': [PERMISSIONS.VIEW_PROGRAMS, PERMISSIONS.MANAGE_PROGRAMS, PERMISSIONS.PROGRAM_ANNOUNCE],
  'Administration': [PERMISSIONS.MANAGE_PERMISSIONS, PERMISSIONS.SYSTEM_SETTINGS]
};

const TAB_LABELS: Record<string, string> = {
  activities: 'Activities',
  snapshot: 'Snapshot',
  milestones: 'Checklist',
  education: 'Education',
  'gap-plan': 'Gap Closure',
  simulation: 'Simulation'
};

interface ContactGranularPermissionsProps {
  userId: string;
  contactName?: string;
  userRole?: string;
  isAdmin?: boolean;
}

export const ContactGranularPermissions: React.FC<ContactGranularPermissionsProps> = ({
  userId,
  contactName,
  userRole = 'pecc',
  isAdmin = false
}) => {
  const { userProfile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [viewTabs, setViewTabs] = useState<ViewTab[]>([]);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const role = normalizeUserRole(userRole as UserRole) as UserRole;
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];

  const loadPermissions = async () => {
    try {
      const [permsRes, tabsRes] = await Promise.all([
        supabase.from('user_permissions').select('*').eq('user_id', userId),
        supabase.from('view_tabs').select('*').eq('user_id', userId).is('cohort_id', null).is('program_id', null)
      ]);
      setUserPermissions((permsRes.data || []) as UserPermission[]);
      setViewTabs((tabsRes.data || []) as ViewTab[]);
    } catch (e) {
      console.error('ContactGranularPermissions load error:', e);
      setSnack({ message: 'Failed to load permissions.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) loadPermissions();
  }, [userId]);

  const handleSavePermission = async (permissionKey: string, enabled: boolean) => {
    const { error } = await supabase.from('user_permissions').upsert({
      user_id: userId,
      permission_key: permissionKey,
      is_enabled: enabled,
      granted_by: userProfile?.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,permission_key' });
    if (!error) {
      setSnack({ message: 'Permission saved.', severity: 'success' });
      await loadPermissions();
    } else {
      setSnack({ message: 'Failed to save.', severity: 'error' });
    }
  };

  const handleSaveTabVisibility = async (tabKey: string, visible: boolean) => {
    const { error } = await supabase.from('view_tabs').upsert({
      user_id: userId,
      tab_key: tabKey,
      is_visible: visible,
      cohort_id: null,
      program_id: null,
      granted_by: userProfile?.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,tab_key' });
    if (!error) {
      setSnack({ message: 'Tab visibility saved.', severity: 'success' });
      await loadPermissions();
    } else {
      setSnack({ message: 'Failed to save tab visibility.', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Granular Permissions {contactName ? `— ${contactName}` : ''}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Permission overrides and tab visibility for this user. Changes apply immediately.
      </Typography>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Permission overrides</Typography>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]) => (
          <Grid item xs={12} key={groupName}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{groupName}</Typography>
            <Grid container spacing={0.5}>
              {perms.map(perm => {
                const existing = userPermissions.find(p => p.permission_key === perm);
                const isEnabled = existing ? existing.is_enabled : (isAdmin ? true : defaultPerms.includes(perm));
                return (
                  <Grid item xs={12} sm={6} md={4} key={perm}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={isEnabled}
                          onChange={(e) => handleSavePermission(perm, e.target.checked)}
                        />
                      }
                      label={perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Tab visibility (PECC nav)</Typography>
      <Grid container spacing={1}>
        {PECC_TAB_KEYS.map(tabKey => {
          const tabRow = viewTabs.find(t => t.tab_key === tabKey);
          const isVisible = tabRow ? tabRow.is_visible : true;
          return (
            <Grid item xs={12} sm={6} md={4} key={tabKey}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={isVisible}
                    onChange={(e) => handleSaveTabVisibility(tabKey, e.target.checked)}
                  />
                }
                label={TAB_LABELS[tabKey] || tabKey}
              />
            </Grid>
          );
        })}
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)}>{snack?.message}</Alert>
      </Snackbar>
    </Paper>
  );
};
