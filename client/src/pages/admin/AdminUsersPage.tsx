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
  ListItemText
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Person as PersonIcon,
  Send as SendIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { supabase } from '../../supabase';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'admin' | 'manager' | 'mentor' | 'pecc';
  status: 'active' | 'pending' | 'inactive';
  lastLogin: string | null;
  createdAt: string;
  manager_id?: string | null;
  mentor_id?: string | null;
  managerName?: string;
  mentorName?: string;
}

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'pecc' as User['role'],
    sendInvite: true,
    assignedManagerId: '' as string,
    assignedMentorId: '' as string
  });
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_active, last_login, created_at, manager_id, mentor_id');
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
          is_active: boolean;
          last_login: string | null;
          created_at: string;
          manager_id: string | null;
          mentor_id: string | null;
        }) => ({
          id: r.id,
          firstName: r.first_name || '',
          lastName: r.last_name || '',
          email: r.email || '',
          phone: r.phone || '',
          role: r.role as User['role'],
          status: r.is_active ? 'active' : 'inactive',
          lastLogin: r.last_login ? new Date(r.last_login).toISOString().split('T')[0] : null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
          manager_id: r.manager_id,
          mentor_id: r.mentor_id
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
        });
        setUsers(mapped);
      }
      setLoadingUsers(false);
    };
    loadUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role: string) => {
    const colors: Record<string, 'error' | 'secondary' | 'warning' | 'primary'> = {
      admin: 'error',
      manager: 'secondary',
      mentor: 'warning',
      pecc: 'primary'
    };
    return colors[role] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error'> = {
      active: 'success',
      pending: 'warning',
      inactive: 'error'
    };
    return colors[status] || 'default';
  };

  const handleCreateUser = () => {
    const newUser: User = {
      id: `user_${Date.now()}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      role: formData.role,
      status: 'pending',
      lastLogin: null,
      createdAt: new Date().toISOString().split('T')[0],
      manager_id: formData.role === 'mentor' && formData.assignedManagerId ? formData.assignedManagerId : null,
      mentor_id: formData.role === 'pecc' && formData.assignedMentorId ? formData.assignedMentorId : null
    };
    if (formData.role === 'mentor' && formData.assignedManagerId) {
      const m = users.find((u) => u.id === formData.assignedManagerId);
      if (m) newUser.managerName = `${m.firstName} ${m.lastName}`.trim() || m.email;
    }
    if (formData.role === 'pecc' && formData.assignedMentorId) {
      const ment = users.find((u) => u.id === formData.assignedMentorId);
      if (ment) newUser.mentorName = `${ment.firstName} ${ment.lastName}`.trim() || ment.email;
    }
    setUsers([...users, newUser]);
    setDialogOpen(false);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'pecc',
      sendInvite: true,
      assignedManagerId: '',
      assignedMentorId: ''
    });
  };

  const managers = users.filter((u) => u.role === 'manager');
  const mentors = users.filter((u) => u.role === 'mentor');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, user: User) => {
    setAnchorEl(event.currentTarget);
    setSelectedUser(user);
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
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add User
        </Button>
      </Box>

      {/* Filters */}
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
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            label="Role"
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="mentor">Mentor</MenuItem>
            <MenuItem value="pecc">PECC</MenuItem>
          </Select>
        </FormControl>
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Typography variant="body2" color="textSecondary" sx={{ alignSelf: 'center' }}>
          {filteredUsers.length} users
        </Typography>
      </Paper>

      {/* Users Table */}
      {loadingUsers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
      <TableContainer component={Paper}>
        <Table>
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
            {filteredUsers.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: `${getRoleColor(user.role)}.main` }}>
                      {user.firstName[0]}{user.lastName[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{user.firstName} {user.lastName}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        Joined {user.createdAt}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.phone}</TableCell>
                <TableCell>
                  <Chip label={user.role.toUpperCase()} size="small" color={getRoleColor(user.role)} />
                </TableCell>
                <TableCell>
                  {user.role === 'mentor' && user.managerName
                    ? user.managerName
                    : user.role === 'pecc' && user.mentorName
                    ? user.mentorName
                    : '—'}
                </TableCell>
                <TableCell>
                  <Chip label={user.status} size="small" color={getStatusColor(user.status)} variant="outlined" />
                </TableCell>
                <TableCell>
                  {user.lastLogin || 'Never'}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, user)}>
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => {
          setAnchorEl(null);
          setTimeout(() => setProfileDrawerOpen(true), 150);
        }}>
          View Profile
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Edit User</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Change Role</MenuItem>
        <MenuItem onClick={handleToggleStatus}>
          {selectedUser?.status === 'active' ? 'Deactivate' : 'Activate'}
        </MenuItem>
        {selectedUser?.status === 'pending' && (
          <MenuItem onClick={() => setAnchorEl(null)}>
            <SendIcon sx={{ mr: 1, fontSize: 18 }} /> Resend Invite
          </MenuItem>
        )}
        <MenuItem onClick={() => setAnchorEl(null)}>Reset Password</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>Delete User</MenuItem>
      </Menu>

      {/* Profile Drawer */}
      <Drawer anchor="right" open={profileDrawerOpen} onClose={() => setProfileDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}>
        {selectedUser && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">User Profile</Typography>
              <IconButton onClick={() => setProfileDrawerOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem', mb: 2 }}>
              {(selectedUser.firstName || selectedUser.lastName || '?')[0].toUpperCase()}
            </Avatar>
            <Typography variant="h6">{selectedUser.firstName} {selectedUser.lastName}</Typography>
            <Chip label={selectedUser.role} size="small" color={getRoleColor(selectedUser.role)} sx={{ my: 1 }} />
            <List dense disablePadding>
              <ListItem disablePadding><ListItemText primary="Email" secondary={selectedUser.email} /></ListItem>
              <ListItem disablePadding><ListItemText primary="Phone" secondary={selectedUser.phone || '—'} /></ListItem>
              <ListItem disablePadding><ListItemText primary="Status" secondary={<Chip label={selectedUser.status} size="small" color={getStatusColor(selectedUser.status)} variant="outlined" />} /></ListItem>
              <ListItem disablePadding><ListItemText primary="Last login" secondary={selectedUser.lastLogin || 'Never'} /></ListItem>
              <ListItem disablePadding><ListItemText primary="Joined" secondary={selectedUser.createdAt} /></ListItem>
              {selectedUser.managerName && <ListItem disablePadding><ListItemText primary="Manager" secondary={selectedUser.managerName} /></ListItem>}
              {selectedUser.mentorName && <ListItem disablePadding><ListItemText primary="Mentor" secondary={selectedUser.mentorName} /></ListItem>}
            </List>
          </Box>
        )}
      </Drawer>

      {/* Add User Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            The user will receive an invitation email to set up their account.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth required>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  onChange={(e) => {
                    const role = e.target.value as User['role'];
                    setFormData((prev) => ({
                      ...prev,
                      role,
                      assignedManagerId: role !== 'mentor' ? '' : prev.assignedManagerId,
                      assignedMentorId: role !== 'pecc' ? '' : prev.assignedMentorId
                    }));
                  }}
                  label="Role"
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="mentor">Mentor</MenuItem>
                  <MenuItem value="pecc">PECC</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formData.role === 'mentor' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Assign to Manager</InputLabel>
                  <Select
                    value={formData.assignedManagerId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, assignedManagerId: e.target.value }))}
                    label="Assign to Manager"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {managers.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {formData.role === 'pecc' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Assign to Mentor</InputLabel>
                  <Select
                    value={formData.assignedMentorId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, assignedMentorId: e.target.value }))}
                    label="Assign to Mentor"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {mentors.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.email})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.sendInvite}
                    onChange={(e) => setFormData(prev => ({ ...prev, sendInvite: e.target.checked }))}
                  />
                }
                label="Send invitation email immediately"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateUser} variant="contained" startIcon={<SendIcon />}>
            Create & Send Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUsersPage;
