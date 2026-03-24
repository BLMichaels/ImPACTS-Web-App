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
  TableRow,
  Tooltip,
  Drawer
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
  Delete as DeleteIcon,
  Close as CloseIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { getUserData, setUserData } from '../../utils/userData';
import { getUserDisplayName } from '../../utils/displayName';
import { PECC_TAB_KEYS } from '../../types/database';
import { TypeDeleteConfirmDialog } from '../../components/crm/TypeDeleteConfirmDialog';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

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

/** Tab keys match PECC_TAB_KEYS so Manager saves to view_tabs (source of truth for Navbar). */
type TabKey = string;
interface TabVisibilitySettings {
  userId: string;
  userName: string;
  userRole: string;
  visibleTabs: Record<TabKey, boolean>;
}

const ManagerCRMPage: React.FC = () => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState(0);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const debouncedContactSearch = useDebouncedValue(contactSearch, 300);
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

  // Hospital notes drawer (notes about this site from mentors/managers/admins)
  const [hospitalNotesDrawerOpen, setHospitalNotesDrawerOpen] = useState(false);
  const [hospitalNotesDrawerHospital, setHospitalNotesDrawerHospital] = useState<HospitalData | null>(null);
  const [hospitalNotesLog, setHospitalNotesLog] = useState<Array<{ date: string; text: string }>>([]);
  const [hospitalNotesLoading, setHospitalNotesLoading] = useState(false);

  // Contact record panel (click row to view)
  const [contactDetailOpen, setContactDetailOpen] = useState(false);
  const [contactDetailContact, setContactDetailContact] = useState<ContactData | null>(null);

  const [contactDeleteOpen, setContactDeleteOpen] = useState(false);
  const [contactDeleteTarget, setContactDeleteTarget] = useState<ContactData | null>(null);
  const [contactDeleteTyped, setContactDeleteTyped] = useState('');
  const [contactsLoadError, setContactsLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadHospitals defined below
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

  // Load all hospitals from DB and mentors when opening Add Hospital dialog (paginate hospitals — PostgREST caps range per request)
  useEffect(() => {
    if (!addHospitalDialog) return;
    (async () => {
      const mentorIds = await getManagedMentorIds();
      const PAGE = 1000;
      let offset = 0;
      const hospitalRows: Array<{ id: string; name: string; city: string; state: string }> = [];
      let hospitalErr: string | null = null;
      for (;;) {
        const { data, error } = await supabase
          .from('hospitals')
          .select('id, name, city, state')
          .eq('is_active', true)
          .order('name')
          .range(offset, offset + PAGE - 1);
        if (error) {
          hospitalErr = error.message;
          break;
        }
        if (data?.length) hospitalRows.push(...(data as typeof hospitalRows));
        if (!data?.length || data.length < PAGE) break;
        offset += PAGE;
      }
      setAllHospitalsFromDb(hospitalRows);
      if (hospitalErr) {
        setSnackbar({ open: true, message: `Could not load full hospital list: ${hospitalErr}`, severity: 'error' });
      }
      if (mentorIds.length > 0) {
        const mRes = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', mentorIds)
          .eq('is_active', true)
          .order('first_name');
        if (mRes.error) {
          setSnackbar({ open: true, message: `Could not load mentors: ${mRes.error.message}`, severity: 'error' });
        } else if (mRes.data) {
          setMentorsList(mRes.data as MentorOption[]);
        }
      } else {
        setMentorsList([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getManagedMentorIds defined below
  }, [addHospitalDialog]);

  // Load contacts when on Contacts tab or when hospitals change
  useEffect(() => {
    if (activeTab === 1) void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadContacts defined below
  }, [activeTab, hospitals]);

  const getManagedMentorIds = async (): Promise<string[]> => {
    if (!userProfile?.id) return [];
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'mentor')
      .eq('manager_id', userProfile.id);
    if (error) throw error;
    const ids = (data || []).map((r: { id: string }) => r.id);
    // If the manager also mentors directly, include self.
    if (!ids.includes(userProfile.id)) ids.push(userProfile.id);
    return ids;
  };

  const loadHospitals = async () => {
    if (!userProfile?.id) return;
    
    try {
      setLoading(true);
      setLoadError(null);

      const mentorIds = await getManagedMentorIds();
      if (mentorIds.length === 0) {
        setHospitals([]);
        return;
      }

      // Get all hospitals from the manager's mentor assignments
      const { data: assignments, error: assignmentError } = await supabase
        .from('mentor_hospital_assignments')
        .select(`
          hospital:hospital_id(id, name, city, state, trauma_level)
        `)
        .in('mentor_id', mentorIds)
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

      // Count mentors, PECCs, and contacts in batch (avoid N+1 query fanout).
      const hospitalIds = hospitalList.map((h) => h.id);
      const [mentorRowsRes, peccRowsRes, contactRowsRes] = await Promise.all([
        supabase
          .from('mentor_hospital_assignments')
          .select('mentor_id, hospital_id')
          .eq('is_active', true)
          .in('mentor_id', mentorIds)
          .in('hospital_id', hospitalIds),
        supabase
          .from('users')
          .select('id, hospital_facility_id')
          .eq('role', 'pecc')
          .in('hospital_facility_id', hospitalIds),
        supabase
          .from('hospital_contacts')
          .select('id, hospital_id')
          .in('hospital_id', hospitalIds),
      ]);

      const mentorCountByHospital = new Map<string, number>();
      const mentorPairs = new Set<string>();
      (mentorRowsRes.data || []).forEach((r: { mentor_id: string; hospital_id: string }) => {
        const key = `${r.hospital_id}:${r.mentor_id}`;
        if (mentorPairs.has(key)) return;
        mentorPairs.add(key);
        mentorCountByHospital.set(r.hospital_id, (mentorCountByHospital.get(r.hospital_id) || 0) + 1);
      });
      const peccCountByHospital = new Map<string, number>();
      (peccRowsRes.data || []).forEach((r: { hospital_facility_id: string }) => {
        const hid = r.hospital_facility_id;
        peccCountByHospital.set(hid, (peccCountByHospital.get(hid) || 0) + 1);
      });
      const contactCountByHospital = new Map<string, number>();
      (contactRowsRes.data || []).forEach((r: { hospital_id: string }) => {
        contactCountByHospital.set(r.hospital_id, (contactCountByHospital.get(r.hospital_id) || 0) + 1);
      });

      hospitalList.forEach((h) => {
        h.mentorCount = mentorCountByHospital.get(h.id) || 0;
        h.peccCount = peccCountByHospital.get(h.id) || 0;
        h.contactCount = contactCountByHospital.get(h.id) || 0;
      });

      setHospitals(hospitalList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Error loading hospitals:', err);
      setLoadError('Failed to load hospitals. Please try again.');
      setSnackbar({ open: true, message: 'Error loading hospitals', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    if (hospitals.length === 0) {
      setContacts([]);
      setContactsLoadError(null);
      return;
    }
    setContactsLoading(true);
    setContactsLoadError(null);
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
      setContactsLoadError('Failed to load contacts. Try again.');
      setSnackbar({ open: true, message: 'Error loading contacts', severity: 'error' });
    } finally {
      setContactsLoading(false);
    }
  };

  const openContactDetail = (c: ContactData) => {
    setContactDetailContact(c);
    setContactDetailOpen(true);
  };

  const openHospitalNotesDrawer = async (hospital: HospitalData) => {
    setHospitalNotesDrawerHospital(hospital);
    setHospitalNotesDrawerOpen(true);
    setHospitalNotesLog([]);
    setHospitalNotesLoading(true);
    try {
      const { data, error } = await supabase
        .from('hospitals')
        .select('notes_log')
        .eq('id', hospital.id)
        .maybeSingle();
      if (!error && data) {
        const raw = (data as { notes_log?: unknown }).notes_log;
        const log: Array<{ date: string; text: string }> = Array.isArray(raw)
          ? raw.map((e: any) => ({ date: e.date ?? '', text: e.text ?? '' })).filter((n) => n.date && n.text)
          : [];
        setHospitalNotesLog(log.sort((a, b) => b.date.localeCompare(a.date)));
      }
    } catch {
      setHospitalNotesLog([]);
    } finally {
      setHospitalNotesLoading(false);
    }
  };

  const loadTabVisibilitySettings = async () => {
    try {
      const managedMentorIds = await getManagedMentorIds();
      const managedHospitalIds = hospitals.map((h) => h.id);
      let managedPeccIds: string[] = [];
      if (managedHospitalIds.length > 0) {
        const { data: managedPeccs, error: managedPeccErr } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'pecc')
          .in('hospital_facility_id', managedHospitalIds);
        if (managedPeccErr) throw managedPeccErr;
        managedPeccIds = (managedPeccs || []).map((p: { id: string }) => p.id);
      }
      const targetUserIds = [...new Set([...managedMentorIds, ...managedPeccIds])];
      if (targetUserIds.length === 0) {
        setVisibilitySettings([]);
        return;
      }

      const { data: users, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('is_active', true)
        .in('id', targetUserIds);

      if (error) throw error;

      const defaults: Record<string, boolean> = Object.fromEntries(PECC_TAB_KEYS.map(k => [k, true]));
      const { data: allTabRows, error: allTabRowsError } = await supabase
        .from('view_tabs')
        .select('user_id, tab_key, is_visible')
        .in('user_id', targetUserIds)
        .is('cohort_id', null)
        .is('program_id', null);
      if (allTabRowsError) throw allTabRowsError;
      const tabRowsByUser = new Map<string, Array<{ tab_key: string; is_visible: boolean }>>();
      (allTabRows || []).forEach((row: { user_id: string; tab_key: string; is_visible: boolean }) => {
        if (!tabRowsByUser.has(row.user_id)) tabRowsByUser.set(row.user_id, []);
        tabRowsByUser.get(row.user_id)!.push({ tab_key: row.tab_key, is_visible: row.is_visible });
      });

      const visibilityList = await Promise.all(
        (users || []).map(async (user) => {
          const tabRows = tabRowsByUser.get(user.id) || [];

          let visibleTabs = { ...defaults };
          if (tabRows && tabRows.length > 0) {
            tabRows.forEach((r: { tab_key: string; is_visible: boolean }) => {
              if (PECC_TAB_KEYS.includes(r.tab_key as any)) visibleTabs[r.tab_key] = r.is_visible;
            });
          } else {
            const legacy = await getUserData<any>(user.id, 'tab_visibility');
            if (legacy && typeof legacy === 'object') {
              PECC_TAB_KEYS.forEach(k => {
                const v = legacy[k] ?? legacy[k === 'gap-plan' ? 'gapPlan' : k];
                if (typeof v === 'boolean') visibleTabs[k] = v;
              });
            }
          }
          return {
            userId: user.id,
            userName: getUserDisplayName(user),
            userRole: user.role,
            visibleTabs
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

      const managedMentorIds = await getManagedMentorIds();
      if (!managedMentorIds.includes(assignToMentorId)) {
        setSnackbar({ open: true, message: 'You can only assign sites to mentors on your team', severity: 'error' });
        return;
      }

      const { data: existingAssignment, error: existingAssignmentError } = await supabase
        .from('mentor_hospital_assignments')
        .select('id')
        .eq('mentor_id', assignToMentorId)
        .eq('hospital_id', hospitalId)
        .eq('is_active', true)
        .maybeSingle();
      if (existingAssignmentError) throw existingAssignmentError;
      if (existingAssignment?.id) {
        setSnackbar({ open: true, message: 'This mentor is already assigned to that site', severity: 'error' });
        return;
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
    const allowedHospitalIds = new Set(hospitals.map((h) => h.id));
    if (!allowedHospitalIds.has(contactForm.hospitalId)) {
      setSnackbar({ open: true, message: 'Invalid site selection for your manager scope', severity: 'error' });
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

  const openContactDeleteConfirm = (contact: ContactData) => {
    setContactDeleteTarget(contact);
    setContactDeleteTyped('');
    setContactDeleteOpen(true);
  };

  const performDeleteContact = async () => {
    const contact = contactDeleteTarget;
    if (!contact) return;
    const allowedHospitalIds = new Set(hospitals.map((h) => h.id));
    if (!allowedHospitalIds.has(contact.hospital_id)) {
      setSnackbar({ open: true, message: 'You can only remove contacts from your managed sites', severity: 'error' });
      return;
    }
    try {
      const { error } = await supabase.from('hospital_contacts').delete().eq('id', contact.id);
      if (error) throw error;
      setSnackbar({ open: true, message: 'Contact removed', severity: 'success' });
      setContactDeleteOpen(false);
      setContactDeleteTarget(null);
      setContactDeleteTyped('');
      if (contactDetailContact?.id === contact.id) {
        setContactDetailOpen(false);
        setContactDetailContact(null);
      }
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
    const q = (debouncedContactSearch || '').toLowerCase().trim();
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
  }, [contacts, debouncedContactSearch, contactHospitalFilter]);

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
    const q = debouncedSearchQuery.toLowerCase().trim();
    if (!q) return hospitals;
    return hospitals.filter(h =>
      (h.name ?? '').toLowerCase().includes(q) ||
      (h.city ?? '').toLowerCase().includes(q) ||
      (h.state ?? '').toLowerCase().includes(q)
    );
  }, [hospitals, debouncedSearchQuery]);

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
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
          <Button size="small" sx={{ ml: 1 }} onClick={() => { setLoadError(null); loadHospitals(); }}>
            Retry
          </Button>
        </Alert>
      )}
      <Alert severity="info" sx={{ mb: 2 }}>
        Manager CRM shows hospitals and contacts for your team’s assigned sites. Full organization-wide CRM (all contacts, merge, bulk import/export) is in the Admin CRM.
      </Alert>
      {contactsLoadError && activeTab === 1 && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setContactsLoadError(null)}>
          {contactsLoadError}
          <Button size="small" sx={{ ml: 1 }} onClick={() => { setContactsLoadError(null); void loadContacts(); }}>
            Retry
          </Button>
        </Alert>
      )}
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
                  <Card
                    variant="outlined"
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'box-shadow 0.2s, border-color 0.2s',
                      '&:hover': { boxShadow: 2, borderColor: 'primary.light' }
                    }}
                  >
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
                          <HospitalIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" fontWeight={600} noWrap>
                            {hospital.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {hospital.city}, {hospital.state}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        <Chip size="small" label={hospital.traumaLevel} variant="outlined" />
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: 1,
                          py: 1.5,
                          px: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                          mb: 2
                        }}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="primary" sx={{ lineHeight: 1.2 }}>{hospital.mentorCount}</Typography>
                          <Typography variant="caption" color="text.secondary">Mentors</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="success.main" sx={{ lineHeight: 1.2 }}>{hospital.peccCount}</Typography>
                          <Typography variant="caption" color="text.secondary">PECCs</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" color="info.main" sx={{ lineHeight: 1.2 }}>{hospital.contactCount}</Typography>
                          <Typography variant="caption" color="text.secondary">Contacts</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 'auto' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<NotesIcon />}
                          onClick={(e) => { e.stopPropagation(); openHospitalNotesDrawer(hospital); }}
                          fullWidth
                        >
                          Notes
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => navigate(`/manager/overview?hospital=${hospital.id}`)}
                          fullWidth
                        >
                          View
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Site record panel (HubSpot/Salesforce-style): header, properties, activity timeline, actions */}
      <Drawer
        anchor="right"
        open={hospitalNotesDrawerOpen}
        onClose={() => { setHospitalNotesDrawerOpen(false); setHospitalNotesDrawerHospital(null); }}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100%' } }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
          {/* Record header */}
          <Box sx={{ p: 2, pb: 1.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                  <HospitalIcon />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" fontWeight={600} noWrap sx={{ lineHeight: 1.3 }}>
                    {hospitalNotesDrawerHospital?.name ?? 'Site'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {hospitalNotesDrawerHospital?.city}, {hospitalNotesDrawerHospital?.state}
                  </Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => { setHospitalNotesDrawerOpen(false); setHospitalNotesDrawerHospital(null); }} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Box>
            {hospitalNotesDrawerHospital && (
              <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${hospitalNotesDrawerHospital.mentorCount} Mentors`} variant="outlined" color="primary" />
                <Chip size="small" label={`${hospitalNotesDrawerHospital.peccCount} PECCs`} variant="outlined" color="success" />
                <Chip size="small" label={`${hospitalNotesDrawerHospital.contactCount} Contacts`} variant="outlined" color="info" />
                <Chip size="small" label={hospitalNotesDrawerHospital.traumaLevel} variant="outlined" />
              </Box>
            )}
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* About this site */}
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
                About this site
              </Typography>
              <Typography variant="body2">
                Notes and activity here are from mentors, managers, and admins. Same content appears in Admin CRM and on the Hospitals page.
              </Typography>
            </Paper>

            {/* Activity timeline */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
              Activity & notes
            </Typography>
            {hospitalNotesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
            ) : hospitalNotesLog.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <NotesIcon sx={{ fontSize: 40, color: 'grey.400', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No notes yet</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Add notes from the Hospitals page or Admin CRM</Typography>
              </Paper>
            ) : (
              <Box sx={{ position: 'relative', pl: 2, borderLeft: 2, borderColor: 'divider', ml: 0.5 }}>
                {hospitalNotesLog.map((entry, i) => (
                  <Box key={i} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                    <Typography variant="caption" fontWeight={600} color="primary" sx={{ display: 'block', mb: 0.25 }}>
                      {entry.date}
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, py: 1, bgcolor: 'background.paper' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{entry.text}</Typography>
                    </Paper>
                  </Box>
                ))}
              </Box>
            )}

            {/* Actions */}
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<HospitalIcon />}
                onClick={() => navigate(`/manager/overview?hospital=${hospitalNotesDrawerHospital?.id}`)}
              >
                View full overview
              </Button>
              <Button fullWidth variant="outlined" onClick={() => { setHospitalNotesDrawerOpen(false); setHospitalNotesDrawerHospital(null); }}>
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Contact record panel: click a contact row to view */}
      <Drawer
        anchor="right"
        open={contactDetailOpen}
        onClose={() => { setContactDetailOpen(false); setContactDetailContact(null); }}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, maxWidth: '100%' } }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
          {contactDetailContact && (
            <>
              <Box sx={{ p: 2, pb: 1.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
                      {(contactDetailContact.first_name?.[0] || contactDetailContact.last_name?.[0] || '?').toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                        {getUserDisplayName(contactDetailContact)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{contactDetailContact.hospitalName}</Typography>
                    </Box>
                  </Box>
                  <IconButton size="small" onClick={() => { setContactDetailOpen(false); setContactDetailContact(null); }} aria-label="Close">
                    <CloseIcon />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                  <Chip size="small" label={contactDetailContact.contact_status} color="primary" variant="outlined" />
                  {contactDetailContact.is_primary_contact && <Chip size="small" label="Primary" color="primary" />}
                </Box>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
                    Contact details
                  </Typography>
                  <List dense disablePadding>
                    <ListItem disablePadding sx={{ py: 0.5 }}>
                      <ListItemText primary="Email" secondary={contactDetailContact.email || '—'} primaryTypographyProps={{ variant: 'caption' }} secondaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 0.5 }}>
                      <ListItemText primary="Phone" secondary={contactDetailContact.phone || '—'} primaryTypographyProps={{ variant: 'caption' }} secondaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                    <ListItem disablePadding sx={{ py: 0.5 }}>
                      <ListItemText primary="Role at hospital" secondary={contactDetailContact.role_at_hospital || '—'} primaryTypographyProps={{ variant: 'caption' }} secondaryTypographyProps={{ variant: 'body2' }} />
                    </ListItem>
                  </List>
                </Paper>
                <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5 }}>
                  Notes
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }} color={contactDetailContact.notes?.trim() ? 'text.primary' : 'text.secondary'}>
                    {contactDetailContact.notes?.trim() || 'No notes'}
                  </Typography>
                </Paper>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button fullWidth variant="contained" startIcon={<EditIcon />} onClick={() => { setContactDetailOpen(false); openEditContact(contactDetailContact); }}>
                    Edit contact
                  </Button>
                  <Button fullWidth variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => { if (contactDetailContact) openContactDeleteConfirm(contactDetailContact); }}>
                    Remove contact
                  </Button>
                  <Button fullWidth variant="outlined" onClick={() => { setContactDetailOpen(false); setContactDetailContact(null); }}>Close</Button>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Drawer>

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
            <Tooltip title={hospitals.length === 0 ? 'Add a hospital first to add contacts' : 'Add a new contact'}>
              <span>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAddContact} disabled={hospitals.length === 0}>
                  Add Contact
                </Button>
              </span>
            </Tooltip>
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
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1, overflowX: 'auto', maxWidth: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                Click a row to open the contact record. Use the action icons to edit or remove.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Hospital</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Phone</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Role / Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>Primary</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredContacts.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => openContactDetail(c)}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {getUserDisplayName(c)}
                          </Typography>
                          {c.notes?.trim() && (
                            <Tooltip title="Has notes">
                              <NotesIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                            </Tooltip>
                          )}
                        </Box>
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
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={() => openEditContact(c)} title="Edit" aria-label="Edit contact">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => openContactDeleteConfirm(c)} title="Remove" aria-label="Remove contact" color="error">
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
            <Button color="error" onClick={() => { if (editingContact) openContactDeleteConfirm(editingContact); }}>
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
            <IconButton onClick={() => setVisibilityDialog(false)} aria-label="Close dialog">
              <CloseIcon />
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
              {PECC_TAB_KEYS.map(tab => (
                <Grid item xs={12} sm={6} key={tab}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {tab === 'gap-plan' ? 'Gap Closure' : tab.charAt(0).toUpperCase() + tab.slice(1)}:
                    </Typography>
                    <Tooltip title="Show this tab for all users">
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={() => handleMassToggle(tab as any, true)}
                      >
                        Show All
                      </Button>
                    </Tooltip>
                    <Tooltip title="Hide this tab for all users">
                      <Button
                        size="small"
                        startIcon={<VisibilityOffIcon />}
                        onClick={() => handleMassToggle(tab as any, false)}
                      >
                        Hide All
                      </Button>
                    </Tooltip>
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
            {filteredVisibilitySettings.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No users to configure"
                  secondary={visibilitySettings.length === 0 ? 'No PECCs or Mentors in the app yet. Add users and assign them to hospitals first.' : 'No users match your search or role filter.'}
                  primaryTypographyProps={{ color: 'text.secondary' }}
                />
              </ListItem>
            ) : filteredVisibilitySettings.map((setting, index) => (
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

      <TypeDeleteConfirmDialog
        open={contactDeleteOpen}
        onClose={() => {
          setContactDeleteOpen(false);
          setContactDeleteTarget(null);
          setContactDeleteTyped('');
        }}
        title="Remove contact from your site list?"
        description="This removes the row from hospital contacts for sites you manage. The person may still exist elsewhere in the platform or CRM."
        typedValue={contactDeleteTyped}
        onTypedChange={setContactDeleteTyped}
        onConfirm={performDeleteContact}
        confirmButtonText="Remove"
      />

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
