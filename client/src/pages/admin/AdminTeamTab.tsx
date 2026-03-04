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
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Snackbar
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Send as SendIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { getRoleMuiColor } from '../../utils/roleUtils';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { createAndSendInvitation } from '../../utils/invitations';
import { UserRole, normalizeUserRole } from '../../types/database';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'admin' | 'manager' | 'mentor' | 'pecc' | 'hospital_system' | 'hiring_group';
  is_admin?: boolean;
  status: 'active' | 'pending' | 'inactive';
  lastLogin: string | null;
  createdAt: string;
  manager_id?: string | null;
  mentor_id?: string | null;
  manager_id_for_pecc?: string | null;  // Direct manager assignment for PECCs
  managerName?: string;
  mentorName?: string;
  managerNameForPECC?: string;  // Display name for direct manager
}

/** Team (user) management content for Admin CRM Team tab. */
const AdminTeamTab: React.FC = () => {
  const navigate = useNavigate();
  const { resetPasswordForEmail } = useAuth();
  const { userProfile, enterViewAsUser } = useUserProfile();
  const [users, setUsers] = useState<User[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity?: 'success' | 'error' }>({ open: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'pecc' as User['role'],
    is_admin: false,
    status: 'active' as 'active' | 'pending' | 'inactive',
    assignedManagerId: '' as string,
    assignedMentorId: '' as string,
    assignedManagerIdForPECC: '' as string,
    assignedHospitalSystems: [] as string[]
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'pecc' as User['role'],
    is_admin: false,
    sendInvite: true,
    assignedManagerId: '' as string,
    assignedMentorId: '' as string,
    assignedManagerIdForPECC: '' as string,
    assignedHospitalId: '' as string,
    assignedHospitalSystems: [] as string[]
  });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [hospitalSystemOptions, setHospitalSystemOptions] = useState<string[]>([]);
  const [hospitalOptions, setHospitalOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const loadHospitals = async () => {
      const { data } = await supabase.from('hospitals').select('id, name').order('name');
      setHospitalOptions((data || []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name || '' })));
    };
    loadHospitals();
  }, []);

  useEffect(() => {
    const loadHospitalSystems = async () => {
      const { data } = await supabase.from('hospitals').select('hospital_system').not('hospital_system', 'is', null);
      const names = [...new Set((data || []).map((r: { hospital_system: string | null }) => r.hospital_system).filter(Boolean) as string[])].sort();
      setHospitalSystemOptions(names);
    };
    loadHospitalSystems();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_admin, is_active, last_login, created_at, manager_id, mentor_id, manager_id_for_pecc');
      if (error) {
        setUsers([]);
      } else {
        const mapped: User[] = (data || []).map((r: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          role: string;
          is_admin?: boolean;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          manager_id: string | null;
          mentor_id: string | null;
          manager_id_for_pecc: string | null;
        }) => ({
          id: r.id,
          firstName: r.first_name || '',
          lastName: r.last_name || '',
          email: r.email || '',
          phone: r.phone || '',
          role: normalizeUserRole(r.role) as User['role'],
          is_admin: r.is_admin === true,
          status: r.is_active ? 'active' : 'inactive',
          lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
          manager_id: r.manager_id,
          mentor_id: r.mentor_id,
          manager_id_for_pecc: r.manager_id_for_pecc
        }));
        mapped.forEach((u) => {
          if (u.manager_id) {
            const m = mapped.find((x) => x.id === u.manager_id);
            if (m) u.managerName = `${m.firstName} ${m.lastName}`.trim() || m.email;
          }
          if (u.mentor_id) {
            const ment = mapped.find((x) => x.id === u.mentor_id);
            if (ment) u.mentorName = `${ment.firstName} ${ment.lastName}`.trim() || ment.email;
          }
          if (u.manager_id_for_pecc) {
            const m = mapped.find((x) => x.id === u.manager_id_for_pecc);
            if (m) u.managerNameForPECC = `${m.firstName} ${m.lastName}`.trim() || m.email;
          }
        });
        setUsers(mapped);
      }
      setLoadingUsers(false);
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const searchTokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const searchable = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase();
    const matchesSearch = searchTokens.length === 0 || searchTokens.every(token => searchable.includes(token));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error'> = {
      active: 'success',
      pending: 'warning',
      inactive: 'error'
    };
    return colors[status] || 'default';
  };

  const handleCreateUser = async () => {
    if (!userProfile?.id) {
      setSnackbar({ open: true, message: 'You must be logged in to create users', severity: 'error' });
      return;
    }
    if (!formData.email?.trim()) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' });
      return;
    }
    if (formData.role === 'mentor' && !formData.assignedManagerId) {
      setSnackbar({ open: true, message: 'Mentors must be assigned to a manager', severity: 'error' });
      return;
    }
    
    try {
      // If sendInvite is true, create an invitation
      if (formData.sendInvite) {
        // Convert string role to UserRole enum
        const roleMap: Record<string, UserRole> = {
          'pecc': UserRole.PECC,
          'mentor': UserRole.MENTOR,
          'manager': UserRole.MANAGER,
          'admin': UserRole.ADMIN,
          'hospital_system': UserRole.HOSPITAL_SYSTEM,
          'hiring_group': UserRole.HIRING_GROUP
        };
        const userRole = roleMap[formData.role] || UserRole.PECC;
        
        const { code } = await createAndSendInvitation({
          email: formData.email,
          role: userRole,
          invitedBy: userProfile.id,
          hospitalId: formData.role === 'pecc' && formData.assignedHospitalId ? formData.assignedHospitalId : null,
          mentorId: formData.role === 'pecc' && formData.assignedMentorId ? formData.assignedMentorId : null,
          managerId: formData.role === 'mentor' && formData.assignedManagerId ? formData.assignedManagerId : null,
          managerIdForPECC: formData.role === 'pecc' && formData.assignedManagerIdForPECC ? formData.assignedManagerIdForPECC : null
        });
        
        setSnackbar({ 
          open: true, 
          message: `Invitation sent to ${formData.email}. Invitation code: ${code}`, 
          severity: 'success' 
        });
      } else {
        // Create user directly (for admins who want to create accounts without invitation)
        // This would require admin privileges and proper user creation logic
        setSnackbar({ 
          open: true, 
          message: 'Direct user creation not yet implemented. Please use invitations.', 
          severity: 'error' 
        });
        return;
      }
      
      setDialogOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: 'pecc',
        is_admin: false,
        sendInvite: true,
        assignedManagerId: '',
        assignedMentorId: '',
        assignedManagerIdForPECC: '',
        assignedHospitalId: '',
        assignedHospitalSystems: []
      });
      
      // Reload users to show the invitation status
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_admin, is_active, last_login, created_at, manager_id, mentor_id, manager_id_for_pecc');
      if (usersData) {
        const mapped: User[] = (usersData || []).map((r: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone: string | null;
          role: string;
          is_admin?: boolean;
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          manager_id: string | null;
          mentor_id: string | null;
          manager_id_for_pecc: string | null;
        }) => ({
          id: r.id,
          firstName: r.first_name || '',
          lastName: r.last_name || '',
          email: r.email || '',
          phone: r.phone || '',
          role: normalizeUserRole(r.role) as User['role'],
          is_admin: r.is_admin === true,
          status: r.is_active ? 'active' : 'inactive',
          lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
          manager_id: r.manager_id,
          mentor_id: r.mentor_id,
          manager_id_for_pecc: r.manager_id_for_pecc
        }));
        mapped.forEach((u) => {
          if (u.manager_id) {
            const m = mapped.find((x) => x.id === u.manager_id);
            if (m) u.managerName = `${m.firstName} ${m.lastName}`.trim() || m.email;
          }
          if (u.mentor_id) {
            const ment = mapped.find((x) => x.id === u.mentor_id);
            if (ment) u.mentorName = `${ment.firstName} ${ment.lastName}`.trim() || ment.email;
          }
          if (u.manager_id_for_pecc) {
            const m = mapped.find((x) => x.id === u.manager_id_for_pecc);
            if (m) u.managerNameForPECC = `${m.firstName} ${m.lastName}`.trim() || m.email;
          }
        });
        setUsers(mapped);
      }
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: `Failed to create invitation: ${error.message || 'Unknown error'}`, 
        severity: 'error' 
      });
    }
  };

  const managers = users.filter((u) => u.role === 'manager');
  const mentors = users.filter((u) => u.role === 'mentor');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
  };

  const openProfileDrawer = async (editMode = false) => {
    setAnchorEl(null);
    if (selectedUser) {
      let assignedSystems: string[] = [];
      if (selectedUser.role === 'hospital_system') {
        const { data } = await supabase.from('hospital_system_assignments').select('hospital_system_name').eq('user_id', selectedUser.id);
        assignedSystems = (data || []).map((r: { hospital_system_name: string }) => r.hospital_system_name);
      } else if (selectedUser.role === 'hiring_group') {
        const { data } = await supabase.from('hiring_group_assignments').select('hospital_system_name').eq('user_id', selectedUser.id);
        assignedSystems = (data || []).map((r: { hospital_system_name: string }) => r.hospital_system_name);
      }
      setProfileForm({
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        phone: selectedUser.phone,
        role: selectedUser.role,
        is_admin: selectedUser.is_admin ?? false,
        status: selectedUser.status,
        assignedManagerId: selectedUser.role === 'mentor' && selectedUser.manager_id ? selectedUser.manager_id : '',
        assignedMentorId: selectedUser.role === 'pecc' && selectedUser.mentor_id ? selectedUser.mentor_id : '',
        assignedManagerIdForPECC: selectedUser.role === 'pecc' && selectedUser.manager_id_for_pecc ? selectedUser.manager_id_for_pecc : '',
        assignedHospitalSystems: assignedSystems
      });
      setProfileEditMode(editMode);
      setProfileError(null);
      setProfileDrawerOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setProfileSaving(true);
    setProfileError(null);
    const payload: Record<string, unknown> = {
      first_name: profileForm.firstName.trim(),
      last_name: profileForm.lastName.trim(),
      phone: profileForm.phone || null,
      role: profileForm.role,
      is_admin: profileForm.is_admin === true,
      is_active: profileForm.status === 'active',
      manager_id: profileForm.role === 'mentor' && profileForm.assignedManagerId ? profileForm.assignedManagerId : null,
      mentor_id: profileForm.role === 'pecc' && profileForm.assignedMentorId ? profileForm.assignedMentorId : null,
      manager_id_for_pecc: profileForm.role === 'pecc' && profileForm.assignedManagerIdForPECC ? profileForm.assignedManagerIdForPECC : null
    };
    const { error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', selectedUser.id);
    if (error) {
      setProfileSaving(false);
      const msg = error.code ? `${error.message} (${error.code})` : error.message;
      setProfileError(msg);
      return;
    }
    if (profileForm.role === 'hospital_system') {
      await supabase.from('hospital_system_assignments').delete().eq('user_id', selectedUser.id);
      for (const name of profileForm.assignedHospitalSystems) {
        await supabase.from('hospital_system_assignments').insert({ user_id: selectedUser.id, hospital_system_name: name });
      }
    } else if (profileForm.role === 'hiring_group') {
      await supabase.from('hiring_group_assignments').delete().eq('user_id', selectedUser.id);
      for (const name of profileForm.assignedHospitalSystems) {
        await supabase.from('hiring_group_assignments').insert({ user_id: selectedUser.id, hospital_system_name: name });
      }
    }
    setProfileSaving(false);
    setUsers(prev => prev.map(u => {
      if (u.id !== selectedUser.id) return u;
      const updated: User = {
        ...u,
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phone: profileForm.phone,
        role: profileForm.role,
        is_admin: profileForm.is_admin,
        status: profileForm.status,
        manager_id: profileForm.role === 'mentor' && profileForm.assignedManagerId ? profileForm.assignedManagerId : null,
        mentor_id: profileForm.role === 'pecc' && profileForm.assignedMentorId ? profileForm.assignedMentorId : null,
        manager_id_for_pecc: profileForm.role === 'pecc' && profileForm.assignedManagerIdForPECC ? profileForm.assignedManagerIdForPECC : null
      };
      if (profileForm.role === 'mentor' && profileForm.assignedManagerId) {
        const m = prev.find(x => x.id === profileForm.assignedManagerId);
        updated.managerName = m ? `${m.firstName} ${m.lastName}`.trim() || m.email : undefined;
      } else updated.managerName = undefined;
      if (profileForm.role === 'pecc' && profileForm.assignedMentorId) {
        const ment = prev.find(x => x.id === profileForm.assignedMentorId);
        updated.mentorName = ment ? `${ment.firstName} ${ment.lastName}`.trim() || ment.email : undefined;
      } else updated.mentorName = undefined;
      return updated;
    }));
    setSelectedUser(prev => prev ? {
      ...prev,
      firstName: profileForm.firstName.trim(),
      lastName: profileForm.lastName.trim(),
      phone: profileForm.phone,
      role: profileForm.role,
      is_admin: profileForm.is_admin,
      status: profileForm.status,
      manager_id: profileForm.role === 'mentor' && profileForm.assignedManagerId ? profileForm.assignedManagerId : null,
      mentor_id: profileForm.role === 'pecc' && profileForm.assignedMentorId ? profileForm.assignedMentorId : null,
      manager_id_for_pecc: profileForm.role === 'pecc' && profileForm.assignedManagerIdForPECC ? profileForm.assignedManagerIdForPECC : null,
      managerName: profileForm.role === 'mentor' && profileForm.assignedManagerId ? (() => { const m = users.find(u => u.id === profileForm.assignedManagerId); return m ? `${m.firstName} ${m.lastName}`.trim() || m.email : undefined; })() : undefined,
      mentorName: profileForm.role === 'pecc' && profileForm.assignedMentorId ? (() => { const m = users.find(u => u.id === profileForm.assignedMentorId); return m ? `${m.firstName} ${m.lastName}`.trim() || m.email : undefined; })() : undefined,
      managerNameForPECC: profileForm.role === 'pecc' && profileForm.assignedManagerIdForPECC ? (() => { const m = users.find(u => u.id === profileForm.assignedManagerIdForPECC); return m ? `${m.firstName} ${m.lastName}`.trim() || m.email : undefined; })() : undefined
    } : null);
    setProfileEditMode(false);
  };

  const handleToggleStatus = () => {
    if (selectedUser) {
      setUsers(users.map(u =>
        u.id === selectedUser.id
          ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
          : u
      ));
    }
    setAnchorEl(null);
  };

  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Team</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add User
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
          }}
          sx={{ width: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Role</InputLabel>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} label="Role">
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="mentor">Mentor</MenuItem>
            <MenuItem value="pecc">PECC</MenuItem>
            <MenuItem value="hospital_system">Hospital System</MenuItem>
            <MenuItem value="hiring_group">Hiring Group</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
          {filteredUsers.length} users
        </Typography>
      </Paper>

      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Reports to</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">
                      {users.length === 0 ? 'No users yet. Add your first user above.' : 'No users match your search or filters.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: `${getRoleMuiColor(user.role)}.main`, fontSize: '0.875rem' }}>
                        {(user.firstName || user.lastName || user.email || '?')[0].toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {(user.firstName || user.lastName).trim() ? `${user.firstName} ${user.lastName}`.trim() : (user.email || 'No name')}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">Joined {user.createdAt}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={user.role.toUpperCase()} size="small" color={getRoleMuiColor(user.role)} />
                      {user.is_admin && <Chip label="Admin" size="small" color="error" variant="outlined" />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {user.role === 'mentor' && user.managerName ? user.managerName : user.role === 'pecc' && user.mentorName ? user.mentorName : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip label={user.status} size="small" color={getStatusColor(user.status)} variant="outlined" />
                  </TableCell>
                  <TableCell>{user.lastLogin || 'Never'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, user)} aria-label={`Actions for ${(user.firstName || user.lastName || user.email || 'user').trim() || 'user'}`}><MoreIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => openProfileDrawer(false)}>View Profile</MenuItem>
        <MenuItem onClick={() => openProfileDrawer(true)}><EditIcon sx={{ mr: 1, fontSize: 18 }} /> Edit User</MenuItem>
        <MenuItem onClick={() => openProfileDrawer(true)}>Change Role</MenuItem>
        <MenuItem onClick={() => {
          setAnchorEl(null);
          if (selectedUser?.id) navigate(`/admin/settings?tab=granular-permissions&userId=${selectedUser.id}`);
        }}>
          <SettingsIcon sx={{ mr: 1, fontSize: 18 }} /> Manage permissions
        </MenuItem>
        <MenuItem onClick={async () => {
          if (!selectedUser?.id) return;
          setAnchorEl(null);
          const result = await enterViewAsUser(selectedUser.id);
          if (result.ok && result.dashboardPath) navigate(result.dashboardPath);
        }}>
          <VisibilityIcon sx={{ mr: 1, fontSize: 18 }} /> View as this user
        </MenuItem>
        <MenuItem onClick={handleToggleStatus}>{selectedUser?.status === 'active' ? 'Deactivate' : 'Activate'}</MenuItem>
        {selectedUser?.status === 'pending' && (
          <MenuItem onClick={() => setAnchorEl(null)}><SendIcon sx={{ mr: 1, fontSize: 18 }} /> Resend Invite</MenuItem>
        )}
        <MenuItem onClick={async () => {
          if (!selectedUser?.email) return;
          setAnchorEl(null);
          try {
            await resetPasswordForEmail(selectedUser.email, typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined);
            setSnackbar({ open: true, message: `Password reset email sent to ${selectedUser.email}`, severity: 'success' });
          } catch (err) {
            setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Failed to send reset email', severity: 'error' });
          }
        }}>
          Reset Password
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>Delete User</MenuItem>
      </Menu>

      <Drawer
        anchor="right"
        open={profileDrawerOpen}
        onClose={() => { setProfileDrawerOpen(false); setProfileEditMode(false); }}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
        container={typeof document !== 'undefined' ? document.body : undefined}
        ModalProps={{ disableEnforceFocus: true, disableAutoFocus: true }}
      >
        {selectedUser && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">{profileEditMode ? 'Edit User' : 'User Profile'}</Typography>
              <IconButton onClick={() => { setProfileDrawerOpen(false); setProfileEditMode(false); }}><CloseIcon /></IconButton>
            </Box>
            {profileError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProfileError(null)}>{profileError}</Alert>
            )}
            {profileEditMode ? (
              <Grid container spacing={2} sx={{ flex: 1, overflow: 'auto' }}>
                <Grid item xs={12}><TextField label="First Name" value={profileForm.firstName} onChange={(e) => setProfileForm(p => ({ ...p, firstName: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={12}><TextField label="Last Name" value={profileForm.lastName} onChange={(e) => setProfileForm(p => ({ ...p, lastName: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={12}><TextField label="Email" value={profileForm.email} fullWidth size="small" disabled helperText="Email cannot be changed here." /></Grid>
                <Grid item xs={12}><TextField label="Phone" value={profileForm.phone} onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Role</InputLabel>
                    <Select value={profileForm.role} label="Role" onChange={(e) => {
                      const role = e.target.value as User['role'];
                      setProfileForm(p => ({
                        ...p,
                        role,
                        assignedManagerId: role !== 'mentor' ? '' : p.assignedManagerId,
                        assignedMentorId: role !== 'pecc' ? '' : p.assignedMentorId,
                        assignedManagerIdForPECC: role !== 'pecc' ? '' : p.assignedManagerIdForPECC,
                        assignedHospitalSystems: (role === 'hospital_system' || role === 'hiring_group') ? p.assignedHospitalSystems : []
                      }));
                    }}>
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="manager">Manager</MenuItem>
                      <MenuItem value="mentor">Mentor</MenuItem>
                      <MenuItem value="pecc">PECC</MenuItem>
                      <MenuItem value="hospital_system">Hospital System</MenuItem>
                      <MenuItem value="hiring_group">Hiring Group</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={profileForm.is_admin} onChange={(e) => setProfileForm(p => ({ ...p, is_admin: e.target.checked }))} />}
                    label="Grant admin access (user can have multiple roles; e.g. Manager + Admin)"
                  />
                </Grid>
                {profileForm.role === 'mentor' && (
                  <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Reports to (Manager)</InputLabel>
                      <Select value={profileForm.assignedManagerId} onChange={(e) => setProfileForm(p => ({ ...p, assignedManagerId: e.target.value }))} label="Reports to (Manager)">
                        <MenuItem value=""><em>None</em></MenuItem>
                        {managers.filter(m => m.id !== selectedUser.id).map((m) => <MenuItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {profileForm.role === 'pecc' && (
                  <>
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Mentor (optional)</InputLabel>
                        <Select value={profileForm.assignedMentorId} onChange={(e) => setProfileForm(p => ({ ...p, assignedMentorId: e.target.value }))} label="Mentor (optional)">
                          <MenuItem value=""><em>None</em></MenuItem>
                          {mentors.filter(m => m.id !== selectedUser.id).map((m) => <MenuItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Direct Manager (optional, bypasses mentor)</InputLabel>
                        <Select value={profileForm.assignedManagerIdForPECC} onChange={(e) => setProfileForm(p => ({ ...p, assignedManagerIdForPECC: e.target.value }))} label="Direct Manager (optional, bypasses mentor)">
                          <MenuItem value=""><em>None</em></MenuItem>
                          {managers.filter(m => m.id !== selectedUser.id).map((m) => <MenuItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</MenuItem>)}
                        </Select>
                      </FormControl>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        If set, this PECC will be directly managed by the selected manager, bypassing the mentor tier.
                      </Typography>
                    </Grid>
                  </>
                )}
                {(profileForm.role === 'hospital_system' || profileForm.role === 'hiring_group') && (
                  <Grid item xs={12}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Assigned hospital systems</InputLabel>
                      <Select
                        multiple
                        value={profileForm.assignedHospitalSystems}
                        label="Assigned hospital systems"
                        onChange={(e) => setProfileForm(p => ({ ...p, assignedHospitalSystems: e.target.value as string[] }))}
                        renderValue={(selected) => selected.join(', ')}
                      >
                        {hospitalSystemOptions.map((name) => (
                          <MenuItem key={name} value={name}>{name}</MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {profileForm.role === 'hospital_system'
                          ? 'User will see all PECC data and aggregated data for hospitals in these systems (CRM Hospital system field).'
                          : 'User will see read-only snapshot view for these systems and their hospitals.'}
                      </Typography>
                    </FormControl>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={profileForm.status} label="Status" onChange={(e) => setProfileForm(p => ({ ...p, status: e.target.value as 'active' | 'pending' | 'inactive' }))}>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sx={{ mt: 'auto', pt: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" fullWidth onClick={() => setProfileEditMode(false)} disabled={profileSaving}>Cancel</Button>
                    <Button variant="contained" fullWidth startIcon={<SaveIcon />} onClick={handleSaveProfile} disabled={profileSaving}>{profileSaving ? 'Saving…' : 'Save'}</Button>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <>
                <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem', mb: 2 }}>
                  {(selectedUser.firstName || selectedUser.lastName || selectedUser.email || '?')[0].toUpperCase()}
                </Avatar>
                <Typography variant="h6">
                  {(selectedUser.firstName || selectedUser.lastName).trim() ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim() : (selectedUser.email || 'No name')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', my: 1 }}>
                  <Chip label={selectedUser.role} size="small" color={getRoleMuiColor(selectedUser.role)} />
                  {selectedUser.is_admin && <Chip label="Admin" size="small" color="error" variant="outlined" />}
                </Box>
                <List dense disablePadding>
                  <ListItem disablePadding><ListItemText primary="Email" secondary={selectedUser.email} /></ListItem>
                  <ListItem disablePadding><ListItemText primary="Phone" secondary={selectedUser.phone || '—'} /></ListItem>
                  <ListItem disablePadding><ListItemText primary="Status" secondary={<Chip label={selectedUser.status} size="small" color={getStatusColor(selectedUser.status)} variant="outlined" />} /></ListItem>
                  <ListItem disablePadding><ListItemText primary="Last login" secondary={selectedUser.lastLogin || 'Never'} /></ListItem>
                  <ListItem disablePadding><ListItemText primary="Joined" secondary={selectedUser.createdAt} /></ListItem>
                  {selectedUser.managerName && <ListItem disablePadding><ListItemText primary="Manager" secondary={selectedUser.managerName} /></ListItem>}
                  {selectedUser.mentorName && <ListItem disablePadding><ListItemText primary="Mentor" secondary={selectedUser.mentorName} /></ListItem>}
                  {selectedUser.managerNameForPECC && <ListItem disablePadding><ListItemText primary="Direct Manager" secondary={selectedUser.managerNameForPECC} /></ListItem>}
                </List>
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setProfileEditMode(true)}>Edit user</Button>
                  <Button variant="contained" color="primary" startIcon={<VisibilityIcon />} onClick={async () => {
                    const result = await enterViewAsUser(selectedUser.id);
                    if (result.ok && result.dashboardPath) { setProfileDrawerOpen(false); navigate(result.dashboardPath); }
                  }}>
                    View as this user
                  </Button>
                </Box>
              </>
            )}
          </Box>
        )}
      </Drawer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>The user will receive an invitation email to set up their account.</Alert>
          <Grid container spacing={2}>
            <Grid item xs={6}><TextField label="First Name" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} fullWidth required /></Grid>
            <Grid item xs={6}><TextField label="Last Name" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} fullWidth required /></Grid>
            <Grid item xs={12}><TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} fullWidth required /></Grid>
            <Grid item xs={6}><TextField label="Phone" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} fullWidth /></Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select value={formData.role} label="Role" onChange={(e) => {
                  const role = e.target.value as User['role'];
                  setFormData((prev) => ({
                    ...prev,
                    role,
                    assignedManagerId: role !== 'mentor' ? '' : prev.assignedManagerId,
                    assignedMentorId: role !== 'pecc' ? '' : prev.assignedMentorId,
                    assignedManagerIdForPECC: role !== 'pecc' ? '' : prev.assignedManagerIdForPECC,
                    assignedHospitalId: role !== 'pecc' ? '' : prev.assignedHospitalId,
                    assignedHospitalSystems: (role === 'hospital_system' || role === 'hiring_group') ? prev.assignedHospitalSystems : []
                  }));
                }}>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="mentor">Mentor</MenuItem>
                  <MenuItem value="pecc">PECC</MenuItem>
                  <MenuItem value="hospital_system">Hospital System</MenuItem>
                  <MenuItem value="hiring_group">Hiring Group</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={formData.is_admin} onChange={(e) => setFormData((prev) => ({ ...prev, is_admin: e.target.checked }))} />}
                label="Grant admin access (user can have multiple roles; e.g. Manager + Admin)"
              />
            </Grid>
            {formData.role === 'mentor' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Assign to Manager</InputLabel>
                  <Select value={formData.assignedManagerId} onChange={(e) => setFormData((prev) => ({ ...prev, assignedManagerId: e.target.value }))} label="Assign to Manager">
                    <MenuItem value=""><em>None</em></MenuItem>
                    {managers.map((m) => <MenuItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {formData.role === 'pecc' && (
              <>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Hospital (site for PECC)</InputLabel>
                    <Select value={formData.assignedHospitalId} onChange={(e) => setFormData((prev) => ({ ...prev, assignedHospitalId: e.target.value }))} label="Hospital (site for PECC)">
                      <MenuItem value=""><em>None – assign later</em></MenuItem>
                      {hospitalOptions.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}
                    </Select>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Pre-assigns the PECC to this hospital when they accept the invitation.
                    </Typography>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Assign to Mentor (optional)</InputLabel>
                    <Select value={formData.assignedMentorId} onChange={(e) => setFormData((prev) => ({ ...prev, assignedMentorId: e.target.value }))} label="Assign to Mentor (optional)">
                      <MenuItem value=""><em>None</em></MenuItem>
                      {mentors.map((m) => <MenuItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Assign Direct Manager (optional, bypasses mentor)</InputLabel>
                    <Select value={formData.assignedManagerIdForPECC} onChange={(e) => setFormData((prev) => ({ ...prev, assignedManagerIdForPECC: e.target.value }))} label="Assign Direct Manager (optional, bypasses mentor)">
                      <MenuItem value=""><em>None</em></MenuItem>
                      {managers.map((m) => <MenuItem key={m.id} value={m.id}>{m.firstName} {m.lastName} ({m.email})</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    If set, this PECC will be directly managed by the selected manager, bypassing the mentor tier.
                  </Typography>
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <FormControlLabel control={<Switch checked={formData.sendInvite} onChange={(e) => setFormData(prev => ({ ...prev, sendInvite: e.target.checked }))} />} label="Send invitation email immediately" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained" startIcon={<SendIcon />}>Create & Send Invite</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity || 'success'} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminTeamTab;
