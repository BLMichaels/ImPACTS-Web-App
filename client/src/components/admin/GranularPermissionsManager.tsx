import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Grid,
  Autocomplete,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { UserRole, normalizeUserRole, PERMISSIONS, PECC_TAB_KEYS, UserPermission, CohortPermission, ProgramPermission, ViewTab, Cohort, Program, User } from '../../types/database';

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

const TOOL_SECTION_TABS = [
  { key: 'snapshot_prs_section', label: 'Pediatric Readiness Scores (on Snapshot / Tool page)' }
];

interface GranularPermissionsManagerProps {
  mode: 'admin' | 'manager';  // Admin can manage all, Manager can only manage their team
  initialSelectedUserId?: string;  // When opening from CRM "Manage permissions", pre-select this user
}

const GranularPermissionsManager: React.FC<GranularPermissionsManagerProps> = ({ mode, initialSelectedUserId }) => {
  const { userProfile, refreshProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState(0);  // 0: Users, 1: Cohorts, 2: Programs, 3: Tabs
  
  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [staffEmails, setStaffEmails] = useState<Set<string>>(new Set());
  const [staffAdminEmails, setStaffAdminEmails] = useState<Set<string>>(new Set()); // CRM staff with is_admin=true
  const [staffNamesByEmail, setStaffNamesByEmail] = useState<Record<string, string>>({});
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected entities
  const [selectedUserId, setSelectedUserId] = useState<string>(initialSelectedUserId || '');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [selectedCohortUserId, setSelectedCohortUserId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedProgramUserId, setSelectedProgramUserId] = useState<string>('');
  
  // Permissions
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [cohortPermissions, setCohortPermissions] = useState<CohortPermission[]>([]);
  const [programPermissions, setProgramPermissions] = useState<ProgramPermission[]>([]);
  const [viewTabs, setViewTabs] = useState<ViewTab[]>([]);
  
  // Permission states (for editing)
  const [permissionStates, setPermissionStates] = useState<Record<string, boolean>>({});
  const [tabVisibilityStates, setTabVisibilityStates] = useState<Record<string, boolean>>({});
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  
  // Common tabs for cohorts/programs (tab_key -> display label)
  const COHORT_PROGRAM_TABS: { key: string; label: string }[] = [
    { key: 'announcements', label: 'Announcements' },
    { key: 'discussions', label: 'Discussions' },
    { key: 'members', label: 'Members' },
    { key: 'activities', label: 'Activities' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'wages', label: 'Wages & Expenses' },
    { key: 'learning', label: 'Learning modules (SCORM)' },
    { key: 'snapshot_prs_section', label: 'Pediatric Readiness Scores (PECC Support Tool & Snapshot)' }
  ];

  const getUserDisplayName = (u: User): string => {
    const fromUser = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
    if (fromUser) return fromUser;
    const fromCrm = staffNamesByEmail[(u.email || '').trim().toLowerCase()];
    if (fromCrm) return fromCrm;
    return (u.email || '').trim() || '(No name)';
  };

  const isEffectivelyAdmin = (u: User): boolean => {
    if (u.is_admin) return true;
    const email = (u.email || '').trim().toLowerCase();
    return !!(email && staffEmails.has(email) && staffAdminEmails.has(email));
  };

  const getEffectiveRoleLabel = (u: User): string => {
    if (u.is_admin || isEffectivelyAdmin(u)) return 'Admin';
    const email = (u.email || '').trim().toLowerCase();
    if (email && staffEmails.has(email)) return 'Staff';
    return u.role || '—';
  };
  
  useEffect(() => {
    loadData();
  }, [mode, userProfile?.id]);

  useEffect(() => {
    if (initialSelectedUserId && users.some(u => u.id === initialSelectedUserId)) {
      setSelectedUserId(initialSelectedUserId);
      setActiveTab(0);
    }
  }, [initialSelectedUserId, users]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Load users: admin uses RPC so all tiers show (avoids RLS only-showing-admins); manager uses table + filter
      let usersData: Array<{
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        role: string;
        is_admin?: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
        last_login: string | null;
        manager_id: string | null;
        mentor_id: string | null;
        manager_id_for_pecc: string | null;
        primary_program_id?: string | null;
      }> | null = null;
      if (mode === 'admin') {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_users_for_granular_permissions');
        if (!rpcError && rpcData != null && Array.isArray(rpcData) && rpcData.length > 0) {
          usersData = rpcData as Array<{
            id: string;
            email: string;
            first_name: string;
            last_name: string;
            phone: string | null;
            role: string;
            is_admin?: boolean;
            is_active: boolean;
            created_at: string;
            updated_at: string;
            last_login: string | null;
            manager_id: string | null;
            mentor_id: string | null;
            manager_id_for_pecc: string | null;
            primary_program_id?: string | null;
          }>;
        } else {
          const { data: tableData } = await supabase.from('users').select('id, email, first_name, last_name, phone, role, is_admin, is_active, created_at, updated_at, last_login, manager_id, mentor_id, manager_id_for_pecc, primary_program_id');
          if (tableData != null && Array.isArray(tableData)) usersData = tableData;
          if (usersData != null && usersData.length > 0 && rpcError) {
            console.warn('[GranularPermissions] get_users_for_granular_permissions failed; using table. Run GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql in Supabase to show all tiers.', rpcError.message);
          }
        }
        // Fallback: if RPC/table returned empty or only admins, try CRM contacts (users by email)
        const hasNonAdmin = usersData?.some((u: { role?: string }) => {
          const r = String(u.role || '').toLowerCase();
          return r && r !== 'admin';
        });
        const shouldTryCrmFallback = !usersData || usersData.length === 0 || (usersData.length > 0 && !hasNonAdmin);
        if (shouldTryCrmFallback) {
          const { data: crmRows } = await supabase
            .from('crm_organizations')
            .select('email')
            .in('contact_type', ['staff', 'manager', 'mentor', 'pecc', 'other']);
          const emails = [...new Set((crmRows || []).map((r: { email?: string }) => (r.email || '').trim()).filter(Boolean))];
          if (emails.length > 0) {
            const { data: byEmail } = await supabase.rpc('get_users_by_emails_for_admin', { p_emails: emails });
            if (byEmail && Array.isArray(byEmail) && byEmail.length > 0) {
              const existingIds = new Set((usersData || []).map((u: { id: string }) => u.id));
              const merged = [...(usersData || [])];
              const byEmailArr = byEmail as Array<{ id: string; email: string; first_name?: string; last_name?: string; phone?: string | null; role: string; is_admin?: boolean; is_active: boolean; created_at: string; updated_at: string; last_login?: string | null; manager_id?: string | null; mentor_id?: string | null; manager_id_for_pecc?: string | null; primary_program_id?: string | null }>;
              for (const u of byEmailArr) {
                if (!existingIds.has(u.id)) {
                  existingIds.add(u.id);
                  merged.push(u as (typeof merged)[0]);
                }
              }
              usersData = merged;
            }
          }
        }
        // If we have initialSelectedUserId but user not in list, fetch that user directly
        if (initialSelectedUserId && usersData) {
          const hasUser = usersData.some((u: { id: string }) => u.id === initialSelectedUserId);
          if (!hasUser) {
            const { data: singleUser } = await supabase.rpc('get_user_by_id_for_admin', { p_user_id: initialSelectedUserId });
            if (singleUser && Array.isArray(singleUser) && singleUser.length > 0) {
              usersData = [...usersData, singleUser[0] as typeof usersData[0]];
            }
          }
        }
      } else {
        let usersQuery = supabase.from('users').select('id, email, first_name, last_name, phone, role, is_admin, is_active, created_at, updated_at, last_login, manager_id, mentor_id, manager_id_for_pecc, primary_program_id');
        if (mode === 'manager' && userProfile?.id) {
          usersQuery = usersQuery.or(`manager_id.eq.${userProfile.id},manager_id_for_pecc.eq.${userProfile.id}`);
        }
        const { data } = await usersQuery;
        usersData = data;
      }
      if (usersData) {
        setUsers(usersData.map((u: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          role: string;
          is_admin?: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login: string | null;
          manager_id: string | null;
          mentor_id: string | null;
          manager_id_for_pecc: string | null;
          primary_program_id?: string | null;
        }) => ({
          id: u.id,
          email: u.email,
          first_name: u.first_name ?? '',
          last_name: u.last_name ?? '',
          phone: u.phone || null,
          role: normalizeUserRole(u.role) as UserRole,
          is_admin: u.is_admin === true,
          is_active: u.is_active ?? true,
          created_at: u.created_at || new Date().toISOString(),
          updated_at: u.updated_at || new Date().toISOString(),
          last_login: u.last_login || null,
          manager_id: u.manager_id || null,
          mentor_id: u.mentor_id || null,
          manager_id_for_pecc: u.manager_id_for_pecc || null,
          primary_program_id: u.primary_program_id ?? null
        })));
      }

      // Load CRM staff (contact_type='staff') so we can align display: show "Staff" / "Admin" and use CRM names when user name is missing
      if (mode === 'admin') {
        const { data: staffRows } = await supabase
          .from('crm_organizations')
          .select('email, first_name, last_name, is_admin')
          .eq('contact_type', 'staff');
        const emails = new Set<string>();
        const adminEmails = new Set<string>();
        const namesByEmail: Record<string, string> = {};
        (staffRows || []).forEach((r: { email?: string; first_name?: string; last_name?: string; is_admin?: boolean }) => {
          const email = (r.email || '').trim().toLowerCase();
          if (email) {
            emails.add(email);
            if (r.is_admin === true) adminEmails.add(email);
            const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
            if (name && !namesByEmail[email]) namesByEmail[email] = name;
          }
        });
        setStaffEmails(emails);
        setStaffAdminEmails(adminEmails);
        setStaffNamesByEmail(namesByEmail);
      } else {
        setStaffEmails(new Set());
        setStaffAdminEmails(new Set());
        setStaffNamesByEmail({});
      }
      
      // Load cohorts (admin: all; manager: only managed, active)
      let cohortsQuery = supabase.from('cohorts').select('id, name, description, program_id, created_by, is_active, created_at, updated_at').order('name');
      if (mode === 'manager' && userProfile?.id) {
        const { data: managedCohorts } = await supabase
          .from('cohort_managers')
          .select('cohort_id')
          .eq('manager_id', userProfile.id);
        if (managedCohorts && managedCohorts.length > 0) {
          cohortsQuery = cohortsQuery.in('id', managedCohorts.map((c: { cohort_id: string }) => c.cohort_id)).eq('is_active', true);
        } else {
          cohortsQuery = cohortsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      // Admin: no is_active filter so all cohorts (including inactive) appear for configuration
      const { data: cohortsData } = await cohortsQuery;
      if (cohortsData) {
        setCohorts(cohortsData.map((c: {
          id: string;
          name: string;
          description: string | null;
          program_id: string | null;
          created_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }) => ({
          id: c.id,
          name: c.name,
          description: c.description || null,
          program_id: c.program_id || null,
          created_by: c.created_by || null,
          is_active: c.is_active,
          created_at: c.created_at,
          updated_at: c.updated_at
        })));
      }
      
      // Load programs (admin: all; manager: only managed, active)
      let programsQuery = supabase.from('programs').select('id, name, description, start_date, end_date, created_by, is_active, created_at, updated_at').order('name');
      if (mode === 'manager' && userProfile?.id) {
        const { data: managedPrograms } = await supabase
          .from('program_managers')
          .select('program_id')
          .eq('manager_id', userProfile.id);
        if (managedPrograms && managedPrograms.length > 0) {
          programsQuery = programsQuery.in('id', managedPrograms.map((p: { program_id: string }) => p.program_id)).eq('is_active', true);
        } else {
          programsQuery = programsQuery.eq('id', '00000000-0000-0000-0000-000000000000');
        }
      }
      const { data: programsData } = await programsQuery;
      if (programsData) {
        setPrograms(programsData.map((p: {
          id: string;
          name: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          created_by: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }) => ({
          id: p.id,
          name: p.name,
          description: p.description || null,
          start_date: p.start_date || null,
          end_date: p.end_date || null,
          created_by: p.created_by || null,
          is_active: p.is_active,
          created_at: p.created_at,
          updated_at: p.updated_at
        })));
      }
      
      // Load existing permissions
      await loadPermissions();
    } catch (error) {
      console.error('Error loading data:', error);
      setSnack({ message: 'Failed to load data. Try refreshing.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const isTableMissingError = (err: { code?: string; message?: string; status?: number } | null) =>
    err && (err.code === 'PGRST301' || err.status === 404 || /not found|relation|404/i.test(String(err.message ?? '')));

  const loadPermissions = async () => {
    if (selectedUserId) {
      const { data, error: permError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', selectedUserId);
      if (isTableMissingError(permError)) {
        setSnack({ message: 'Permission tables missing. Run CREATE_USER_PERMISSIONS_TABLE.sql in Supabase SQL Editor.', severity: 'error' });
      }
      if (data) {
        setUserPermissions(data);
        const states: Record<string, boolean> = {};
        data.forEach(p => { states[p.permission_key] = p.is_enabled; });
        setPermissionStates(states);
      }
      const { data: userTabsData } = await supabase
        .from('view_tabs')
        .select('*')
        .eq('user_id', selectedUserId);
      setViewTabs(userTabsData || []);
      const tabStates: Record<string, boolean> = {};
      (userTabsData || []).forEach(t => { tabStates[t.tab_key] = t.is_visible; });
      setTabVisibilityStates(prev => ({ ...prev, ...tabStates }));
    }
    
    if (selectedCohortId) {
      const { data } = await supabase
        .from('cohort_permissions')
        .select('*')
        .eq('cohort_id', selectedCohortId);
      if (data) {
        setCohortPermissions(data);
        const states: Record<string, boolean> = {};
        data.forEach(p => {
          const key = p.user_id ? `user_${p.user_id}` : `role_${p.role}`;
          states[`${key}_${p.permission_key}`] = p.is_enabled;
        });
        setPermissionStates(states);
      }
      
      // Load tab visibility
      const { data: tabsData } = await supabase
        .from('view_tabs')
        .select('*')
        .eq('cohort_id', selectedCohortId);
      if (tabsData) {
        setViewTabs(tabsData);
        const tabStates: Record<string, boolean> = {};
        tabsData.forEach(t => { tabStates[t.tab_key] = t.is_visible; });
        setTabVisibilityStates(tabStates);
      }
    }
    
    if (selectedProgramId) {
      const { data } = await supabase
        .from('program_permissions')
        .select('*')
        .eq('program_id', selectedProgramId);
      if (data) {
        setProgramPermissions(data);
        const states: Record<string, boolean> = {};
        data.forEach(p => {
          const key = p.user_id ? `user_${p.user_id}` : `role_${p.role}`;
          states[`${key}_${p.permission_key}`] = p.is_enabled;
        });
        setPermissionStates(states);
      }
      
      // Load tab visibility
      const { data: tabsData } = await supabase
        .from('view_tabs')
        .select('*')
        .eq('program_id', selectedProgramId);
      if (tabsData) {
        setViewTabs(tabsData);
        const tabStates: Record<string, boolean> = {};
        tabsData.forEach(t => { tabStates[t.tab_key] = t.is_visible; });
        setTabVisibilityStates(tabStates);
      }
    }
  };
  
  useEffect(() => {
    if (selectedUserId || selectedCohortId || selectedProgramId) {
      loadPermissions();
    }
  }, [selectedUserId, selectedCohortId, selectedProgramId]);
  
  const handleSaveUserPermission = async (permissionKey: string, enabled: boolean) => {
    if (!selectedUserId) return;
    
    const { error } = await supabase
      .from('user_permissions')
      .upsert({
        user_id: selectedUserId,
        permission_key: permissionKey,
        is_enabled: enabled,
        granted_by: userProfile?.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,permission_key' });
    
    if (!error) {
      setSnack({ message: 'Permission saved.', severity: 'success' });
      await loadPermissions();
    } else {
      const msg = isTableMissingError(error) ? 'Permission tables missing. Run CREATE_USER_PERMISSIONS_TABLE.sql in Supabase SQL Editor.' : 'Failed to save permission.';
      setSnack({ message: msg, severity: 'error' });
    }
  };

  const handleSavePrimaryProgram = async (programId: string | null) => {
    if (!selectedUserId) return;
    const { error } = await supabase
      .from('users')
      .update({ primary_program_id: programId || null, updated_at: new Date().toISOString() })
      .eq('id', selectedUserId);
    if (!error) {
      setSnack({ message: 'Primary program saved.', severity: 'success' });
      setUsers(prev => prev.map(u => u.id === selectedUserId ? { ...u, primary_program_id: programId || null } : u));
      if (selectedUserId === userProfile?.id && refreshProfile) {
        await refreshProfile();
      }
    } else {
      setSnack({ message: 'Failed to save primary program.', severity: 'error' });
    }
  };
  
  const handleSaveCohortPermission = async (permissionKey: string, enabled: boolean, userId?: string, role?: UserRole) => {
    if (!selectedCohortId) return;
    
    const { error } = await supabase
      .from('cohort_permissions')
      .upsert({
        cohort_id: selectedCohortId,
        user_id: userId || null,
        role: role || null,
        permission_key: permissionKey,
        is_enabled: enabled,
        granted_by: userProfile?.id,
        updated_at: new Date().toISOString()
      }, { onConflict: userId ? 'cohort_id,user_id,permission_key' : 'cohort_id,role,permission_key' });
    
    if (!error) {
      setSnack({ message: 'Cohort permission saved.', severity: 'success' });
      await loadPermissions();
    } else {
      setSnack({ message: 'Failed to save cohort permission.', severity: 'error' });
    }
  };
  
  const handleSaveProgramPermission = async (permissionKey: string, enabled: boolean, userId?: string, role?: UserRole) => {
    if (!selectedProgramId) return;
    
    const { error } = await supabase
      .from('program_permissions')
      .upsert({
        program_id: selectedProgramId,
        user_id: userId || null,
        role: role || null,
        permission_key: permissionKey,
        is_enabled: enabled,
        granted_by: userProfile?.id,
        updated_at: new Date().toISOString()
      }, { onConflict: userId ? 'program_id,user_id,permission_key' : 'program_id,role,permission_key' });
    
    if (!error) {
      setSnack({ message: 'Program permission saved.', severity: 'success' });
      await loadPermissions();
    } else {
      setSnack({ message: 'Failed to save program permission.', severity: 'error' });
    }
  };
  
  const handleSaveTabVisibility = async (tabKey: string, visible: boolean, scope: 'user' | 'cohort' | 'program') => {
    const scopeId = scope === 'user' ? selectedUserId : scope === 'cohort' ? selectedCohortId : selectedProgramId;
    if (!scopeId) return;
    const payload: Partial<ViewTab> = {
      tab_key: tabKey,
      is_visible: visible,
      granted_by: userProfile?.id ?? null,
      updated_at: new Date().toISOString()
    };
    if (scope === 'user') {
      payload.user_id = scopeId;
      payload.cohort_id = null;
      payload.program_id = null;
    } else if (scope === 'cohort') {
      payload.user_id = null;
      payload.cohort_id = scopeId;
      payload.program_id = null;
    } else {
      payload.user_id = null;
      payload.cohort_id = null;
      payload.program_id = scopeId;
    }
    const { error } = await supabase
      .from('view_tabs')
      .upsert(payload, { onConflict: scope === 'user' ? 'user_id,tab_key' : scope === 'cohort' ? 'cohort_id,tab_key' : 'program_id,tab_key' });
    if (!error) {
      setSnack({ message: 'Tab visibility saved.', severity: 'success' });
      await loadPermissions();
      if (scope === 'user' && scopeId === userProfile?.id && refreshProfile) {
        await refreshProfile();
      }
    } else {
      setSnack({ message: 'Failed to save tab visibility.', severity: 'error' });
    }
  };
  
  const handleDeletePermission = async (type: 'user' | 'cohort' | 'program', id: string) => {
    const table = type === 'user' ? 'user_permissions' : type === 'cohort' ? 'cohort_permissions' : 'program_permissions';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      setSnack({ message: 'Permission removed.', severity: 'success' });
      await loadPermissions();
    } else {
      setSnack({ message: 'Failed to remove permission.', severity: 'error' });
    }
  };
  
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {mode === 'admin' ? 'Granular Permissions Management' : 'Team Permissions Management'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {mode === 'admin' 
          ? 'Set permissions and tab visibility for specific users, cohorts, and programs.'
          : 'Manage permissions and tab visibility for your team members, cohorts, and programs.'}
      </Typography>
      
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }} aria-label="Granular permissions sections">
        <Tab label="User Permissions" id="granular-tab-0" aria-controls="granular-panel-0" />
        <Tab label="Cohort Permissions" id="granular-tab-1" aria-controls="granular-panel-1" />
        <Tab label="Program Permissions" id="granular-tab-2" aria-controls="granular-panel-2" />
        <Tab label="Tab Visibility" id="granular-tab-3" aria-controls="granular-panel-3" />
      </Tabs>
      
      {/* User Permissions Tab */}
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Search users by name or email</Typography>
          <Autocomplete
            value={users.find(u => u.id === selectedUserId) ?? null}
            onChange={(_, user) => setSelectedUserId(user?.id ?? '')}
            options={users}
            getOptionLabel={(u) => {
              const name = getUserDisplayName(u);
              const role = getEffectiveRoleLabel(u);
              return `${name} (${u.email}) — ${role}`;
            }}
            filterOptions={(options, { inputValue }) => {
              const q = (inputValue || '').trim().toLowerCase();
              if (!q) return options;
              return options.filter(u => {
                const name = getUserDisplayName(u).toLowerCase();
                const email = (u.email || '').toLowerCase();
                return name.includes(q) || email.includes(q);
              });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search and select user"
                placeholder="Type name or email to find a user (e.g. John Smith)"
              />
            )}
            renderOption={(props, u) => {
              const name = getUserDisplayName(u);
              const role = getEffectiveRoleLabel(u);
              const admin = isEffectivelyAdmin(u);
              return (
                <li {...props} key={u.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <span>{name}</span>
                    <Typography variant="body2" color="text.secondary">({u.email})</Typography>
                    <Chip label={role} size="small" color={admin ? 'error' : role === 'Staff' ? 'primary' : 'default'} variant="outlined" />
                  </Box>
                </li>
              );
            }}
            sx={{ mb: 2 }}
          />
          
          {selectedUserId && (() => {
            const selectedUser = users.find(u => u.id === selectedUserId);
            const isAdmin = selectedUser ? isEffectivelyAdmin(selectedUser) : false;
            return (
            <Box>
              {isAdmin && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  This user is an <strong>Admin</strong>. Admins have full access to the platform regardless of their base role ({selectedUser?.role ?? '—'}). The toggles below reflect that (all on by default); you can still turn specific overrides off if needed.
                </Alert>
              )}
              <Typography variant="subtitle1" gutterBottom>Permission overrides (fine-grained feature toggles)</Typography>
              <Grid container spacing={2}>
                {Object.entries(PERMISSION_GROUPS).map(([groupName, perms]) => (
                  <Grid item xs={12} key={groupName}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>{groupName}</Typography>
                    <Grid container spacing={1}>
                      {perms.map(perm => {
                        const existing = userPermissions.find(p => p.permission_key === perm);
                        const isEnabled = existing ? existing.is_enabled : (isAdmin ? true : (permissionStates[perm] ?? false));
                        return (
                          <Grid item xs={12} sm={6} md={4} key={perm}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={isEnabled}
                                  onChange={(e) => {
                                    setPermissionStates(prev => ({ ...prev, [perm]: e.target.checked }));
                                    handleSaveUserPermission(perm, e.target.checked);
                                  }}
                                />
                              }
                              label={perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                            />
                            {existing && (
                              <IconButton
                                size="small"
                                onClick={() => handleDeletePermission('user', existing.id)}
                                sx={{ ml: 0.5 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>Primary program (navbar logo)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                The logo shown in the top left of the app is determined by this user&apos;s primary program. They can be in multiple programs; this selects which program&apos;s logo to display.
              </Typography>
              <FormControl fullWidth sx={{ maxWidth: 400 }}>
                <InputLabel>Primary program</InputLabel>
                <Select
                  value={(selectedUser as User & { primary_program_id?: string | null })?.primary_program_id ?? ''}
                  label="Primary program"
                  onChange={(e) => handleSavePrimaryProgram((e.target.value as string) || null)}
                >
                  <MenuItem value=""><em>None (default ImPACTS logo)</em></MenuItem>
                  {programs.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          );
          })()}
        </Paper>
      )}

      {/* Cohort Permissions Tab */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>Select a cohort to set permissions and tab visibility for its members</Typography>
          <Autocomplete
            value={cohorts.find(c => c.id === selectedCohortId) ?? null}
            onChange={(_, c) => {
              setSelectedCohortId(c?.id ?? '');
              setSelectedCohortUserId('');
            }}
            options={cohorts}
            getOptionLabel={(c) => `${c.name}${c.is_active === false ? ' (Inactive)' : ''}${c.program_id ? ` — ${c.program_id}` : ''}`}
            filterOptions={(options, { inputValue }) => {
              const q = (inputValue || '').trim().toLowerCase();
              if (!q) return options;
              return options.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.program_id || '').toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q)
              );
            }}
            renderInput={(params) => (
              <TextField {...params} label="Search and select cohort" placeholder="Type cohort name or program to find..." />
            )}
            renderOption={(props, c) => (
              <li {...props} key={c.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <span>{c.name}</span>
                  {c.is_active === false && <Chip label="Inactive" size="small" color="default" variant="outlined" />}
                  {c.program_id && <Typography variant="body2" color="text.secondary">— {c.program_id}</Typography>}
                </Box>
              </li>
            )}
            sx={{ mb: 3 }}
          />
          
          {selectedCohortId && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set permissions for specific users or roles within this cohort. User-specific overrides take precedence over role-based permissions.
              </Alert>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by User</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <Autocomplete
                  value={users.find(u => u.id === selectedCohortUserId) ?? null}
                  onChange={(_, user) => setSelectedCohortUserId(user?.id ?? '')}
                  options={users}
                  getOptionLabel={(u) => {
                    const name = getUserDisplayName(u);
                    const role = getEffectiveRoleLabel(u);
                    return `${name} (${u.email}) — ${role}`;
                  }}
                  filterOptions={(options, { inputValue }) => {
                    const q = (inputValue || '').trim().toLowerCase();
                    if (!q) return options;
                    return options.filter(u => {
                      const name = getUserDisplayName(u).toLowerCase();
                      const email = (u.email || '').toLowerCase();
                      return name.includes(q) || email.includes(q);
                    });
                  }}
                  renderInput={(params) => <TextField {...params} label="Select User" placeholder="Type name or email to search..." />}
                />
              </FormControl>
              {selectedCohortUserId && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Overrides for {getUserDisplayName(users.find(u => u.id === selectedCohortUserId)!)}</Typography>
                  <Grid container spacing={1}>
                    {Object.values(PERMISSIONS).map(perm => {
                      const existing = cohortPermissions.find(
                        p => p.cohort_id === selectedCohortId && p.user_id === selectedCohortUserId && p.permission_key === perm
                      );
                      const key = `user_${selectedCohortUserId}_${perm}`;
                      const isEnabled = existing ? existing.is_enabled : (permissionStates[key] ?? true);
                      return (
                        <Grid item xs={12} sm={6} md={4} key={perm}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={isEnabled}
                                onChange={(e) => {
                                  setPermissionStates(prev => ({ ...prev, [key]: e.target.checked }));
                                  handleSaveCohortPermission(perm, e.target.checked, selectedCohortUserId, undefined);
                                }}
                              />
                            }
                            label={perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by Role (default: all on for new members; user-specific overrides take precedence)</Typography>
              <Grid container spacing={2}>
                {[UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC].map(role => (
                  <Grid item xs={12} key={role}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{role.charAt(0).toUpperCase() + role.slice(1)}</Typography>
                    {Object.values(PERMISSIONS).map(perm => {
                      const key = `role_${role}_${perm}`;
                      const existing = cohortPermissions.find(
                        p => p.cohort_id === selectedCohortId && p.role === role && p.permission_key === perm
                      );
                      const isEnabled = existing ? existing.is_enabled : (permissionStates[key] ?? true);
                      
                      return (
                        <FormControlLabel
                          key={perm}
                          control={
                            <Switch
                              checked={isEnabled}
                              onChange={(e) => {
                                setPermissionStates(prev => ({ ...prev, [key]: e.target.checked }));
                                handleSaveCohortPermission(perm, e.target.checked, undefined, role);
                              }}
                            />
                          }
                          label={perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          sx={{ display: 'block', mb: 0.5 }}
                        />
                      );
                    })}
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Paper>
      )}
      
      {/* Program Permissions Tab */}
      {activeTab === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>Select a program to set permissions and tab visibility for its members</Typography>
          <Autocomplete
            value={programs.find(p => p.id === selectedProgramId) ?? null}
            onChange={(_, p) => setSelectedProgramId(p?.id ?? '')}
            options={programs}
            getOptionLabel={(p) => `${p.name}${p.is_active === false ? ' (Inactive)' : ''}`}
            filterOptions={(options, { inputValue }) => {
              const q = (inputValue || '').trim().toLowerCase();
              if (!q) return options;
              return options.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q)
              );
            }}
            renderInput={(params) => (
              <TextField {...params} label="Search and select program" placeholder="Type program name to find..." />
            )}
            renderOption={(props, p) => (
              <li {...props} key={p.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <span>{p.name}</span>
                  {p.is_active === false && <Chip label="Inactive" size="small" color="default" variant="outlined" />}
                </Box>
              </li>
            )}
            sx={{ mb: 3 }}
          />
          
          {selectedProgramId && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set permissions for specific users or roles within this program. User-specific overrides take precedence over role-based permissions.
              </Alert>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by User</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <Autocomplete
                  value={users.find(u => u.id === selectedProgramUserId) ?? null}
                  onChange={(_, user) => setSelectedProgramUserId(user?.id ?? '')}
                  options={users}
                  getOptionLabel={(u) => `${getUserDisplayName(u)} (${u.email}) — ${getEffectiveRoleLabel(u)}`}
                  filterOptions={(options, { inputValue }) => {
                    const q = (inputValue || '').trim().toLowerCase();
                    if (!q) return options;
                    return options.filter(u =>
                      getUserDisplayName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                    );
                  }}
                  renderInput={(params) => <TextField {...params} label="Select User" placeholder="Type name or email to search..." />}
                />
              </FormControl>
              {selectedProgramUserId && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Overrides for {getUserDisplayName(users.find(u => u.id === selectedProgramUserId)!)}</Typography>
                  <Grid container spacing={1}>
                    {Object.values(PERMISSIONS).map(perm => {
                      const existing = programPermissions.find(
                        p => p.program_id === selectedProgramId && p.user_id === selectedProgramUserId && p.permission_key === perm
                      );
                      const key = `puser_${selectedProgramUserId}_${perm}`;
                      const isEnabled = existing ? existing.is_enabled : (permissionStates[key] ?? true);
                      return (
                        <Grid item xs={12} sm={6} md={4} key={perm}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={isEnabled}
                                onChange={(e) => {
                                  setPermissionStates(prev => ({ ...prev, [key]: e.target.checked }));
                                  handleSaveProgramPermission(perm, e.target.checked, selectedProgramUserId, undefined);
                                }}
                              />
                            }
                            label={perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by Role (default: all on; user-specific overrides take precedence)</Typography>
              <Grid container spacing={2}>
                {[UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC].map(role => (
                  <Grid item xs={12} key={role}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{role.charAt(0).toUpperCase() + role.slice(1)}</Typography>
                    {Object.values(PERMISSIONS).map(perm => {
                      const key = `role_${role}_${perm}`;
                      const existing = programPermissions.find(
                        p => p.program_id === selectedProgramId && p.role === role && p.permission_key === perm
                      );
                      const isEnabled = existing ? existing.is_enabled : (permissionStates[key] ?? true);
                      
                      return (
                        <FormControlLabel
                          key={perm}
                          control={
                            <Switch
                              checked={isEnabled}
                              onChange={(e) => {
                                setPermissionStates(prev => ({ ...prev, [key]: e.target.checked }));
                                handleSaveProgramPermission(perm, e.target.checked, undefined, role);
                              }}
                            />
                          }
                          label={perm.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          sx={{ display: 'block', mb: 0.5 }}
                        />
                      );
                    })}
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Paper>
      )}
      
      {/* Tab Visibility Tab */}
      {activeTab === 3 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Control which tabs and sections are visible
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            For <strong>users</strong>: control PECC Support Tool tabs (Snapshot, Activities, Gap Closure, Simulation, etc.) and sections like Pediatric Readiness Scores. For <strong>cohorts</strong> and <strong>programs</strong>: control announcements, discussions, members, and other cohort/program page tabs. Default is visible when no override is set.
          </Typography>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>Choose who or what to configure</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>User (PECC tool tabs)</Typography>
              <Autocomplete
                value={users.find(u => u.id === selectedUserId) ?? null}
                onChange={(_, u) => {
                  setSelectedUserId(u?.id ?? '');
                  if (u) { setSelectedCohortId(''); setSelectedProgramId(''); }
                }}
                options={users}
                getOptionLabel={(u) => `${getUserDisplayName(u)} (${u.email})`}
                filterOptions={(options, { inputValue }) => {
                  const q = (inputValue || '').trim().toLowerCase();
                  if (!q) return options;
                  return options.filter(u =>
                    getUserDisplayName(u).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                  );
                }}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Search user..." />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Cohort (cohort page tabs)</Typography>
              <Autocomplete
                value={cohorts.find(c => c.id === selectedCohortId) ?? null}
                onChange={(_, c) => {
                  setSelectedCohortId(c?.id ?? '');
                  if (c) { setSelectedUserId(''); setSelectedProgramId(''); }
                }}
                options={cohorts}
                getOptionLabel={(c) => `${c.name}${c.is_active === false ? ' (Inactive)' : ''}`}
                filterOptions={(options, { inputValue }) => {
                  const q = (inputValue || '').trim().toLowerCase();
                  if (!q) return options;
                  return options.filter(c =>
                    c.name.toLowerCase().includes(q) || (c.program_id || '').toLowerCase().includes(q)
                  );
                }}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Search cohort..." />}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Program (program page tabs)</Typography>
              <Autocomplete
                value={programs.find(p => p.id === selectedProgramId) ?? null}
                onChange={(_, p) => {
                  setSelectedProgramId(p?.id ?? '');
                  if (p) { setSelectedUserId(''); setSelectedCohortId(''); }
                }}
                options={programs}
                getOptionLabel={(p) => `${p.name}${p.is_active === false ? ' (Inactive)' : ''}`}
                filterOptions={(options, { inputValue }) => {
                  const q = (inputValue || '').trim().toLowerCase();
                  if (!q) return options;
                  return options.filter(p =>
                    p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
                  );
                }}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Search program..." />}
              />
            </Grid>
          </Grid>
          {!selectedUserId && !selectedCohortId && !selectedProgramId && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Select a user, cohort, or program above to see and edit their tab visibility settings.
            </Alert>
          )}
          
          {selectedUserId && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>User: PECC Tool page tabs</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Show or hide entire tabs on the PECC Support Tool (e.g. Snapshot, Activities, Gap Closure, Simulation).</Typography>
              <Grid container spacing={1}>
                {PECC_TAB_KEYS.map(tab => {
                  const existing = viewTabs.find(t => t.tab_key === tab);
                  const isVisible = existing ? existing.is_visible : (tabVisibilityStates[tab] ?? true);
                  return (
                    <Grid item xs={12} sm={6} md={4} key={tab}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isVisible}
                            onChange={(e) => {
                              setTabVisibilityStates(prev => ({ ...prev, [tab]: e.target.checked }));
                              handleSaveTabVisibility(tab, e.target.checked, 'user');
                            }}
                          />
                        }
                        label={tab === 'gap-plan' ? 'Gap Closure' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                      />
                    </Grid>
                  );
                })}
              </Grid>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Tool page sections</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Show or hide specific sections within a tab (e.g. Pediatric Readiness Scores on the Snapshot tab).</Typography>
              <Grid container spacing={1}>
                {TOOL_SECTION_TABS.map(({ key, label }) => {
                  const existing = viewTabs.find(t => t.tab_key === key);
                  const isVisible = existing ? existing.is_visible : (tabVisibilityStates[key] ?? true);
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isVisible}
                            onChange={(e) => {
                              setTabVisibilityStates(prev => ({ ...prev, [key]: e.target.checked }));
                              handleSaveTabVisibility(key, e.target.checked, 'user');
                            }}
                          />
                        }
                        label={label}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
          
          {(selectedCohortId || selectedProgramId) && !selectedUserId && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                {selectedCohortId ? 'Cohort' : 'Program'} page tabs — show or hide these sections for members
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                When a tab is hidden, members of this {selectedCohortId ? 'cohort' : 'program'} will not see it on the cohort/program detail page.
              </Typography>
              <Grid container spacing={2}>
                {COHORT_PROGRAM_TABS.map(({ key, label }) => {
                  const existing = viewTabs.find(t => t.tab_key === key);
                  const isVisible = existing ? existing.is_visible : (tabVisibilityStates[key] ?? true);
                  const scope = selectedCohortId ? 'cohort' : 'program';
                  return (
                    <Grid item xs={12} sm={6} md={4} key={key}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isVisible}
                            onChange={(e) => {
                              setTabVisibilityStates(prev => ({ ...prev, [key]: e.target.checked }));
                              handleSaveTabVisibility(key, e.target.checked, scope);
                            }}
                          />
                        }
                        label={label}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Paper>
      )}
      
      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button startIcon={<RefreshIcon />} onClick={loadData} variant="outlined" aria-label="Refresh permissions and data">Refresh</Button>
      </Box>
      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        message={snack?.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        ContentProps={{ role: 'alert', 'aria-live': 'polite' }}
        sx={{ '& .MuiSnackbarContent-message': { color: snack?.severity === 'error' ? 'error.main' : 'inherit' } }}
      />
    </Box>
  );
};

export default GranularPermissionsManager;
