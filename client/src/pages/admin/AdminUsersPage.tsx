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
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Person as PersonIcon,
  Send as SendIcon
} from '@mui/icons-material';

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
}

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'pecc' as User['role'],
    sendInvite: true
  });

  useEffect(() => {
    // Users loaded from Supabase when backend is connected; start empty
    setUsers([]);
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
      createdAt: new Date().toISOString().split('T')[0]
    };
    setUsers([...users, newUser]);
    setDialogOpen(false);
    setFormData({ firstName: '', lastName: '', email: '', phone: '', role: 'pecc', sendInvite: true });
  };

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
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Role</TableCell>
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

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => setAnchorEl(null)}>View Profile</MenuItem>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as User['role'] }))}
                  label="Role"
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="mentor">Mentor</MenuItem>
                  <MenuItem value="pecc">PECC</MenuItem>
                </Select>
              </FormControl>
            </Grid>
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
