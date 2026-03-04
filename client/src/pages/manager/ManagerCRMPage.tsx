import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Add as AddIcon,
  Person as PersonIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { getUserData, setUserData } from '../../utils/userData';

const CONTACT_STATUSES = [
  'ED Employee (general contact)',
  'Pediatric Champion (NOT A PECC)',
  'New PECC',
  'Already a PECC'
];

interface HospitalData {
  id: string;
  name: string;
  city: string;
  state: string;
  traumaLevel: string;
  mentorCount: number;
  peccCount: number;
  contactCount: number;
}

interface ContactData {
  id: string;
  hospital_id: string;
  hospitalName: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  contact_status: string;
  role_at_hospital: string | null;
  is_primary_contact: boolean;
  is_actively_engaged: boolean;
  notes: string | null;
}

interface MentorOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface TabVisibilitySettings {
  userId: string;
  userName: string;
  userRole: string;
  visibleTabs: {
    snapshot: boolean;
    activities: boolean;
    milestones: boolean;
    gapPlan: boolean;
    simulation: boolean;
  };
}

const ManagerCRMPage: React.FC = () => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState(0);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [, setSelectedHospital] = useState<HospitalData | null>(null);
  
  // Add Hospital Dialog: default = select from existing CRM list; option = add unlisted site
  const [addHospitalDialog, setAddHospitalDialog] = useState(false);
  const [addHospitalMode, setAddHospitalMode] = useState<'existing' | 'unlisted'>('existing');
  const [allHospitalsFromDb, setAllHospitalsFromDb] = useState<Array<{ id: string; name: string; city: string; state: string }>>([]);
  const [mentorsList, setMentorsList] = useState<MentorOption[]>([]);
  const [addHospitalState, setAddHospitalState] = useState('');
  const [addHospitalCity, setAddHospitalCity] = useState('');
  const [selectedExistingHospital, setSelectedExistingHospital] = useState<{ id: string; name: string; city: string; state: string } | null>(null);
  const [assignToMentorId, setAssignToMentorId] = useState('');
  const [addHospitalForm, setAddHospitalForm] = useState({
    name: '',
    city: '',
    state: '',
    address: '',
    phone: '',
    traumaLevel: 'Non-Designated',
    edSize: ''
  });

  // Contacts
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactHospitalFilter, setContactHospitalFilter] = useState('');
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [contactForm, setContactForm] = useState({
    hospitalId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    contactStatus: 'ED Employee (general contact)',
    roleAtHospital: '',
    isPrimaryContact: false,
    isActivelyEngaged: true,
    notes: ''
  });
  
  // Tab Visibility Dialog
  const [visibilityDialog, setVisibilityDialog] = useState(false);
  const [visibilitySettings, setVisibilitySettings] = useState<TabVisibilitySettings[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState({ role: '', search: '' });
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    loadHospitals();
  }, [userProfile?.id]);

  useEffect(() => {
    const hospitalId = searchParams.get('hospital');
    if (hospitalId && hospitals.length > 0) {
      const hospital = hospitals.find(h => h.id === hospitalId);
      if (hospital) {
        setSelectedHospital(hospital);
        setActiveTab(0);
      }
    }
  }, [searchParams, hospitals]);

  // Load all hospitals from DB and mentors when opening Add Hospital dialog
  useEffect(() => {
    if (!addHospitalDialog) return;
    (async () => {
      const [hRes, mRes] = await Promise.all([
        supabase.from('hospitals').select('id, name, city, state').eq('is_active', true).order('name').range(0, 99999),
        supabase.from('users').select('id, first_name, last_name, email').eq('role', 'mentor').eq('is_active', true).order('first_name').range(0, 99999)
      ]);
      if (hRes.data) setAllHospitalsFromDb(hRes.data as any);
      if (mRes.data) setMentorsList(mRes.data as MentorOption[]);
    })();
  }, [addHospitalDialog]);

  // Load contacts when on Contacts tab or when hospitals change
  useEffect(() => {
    if (activeTab === 1 && hospitals.length > 0) loadContacts();
  }, [activeTab, hospitals]);

  const loadHospitals = async () => {
    if (!userProfile?.id) return;
    
    try {
      setLoading(true);

      // Get all hospitals from mentor assignments
      const { data: assignments, error: assignmentError } = await supabase
        .from('mentor_hospital_assignments')
        .select(`
          hospital:hospital_id(id, name, city, state, trauma_level)
        `)
        .eq('is_active', true);

      if (assignmentError) throw assignmentError;

      // Get unique hospitals
      const uniqueHospitalIds = new Set();
      const hospitalList: HospitalData[] = [];

      (assignments || []).forEach((a: any) => {
        const hospital = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
        if (hospital && !uniqueHospitalIds.has(hospital.id)) {
          uniqueHospitalIds.add(hospital.id);
          hospitalList.push({
            id: hospital.id,
            name: hospital.name,
            city: hospital.city || '',
            state: hospital.state || '',
            traumaLevel: hospital.trauma_level || 'Non-Designated',
            mentorCount: 0,
            peccCount: 0,
            contactCount: 0
          });
        }
      });

      // Count mentors, PECCs, and contacts for each hospital
      for (const hospital of hospitalList) {
        const [mentorRes, peccRes, contactRes] = await Promise.all([
          supabase.from('mentor_hospital_assignments').select('*', { count: 'exact', head: true }).eq('hospital_id', hospital.id).eq('is_active', true),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'pecc').eq('hospital_facility_id', hospital.id),
          supabase.from('hospital_contacts').select('*', { count: 'exact', head: true }).eq('hospital_id', hospital.id)
        ]);
        hospital.mentorCount = mentorRes.count || 0;
        hospital.peccCount = peccRes.count || 0;
        hospital.contactCount = contactRes.count || 0;
      }

      setHospitals(hospitalList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Error loading hospitals:', err);
      setSnackbar({ open: true, message: 'Error loading hospitals', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    if (hospitals.length === 0) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const hospitalIds = hospitals.map(h => h.id);
      const { data: rows, error } = await supabase
        .from('hospital_contacts')
        .select('id, hospital_id, first_name, last_name, email, phone, contact_status, role_at_hospital, is_primary_contact, is_actively_engaged, notes')
        .in('hospital_id', hospitalIds)
        .order('last_name');

      if (error) throw error;
      const hospitalNames = new Map(hospitals.map(h => [h.id, h.name]));
      setContacts((rows || []).map((r: any) => ({
        id: r.id,
        hospital_id: r.hospital_id,
        hospitalName: hospitalNames.get(r.hospital_id) || 'Unknown',
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
        contact_status: r.contact_status,
        role_at_hospital: r.role_at_hospital,
        is_primary_contact: r.is_primary_contact,
        is_actively_engaged: r.is_actively_engaged,
        notes: r.notes
      })));
    } catch (err) {
      console.error('Error loading contacts:', err);
      setSnackbar({ open: true, message: 'Error loading contacts', severity: 'error' });
    } finally {
      setContactsLoading(false);
    }
  };

  const loadTabVisibilitySettings = async () => {
    try {
      // Get all PECCs and Mentors (live from DB; exclude admins/managers so only pecc/mentor show in tab visibility)
      const { data: users, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('is_active', true)
        .in('role', ['pecc', 'mentor'])
        .range(0, 99999);

      if (error) throw error;

      // Load visibility settings from Supabase (user_data) per user
      const defaults = {
        snapshot: true,
        activities: true,
        milestones: true,
        gapPlan: true,
        simulation: true
      };
      const visibilityList = await Promise.all(
        (users || []).map(async (user) => {
          const saved = await getUserData<any>(user.id, 'tab_visibility');
          return {
            userId: user.id,
            userName: `${user.first_name} ${user.last_name}`,
            userRole: user.role,
            visibleTabs: saved && typeof saved === 'object' ? { ...defaults, ...saved } : defaults
          };
        })
      );
      setVisibilitySettings(visibilityList);
    } catch (err) {
      console.error('Error loading tab visibility settings:', err);
      setSnackbar({ open: true, message: 'Error loading visibility settings', severity: 'error' });
    }
  };

  const handleAddHospital = async () => {
    if (!assignToMentorId) {
      setSnackbar({ open: true, message: 'Please assign the site to a mentor', severity: 'error' });
      return;
    }

    try {
      let hospitalId: string;

      if (addHospitalMode === 'existing') {
        if (!selectedExistingHospital) {
          setSnackbar({ open: true, message: 'Please select a hospital from the list', severity: 'error' });
          return;
        }
        hospitalId = selectedExistingHospital.id;
      } else {
        if (!addHospitalForm.name?.trim() || !addHospitalForm.city?.trim() || !addHospitalForm.state?.trim()) {
          setSnackbar({ open: true, message: 'Name, city, and state are required for a new site', severity: 'error' });
          return;
        }
        const { data: newHospital, error: insertError } = await supabase
          .from('hospitals')
          .insert({
            name: addHospitalForm.name.trim(),
            city: addHospitalForm.city.trim(),
            state: addHospitalForm.state.trim(),
            address: addHospitalForm.address.trim() || null,
            phone: addHospitalForm.phone.trim() || null,
            trauma_level: addHospitalForm.traumaLevel,
            ed_size: addHospitalForm.edSize.trim() || null
          })
          .select('id')
          .single();
        if (insertError) throw insertError;
        hospitalId = (newHospital as any).id;
      }

      const { error: assignError } = await supabase
        .from('mentor_hospital_assignments')
        .insert({
          mentor_id: assignToMentorId,
          hospital_id: hospitalId,
          is_active: true
        });
      if (assignError) throw assignError;

      setSnackbar({ open: true, message: 'Hospital added to CRM successfully', severity: 'success' });
      setAddHospitalDialog(false);
      setAddHospitalMode('existing');
      setSelectedExistingHospital(null);
      setAssignToMentorId('');
      setAddHospitalForm({ name: '', city: '', state: '', address: '', phone: '', traumaLevel: 'Non-Designated', edSize: '' });
      loadHospitals();
    } catch (err: any) {
      console.error('Error adding hospital:', err);
      setSnackbar({ open: true, message: err.message || 'Error adding hospital', severity: 'error' });
    }
  };

  const handleOpenAddHospital = () => {
    setAddHospitalMode('existing');
    setAddHospitalState('');
    setAddHospitalCity('');
    setSelectedExistingHospital(null);
    setAssignToMentorId('');
    setAddHospitalForm({ name: '', city: '', state: '', address: '', phone: '', traumaLevel: 'Non-Designated', edSize: '' });
    setAddHospitalDialog(true);
  };

  // State → City → Hospital dropdown options (existing list)
  const addHospitalStateOptions = useMemo(() => {
    const s = new Set<string>();
    allHospitalsFromDb.forEach(h => {
      const v = (h.state ?? '').trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [allHospitalsFromDb]);

  const addHospitalCityOptions = useMemo(() => {
    if (!addHospitalState) return [];
    const s = new Set<string>();
    allHospitalsFromDb.forEach(h => {
      if ((h.state ?? '').trim() !== addHospitalState) return;
      const v = (h.city ?? '').trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [allHospitalsFromDb, addHospitalState]);

  const addHospitalHospitalOptions = useMemo(() => {
    if (!addHospitalState || !addHospitalCity) return [];
    return allHospitalsFromDb.filter(
      h => (h.state ?? '').trim() === addHospitalState && (h.city ?? '').trim() === addHospitalCity
    );
  }, [allHospitalsFromDb, addHospitalState, addHospitalCity]);

  const handleSaveContact = async () => {
    if (!contactForm.firstName?.trim() || !contactForm.lastName?.trim()) {
      setSnackbar({ open: true, message: 'First and last name are required', severity: 'error' });
      return;
    }
    if (!contactForm.email?.trim()) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
      return;
    }
    if (!contactForm.hospitalId) {
      setSnackbar({ open: true, message: 'Please select a hospital', severity: 'error' });
      return;
    }
    try {
      const email = contactForm.email.trim();
      if (!email) {
        setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' });
        return;
      }
      const payload = {
        hospital_id: contactForm.hospitalId,
        first_name: contactForm.firstName.trim(),
        last_name: contactForm.lastName.trim(),
        email,
        phone: contactForm.phone?.trim() || null,
        contact_status: contactForm.contactStatus,
        role_at_hospital: contactForm.roleAtHospital?.trim() || null,
        is_primary_contact: contactForm.isPrimaryContact,
        is_actively_engaged: contactForm.isActivelyEngaged,
        notes: contactForm.notes?.trim() || null
      };
      if (editingContact) {
        const { error } = await supabase.from('hospital_contacts').update(payload).eq('id', editingContact.id);
        if (error) throw error;
        setSnackbar({ open: true, message: 'Contact updated', severity: 'success' });
      } else {
        const { error } = await supabase.from('hospital_contacts').insert(payload);
        if (error) throw error;
        setSnackbar({ open: true, message: 'Contact added', severity: 'success' });
      }
      setContactDialogOpen(false);
      setEditingContact(null);
      loadContacts();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'Failed to save contact', severity: 'error' });
    }
  };

  const handleDeleteContact = async (contact: ContactData) => {
    if (!window.confirm(`Remove ${contact.first_name} ${contact.last_name} from contacts?`)) return;
    try {
      const { error } = await supabase.from('hospital_contacts').delete().eq('id', contact.id);
      if (error) throw error;
      setSnackbar({ open: true, message: 'Contact removed', severity: 'success' });
      loadContacts();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'Failed to remove contact', severity: 'error' });
    }
  };

  const openAddContact = () => {
    setEditingContact(null);
    setContactForm({
      hospitalId: contactHospitalFilter || (hospitals[0]?.id ?? ''),
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      contactStatus: 'ED Employee (general contact)',
      roleAtHospital: '',
      isPrimaryContact: false,
      isActivelyEngaged: true,
      notes: ''
    });
    setContactDialogOpen(true);
  };

  const openEditContact = (c: ContactData) => {
    setEditingContact(c);
    setContactForm({
      hospitalId: c.hospital_id,
      firstName: c.first_name,
      lastName: c.last_name,
      email: c.email,
      phone: c.phone || '',
      contactStatus: c.contact_status,
      roleAtHospital: c.role_at_hospital || '',
      isPrimaryContact: c.is_primary_contact,
      isActivelyEngaged: c.is_actively_engaged,
      notes: c.notes || ''
    });
    setContactDialogOpen(true);
  };

  const filteredContacts = useMemo(() => {
    let list = contacts;
    const q = (contactSearch || '').toLowerCase().trim();
    if (q) {
      list = list.filter(c =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.hospitalName || '').toLowerCase().includes(q)
      );
    }
    if (contactHospitalFilter) {
      list = list.filter(c => c.hospital_id === contactHospitalFilter);
    }
    return list.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''));
  }, [contacts, contactSearch, contactHospitalFilter]);

  const handleToggleTabVisibility = (userId: string, tab: keyof TabVisibilitySettings['visibleTabs']) => {
    setVisibilitySettings(prev => {
      const updated = prev.map(setting => {
        if (setting.userId === userId) {
          const newVisibleTabs = {
            ...setting.visibleTabs,
            [tab]: !setting.visibleTabs[tab]
          };
          setUserData(userId, 'tab_visibility', newVisibleTabs);
          return { ...setting, visibleTabs: newVisibleTabs };
        }
        return setting;
      });
      return updated;
    });
  };

  const handleMassToggle = (tab: keyof TabVisibilitySettings['visibleTabs'], visible: boolean, roleFilter?: string) => {
    setVisibilitySettings(prev => {
      const updated = prev.map(setting => {
        if (!roleFilter || setting.userRole === roleFilter) {
          const newVisibleTabs = {
            ...setting.visibleTabs,
            [tab]: visible
          };
          setUserData(setting.userId, 'tab_visibility', newVisibleTabs);
          return { ...setting, visibleTabs: newVisibleTabs };
        }
        return setting;
      });
      return updated;
    });
    setSnackbar({ 
      open: true, 
      message: `${tab} tab ${visible ? 'shown' : 'hidden'} for ${roleFilter || 'all users'}`, 
      severity: 'success' 
    });
  };

  const filteredHospitals = useMemo(() => {
    return hospitals.filter(h =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.state.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [hospitals, searchQuery]);

  const filteredVisibilitySettings = useMemo(() => {
    return visibilitySettings.filter(setting => {
      const matchesRole = !visibilityFilter.role || setting.userRole === visibilityFilter.role;
      const matchesSearch = !visibilityFilter.search || 
        setting.userName.toLowerCase().includes(visibilityFilter.search.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [visibilitySettings, visibilityFilter]);

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary" fontWeight={600}>
            CRM
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage hospitals, contacts, and user tab visibility settings
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => {
              loadTabVisibilitySettings();
              setVisibilityDialog(true);
            }}
          >
            Tab Visibility
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddHospital}
          >
            Add Hospital
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Hospitals" icon={<HospitalIcon />} iconPosition="start" />
          <Tab label="Contacts" icon={<PersonIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search hospitals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3, maxWidth: 500 }}
          />

          {/* Hospitals Grid */}
          {filteredHospitals.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <HospitalIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                {searchQuery ? 'No hospitals match your search' : 'No hospitals yet'}
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
                {searchQuery ? 'Try adjusting your search' : 'Add hospitals to start managing your team\'s work'}
              </Typography>
              {!searchQuery && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddHospital}>
                  Add First Hospital
                </Button>
              )}
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {filteredHospitals.map((hospital) => (
                <Grid item xs={12} md={6} lg={4} key={hospital.id}>
                  <Card sx={{ height: '100%', cursor: 'pointer', '&:hover': { boxShadow: 6 } }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <HospitalIcon />
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight={600} noWrap>
                            {hospital.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {hospital.city}, {hospital.state}
                          </Typography>
                        </Box>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" color="primary">
                              {hospital.mentorCount}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Mentors
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" color="success.main">
                              {hospital.peccCount}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              PECCs
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h5" color="info.main">
                              {hospital.contactCount}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              Contacts
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 2 }}>
                        <Chip
                          size="small"
                          label={hospital.traumaLevel}
                          variant="outlined"
                          sx={{ mr: 1 }}
                        />
                      </Box>

                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ mt: 2 }}
                        onClick={() => navigate(`/manager/overview?hospital=${hospital.id}`)}
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
            <TextField
              size="small"
              placeholder="Search contacts..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 220 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Hospital</InputLabel>
              <Select
                value={contactHospitalFilter}
                onChange={(e) => setContactHospitalFilter(e.target.value)}
                label="Hospital"
              >
                <MenuItem value="">All hospitals</MenuItem>
                {hospitals.map(h => (
                  <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAddContact} disabled={hospitals.length === 0}>
              Add Contact
            </Button>
          </Box>

          {contactsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredContacts.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="textSecondary" gutterBottom>
                {contacts.length === 0 ? 'No contacts yet' : 'No contacts match your filters'}
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                Add contacts for your CRM hospitals. Select a hospital and enter their details.
              </Typography>
              {hospitals.length > 0 && (
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAddContact}>
                  Add first contact
                </Button>
              )}
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Hospital</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Role / Status</TableCell>
                    <TableCell align="center">Primary</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredContacts.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {c.first_name} {c.last_name}
                        </Typography>
                      </TableCell>
                      <TableCell>{c.hospitalName}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          {c.email}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {c.phone ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            {c.phone}
                          </Box>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block">{c.role_at_hospital || '—'}</Typography>
                        <Chip size="small" label={c.contact_status} sx={{ mt: 0.5 }} />
                      </TableCell>
                      <TableCell align="center">
                        {c.is_primary_contact ? <Chip size="small" color="primary" label="Primary" /> : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => openEditContact(c)} title="Edit" aria-label={`Edit contact ${c.first_name} ${c.last_name}`}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteContact(c)} title="Remove" aria-label={`Remove contact ${c.first_name} ${c.last_name}`} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            Do not include PHI or patient data in contact details or notes.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Hospital</InputLabel>
                <Select
                  value={contactForm.hospitalId}
                  onChange={(e) => setContactForm(prev => ({ ...prev, hospitalId: e.target.value }))}
                  label="Hospital"
                  disabled={!!editingContact}
                >
                  {hospitals.map(h => (
                    <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="First Name"
                fullWidth
                required
                value={contactForm.firstName}
                onChange={(e) => setContactForm(prev => ({ ...prev, firstName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Name"
                fullWidth
                required
                value={contactForm.lastName}
                onChange={(e) => setContactForm(prev => ({ ...prev, lastName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Phone"
                fullWidth
                value={contactForm.phone}
                onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
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
                  {CONTACT_STATUSES.map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Role at Hospital"
                fullWidth
                value={contactForm.roleAtHospital}
                onChange={(e) => setContactForm(prev => ({ ...prev, roleAtHospital: e.target.value }))}
                placeholder="Job title or role"
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
                label="Primary site contact"
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
                label="Actively engaged"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                rows={2}
                value={contactForm.notes}
                onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Cancel</Button>
          {editingContact && (
            <Button color="error" onClick={() => handleDeleteContact(editingContact)}>
              Remove
            </Button>
          )}
          <Button onClick={handleSaveContact} variant="contained">
            {editingContact ? 'Save changes' : 'Add contact'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Hospital Dialog: default = select from existing list; option = add unlisted site */}
      <Dialog open={addHospitalDialog} onClose={() => setAddHospitalDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Hospital to CRM</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Choose a site from the existing list, or add an unlisted site. Assign the site to a mentor so it appears in your CRM.
          </Alert>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Assign to mentor</InputLabel>
            <Select
              value={assignToMentorId}
              onChange={(e) => setAssignToMentorId(e.target.value)}
              label="Assign to mentor"
            >
              {mentorsList.map(m => (
                <MenuItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</MenuItem>
              ))}
              {mentorsList.length === 0 && <MenuItem value="" disabled>No mentors found</MenuItem>}
            </Select>
          </FormControl>

          <Tabs value={addHospitalMode === 'existing' ? 0 : 1} onChange={(_, v) => setAddHospitalMode(v === 0 ? 'existing' : 'unlisted')} sx={{ mb: 2 }}>
            <Tab label="Select from existing list" />
            <Tab label="Add unlisted site" />
          </Tabs>

          {addHospitalMode === 'existing' && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>State</InputLabel>
                  <Select
                    value={addHospitalState}
                    onChange={(e) => {
                      setAddHospitalState(e.target.value);
                      setAddHospitalCity('');
                      setSelectedExistingHospital(null);
                    }}
                    label="State"
                  >
                    <MenuItem value="">Select state</MenuItem>
                    {addHospitalStateOptions.map(st => (
                      <MenuItem key={st} value={st}>{st}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small" disabled={!addHospitalState}>
                  <InputLabel>City</InputLabel>
                  <Select
                    value={addHospitalCity}
                    onChange={(e) => {
                      setAddHospitalCity(e.target.value);
                      setSelectedExistingHospital(null);
                    }}
                    label="City"
                  >
                    <MenuItem value="">Select city</MenuItem>
                    {addHospitalCityOptions.map(ct => (
                      <MenuItem key={ct} value={ct}>{ct}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth size="small" disabled={!addHospitalCity}>
                  <InputLabel>Hospital</InputLabel>
                  <Select
                    value={selectedExistingHospital?.id ?? ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      const found = addHospitalHospitalOptions.find(h => h.id === id);
                      setSelectedExistingHospital(found || null);
                    }}
                    label="Hospital"
                  >
                    <MenuItem value="">Select hospital</MenuItem>
                    {addHospitalHospitalOptions.map(h => (
                      <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}

          {addHospitalMode === 'unlisted' && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Hospital Name"
                  fullWidth
                  required
                  value={addHospitalForm.name}
                  onChange={(e) => setAddHospitalForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  fullWidth
                  value={addHospitalForm.address}
                  onChange={(e) => setAddHospitalForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="City"
                  fullWidth
                  required
                  value={addHospitalForm.city}
                  onChange={(e) => setAddHospitalForm(prev => ({ ...prev, city: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="State"
                  fullWidth
                  required
                  value={addHospitalForm.state}
                  onChange={(e) => setAddHospitalForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="e.g., CA, TX"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Phone"
                  fullWidth
                  value={addHospitalForm.phone}
                  onChange={(e) => setAddHospitalForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Trauma Level</InputLabel>
                  <Select
                    value={addHospitalForm.traumaLevel}
                    onChange={(e) => setAddHospitalForm(prev => ({ ...prev, traumaLevel: e.target.value }))}
                    label="Trauma Level"
                  >
                    <MenuItem value="Level I">Level I</MenuItem>
                    <MenuItem value="Level II">Level II</MenuItem>
                    <MenuItem value="Level III">Level III</MenuItem>
                    <MenuItem value="Level IV">Level IV</MenuItem>
                    <MenuItem value="Critical Access">Critical Access</MenuItem>
                    <MenuItem value="Non-Designated">Non-Designated</MenuItem>
                    <MenuItem value="Free-Standing ED">Free-Standing ED</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="ED Size (optional)"
                  fullWidth
                  value={addHospitalForm.edSize}
                  onChange={(e) => setAddHospitalForm(prev => ({ ...prev, edSize: e.target.value }))}
                  placeholder="e.g., Small (<20k visits/yr)"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddHospitalDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddHospital}
            variant="contained"
            disabled={
              !assignToMentorId ||
              (addHospitalMode === 'existing' ? !selectedExistingHospital : !addHospitalForm.name?.trim() || !addHospitalForm.city?.trim() || !addHospitalForm.state?.trim())
            }
          >
            {addHospitalMode === 'existing' ? 'Add to CRM' : 'Add unlisted site'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tab Visibility Dialog */}
      <Dialog 
        open={visibilityDialog} 
        onClose={() => setVisibilityDialog(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">User Tab Visibility Settings</Typography>
            <IconButton onClick={() => setVisibilityDialog(false)}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Control which tabs are visible for each user. Hide tabs to simplify the interface or restrict access to certain features.
          </Alert>

          {/* Mass Actions */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Mass Actions
            </Typography>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 2 }}>
              Quickly show or hide tabs for all users or specific roles
            </Typography>
            <Grid container spacing={2}>
              {['snapshot', 'activities', 'milestones', 'gapPlan', 'simulation'].map(tab => (
                <Grid item xs={12} sm={6} key={tab}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ flex: 1, textTransform: 'capitalize' }}>
                      {tab.replace(/([A-Z])/g, ' $1').trim()}:
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => handleMassToggle(tab as any, true)}
                    >
                      Show All
                    </Button>
                    <Button
                      size="small"
                      startIcon={<VisibilityOffIcon />}
                      onClick={() => handleMassToggle(tab as any, false)}
                    >
                      Hide All
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Filter by Role</InputLabel>
              <Select
                value={visibilityFilter.role}
                onChange={(e) => setVisibilityFilter(prev => ({ ...prev, role: e.target.value }))}
                label="Filter by Role"
              >
                <MenuItem value="">All Roles</MenuItem>
                <MenuItem value="pecc">PECCs</MenuItem>
                <MenuItem value="mentor">Mentors</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search by name..."
              value={visibilityFilter.search}
              onChange={(e) => setVisibilityFilter(prev => ({ ...prev, search: e.target.value }))}
              sx={{ flex: 1 }}
            />
          </Box>

          {/* User List */}
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredVisibilitySettings.map((setting, index) => (
              <React.Fragment key={setting.userId}>
                {index > 0 && <Divider />}
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: setting.userRole === 'pecc' ? 'primary.main' : 'secondary.main' }}>
                      {setting.userName.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={setting.userName}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        {Object.entries(setting.visibleTabs).map(([tab, visible]) => (
                          <FormControlLabel
                            key={tab}
                            control={
                              <Checkbox
                                size="small"
                                checked={visible}
                                onChange={() => handleToggleTabVisibility(setting.userId, tab as any)}
                              />
                            }
                            label={
                              <Typography variant="caption">
                                {tab.replace(/([A-Z])/g, ' $1').trim()}
                              </Typography>
                            }
                          />
                        ))}
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisibilityDialog(false)}>Close</Button>
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

export default ManagerCRMPage;
