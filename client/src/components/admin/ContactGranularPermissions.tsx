/**
 * Compact Granular Permissions for a single user - shown in CRM contact detail.
 * Allows managing permissions and tab visibility without leaving the CRM.
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  InputAdornment,
  Chip
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon, Search as SearchIcon } from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { PERMISSIONS, PECC_TAB_KEYS, UserPermission, ViewTab } from '../../types/database';
import { DEFAULT_ROLE_PERMISSIONS } from '../../types/database';
import { UserRole, normalizeUserRole } from '../../types/database';
import { formatPermissionLabel } from '../../utils/permissionsUi';

const PERMISSION_GROUPS: Record<string, string[]> = {
  'Support Tool & Views': [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_AGGREGATED_DATA, PERMISSIONS.VIEW_SNAPSHOT, PERMISSIONS.EXPORT_DATA],
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

const PENDING_USER_PREFIX = 'pending:';

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
  const [permissionStates, setPermissionStates] = useState<Record<string, boolean>>({});
  const [tabVisibilityStates, setTabVisibilityStates] = useState<Record<string, boolean>>({});
  const [permissionFilter, setPermissionFilter] = useState('');
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const role = normalizeUserRole(userRole as UserRole) as UserRole;
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];

  const isPending = userId.startsWith(PENDING_USER_PREFIX);
  const email = isPending ? userId.slice(PENDING_USER_PREFIX.length) : '';

  const loadPermissions = useCallback(async () => {
    try {
      if (!userId?.trim()) {
        setLoading(false);
        return;
      }
      if (isPending && email) {
        const [permsRes, tabsRes] = await Promise.all([
          supabase.from('pending_user_permissions').select('*').eq('email', email),
          supabase.from('pending_view_tabs').select('*').eq('email', email)
        ]);
        if (permsRes.error || tabsRes.error) {
          setSnack({
            message: `Failed to load permissions: ${permsRes.error?.message || tabsRes.error?.message || 'Unknown error'}`,
            severity: 'error'
          });
          return;
        }
        setUserPermissions((permsRes.data || []).map((p: { id: string; permission_key: string; is_enabled: boolean; granted_by?: string | null; granted_at?: string; updated_at?: string }) => ({
          id: p.id,
          user_id: userId,
          permission_key: p.permission_key,
          is_enabled: p.is_enabled,
          granted_by: p.granted_by ?? null,
          granted_at: p.granted_at ?? new Date().toISOString(),
          updated_at: p.updated_at ?? new Date().toISOString()
        })) as UserPermission[]);
        setViewTabs((tabsRes.data || []).map((t: { id: string; tab_key: string; is_visible: boolean; granted_by?: string | null; granted_at?: string; updated_at?: string }) => ({
          id: t.id,
          user_id: userId,
          cohort_id: null,
          program_id: null,
          tab_key: t.tab_key,
          is_visible: t.is_visible,
          granted_by: t.granted_by ?? null,
          granted_at: t.granted_at ?? new Date().toISOString(),
          updated_at: t.updated_at ?? new Date().toISOString()
        })) as ViewTab[]);
        const permStates: Record<string, boolean> = {};
        (permsRes.data || []).forEach((p: { permission_key: string; is_enabled: boolean }) => { permStates[p.permission_key] = p.is_enabled; });
        setPermissionStates(permStates);
        const tabStates: Record<string, boolean> = {};
        (tabsRes.data || []).forEach((t: { tab_key: string; is_visible: boolean }) => { tabStates[t.tab_key] = t.is_visible; });
        setTabVisibilityStates(tabStates);
      } else {
        const [permsRes, tabsRes] = await Promise.all([
          supabase.from('user_permissions').select('*').eq('user_id', userId),
          supabase.from('view_tabs').select('*').eq('user_id', userId).is('cohort_id', null).is('program_id', null)
        ]);
        if (permsRes.error || tabsRes.error) {
          setSnack({
            message: `Failed to load permissions: ${permsRes.error?.message || tabsRes.error?.message || 'Unknown error'}`,
            severity: 'error'
          });
          return;
        }
        setUserPermissions((permsRes.data || []) as UserPermission[]);
        setViewTabs((tabsRes.data || []) as ViewTab[]);
        const permStates: Record<string, boolean> = {};
        (permsRes.data || []).forEach((p: { permission_key: string; is_enabled: boolean }) => { permStates[p.permission_key] = p.is_enabled; });
        setPermissionStates(permStates);
        const tabStates: Record<string, boolean> = {};
        (tabsRes.data || []).forEach((t: { tab_key: string; is_visible: boolean }) => { tabStates[t.tab_key] = t.is_visible; });
        setTabVisibilityStates(tabStates);
      }
    } catch (e) {
      console.error('ContactGranularPermissions load error:', e);
      setSnack({ message: 'Failed to load permissions.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, isPending, email]);

  useEffect(() => {
    if (userId) void loadPermissions();
  }, [userId, loadPermissions]);

  const handleSavePermission = async (permissionKey: string, enabled: boolean) => {
    if (isPending && email) {
      const { error } = await supabase.from('pending_user_permissions').upsert({
        email: email.trim().toLowerCase(),
        permission_key: permissionKey,
        is_enabled: enabled,
        granted_by: userProfile?.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email,permission_key' });
      if (!error) {
        setSnack({ message: 'Permission saved. Will apply when they create an account.', severity: 'success' });
        await loadPermissions();
      } else {
        setSnack({ message: error.message ? `Failed to save: ${error.message}` : 'Failed to save.', severity: 'error' });
      }
      return;
    }
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
      setSnack({ message: error.message ? `Failed to save: ${error.message}` : 'Failed to save.', severity: 'error' });
    }
  };

  const handleSaveTabVisibility = async (tabKey: string, visible: boolean) => {
    if (isPending && email) {
      const { error } = await supabase.from('pending_view_tabs').upsert({
        email: email.trim().toLowerCase(),
        tab_key: tabKey,
        is_visible: visible,
        granted_by: userProfile?.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email,tab_key' });
      if (!error) {
        setSnack({ message: 'Tab visibility saved. Will apply when they create an account.', severity: 'success' });
        await loadPermissions();
      } else {
        setSnack({ message: error.message ? `Failed to save tab visibility: ${error.message}` : 'Failed to save tab visibility.', severity: 'error' });
      }
      return;
    }
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
      setSnack({ message: error.message ? `Failed to save tab visibility: ${error.message}` : 'Failed to save tab visibility.', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">Loading permissions...</Typography>
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
      <TextField
        size="small"
        fullWidth
        value={permissionFilter}
        onChange={(e) => setPermissionFilter(e.target.value)}
        placeholder="Filter permissions..."
        sx={{ mb: 1.5, maxWidth: 420 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          )
        }}
      />
      <Box sx={{ mb: 2 }}>
        {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]) => {
          const filteredPerms = perms.filter((perm) =>
            !permissionFilter.trim() ||
            formatPermissionLabel(perm).toLowerCase().includes(permissionFilter.trim().toLowerCase())
          );
          if (filteredPerms.length === 0) return null;
          const enabledCount = filteredPerms.filter((perm) => {
            const existing = userPermissions.find((p) => p.permission_key === perm);
            const hasLocalOverride = Object.prototype.hasOwnProperty.call(permissionStates, perm);
            const isEnabled = hasLocalOverride
              ? permissionStates[perm]
              : existing
                ? existing.is_enabled
                : (isAdmin ? true : defaultPerms.includes(perm));
            return isEnabled;
          }).length;
          return (
            <Accordion key={groupName} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{groupName}</Typography>
                <Chip size="small" sx={{ ml: 1 }} label={`${enabledCount}/${filteredPerms.length} enabled`} />
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={0.5}>
              {filteredPerms.map(perm => {
                const existing = userPermissions.find(p => p.permission_key === perm);
                const hasLocalOverride = Object.prototype.hasOwnProperty.call(permissionStates, perm);
                const isEnabled = hasLocalOverride
                  ? permissionStates[perm]
                  : existing
                    ? existing.is_enabled
                    : (isAdmin ? true : defaultPerms.includes(perm));
                return (
                  <Grid item xs={12} sm={6} md={4} key={perm}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={isEnabled}
                          onChange={(e) => {
                            setPermissionStates((prev) => ({ ...prev, [perm]: e.target.checked }));
                            void handleSavePermission(perm, e.target.checked);
                          }}
                        />
                      }
                      label={formatPermissionLabel(perm)}
                    />
                  </Grid>
                );
              })}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Tab visibility (PECC nav)</Typography>
      <Grid container spacing={1}>
        {PECC_TAB_KEYS.map(tabKey => {
          const tabRow = viewTabs.find(t => t.tab_key === tabKey);
          const hasLocalOverride = Object.prototype.hasOwnProperty.call(tabVisibilityStates, tabKey);
          const isVisible = hasLocalOverride ? tabVisibilityStates[tabKey] : (tabRow ? tabRow.is_visible : true);
          return (
            <Grid item xs={12} sm={6} md={4} key={tabKey}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={isVisible}
                    onChange={(e) => {
                      setTabVisibilityStates((prev) => ({ ...prev, [tabKey]: e.target.checked }));
                      void handleSaveTabVisibility(tabKey, e.target.checked);
                    }}
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
