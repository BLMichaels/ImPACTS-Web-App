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
  TableSortLabel,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Business as BusinessIcon
} from '@mui/icons-material';

interface Contact {
  id: string;
  type: 'hospital' | 'mentor' | 'pecc';
  name: string;
  organization: string;
  email: string;
  phone: string;
  status: string;
  lastContact: string;
  assignedTo: string;
}

const ManagerCRMPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    // Mock data
    setContacts([
      { id: '1', type: 'hospital', name: 'Memorial General Hospital', organization: '', email: 'admin@memorial.org', phone: '(555) 123-4567', status: 'Active', lastContact: '2026-01-25', assignedTo: 'Sarah Johnson' },
      { id: '2', type: 'hospital', name: 'Children\'s Regional Medical Center', organization: '', email: 'info@childrens.org', phone: '(555) 234-5678', status: 'Active', lastContact: '2026-01-20', assignedTo: 'Michael Chen' },
      { id: '3', type: 'mentor', name: 'Sarah Johnson', organization: 'PRISM Team', email: 'sarah.johnson@example.com', phone: '(555) 111-2222', status: 'Active', lastContact: '2026-01-27', assignedTo: '-' },
      { id: '4', type: 'mentor', name: 'Michael Chen', organization: 'PRISM Team', email: 'michael.chen@example.com', phone: '(555) 333-4444', status: 'Active', lastContact: '2026-01-26', assignedTo: '-' },
      { id: '5', type: 'pecc', name: 'Jane Smith', organization: 'Memorial General Hospital', email: 'jane.smith@memorial.org', phone: '(555) 444-5555', status: 'Active', lastContact: '2026-01-24', assignedTo: 'Sarah Johnson' },
      { id: '6', type: 'pecc', name: 'John Doe', organization: 'Children\'s Regional', email: 'john.doe@childrens.org', phone: '(555) 555-6666', status: 'Active', lastContact: '2026-01-22', assignedTo: 'Michael Chen' },
      { id: '7', type: 'hospital', name: 'St. Mary\'s Community Hospital', organization: '', email: 'contact@stmarys.org', phone: '(555) 345-6789', status: 'Pending', lastContact: '2026-01-15', assignedTo: 'Unassigned' },
      { id: '8', type: 'pecc', name: 'Emily Brown', organization: 'St. Mary\'s Community', email: 'emily.brown@stmarys.org', phone: '(555) 666-7777', status: 'Pending', lastContact: '2026-01-10', assignedTo: 'Unassigned' }
    ]);
  }, []);

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.organization.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (tabValue === 0) return matchesSearch; // All
    if (tabValue === 1) return matchesSearch && contact.type === 'hospital';
    if (tabValue === 2) return matchesSearch && contact.type === 'mentor';
    if (tabValue === 3) return matchesSearch && contact.type === 'pecc';
    return matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hospital': return <HospitalIcon />;
      case 'mentor': return <PersonIcon />;
      case 'pecc': return <PersonIcon />;
      default: return <BusinessIcon />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'hospital': return '#1976d2';
      case 'mentor': return '#388e3c';
      case 'pecc': return '#7b1fa2';
      default: return '#757575';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'success';
      case 'Pending': return 'warning';
      case 'Inactive': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Contact Management (CRM)</Typography>
      
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {contacts.filter(c => c.type === 'hospital').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">Hospitals</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {contacts.filter(c => c.type === 'mentor').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">Mentors</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="secondary">
              {contacts.filter(c => c.type === 'pecc').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">PECCs</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {contacts.filter(c => c.status === 'Pending').length}
            </Typography>
            <Typography variant="body2" color="textSecondary">Pending</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs and Search */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="All" />
            <Tab label="Hospitals" />
            <Tab label="Mentors" />
            <Tab label="PECCs" />
          </Tabs>
          <Box sx={{ flexGrow: 1 }} />
          <TextField
            size="small"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
            sx={{ width: 250 }}
          />
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>
                <TableSortLabel>Name</TableSortLabel>
              </TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Last Contact</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="textSecondary" sx={{ py: 4 }}>
                    No contacts found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id} hover>
                  <TableCell>
                    <Avatar sx={{ bgcolor: getTypeColor(contact.type), width: 32, height: 32 }}>
                      {getTypeIcon(contact.type)}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{contact.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {contact.organization || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{contact.email}</TableCell>
                  <TableCell>{contact.phone}</TableCell>
                  <TableCell>
                    <Chip 
                      label={contact.status} 
                      size="small" 
                      color={getStatusColor(contact.status) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color={contact.assignedTo === 'Unassigned' ? 'error' : 'inherit'}>
                      {contact.assignedTo}
                    </Typography>
                  </TableCell>
                  <TableCell>{contact.lastContact}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => setAnchorEl(null)}>View Details</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Edit Contact</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Send Email</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Assign to Mentor</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>View Activity History</MenuItem>
      </Menu>
    </Box>
  );
};

export default ManagerCRMPage;
