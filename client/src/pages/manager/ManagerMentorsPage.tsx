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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Avatar,
  Grid,
  Alert,
  Snackbar,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Send as SendIcon,
  LocalHospital as HospitalIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

interface Mentor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'pending' | 'inactive';
  hospitals: string[];
  peccs: number;
  hoursThisMonth: number;
  joinedDate: string;
}

interface Hospital {
  id: string;
  name: string;
}

const ManagerMentorsPage: React.FC = () => {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    // Mentors and hospitals loaded from Supabase when backend is connected; start empty
    setMentors([]);
    setHospitals([]);
  }, []);

  const handleInviteMentor = () => {
    if (!formData.email) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
      return;
    }

    // Generate invite code
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    
    navigator.clipboard.writeText(inviteUrl);
    
    // Add as pending mentor
    const newMentor: Mentor = {
      id: `mentor_${Date.now()}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      status: 'pending',
      hospitals: [],
      peccs: 0,
      hoursThisMonth: 0,
      joinedDate: new Date().toISOString().split('T')[0]
    };

    setMentors([...mentors, newMentor]);
    setDialogOpen(false);
    setFormData({ firstName: '', lastName: '', email: '', phone: '' });
    setSnackbar({ 
      open: true, 
      message: `Invitation link copied! Send to ${formData.email}`, 
      severity: 'success' 
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, mentor: Mentor) => {
    setAnchorEl(event.currentTarget);
    setSelectedMentor(mentor);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAssignHospitals = () => {
    handleMenuClose();
    setAssignDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'inactive': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Manage Mentors</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Invite Mentor
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Mentor</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Hospitals</TableCell>
              <TableCell>PECCs</TableCell>
              <TableCell>Hours (This Month)</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mentors.map((mentor) => (
              <TableRow key={mentor.id}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {mentor.firstName[0]}{mentor.lastName[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{mentor.firstName} {mentor.lastName}</Typography>
                      <Typography variant="caption" color="textSecondary">{mentor.phone}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{mentor.email}</TableCell>
                <TableCell>
                  <Chip 
                    label={mentor.status} 
                    size="small" 
                    color={getStatusColor(mentor.status) as any}
                  />
                </TableCell>
                <TableCell>
                  {mentor.hospitals.length > 0 ? (
                    <Box>
                      {mentor.hospitals.slice(0, 2).map((h, i) => (
                        <Chip key={i} label={h} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                      ))}
                      {mentor.hospitals.length > 2 && (
                        <Chip label={`+${mentor.hospitals.length - 2}`} size="small" />
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">None assigned</Typography>
                  )}
                </TableCell>
                <TableCell>{mentor.peccs}</TableCell>
                <TableCell>{mentor.hoursThisMonth}h</TableCell>
                <TableCell>
                  <IconButton onClick={(e) => handleMenuOpen(e, mentor)}>
                    <MoreIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={handleAssignHospitals}>
          <HospitalIcon sx={{ mr: 1 }} /> Assign Hospitals
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>View Activities</MenuItem>
        <MenuItem onClick={handleMenuClose}>View PECCs</MenuItem>
        <MenuItem onClick={handleMenuClose}>Send Message</MenuItem>
        {selectedMentor?.status === 'pending' && (
          <MenuItem onClick={handleMenuClose}>
            <SendIcon sx={{ mr: 1 }} /> Resend Invite
          </MenuItem>
        )}
      </Menu>

      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite New Mentor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Send an invitation link to add a new mentor to your team. They'll be able to set up their account and start working with hospitals you assign.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                fullWidth
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
            <Grid item xs={12}>
              <TextField
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleInviteMentor} variant="contained" startIcon={<CopyIcon />}>
            Generate & Copy Invite Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign Hospitals Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Hospitals to {selectedMentor?.firstName} {selectedMentor?.lastName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Select hospitals to assign to this mentor.
          </Typography>
          <List>
            {hospitals.map((hospital) => {
              const isAssigned = selectedMentor?.hospitals.includes(hospital.name);
              return (
                <ListItem key={hospital.id} button>
                  <ListItemText primary={hospital.name} />
                  <ListItemSecondaryAction>
                    <Chip 
                      label={isAssigned ? 'Assigned' : 'Assign'} 
                      color={isAssigned ? 'primary' : 'default'}
                      onClick={() => {}}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Close</Button>
          <Button variant="contained">Save Assignments</Button>
        </DialogActions>
      </Dialog>

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

export default ManagerMentorsPage;
