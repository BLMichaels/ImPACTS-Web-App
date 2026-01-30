import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';

// Types
interface Hospital {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  traumaLevel: string;
  edSize: string;
  notes: string;
  isWorkingWith: boolean; // true = actively working with, false = just a contact/reference
}

interface Contact {
  id: string;
  hospitalId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactStatus: string;
  roleAtHospital: string;
  isPrimaryContact: boolean;
  isActivelyEngaged: boolean;
  notes: string;
}

/** CRM hospital row from Supabase hospitals table */
interface CrmHospitalRow {
  id: string;
  facility_id?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  trauma_level?: string | null;
  ed_size?: string | null;
  notes?: string | null;
}

const TRAUMA_LEVELS = [
  'Level I',
  'Level II',
  'Level III',
  'Level IV',
  'Critical Access',
  'Non-Designated',
  'Free-Standing ED'
];

const CONTACT_STATUSES = [
  'ED Employee (general contact)',
  'Pediatric Champion (NOT A PECC)',
  'New PECC',
  'Already a PECC'
];

const MentorHospitalContactsPage: React.FC = () => {
  const { currentUser } = useAuth();
  
  // State
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [hospitalDetailsDialogOpen, setHospitalDetailsDialogOpen] = useState(false);
  
  // Dialog states
  const [hospitalDialogOpen, setHospitalDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Form states
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    traumaLevel: 'Non-Designated',
    edSize: '',
    notes: '',
    isWorkingWith: true // Default to "working with"
  });
  
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    contactStatus: 'ED Employee (general contact)',
    roleAtHospital: '',
    isPrimaryContact: false,
    isActivelyEngaged: false,
    notes: ''
  });
  
  const [inviteEmail, setInviteEmail] = useState('');

  // CRM hospitals for Add Hospital (state → city → hospital)
  const [crmHospitals, setCrmHospitals] = useState<CrmHospitalRow[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [addState, setAddState] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addHospitalId, setAddHospitalId] = useState('');
  const [addIsWorkingWith, setAddIsWorkingWith] = useState(true);
  const [showAllHospitals, setShowAllHospitals] = useState(false); // Filter toggle

  // Load CRM hospitals for Add Hospital cascading dropdowns
  useEffect(() => {
    let mounted = true;
    setCrmLoading(true);
    (async () => {
      try {
        // Fetch all hospitals without limit to ensure all states are available
        let allHospitals: CrmHospitalRow[] = [];
        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore && mounted) {
          const { data, error } = await supabase
            .from('hospitals')
            .select('id, facility_id, name, address, city, state, phone, trauma_level, ed_size, notes')
            .range(from, from + pageSize - 1)
            .order('state', { ascending: true })
            .order('city', { ascending: true })
            .order('name', { ascending: true });

          if (!mounted) return;
          if (error) {
            console.error('Error fetching hospitals:', error);
            break;
          }
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allHospitals = [...allHospitals, ...(data as unknown as CrmHospitalRow[])];
            if (data.length < pageSize) {
              hasMore = false;
            } else {
              from += pageSize;
            }
          }
        }

        if (!mounted) return;
        setCrmHospitals(allHospitals);
      } catch (err) {
        console.error('Error loading hospitals:', err);
        if (mounted) setCrmHospitals([]);
      } finally {
        if (mounted) setCrmLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load data
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = () => {
    const uid = currentUser?.id;
    if (!uid) return;

    const savedHospitals = localStorage.getItem(`mentorHospitals_${uid}`);
    const savedContacts = localStorage.getItem(`mentorContacts_${uid}`);

    // One-time migration: clear old sample/mock data from localStorage
    const isOldMockHospital = (name: string) =>
      name === 'Memorial General Hospital' || name === "Children's Regional Medical Center" || name === "St. Mary's Community Hospital";
    const isOldMockContact = (f: string, l: string) =>
      (f === 'Jane' && l === 'Smith') || (f === 'John' && l === 'Doe');

    let hospitals: Hospital[] = [];
    if (savedHospitals) {
      try {
        const parsed = JSON.parse(savedHospitals);
        if (Array.isArray(parsed) && parsed.some((h: { name?: string }) => isOldMockHospital(h?.name || ''))) {
          localStorage.removeItem(`mentorHospitals_${uid}`);
          localStorage.removeItem(`mentorContacts_${uid}`);
        } else {
          // Migrate old hospitals to include isWorkingWith field (default to true)
          hospitals = Array.isArray(parsed) ? parsed.map((h: Hospital) => ({
            ...h,
            isWorkingWith: h.isWorkingWith ?? true
          })) : [];
        }
      } catch {
        hospitals = [];
      }
    }
    setHospitals(hospitals);
    setSelectedHospital(hospitals.length > 0 ? hospitals[0] : null);

    let contacts: Contact[] = [];
    if (savedContacts) {
      try {
        const parsed = JSON.parse(savedContacts);
        if (Array.isArray(parsed) && parsed.some((c: { firstName?: string; lastName?: string }) => isOldMockContact(c?.firstName || '', c?.lastName || ''))) {
          localStorage.removeItem(`mentorContacts_${uid}`);
        } else {
          contacts = Array.isArray(parsed) ? parsed : [];
        }
      } catch {
        contacts = [];
      }
    }
    setContacts(contacts);
  };

  const saveHospitals = (newHospitals: Hospital[]) => {
    localStorage.setItem(`mentorHospitals_${currentUser?.id}`, JSON.stringify(newHospitals));
    setHospitals(newHospitals);
  };

  const saveContacts = (newContacts: Contact[]) => {
    localStorage.setItem(`mentorContacts_${currentUser?.id}`, JSON.stringify(newContacts));
    setContacts(newContacts);
  };

  // CRM state → city → hospital options for Add Hospital
  const addStates = useMemo(() => {
    const s = new Set<string>();
    crmHospitals.forEach((h) => {
      const v = (h.state ?? '').trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [crmHospitals]);

  const addCities = useMemo(() => {
    if (!addState) return [];
    const s = new Set<string>();
    crmHospitals.forEach((h) => {
      if ((h.state ?? '').trim() !== addState) return;
      const v = (h.city ?? '').trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [crmHospitals, addState]);

  const addHospitalOptions = useMemo(() => {
    if (!addState || !addCity) return [];
    return crmHospitals.filter(
      (h) => (h.state ?? '').trim() === addState && (h.city ?? '').trim() === addCity
    );
  }, [crmHospitals, addState, addCity]);

  const selectedCrmHospital = useMemo(() => {
    if (!addHospitalId) return null;
    const id = addHospitalId;
    return crmHospitals.find((h) => String(h.facility_id ?? h.id) === id) ?? null;
  }, [crmHospitals, addHospitalId]);

  // Hospital handlers
  const handleAddHospital = () => {
    setEditingHospital(null);
    setAddState('');
    setAddCity('');
    setAddHospitalId('');
    setAddIsWorkingWith(true);
    setHospitalForm({
      name: '',
      address: '',
      city: '',
      state: '',
      phone: '',
      traumaLevel: 'Non-Designated',
      edSize: '',
      notes: '',
      isWorkingWith: true
    });
    setHospitalDialogOpen(true);
  };

  const handleEditHospital = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setHospitalForm({
      name: hospital.name,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      phone: hospital.phone,
      traumaLevel: hospital.traumaLevel,
      edSize: hospital.edSize,
      notes: hospital.notes,
      isWorkingWith: hospital.isWorkingWith ?? true
    });
    setHospitalDialogOpen(true);
  };

  // Link PECCs and Mentors to CRM when hospital is selected
  const linkHospitalToCRM = async (hospital: Hospital) => {
    if (!currentUser?.id) return;

    try {
      const hospitalId = hospital.id; // facility_id or id
      
      // Find PECCs for this hospital
      const { data: peccUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('role', 'pecc')
        .or(`hospital_facility_id.eq.${hospitalId},hospital_facility_id.eq.${hospital.id}`);

      // Also check site_members
      const { data: siteMembers } = await supabase
        .from('site_members')
        .select('user_id')
        .eq('site_id', hospitalId);

      const peccUserIds = [
        ...(peccUsers?.map(u => u.id) || []),
        ...(siteMembers?.map(sm => sm.user_id) || [])
      ];

      // Update CRM hospital record with PECC and Mentor info
      // This would ideally update a notes_log or activity_log field
      // For now, we'll just ensure the relationship exists
      console.log('Linking hospital to CRM:', {
        hospitalId,
        peccs: peccUsers,
        mentor: currentUser.id
      });

      // Could add to CRM notes_log or activity_log here
    } catch (err) {
      console.error('Error linking hospital to CRM:', err);
    }
  };

  const handleSaveHospital = () => {
    if (editingHospital) {
      // Edit flow: require name
      if (!hospitalForm.name.trim()) {
        setSnackbar({ open: true, message: 'Hospital name is required', severity: 'error' });
        return;
      }
      const hospitalData: Hospital = {
        id: editingHospital.id,
        ...hospitalForm
      };
      const newHospitals = hospitals.map(h => h.id === editingHospital.id ? hospitalData : h);
      saveHospitals(newHospitals);
      setHospitalDialogOpen(false);
      if (selectedHospital?.id === editingHospital.id) setSelectedHospital(hospitalData);
      setSnackbar({ open: true, message: 'Hospital updated successfully', severity: 'success' });
      return;
    }

    // Add flow: must select hospital from CRM (state → city → hospital)
    const crmRow = selectedCrmHospital;
    if (!addHospitalId || !crmRow) {
      setSnackbar({ open: true, message: 'Please select a state, city, and hospital from the list', severity: 'error' });
      return;
    }
    const id = String(crmRow.facility_id ?? crmRow.id ?? '');
    if (hospitals.some(h => h.id === id)) {
      setSnackbar({ open: true, message: 'That hospital is already in your list', severity: 'error' });
      return;
    }
    const hospitalData: Hospital = {
      id,
      name: String(crmRow.name ?? 'Unknown'),
      address: String(crmRow.address ?? ''),
      city: String(crmRow.city ?? ''),
      state: String(crmRow.state ?? ''),
      phone: String(crmRow.phone ?? ''),
      traumaLevel: TRAUMA_LEVELS.includes(String(crmRow.trauma_level ?? '')) ? String(crmRow.trauma_level) : 'Non-Designated',
      edSize: String(crmRow.ed_size ?? ''),
      notes: String(crmRow.notes ?? ''),
      isWorkingWith: addIsWorkingWith
    };
    const newHospitals = [...hospitals, hospitalData];
    saveHospitals(newHospitals);
    setHospitalDialogOpen(false);
    setSelectedHospital(hospitalData);
    linkHospitalToCRM(hospitalData);
    setSnackbar({ open: true, message: 'Hospital added successfully', severity: 'success' });
  };

  const handleHospitalRowClick = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    linkHospitalToCRM(hospital);
    setHospitalDetailsDialogOpen(true);
  };

  const handleRemoveHospital = (hospitalId: string) => {
    if (window.confirm('Remove this hospital from your dashboard? This will not delete it from the CRM, but you will no longer see it in your list.')) {
      const newHospitals = hospitals.filter(h => h.id !== hospitalId);
      saveHospitals(newHospitals);
      if (selectedHospital?.id === hospitalId) {
        setSelectedHospital(null);
      }
      setSnackbar({ open: true, message: 'Hospital removed from dashboard', severity: 'success' });
    }
  };

  const handleToggleWorkingWith = (hospitalId: string) => {
    const hospital = hospitals.find(h => h.id === hospitalId);
    if (!hospital) return;
    const updatedHospital: Hospital = {
      ...hospital,
      isWorkingWith: !hospital.isWorkingWith
    };
    const newHospitals = hospitals.map(h => h.id === hospitalId ? updatedHospital : h);
    saveHospitals(newHospitals);
    if (selectedHospital?.id === hospitalId) {
      setSelectedHospital(updatedHospital);
    }
    setSnackbar({ 
      open: true, 
      message: updatedHospital.isWorkingWith 
        ? 'Hospital marked as actively working with' 
        : 'Hospital marked as contact only', 
      severity: 'success' 
    });
  };

  // Contact handlers
  const handleAddContact = () => {
    if (!selectedHospital) {
      setSnackbar({ open: true, message: 'Please select a hospital first', severity: 'error' });
      return;
    }
    setEditingContact(null);
    setContactForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      contactStatus: 'ED Employee (general contact)',
      roleAtHospital: '',
      isPrimaryContact: false,
      isActivelyEngaged: false,
      notes: ''
    });
    setContactDialogOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      contactStatus: contact.contactStatus,
      roleAtHospital: contact.roleAtHospital,
      isPrimaryContact: contact.isPrimaryContact,
      isActivelyEngaged: contact.isActivelyEngaged,
      notes: contact.notes
    });
    setContactDialogOpen(true);
  };

  const handleSaveContact = () => {
    if (!contactForm.firstName.trim() || !contactForm.lastName.trim()) {
      setSnackbar({ open: true, message: 'Name is required', severity: 'error' });
      return;
    }
    if (!contactForm.email.trim()) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
      return;
    }

    const contactData: Contact = {
      id: editingContact?.id || `contact_${Date.now()}`,
      hospitalId: editingContact?.hospitalId || selectedHospital!.id,
      ...contactForm
    };

    let newContacts: Contact[];
    if (editingContact) {
      newContacts = contacts.map(c => c.id === editingContact.id ? contactData : c);
    } else {
      newContacts = [...contacts, contactData];
    }

    saveContacts(newContacts);
    setContactDialogOpen(false);
    setSnackbar({ open: true, message: `Contact ${editingContact ? 'updated' : 'added'} successfully`, severity: 'success' });
  };

  const handleDeleteContact = (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      const newContacts = contacts.filter(c => c.id !== id);
      saveContacts(newContacts);
      setSnackbar({ open: true, message: 'Contact deleted', severity: 'success' });
    }
  };

  // Invite handler
  const handleSendInvite = () => {
    // Generate unique invite code
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    
    // In production, this would save to the database and send an email
    // For now, just copy to clipboard
    navigator.clipboard.writeText(inviteUrl);
    
    setSnackbar({ 
      open: true, 
      message: `Invitation link copied to clipboard! Share with: ${inviteEmail}`, 
      severity: 'success' 
    });
    setInviteDialogOpen(false);
    setInviteEmail('');
  };

  const hospitalContacts = selectedHospital 
    ? contacts.filter(c => c.hospitalId === selectedHospital.id)
    : [];

  // Filter hospitals based on showAllHospitals toggle
  const displayedHospitals = showAllHospitals 
    ? hospitals 
    : hospitals.filter(h => h.isWorkingWith);

  return (
    <Box sx={{ py: 3 }}>
      <Alert severity="info" sx={{ mb: 2 }} icon={false}>
        <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in hospital or contact notes.
      </Alert>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Hospital Contacts</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddHospital}>
          Add Hospital
        </Button>
      </Box>

      {/* List View - Table */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showAllHospitals}
                onChange={(e) => setShowAllHospitals(e.target.checked)}
              />
            }
            label="Show all hospitals (including contacts only)"
          />
          <Typography variant="body2" color="textSecondary">
            {displayedHospitals.length} of {hospitals.length} hospitals
          </Typography>
        </Box>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Hospital Name</strong></TableCell>
                  <TableCell><strong>Location</strong></TableCell>
                  <TableCell><strong>Trauma Level</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Contacts</strong></TableCell>
                  <TableCell><strong>Primary Contact</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedHospitals.map(hospital => {
                  const hContacts = contacts.filter(c => c.hospitalId === hospital.id);
                  const primaryContact = hContacts.find(c => c.isPrimaryContact);
                  
                  return (
                    <TableRow 
                      key={hospital.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleHospitalRowClick(hospital)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <HospitalIcon color="primary" />
                          <Typography variant="body2" fontWeight={500}>
                            {hospital.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {hospital.city}, {hospital.state}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={hospital.traumaLevel} size="small" />
                      </TableCell>
                      <TableCell>
                        {hospital.isWorkingWith ? (
                          <Chip label="Working With" size="small" color="success" />
                        ) : (
                          <Chip label="Contact Only" size="small" color="default" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{hContacts.length}</Typography>
                      </TableCell>
                      <TableCell>
                        {primaryContact ? (
                          <Typography variant="body2">
                            {primaryContact.firstName} {primaryContact.lastName}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="textSecondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton size="small" onClick={() => handleEditHospital(hospital)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => handleToggleWorkingWith(hospital.id)}
                            color={hospital.isWorkingWith ? 'default' : 'success'}
                          >
                            {hospital.isWorkingWith ? 'Contact' : 'Working'}
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setSelectedHospital(hospital);
                              setInviteDialogOpen(true);
                            }}
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={() => handleRemoveHospital(hospital.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {displayedHospitals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary">
                        No hospitals found. Click "Add Hospital" to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Hospital Details Dialog */}
      <Dialog 
        open={hospitalDetailsDialogOpen} 
        onClose={() => setHospitalDetailsDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        {selectedHospital && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{selectedHospital.name}</Typography>
                <IconButton onClick={() => setHospitalDetailsDialogOpen(false)} size="small">
                  <DeleteIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Hospital Information</Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="subtitle2" color="textSecondary">Status:</Typography>
                {selectedHospital.isWorkingWith ? (
                  <Chip label="Working With" color="success" size="small" />
                ) : (
                  <Chip label="Contact Only" color="default" size="small" />
                )}
              </Box>
              
              <Typography variant="subtitle2" color="textSecondary">Name</Typography>
              <Typography gutterBottom>{selectedHospital.name}</Typography>
              
              <Typography variant="subtitle2" color="textSecondary">Trauma Level</Typography>
              <Chip label={selectedHospital.traumaLevel} size="small" sx={{ mb: 1 }} />
              
              <Typography variant="subtitle2" color="textSecondary">Address</Typography>
              <Typography gutterBottom>
                {selectedHospital.address}<br />
                {selectedHospital.city}, {selectedHospital.state}
              </Typography>
              
              <Typography variant="subtitle2" color="textSecondary">Phone</Typography>
              <Typography gutterBottom>{selectedHospital.phone || '-'}</Typography>
              
              <Typography variant="subtitle2" color="textSecondary">ED Size</Typography>
              <Typography gutterBottom>{selectedHospital.edSize || '-'}</Typography>
              
              {selectedHospital.notes && (
                <>
                  <Typography variant="subtitle2" color="textSecondary">Notes</Typography>
                  <Typography>{selectedHospital.notes}</Typography>
                </>
              )}
              
              <Button 
                variant="outlined" 
                fullWidth 
                sx={{ mt: 2, mb: 1 }}
                onClick={() => handleEditHospital(selectedHospital)}
              >
                Edit Hospital
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                sx={{ mb: 1 }}
                onClick={() => handleToggleWorkingWith(selectedHospital.id)}
              >
                {selectedHospital.isWorkingWith ? 'Mark as Contact Only' : 'Mark as Working With'}
              </Button>
              <Button 
                variant="outlined" 
                color="error"
                fullWidth 
                onClick={() => handleRemoveHospital(selectedHospital.id)}
              >
                Remove from Dashboard
              </Button>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Contacts</Typography>
                <Box>
                  <Button 
                    startIcon={<SendIcon />} 
                    onClick={() => setInviteDialogOpen(true)}
                    sx={{ mr: 1 }}
                  >
                    Invite PECC
                  </Button>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddContact}>
                    Add Contact
                  </Button>
                </Box>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {hospitalContacts.length === 0 ? (
                <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                  No contacts for this hospital yet
                </Typography>
              ) : (
                <List>
                  {hospitalContacts.map((contact, index) => (
                    <React.Fragment key={contact.id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: contact.isPrimaryContact ? 'primary.main' : 'grey.400' }}>
                            <PersonIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {contact.firstName} {contact.lastName}
                              {contact.isPrimaryContact && (
                                <Chip label="Primary" size="small" color="primary" />
                              )}
                              {contact.isActivelyEngaged && (
                                <Chip label="Active" size="small" color="success" />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span">
                                {contact.roleAtHospital}
                              </Typography>
                              <br />
                              <Typography variant="caption" component="span">
                                <Chip label={contact.contactStatus} size="small" sx={{ mr: 1 }} />
                              </Typography>
                              <br />
                              <Typography variant="caption" component="span">
                                <EmailIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                {contact.email}
                                {contact.phone && (
                                  <>
                                    {' | '}
                                    <PhoneIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                                    {contact.phone}
                                  </>
                                )}
                              </Typography>
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton size="small" onClick={() => handleEditContact(contact)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteContact(contact.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < hospitalContacts.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setHospitalDetailsDialogOpen(false)}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>

      {/* Hospital Dialog */}
      <Dialog open={hospitalDialogOpen} onClose={() => setHospitalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingHospital ? 'Edit Hospital' : 'Add Hospital'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in hospital details or notes.
          </Alert>
          {editingHospital ? (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Hospital Name"
                  value={hospitalForm.name}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  value={hospitalForm.address}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, address: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="City"
                  value={hospitalForm.city}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, city: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="State"
                  value={hospitalForm.state}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, state: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Phone"
                  value={hospitalForm.phone}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, phone: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Trauma Level</InputLabel>
                  <Select
                    value={hospitalForm.traumaLevel}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, traumaLevel: e.target.value }))}
                    label="Trauma Level"
                  >
                    {TRAUMA_LEVELS.map(level => (
                      <MenuItem key={level} value={level}>{level}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="ED Size"
                  value={hospitalForm.edSize}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, edSize: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notes"
                  value={hospitalForm.notes}
                  onChange={(e) => setHospitalForm(prev => ({ ...prev, notes: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Choose a hospital from the CRM list. Pick state, then city, then hospital.
                </Typography>
              </Grid>
              {crmLoading ? (
                <Grid item xs={12}>
                  <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress size={24} />
                  </Box>
                </Grid>
              ) : (
                <>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={addStates}
                      value={addState || null}
                      onChange={(_, newValue) => {
                        setAddState(newValue || '');
                        setAddCity('');
                        setAddHospitalId('');
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="State" placeholder="Select or type to search" />
                      )}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={addCities}
                      value={addCity || null}
                      onChange={(_, newValue) => {
                        setAddCity(newValue || '');
                        setAddHospitalId('');
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="City" placeholder="Select or type to search" disabled={!addState} />
                      )}
                      fullWidth
                      disabled={!addState}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={addHospitalOptions}
                      value={addHospitalOptions.find(h => String(h.facility_id ?? h.id ?? '') === addHospitalId) || null}
                      onChange={(_, newValue) => {
                        setAddHospitalId(newValue ? String(newValue.facility_id ?? newValue.id ?? '') : '');
                      }}
                      getOptionLabel={(option) => option.name || 'Unknown'}
                      renderInput={(params) => (
                        <TextField {...params} label="Hospital" placeholder="Select or type to search" disabled={!addCity} />
                      )}
                      fullWidth
                      disabled={!addCity}
                    />
                  </Grid>
                  {addHospitalId && (
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Hospital Type</InputLabel>
                        <Select
                          value={addIsWorkingWith ? 'working' : 'contact'}
                          onChange={(e) => setAddIsWorkingWith(e.target.value === 'working')}
                          label="Hospital Type"
                        >
                          <MenuItem value="working">I am actively working with this hospital</MenuItem>
                          <MenuItem value="contact">Just a contact/reference (not actively working with)</MenuItem>
                        </Select>
                      </FormControl>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                        Select whether you are actively working with this hospital or just keeping it as a contact reference.
                      </Typography>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          )}
          {editingHospital && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Hospital Type</InputLabel>
                  <Select
                    value={hospitalForm.isWorkingWith ? 'working' : 'contact'}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, isWorkingWith: e.target.value === 'working' }))}
                    label="Hospital Type"
                  >
                    <MenuItem value="working">I am actively working with this hospital</MenuItem>
                    <MenuItem value="contact">Just a contact/reference (not actively working with)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                  Select whether you are actively working with this hospital or just keeping it as a contact reference.
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHospitalDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveHospital} variant="contained" disabled={!editingHospital && (crmLoading || !addHospitalId)}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in contact details or notes.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="First Name"
                value={contactForm.firstName}
                onChange={(e) => setContactForm(prev => ({ ...prev, firstName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Name"
                value={contactForm.lastName}
                onChange={(e) => setContactForm(prev => ({ ...prev, lastName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Phone"
                value={contactForm.phone}
                onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Contact Status</InputLabel>
                <Select
                  value={contactForm.contactStatus}
                  onChange={(e) => setContactForm(prev => ({ ...prev, contactStatus: e.target.value }))}
                  label="Contact Status"
                >
                  {CONTACT_STATUSES.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Role at Hospital"
                value={contactForm.roleAtHospital}
                onChange={(e) => setContactForm(prev => ({ ...prev, roleAtHospital: e.target.value }))}
                fullWidth
                placeholder="What is their job at the hospital?"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={contactForm.isPrimaryContact}
                    onChange={(e) => setContactForm(prev => ({ ...prev, isPrimaryContact: e.target.checked }))}
                  />
                }
                label="Primary Site Contact"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={contactForm.isActivelyEngaged}
                    onChange={(e) => setContactForm(prev => ({ ...prev, isActivelyEngaged: e.target.checked }))}
                  />
                }
                label="Actively Engaged ED"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                value={contactForm.notes}
                onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveContact} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite PECC to {selectedHospital?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Send a unique registration link to invite a PECC. The link will automatically associate them with this hospital and you as their mentor.
          </Typography>
          <TextField
            label="PECC Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            fullWidth
            placeholder="pecc@hospital.org"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSendInvite} 
            variant="contained" 
            startIcon={<CopyIcon />}
            disabled={!inviteEmail}
          >
            Generate & Copy Invite Link
          </Button>
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

export default MentorHospitalContactsPage;
