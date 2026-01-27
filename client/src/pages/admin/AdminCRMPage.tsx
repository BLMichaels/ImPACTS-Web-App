import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
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
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Download as DownloadIcon
} from '@mui/icons-material';

interface Contact {
  id: string;
  type: 'organization' | 'hospital' | 'manager' | 'mentor' | 'pecc' | 'other';
  name: string;
  organization: string;
  email: string;
  phone: string;
  status: string;
  region: string;
  createdAt: string;
  notes: string;
}

const AdminCRMPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [formData, setFormData] = useState({
    type: 'other',
    name: '',
    organization: '',
    email: '',
    phone: '',
    status: 'Active',
    region: '',
    notes: ''
  });

  useEffect(() => {
    // Contacts loaded from Supabase when backend is connected; start empty
    setContacts([]);
  }, []);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.organization.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (tabValue === 0) return matchesSearch;
    if (tabValue === 1) return matchesSearch && contact.type === 'organization';
    if (tabValue === 2) return matchesSearch && contact.type === 'hospital';
    if (tabValue === 3) return matchesSearch && contact.type === 'manager';
    if (tabValue === 4) return matchesSearch && contact.type === 'mentor';
    if (tabValue === 5) return matchesSearch && contact.type === 'pecc';
    if (tabValue === 6) return matchesSearch && contact.type === 'other';
    return matchesSearch;
  });

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      organization: '#2196f3',
      hospital: '#4caf50',
      manager: '#9c27b0',
      mentor: '#ff9800',
      pecc: '#e91e63',
      other: '#607d8b'
    };
    return colors[type] || '#607d8b';
  };

  const handleSaveContact = () => {
    const newContact: Contact = {
      id: `contact_${Date.now()}`,
      ...formData,
      type: formData.type as Contact['type'],
      createdAt: new Date().toISOString().split('T')[0]
    };
    setContacts([...contacts, newContact]);
    setDialogOpen(false);
    setFormData({ type: 'other', name: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '' });
  };

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">CRM - All Contacts</Typography>
        <Box>
          <Button startIcon={<DownloadIcon />} sx={{ mr: 1 }}>Export</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add Contact
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Organizations', count: contacts.filter(c => c.type === 'organization').length, color: '#2196f3' },
          { label: 'Hospitals', count: contacts.filter(c => c.type === 'hospital').length, color: '#4caf50' },
          { label: 'Managers', count: contacts.filter(c => c.type === 'manager').length, color: '#9c27b0' },
          { label: 'Mentors', count: contacts.filter(c => c.type === 'mentor').length, color: '#ff9800' },
          { label: 'PECCs', count: contacts.filter(c => c.type === 'pecc').length, color: '#e91e63' },
          { label: 'Other', count: contacts.filter(c => c.type === 'other').length, color: '#607d8b' }
        ].map((item) => (
          <Grid item xs={6} sm={4} md={2} key={item.label}>
            <Paper sx={{ p: 2, textAlign: 'center', borderTop: 3, borderColor: item.color }}>
              <Typography variant="h5" sx={{ color: item.color }}>{item.count}</Typography>
              <Typography variant="body2" color="textSecondary">{item.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Tabs and Search */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2, flexWrap: 'wrap' }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="All" />
            <Tab label="Organizations" />
            <Tab label="Hospitals" />
            <Tab label="Managers" />
            <Tab label="Mentors" />
            <Tab label="PECCs" />
            <Tab label="Other" />
          </Tabs>
          <Box sx={{ flexGrow: 1 }} />
          <TextField
            size="small"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
            }}
            sx={{ width: 250, my: 1 }}
          />
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Region</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredContacts.map((contact) => (
              <TableRow key={contact.id} hover>
                <TableCell>
                  <Chip 
                    label={contact.type} 
                    size="small" 
                    sx={{ bgcolor: getTypeColor(contact.type), color: 'white' }}
                  />
                </TableCell>
                <TableCell>{contact.name}</TableCell>
                <TableCell>{contact.organization || '-'}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell>{contact.region || '-'}</TableCell>
                <TableCell>
                  <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : 'default'} />
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
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
        <MenuItem onClick={() => setAnchorEl(null)}>View Details</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Edit</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Send Email</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>View History</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>

      {/* Add Contact Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Contact</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  label="Type"
                >
                  <MenuItem value="organization">Organization</MenuItem>
                  <MenuItem value="hospital">Hospital</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="mentor">Mentor</MenuItem>
                  <MenuItem value="pecc">PECC</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Organization"
                value={formData.organization}
                onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                fullWidth
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
              <TextField
                label="Region"
                value={formData.region}
                onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  label="Status"
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveContact} variant="contained">Save Contact</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCRMPage;
