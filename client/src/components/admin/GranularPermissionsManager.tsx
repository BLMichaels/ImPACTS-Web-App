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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { UserRole, PERMISSIONS, UserPermission, CohortPermission, ProgramPermission, ViewTab, Cohort, Program, User } from '../../types/database';

interface GranularPermissionsManagerProps {
  mode: 'admin' | 'manager';  // Admin can manage all, Manager can only manage their team
}

const GranularPermissionsManager: React.FC<GranularPermissionsManagerProps> = ({ mode }) => {
  const { userProfile } = useUserProfile();
  const [activeTab, setActiveTab] = useState(0);  // 0: Users, 1: Cohorts, 2: Programs, 3: Tabs
  
  // Data
  const [users, setUsers] = useState<User[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected entities
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  
  // Permissions
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [cohortPermissions, setCohortPermissions] = useState<CohortPermission[]>([]);
  const [programPermissions, setProgramPermissions] = useState<ProgramPermission[]>([]);
  const [viewTabs, setViewTabs] = useState<ViewTab[]>([]);
  
  // Permission states (for editing)
  const [permissionStates, setPermissionStates] = useState<Record<string, boolean>>({});
  const [tabVisibilityStates, setTabVisibilityStates] = useState<Record<string, boolean>>({});
  
  // Common tabs for cohorts/programs
  const COMMON_TABS = ['announcements', 'discussions', 'members', 'activities', 'milestones', 'wages'];
  
  useEffect(() => {
    loadData();
  }, [mode, userProfile?.id]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Load users (filtered by mode)
      let usersQuery = supabase.from('users').select('id, email, first_name, last_name, phone, role, is_active, created_at, updated_at, last_login, manager_id, mentor_id, manager_id_for_pecc');
      if (mode === 'manager' && userProfile?.id) {
        // Managers can only see their direct reports
        usersQuery = usersQuery.or(`manager_id.eq.${userProfile.id},manager_id_for_pecc.eq.${userProfile.id}`);
      }
      const { data: usersData } = await usersQuery;
      if (usersData) {
        setUsers(usersData.map((u: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          role: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_login: string | null;
          manager_id: string | null;
          mentor_id: string | null;
          manager_id_for_pecc: string | null;
        }) => ({
          id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          phone: u.phone || null,
          role: u.role as UserRole,
          is_active: u.is_active ?? true,
          created_at: u.created_at || new Date().toISOString(),
          updated_at: u.updated_at || new Date().toISOString(),
          last_login: u.last_login || null,
          manager_id: u.manager_id || null,
          mentor_id: u.mentor_id || null,
          manager_id_for_pecc: u.manager_id_for_pecc || null
        })));
      }
      
      // Load cohorts (filtered by mode)
      let cohortsQuery = supabase.from('cohorts').select('id, name, description, program_id, created_by, is_active, created_at, updated_at').eq('is_active', true);
      if (mode === 'manager' && userProfile?.id) {
        // Get cohorts managed by this manager
        const { data: managedCohorts } = await supabase
          .from('cohort_managers')
          .select('cohort_id')
          .eq('manager_id', userProfile.id);
        if (managedCohorts && managedCohorts.length > 0) {
          cohortsQuery = cohortsQuery.in('id', managedCohorts.map(c => c.cohort_id));
        } else {
          cohortsQuery = cohortsQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // No results
        }
      }
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
      
      // Load programs (filtered by mode)
      let programsQuery = supabase.from('programs').select('id, name, description, start_date, end_date, created_by, is_active, created_at, updated_at').eq('is_active', true);
      if (mode === 'manager' && userProfile?.id) {
        // Get programs managed by this manager
        const { data: managedPrograms } = await supabase
          .from('program_managers')
          .select('program_id')
          .eq('manager_id', userProfile.id);
        if (managedPrograms && managedPrograms.length > 0) {
          programsQuery = programsQuery.in('id', managedPrograms.map(p => p.program_id));
        } else {
          programsQuery = programsQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // No results
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
    } finally {
      setLoading(false);
    }
  };
  
  const loadPermissions = async () => {
    if (selectedUserId) {
      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', selectedUserId);
      if (data) {
        setUserPermissions(data);
        const states: Record<string, boolean> = {};
        data.forEach(p => { states[p.permission_key] = p.is_enabled; });
        setPermissionStates(states);
      }
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
      await loadPermissions();
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
      await loadPermissions();
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
      await loadPermissions();
    }
  };
  
  const handleSaveTabVisibility = async (tabKey: string, visible: boolean, scope: 'user' | 'cohort' | 'program') => {
    const scopeId = scope === 'user' ? selectedUserId : scope === 'cohort' ? selectedCohortId : selectedProgramId;
    if (!scopeId) return;
    
    const payload: Partial<ViewTab> = {
      tab_key: tabKey,
      is_visible: visible,
      granted_by: userProfile?.id,
      updated_at: new Date().toISOString()
    };
    
    if (scope === 'user') payload.user_id = scopeId;
    else if (scope === 'cohort') payload.cohort_id = scopeId;
    else payload.program_id = scopeId;
    
    const { error } = await supabase
      .from('view_tabs')
      .upsert(payload, { onConflict: scope === 'user' ? 'user_id,tab_key' : scope === 'cohort' ? 'cohort_id,tab_key' : 'program_id,tab_key' });
    
    if (!error) {
      await loadPermissions();
    }
  };
  
  const handleDeletePermission = async (type: 'user' | 'cohort' | 'program', id: string) => {
    const table = type === 'user' ? 'user_permissions' : type === 'cohort' ? 'cohort_permissions' : 'program_permissions';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) {
      await loadPermissions();
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
      
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label="User Permissions" />
        <Tab label="Cohort Permissions" />
        <Tab label="Program Permissions" />
        <Tab label="Tab Visibility" />
      </Tabs>
      
      {/* User Permissions Tab */}
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select User</InputLabel>
            <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} label="Select User">
              <MenuItem value=""><em>None</em></MenuItem>
              {users.map(u => (
                <MenuItem key={u.id} value={u.id}>
                  {u.first_name} {u.last_name} ({u.email}) - {u.role}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedUserId && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Permission Overrides</Typography>
              <Grid container spacing={2}>
                {Object.values(PERMISSIONS).map(perm => {
                  const existing = userPermissions.find(p => p.permission_key === perm);
                  const isEnabled = existing ? existing.is_enabled : permissionStates[perm] ?? false;
                  
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
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Paper>
      )}
      
      {/* Cohort Permissions Tab */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Cohort</InputLabel>
            <Select value={selectedCohortId} onChange={(e) => setSelectedCohortId(e.target.value)} label="Select Cohort">
              <MenuItem value=""><em>None</em></MenuItem>
              {cohorts.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedCohortId && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set permissions for specific users or roles within this cohort. User-specific overrides take precedence over role-based permissions.
              </Alert>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by User</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <Autocomplete
                  options={users}
                  getOptionLabel={(u) => `${u.first_name} ${u.last_name} (${u.email})`}
                  renderInput={(params) => <TextField {...params} label="Select User" />}
                  onChange={(_, user) => {
                    if (user) {
                      // Show permissions for this user
                      Object.values(PERMISSIONS).forEach(perm => {
                        const existing = cohortPermissions.find(
                          p => p.cohort_id === selectedCohortId && p.user_id === user.id && p.permission_key === perm
                        );
                        if (!existing) {
                          // Initialize with default (can be toggled)
                        }
                      });
                    }
                  }}
                />
              </FormControl>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by Role</Typography>
              <Grid container spacing={2}>
                {[UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC].map(role => (
                  <Grid item xs={12} key={role}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{role.charAt(0).toUpperCase() + role.slice(1)}</Typography>
                    {Object.values(PERMISSIONS).slice(0, 5).map(perm => {
                      const key = `role_${role}_${perm}`;
                      const existing = cohortPermissions.find(
                        p => p.cohort_id === selectedCohortId && p.role === role && p.permission_key === perm
                      );
                      const isEnabled = existing ? existing.is_enabled : permissionStates[key] ?? false;
                      
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
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Program</InputLabel>
            <Select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)} label="Select Program">
              <MenuItem value=""><em>None</em></MenuItem>
              {programs.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedProgramId && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set permissions for specific users or roles within this program. User-specific overrides take precedence over role-based permissions.
              </Alert>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Permissions by Role</Typography>
              <Grid container spacing={2}>
                {[UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC].map(role => (
                  <Grid item xs={12} key={role}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>{role.charAt(0).toUpperCase() + role.slice(1)}</Typography>
                    {Object.values(PERMISSIONS).slice(0, 5).map(perm => {
                      const key = `role_${role}_${perm}`;
                      const existing = programPermissions.find(
                        p => p.program_id === selectedProgramId && p.role === role && p.permission_key === perm
                      );
                      const isEnabled = existing ? existing.is_enabled : permissionStates[key] ?? false;
                      
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
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Scope</InputLabel>
            <Select value={activeTab === 3 ? 'cohort' : 'user'} disabled>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="cohort">Cohort</MenuItem>
              <MenuItem value="program">Program</MenuItem>
            </Select>
          </FormControl>
          
          {(selectedUserId || selectedCohortId || selectedProgramId) && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>Tab Visibility</Typography>
              <Grid container spacing={2}>
                {COMMON_TABS.map(tab => {
                  const existing = viewTabs.find(t => t.tab_key === tab);
                  const isVisible = existing ? existing.is_visible : tabVisibilityStates[tab] ?? true;
                  const scope = selectedUserId ? 'user' : selectedCohortId ? 'cohort' : 'program';
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={tab}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={isVisible}
                            onChange={(e) => {
                              setTabVisibilityStates(prev => ({ ...prev, [tab]: e.target.checked }));
                              handleSaveTabVisibility(tab, e.target.checked, scope);
                            }}
                          />
                        }
                        label={tab.charAt(0).toUpperCase() + tab.slice(1)}
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
        <Button startIcon={<RefreshIcon />} onClick={loadData} variant="outlined">Refresh</Button>
      </Box>
    </Box>
  );
};

export default GranularPermissionsManager;
