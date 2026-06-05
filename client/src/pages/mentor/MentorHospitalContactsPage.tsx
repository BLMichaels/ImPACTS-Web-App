import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  List,
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
  TableRow,
  InputAdornment,
  Switch
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
  Search as SearchIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { getHospitalData, getUserData, resolveHospitalUuid, setUserData } from '../../utils/userData';
import { fetchMergedMentorHospitals } from '../../utils/mentorHospitalScope';
import { buildPeccHospitalFacilityOrClause, ensureMentorHospitalAssignment } from '../../utils/mentorHospitalAssignments';
import {
  assignedPeccToContact,
  loadAssignedPeccsForHospital,
  type AssignedHospitalPecc,
} from '../../utils/mentorHospitalAssignedPeccs';
import {
  buildHospitalsTableOrClause,
  hospitalIdOrFacilityOrClause,
  hospitalKeysMatch,
} from '../../utils/hospitalId';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';
import { createAndSendInvitation } from '../../utils/invitations';
import { HospitalContactListItem } from '../../components/mentor/HospitalContactListItem';
import { UserRole } from '../../types/database';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';

// Types
interface DatedNote {
  id?: string;
  date: string; // YYYY-MM-DD
  text: string;
  author_id?: string; // user id of creator; only they can edit/delete
}

interface Hospital {
  id: string;
  facilityId?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  traumaLevel: string;
  edSize: string;
  notes: string;
  notesLog?: DatedNote[]; // dated notes (newest first in UI)
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
  isWorkingWithMentor?: boolean; // true = actively working with this mentor; false = contact only for this mentor
  notes: string;
  assignedPeccSource?: AssignedHospitalPecc['source'];
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

const EMPTY_CONTACT_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  contactStatus: 'ED Employee (general contact)',
  roleAtHospital: '',
  isPrimaryContact: false,
  isActivelyEngaged: false,
  isWorkingWithMentor: true,
  notes: ''
};

function mergeContactsForHospital(
  hospital: Hospital,
  storedContacts: Contact[],
  assignedPeccs: AssignedHospitalPecc[],
  hospitalRefToUuid: Map<string, string>,
  mentorId: string
): Contact[] {
  const hospitalRefSet = new Set(
    [hospital.id, hospital.facilityId].map((ref) => String(ref || '').trim()).filter(Boolean)
  );
  for (const ref of [...hospitalRefSet]) {
    const uuid = hospitalRefToUuid.get(ref);
    if (uuid) hospitalRefSet.add(uuid);
  }
  for (const [ref, uuid] of hospitalRefToUuid) {
    if (hospitalRefSet.has(ref) || hospitalRefSet.has(uuid)) {
      hospitalRefSet.add(ref);
      hospitalRefSet.add(uuid);
    }
  }

  const stored = storedContacts.filter((contact) =>
    [...hospitalRefSet].some((ref) => hospitalKeysMatch(contact.hospitalId, ref))
  );
  const storedEmails = new Set(stored.map((c) => c.email.trim().toLowerCase()).filter(Boolean));
  const autoContacts: Contact[] = assignedPeccs
    .filter((pecc) => !storedEmails.has(pecc.email.trim().toLowerCase()))
    .map((pecc) => assignedPeccToContact(pecc, hospital.id, mentorId));

  return [...stored, ...autoContacts];
}

const MentorHospitalContactsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile, effectiveUserId } = useUserProfile();
  const dataUserId = effectiveUserId ?? currentUser?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingReturnToRef = useRef<string | undefined>((location.state as { returnTo?: string } | null)?.returnTo);
  const deepLinkHospitalDone = useRef(false);

  useEffect(() => {
    const s = location.state as { returnTo?: string } | null;
    if (s?.returnTo) pendingReturnToRef.current = s.returnTo;
  }, [location.state]);

  const navigateBackIfReport = useCallback(() => {
    const rt = pendingReturnToRef.current;
    if (rt) {
      pendingReturnToRef.current = undefined;
      navigate(rt, { replace: true });
    }
  }, [navigate]);

  const closeHospitalDetailsDialog = useCallback(() => {
    setHospitalDetailsDialogOpen(false);
    navigateBackIfReport();
  }, [navigateBackIfReport]);

  // State
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [assignedPeccsByHospital, setAssignedPeccsByHospital] = useState<Map<string, AssignedHospitalPecc[]>>(new Map());
  const [hospitalRefToUuid, setHospitalRefToUuid] = useState<Map<string, string>>(new Map());
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [hospitalDetailsDialogOpen, setHospitalDetailsDialogOpen] = useState(false);
  
  // Dialog states
  const [hospitalDialogOpen, setHospitalDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactHospitalId, setContactHospitalId] = useState('');
  const [addIncludeContact, setAddIncludeContact] = useState(false);
  
  // Snackbar
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' });
  
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
  
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCohortIds, setInviteCohortIds] = useState<string[]>([]);
  const [inviteCustomMessage, setInviteCustomMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccessCode, setInviteSuccessCode] = useState<string | null>(null);
  const [inviteCohorts, setInviteCohorts] = useState<Array<{ id: string; name: string }>>([]);

  // CRM hospitals for Add Hospital (state → city → hospital)
  const [crmHospitals, setCrmHospitals] = useState<CrmHospitalRow[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [addHospitalId, setAddHospitalId] = useState('');
  const [addIsWorkingWith, setAddIsWorkingWith] = useState(true);
  const [showAllHospitals, setShowAllHospitals] = useState(false); // Filter toggle

  // Hospital table filter/sort
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalFilterState, setHospitalFilterState] = useState<string>('');
  const [hospitalFilterTrauma, setHospitalFilterTrauma] = useState<string>('');
  const [hospitalSortBy, setHospitalSortBy] = useState<'name' | 'location' | 'traumaLevel' | 'status' | 'contactCount' | 'primaryContact'>('name');
  const [hospitalSortOrder, setHospitalSortOrder] = useState<'asc' | 'desc'>('asc');

  // Contacts list filter/sort (in hospital details dialog)
  const [contactSearch, setContactSearch] = useState('');
  const [contactSortBy, setContactSortBy] = useState<'name' | 'role' | 'status' | 'primary' | 'workingWithMe'>('name');
  const [contactSortOrder, setContactSortOrder] = useState<'asc' | 'desc'>('asc');

  // Dated note form (hospital detail)
  const [newNoteDate, setNewNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNoteText, setNewNoteText] = useState('');
  // Edit note dialog (own notes only)
  const [editingNote, setEditingNote] = useState<DatedNote | null>(null);
  const [editNoteDate, setEditNoteDate] = useState('');
  const [editNoteText, setEditNoteText] = useState('');
  // Site activity stats (this hospital)
  const [siteStats, setSiteStats] = useState<{ activities: number; hours: number } | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadData defined below
  }, [currentUser, effectiveUserId]);

  const loadData = async () => {
    const uid = dataUserId;
    if (!uid) return;

    try {
    const isOldMockHospital = (name: string) =>
      name === 'Memorial General Hospital' || name === "Children's Regional Medical Center" || name === "St. Mary's Community Hospital";
    const isOldMockContact = (f: string, l: string) =>
      (f === 'Jane' && l === 'Smith') || (f === 'John' && l === 'Doe');

    let hospitals: Hospital[] = [];
    let contacts: Contact[] = [];
    let hospitalsVal = await getUserData<Hospital[]>(uid, 'mentorHospitals');
    let contactsVal = await getUserData<Contact[]>(uid, 'mentorContacts');
    if (hospitalsVal == null || !Array.isArray(hospitalsVal)) {
      try {
        const raw = localStorage.getItem(`mentorHospitals_${uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            hospitalsVal = parsed;
            await setUserData(uid, 'mentorHospitals', parsed);
            localStorage.removeItem(`mentorHospitals_${uid}`);
          }
        }
      } catch {}
    }
    if (contactsVal == null || !Array.isArray(contactsVal)) {
      try {
        const raw = localStorage.getItem(`mentorContacts_${uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            contactsVal = parsed;
            await setUserData(uid, 'mentorContacts', parsed);
            localStorage.removeItem(`mentorContacts_${uid}`);
          }
        }
      } catch {}
    }
    const storedHospitals: Hospital[] = [];
    if (hospitalsVal != null && Array.isArray(hospitalsVal)) {
      if (hospitalsVal.some((h: Hospital) => isOldMockHospital(h?.name || ''))) {
        await setUserData(uid, 'mentorHospitals', []);
        await setUserData(uid, 'mentorContacts', []);
      } else {
        hospitalsVal.forEach((h: Hospital) => {
          storedHospitals.push({
            ...h,
            isWorkingWith: h.isWorkingWith ?? true,
            notesLog: Array.isArray((h as Hospital & { notesLog?: DatedNote[] }).notesLog)
              ? (h as Hospital & { notesLog: DatedNote[] }).notesLog
              : [],
          });
        });
      }
    }

    const storedById = new Map(storedHospitals.map((h) => [String(h.id), h]));
    try {
      const mergedRows = await fetchMergedMentorHospitals(uid);
      if (mergedRows.length > 0) {
        hospitals = mergedRows.map((m) => {
          const fid = m.hospital.facility_id != null ? String(m.hospital.facility_id) : undefined;
          const s =
            storedById.get(m.hospital.id) ||
            (fid ? storedById.get(fid) : undefined);
          return {
            id: m.hospital.id,
            facilityId: fid,
            name: s?.name || m.hospital.name || 'Hospital',
            address: s?.address || '',
            city: m.storedHospital?.city || s?.city || '',
            state: m.storedHospital?.state || s?.state || '',
            phone: s?.phone || '',
            traumaLevel: s?.traumaLevel || '',
            edSize: s?.edSize || '',
            notes: s?.notes || '',
            notesLog: s?.notesLog || [],
            isWorkingWith: s?.isWorkingWith !== false,
          };
        });
      } else {
        hospitals = storedHospitals;
      }
    } catch {
      hospitals = storedHospitals;
    }
    if (contactsVal != null && Array.isArray(contactsVal)) {
      if (contactsVal.some((c: any) => isOldMockContact(c?.firstName || '', c?.lastName || ''))) {
        contacts = [];
        await setUserData(uid, 'mentorContacts', []);
      } else {
        contacts = contactsVal;
      }
    }

    const refToUuid = new Map<string, string>();
    if (hospitals.length > 0) {
      const nameByKey: Record<string, string> = {};
      const ids = hospitals.map((h: Hospital) => h.id);
      const orClause = buildHospitalsTableOrClause(ids);
      const { data: rows } = await supabase.from('hospitals').select('id, facility_id, name').or(orClause);
      (rows || []).forEach((r: { id?: string; facility_id?: string; name?: string }) => {
        const name = r.name != null ? normalizeHospitalOrOrgName(r.name) : '';
        if (r.id) {
          nameByKey[r.id] = name;
          refToUuid.set(r.id, r.id);
        }
        if (r.facility_id != null) {
          const fid = String(r.facility_id);
          nameByKey[fid] = name;
          if (r.id) refToUuid.set(fid, r.id);
        }
      });
      const facilityIdByUuid = new Map<string, string>();
      (rows || []).forEach((r: { id?: string; facility_id?: string | null }) => {
        if (r.id && r.facility_id != null) {
          facilityIdByUuid.set(r.id, String(r.facility_id));
        }
      });
      hospitals = hospitals.map((h: Hospital) => ({
        ...h,
        facilityId: h.facilityId || facilityIdByUuid.get(h.id),
        name: nameByKey[h.id] ?? nameByKey[h.facilityId || ''] ?? normalizeHospitalOrOrgName(h.name),
      }));
      await setUserData(uid, 'mentorHospitals', hospitals);
      setHospitalRefToUuid(refToUuid);

      const assignedEntries = await Promise.all(
        hospitals.map(async (h) => {
          const rows = await loadAssignedPeccsForHospital(h.id, h.facilityId);
          return [h.id, rows] as const;
        })
      );
      setAssignedPeccsByHospital(new Map(assignedEntries));
    } else {
      setHospitalRefToUuid(new Map());
      setAssignedPeccsByHospital(new Map());
    }

    setHospitals(hospitals);
    setSelectedHospital(hospitals.length > 0 ? hospitals[0] : null);
    setContacts(contacts);
    } catch (err) {
      console.error('Error loading hospitals and contacts:', err);
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Failed to load data. Try refreshing.', severity: 'error' });
    }
  };

  const saveHospitals = async (newHospitals: Hospital[]) => {
    setHospitals(newHospitals);
    if (dataUserId) await setUserData(dataUserId, 'mentorHospitals', newHospitals);
  };

  const saveContacts = async (newContacts: Contact[]) => {
    setContacts(newContacts);
    if (dataUserId) await setUserData(dataUserId, 'mentorContacts', newContacts);
  };

  const selectedCrmHospital = useMemo(() => {
    if (!addHospitalId) return null;
    const id = addHospitalId;
    return crmHospitals.find((h) => String(h.facility_id ?? h.id) === id) ?? null;
  }, [crmHospitals, addHospitalId]);

  // Hospital handlers
  const openUnifiedAddDialog = (opts?: { preselectedHospital?: Hospital | null; includeContact?: boolean }) => {
    const preselectedHospital = opts?.preselectedHospital ?? null;
    const includeContact = opts?.includeContact === true;
    const preselectedId = preselectedHospital?.id ?? '';
    setEditingHospital(null);
    setAddHospitalId(preselectedId);
    setAddIsWorkingWith(preselectedHospital?.isWorkingWith ?? true);
    setAddIncludeContact(includeContact);
    setContactHospitalId(preselectedId);
    setContactForm(EMPTY_CONTACT_FORM);
    setHospitalDialogOpen(true);
  };

  const handleAddHospital = () => {
    openUnifiedAddDialog({ includeContact: false });
  };

  const openAddContactForHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    openUnifiedAddDialog({ preselectedHospital: hospital, includeContact: true });
  };

  const handleEditHospital = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setHospitalForm({
      name: normalizeHospitalOrOrgName(hospital.name),
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
  const linkHospitalToCRM = useCallback(async (hospital: Hospital) => {
    if (!dataUserId) return;

    try {
      const hospitalId = hospital.id; // facility_id or id

      // Find PECCs for this hospital
      const { data: peccUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('role', 'pecc')
        .or(buildPeccHospitalFacilityOrClause([hospitalId, hospital.facilityId, hospital.id].filter(Boolean) as string[]));

      // Update CRM hospital record with PECC and Mentor info
      // This would ideally update a notes_log or activity_log field
      // For now, we'll just ensure the relationship exists
      console.log('Linking hospital to CRM:', {
        hospitalId,
        peccs: peccUsers,
        mentor: dataUserId
      });

      // Could add to CRM notes_log or activity_log here
    } catch (err) {
      console.error('Error linking hospital to CRM:', err);
    }
  }, [dataUserId]);

  const handleSaveHospital = async () => {
    if (editingHospital) {
      // Edit flow: require name
      if (!hospitalForm.name.trim()) {
        setSnackbar({ open: true, message: 'Hospital name is required', severity: 'error' });
        return;
      }
      const hospitalData: Hospital = {
        id: editingHospital.id,
        ...hospitalForm,
        notesLog: editingHospital.notesLog ?? []
      };
      const newHospitals = hospitals.map(h => h.id === editingHospital.id ? hospitalData : h);
      saveHospitals(newHospitals);
      setHospitalDialogOpen(false);
      if (selectedHospital?.id === editingHospital.id) setSelectedHospital(hospitalData);
      setSnackbar({ open: true, message: 'Hospital updated successfully', severity: 'success' });
      return;
    }

    // Unified add flow: select a CRM hospital, then optionally add contact details.
    const crmRow = selectedCrmHospital;
    if (!addHospitalId || !crmRow) {
      setSnackbar({ open: true, message: 'Please select a hospital from the CRM list', severity: 'error' });
      return;
    }
    const id = String(crmRow.facility_id ?? crmRow.id ?? '');
    const existingHospital = hospitals.find((h) => h.id === id) ?? null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const contactEmail = contactForm.email.trim();
    if (addIncludeContact) {
      if (!contactForm.firstName.trim() || !contactForm.lastName.trim()) {
        setSnackbar({ open: true, message: 'Contact first and last name are required', severity: 'error' });
        return;
      }
      if (!contactEmail) {
        setSnackbar({ open: true, message: 'Contact email is required', severity: 'error' });
        return;
      }
      if (!emailRegex.test(contactEmail)) {
        setSnackbar({ open: true, message: 'Please enter a valid contact email address', severity: 'error' });
        return;
      }
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
      notesLog: [],
      isWorkingWith: addIsWorkingWith
    };
    let targetHospital = hospitalData;
    let hospitalActionLabel = 'Hospital added';
    if (existingHospital) {
      targetHospital = { ...existingHospital, isWorkingWith: addIsWorkingWith };
      const updatedHospitals = hospitals.map((h) => (h.id === existingHospital.id ? targetHospital : h));
      saveHospitals(updatedHospitals);
      hospitalActionLabel = existingHospital.isWorkingWith !== addIsWorkingWith ? 'Hospital relationship updated' : 'Using existing hospital';
    } else {
      const newHospitals = [...hospitals, hospitalData];
      saveHospitals(newHospitals);
    }

    if (addIncludeContact) {
      const newContact: Contact = {
        id: `contact_${Date.now()}`,
        hospitalId: targetHospital.id,
        ...contactForm,
        email: contactEmail,
        isWorkingWithMentor: contactForm.isWorkingWithMentor !== false
      };
      saveContacts([...contacts, newContact]);
      hospitalActionLabel = existingHospital ? 'Hospital and contact saved' : 'Hospital added and contact saved';
    }

    setHospitalDialogOpen(false);
    setSelectedHospital(targetHospital);
    linkHospitalToCRM(targetHospital);
    if (dataUserId && addIsWorkingWith !== false) {
      try {
        await ensureMentorHospitalAssignment(dataUserId, targetHospital.id, dataUserId);
      } catch (err) {
        console.warn('[MentorHospitalContacts] assignment sync failed:', err);
      }
    }
    setSnackbar({ open: true, message: `${hospitalActionLabel} successfully`, severity: 'success' });
  };

  const handleHospitalRowClick = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    linkHospitalToCRM(hospital);
    setHospitalDetailsDialogOpen(true);
    setNewNoteDate(new Date().toISOString().slice(0, 10));
    setNewNoteText('');
  };

  useEffect(() => {
    const hid = searchParams.get('hospital');
    if (!hid || !hospitals.length) {
      if (!hid) deepLinkHospitalDone.current = false;
      return;
    }
    if (deepLinkHospitalDone.current) return;
    const h = hospitals.find((x) => x.id === hid);
    if (h) {
      setSelectedHospital(h);
      linkHospitalToCRM(h);
      setHospitalDetailsDialogOpen(true);
      deepLinkHospitalDone.current = true;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('hospital');
        next.delete('contact');
        next.delete('user');
        return next;
      }, { replace: true });
    }
  }, [hospitals, searchParams, setSearchParams, linkHospitalToCRM]);

  // When hospital detail dialog opens, refresh assigned PECCs and hospital-scoped stats
  useEffect(() => {
    if (!hospitalDetailsDialogOpen || !selectedHospital?.id) return;
    setSiteStats(null);
    let cancelled = false;
    const hospitalId = selectedHospital.id;
    const hospitalFacilityId = selectedHospital.facilityId;
    (async () => {
      const assigned = await loadAssignedPeccsForHospital(hospitalId, hospitalFacilityId);
      if (!cancelled) {
        setAssignedPeccsByHospital((prev) => {
          const next = new Map(prev);
          next.set(hospitalId, assigned);
          return next;
        });
      }
      const [{ data, error }, hospitalUuid] = await Promise.all([
        supabase.from('hospitals').select('notes_log').or(hospitalIdOrFacilityOrClause(hospitalId)).limit(1).maybeSingle(),
        resolveHospitalUuid(hospitalId),
      ]);
      if (cancelled) return;
      if (!error && data) {
        const raw = (data as { notes_log?: unknown })?.notes_log;
        const serverLog: DatedNote[] = Array.isArray(raw)
          ? raw.map((e: any) => ({ id: e.id, date: e.date ?? '', text: e.text ?? '', author_id: e.author_id })).filter((n: DatedNote) => n.date && n.text)
          : [];
        if (serverLog.length > 0) {
          setSelectedHospital(prev => prev && prev.id === hospitalId ? { ...prev, notesLog: serverLog.sort((a, b) => b.date.localeCompare(a.date)) } : prev);
        }
      }
      const hospitalActivities = hospitalUuid
        ? await getHospitalData<any[]>(hospitalUuid, 'activities')
        : null;
      const entries = Array.isArray(hospitalActivities) ? hospitalActivities : [];
      const hours = entries.reduce((sum: number, a: any) => sum + (Number(a?.hours) || 0), 0);
      if (!cancelled) setSiteStats({ activities: entries.length, hours });
    })();
    return () => { cancelled = true; };
  }, [hospitalDetailsDialogOpen, selectedHospital?.id, selectedHospital?.facilityId]);

  const handleAddDatedNote = async () => {
    if (!selectedHospital || !newNoteText.trim()) return;
    const noteText = newNoteText.trim();
    const noteId = crypto.randomUUID();
    const note: DatedNote = {
      id: noteId,
      date: newNoteDate,
      text: noteText,
      author_id: dataUserId ?? undefined
    };
    const notesLog = [...(selectedHospital.notesLog ?? []), note].sort((a, b) => b.date.localeCompare(a.date));
    const updated: Hospital = { ...selectedHospital, notesLog };
    const newHospitals = hospitals.map(h => h.id === selectedHospital.id ? updated : h);
    saveHospitals(newHospitals);
    setSelectedHospital(updated);
    setNewNoteText('');
    setNewNoteDate(new Date().toISOString().slice(0, 10));
    setSnackbar({ open: true, message: 'Dated note added', severity: 'success' });

    // Sync note to CRM so admins see it on the hospital's CRM page
    const authorName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ').trim();
    const roleLabel = userProfile?.role === 'manager' ? 'Manager' : 'Mentor';
    const crmNoteText = authorName ? `${roleLabel} (${authorName}): ${noteText}` : `${roleLabel}: ${noteText}`;
    const { error } = await supabase.rpc('append_hospital_note', {
      p_hospital_id: selectedHospital.id,
      p_note_date: newNoteDate,
      p_note_text: crmNoteText,
      p_note_id: noteId
    });
    if (error) {
      console.warn('Could not sync note to CRM:', error.message);
      setSnackbar({
        open: true,
        message: `Note saved locally. It did not sync to the CRM (${error.message}). Ask an admin to run MENTOR_HOSPITAL_NOTE_TO_CRM.sql in Supabase if you need notes to appear in the CRM.`,
        severity: 'warning'
      });
    }
  };

  const canEditNote = (entry: DatedNote) =>
    Boolean(entry.author_id && dataUserId && entry.author_id === dataUserId);

  const handleEditNoteClick = (entry: DatedNote) => {
    setEditingNote(entry);
    setEditNoteDate(entry.date);
    setEditNoteText(entry.text);
  };

  const handleUpdateNote = async () => {
    if (!selectedHospital || !editingNote?.id) return;
    const newLog = (selectedHospital.notesLog ?? []).map((n) =>
      n.id === editingNote.id ? { ...n, date: editNoteDate, text: editNoteText } : n
    );
    const updated: Hospital = { ...selectedHospital, notesLog: newLog };
    const newHospitals = hospitals.map(h => h.id === selectedHospital.id ? updated : h);
    saveHospitals(newHospitals);
    setSelectedHospital(updated);
    setEditingNote(null);
    setSnackbar({ open: true, message: 'Note updated', severity: 'success' });

    const { error } = await supabase.rpc('update_hospital_note', {
      p_hospital_id: selectedHospital.id,
      p_note_id: editingNote.id,
      p_note_date: editNoteDate,
      p_note_text: editNoteText
    });
    if (error) {
      console.warn('Could not sync note update to CRM:', error.message);
      setSnackbar({ open: true, message: 'Note updated locally; CRM sync failed.', severity: 'warning' });
    }
  };

  const handleDeleteNote = async (entry: DatedNote) => {
    if (!selectedHospital || !entry.id) return;
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    const newLog = (selectedHospital.notesLog ?? []).filter((n) => n.id !== entry.id);
    const updated: Hospital = { ...selectedHospital, notesLog: newLog };
    const newHospitals = hospitals.map(h => h.id === selectedHospital.id ? updated : h);
    saveHospitals(newHospitals);
    setSelectedHospital(updated);
    setSnackbar({ open: true, message: 'Note deleted', severity: 'success' });

    const { error } = await supabase.rpc('delete_hospital_note', {
      p_hospital_id: selectedHospital.id,
      p_note_id: entry.id
    });
    if (error) {
      console.warn('Could not sync note deletion to CRM:', error.message);
      setSnackbar({ open: true, message: 'Note deleted locally; CRM sync failed.', severity: 'warning' });
    }
  };

  const handleRemoveHospital = (hospitalId: string) => {
    if (window.confirm('Remove this hospital from your Support Tool? This will not delete it from the CRM, but you will no longer see it in your list.')) {
      const newHospitals = hospitals.filter(h => h.id !== hospitalId);
      saveHospitals(newHospitals);
      if (selectedHospital?.id === hospitalId) {
        setSelectedHospital(null);
      }
      setSnackbar({ open: true, message: 'Hospital removed from Support Tool', severity: 'success' });
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
    openUnifiedAddDialog({ preselectedHospital: selectedHospital, includeContact: true });
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactHospitalId(contact.hospitalId);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      contactStatus: contact.contactStatus,
      roleAtHospital: contact.roleAtHospital,
      isPrimaryContact: contact.isPrimaryContact,
      isActivelyEngaged: contact.isActivelyEngaged,
      isWorkingWithMentor: contact.isWorkingWithMentor !== false,
      notes: contact.notes
    });
    setContactDialogOpen(true);
  };

  const handleSaveContact = () => {
    if (!contactForm.firstName.trim() || !contactForm.lastName.trim()) {
      setSnackbar({ open: true, message: 'Name is required', severity: 'error' });
      return;
    }
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

    const targetHospitalId = editingContact?.hospitalId || contactHospitalId;
    if (!targetHospitalId) {
      setSnackbar({ open: true, message: 'Please select a hospital for this contact', severity: 'error' });
      return;
    }

    const contactData: Contact = {
      id: editingContact?.id || `contact_${Date.now()}`,
      hospitalId: targetHospitalId,
      ...contactForm,
      isWorkingWithMentor: contactForm.isWorkingWithMentor !== false
    };

    let newContacts: Contact[];
    if (editingContact) {
      newContacts = contacts.map(c => c.id === editingContact.id ? contactData : c);
    } else {
      newContacts = [...contacts, contactData];
    }

    saveContacts(newContacts);
    setContactDialogOpen(false);
    const contactHospital = hospitals.find((h) => h.id === targetHospitalId);
    if (contactHospital) setSelectedHospital(contactHospital);
    setSnackbar({ open: true, message: `Contact ${editingContact ? 'updated' : 'added'} successfully`, severity: 'success' });
  };

  const handleDeleteContact = (id: string) => {
    if (window.confirm('Remove this contact from your list? They will remain in the CRM; you just won’t see them in your contacts for this hospital.')) {
      const newContacts = contacts.filter(c => c.id !== id);
      saveContacts(newContacts);
      setContactDialogOpen(false);
      setSnackbar({ open: true, message: 'Contact removed from your list', severity: 'success' });
    }
  };

  const getDisplayedContactsForHospital = useCallback(
    (hospital: Hospital) =>
      mergeContactsForHospital(
        hospital,
        contacts,
        assignedPeccsByHospital.get(hospital.id) || [],
        hospitalRefToUuid,
        dataUserId || ''
      ),
    [contacts, assignedPeccsByHospital, hospitalRefToUuid, dataUserId]
  );

  const handleToggleContactWorkingWith = (contact: Contact) => {
    if (
      contact.assignedPeccSource ||
      contact.id.startsWith('pecc-') ||
      contact.id.startsWith('hc-') ||
      contact.id.startsWith('crm-')
    ) {
      return;
    }
    const next = contact.isWorkingWithMentor !== false ? false : true;
    const updated: Contact = { ...contact, isWorkingWithMentor: next };
    const newContacts = contacts.map(c => c.id === contact.id ? updated : c);
    saveContacts(newContacts);
    if (editingContact?.id === contact.id) {
      setContactForm(prev => ({ ...prev, isWorkingWithMentor: next }));
    }
    setSnackbar({
      open: true,
      message: next ? 'Contact marked as working with you' : 'Contact marked as not actively working with you',
      severity: 'success'
    });
  };

  // Load cohorts when invite dialog opens (mentors only see cohorts they're allowed to invite to)
  useEffect(() => {
    if (inviteDialogOpen && dataUserId) {
      setInviteCohortIds([]);
      setInviteCustomMessage('');
      setInviteSuccessCode(null);
      (async () => {
        const { data: allowedRows } = await supabase
          .from('cohort_invite_mentors')
          .select('cohort_id')
          .eq('mentor_id', dataUserId);
        const allowedIds = (allowedRows || []).map(r => r.cohort_id);
        if (allowedIds.length === 0) {
          setInviteCohorts([]);
        } else {
          const { data } = await supabase
            .from('cohorts')
            .select('id, name')
            .eq('is_active', true)
            .in('id', allowedIds)
            .order('name');
          if (data) setInviteCohorts(data.map(c => ({ id: c.id, name: c.name })));
        }
      })();
    }
  }, [inviteDialogOpen, dataUserId]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !dataUserId || !selectedHospital) return;
    setInviteSending(true);
    try {
      const { code, emailSent, emailError } = await createAndSendInvitation({
        email: inviteEmail.trim(),
        role: UserRole.PECC,
        invitedBy: dataUserId,
        hospitalId: selectedHospital.id,
        mentorId: dataUserId,
        cohortIds: inviteCohortIds.length > 0 ? inviteCohortIds : undefined,
        customMessage: inviteCustomMessage.trim() || undefined
      });
      setInviteSuccessCode(code);
      const inviteUrl = `${window.location.origin}/invite/${code}`;
      navigator.clipboard.writeText(inviteUrl);
      setSnackbar({
        open: true,
        message: emailSent
          ? 'Invitation created! Link copied to clipboard.'
          : `Invitation created! Link copied. Email was not sent${emailError ? `: ${emailError}` : ''} — please send the link to the invitee.`,
        severity: 'success'
      });
    } catch (err: unknown) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to create invitation',
        severity: 'error'
      });
    } finally {
      setInviteSending(false);
    }
  };

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteEmail('');
    setInviteCohortIds([]);
    setInviteCustomMessage('');
    setInviteSuccessCode(null);
  };

  const hospitalContacts = useMemo(
    () => (selectedHospital ? getDisplayedContactsForHospital(selectedHospital) : []),
    [selectedHospital, getDisplayedContactsForHospital]
  );

  // Reset contact filter/sort when opening a different hospital
  useEffect(() => {
    if (!selectedHospital) {
      setContactSearch('');
    }
  }, [selectedHospital]);

  // Filter hospitals based on showAllHospitals toggle
  const displayedHospitals = showAllHospitals 
    ? hospitals 
    : hospitals.filter(h => h.isWorkingWith);

  // Options for hospital filters (from current data)
  const hospitalStateOptions = useMemo(() => {
    const s = new Set(displayedHospitals.map(h => h.state).filter(Boolean));
    return Array.from(s).sort();
  }, [displayedHospitals]);

  // Apply search and filters to hospitals, then sort
  const filteredAndSortedHospitals = useMemo(() => {
    const search = (hospitalSearch || '').toLowerCase().trim();
    let list = displayedHospitals;
    if (search) {
      list = list.filter(h => {
        const name = normalizeHospitalOrOrgName(h.name).toLowerCase();
        const location = `${(h.city || '')} ${(h.state || '')}`.toLowerCase();
        return name.includes(search) || location.includes(search);
      });
    }
    if (hospitalFilterState) {
      list = list.filter(h => (h.state || '') === hospitalFilterState);
    }
    if (hospitalFilterTrauma) {
      list = list.filter(h => (h.traumaLevel || '') === hospitalFilterTrauma);
    }
    const dir = hospitalSortOrder === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const aContacts = getDisplayedContactsForHospital(a);
      const bContacts = getDisplayedContactsForHospital(b);
      const aPrimary = aContacts.find(c => c.isPrimaryContact);
      const bPrimary = bContacts.find(c => c.isPrimaryContact);
      const aPrimaryName = aPrimary ? `${aPrimary.firstName} ${aPrimary.lastName}` : '';
      const bPrimaryName = bPrimary ? `${bPrimary.firstName} ${bPrimary.lastName}` : '';
      let cmp = 0;
      switch (hospitalSortBy) {
        case 'name':
          cmp = normalizeHospitalOrOrgName(a.name).localeCompare(normalizeHospitalOrOrgName(b.name));
          break;
        case 'location':
          cmp = (a.state || '').localeCompare(b.state || '') || (a.city || '').localeCompare(b.city || '');
          break;
        case 'traumaLevel':
          cmp = (a.traumaLevel || '').localeCompare(b.traumaLevel || '');
          break;
        case 'status':
          cmp = (a.isWorkingWith === b.isWorkingWith) ? 0 : (a.isWorkingWith ? 1 : -1);
          break;
        case 'contactCount':
          cmp = aContacts.length - bContacts.length;
          break;
        case 'primaryContact':
          cmp = aPrimaryName.localeCompare(bPrimaryName);
          break;
        default:
          break;
      }
      return cmp * dir;
    });
    return list;
  }, [displayedHospitals, hospitalSearch, hospitalFilterState, hospitalFilterTrauma, hospitalSortBy, hospitalSortOrder, getDisplayedContactsForHospital]);

  // Filter and sort contacts in the hospital details dialog
  const filteredAndSortedContacts = useMemo(() => {
    const search = (contactSearch || '').toLowerCase().trim();
    let list = hospitalContacts;
    if (search) {
      list = list.filter(c => {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase();
        const email = (c.email || '').toLowerCase();
        const role = (c.roleAtHospital || '').toLowerCase();
        const status = (c.contactStatus || '').toLowerCase();
        return name.includes(search) || email.includes(search) || role.includes(search) || status.includes(search);
      });
    }
    const dir = contactSortOrder === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (contactSortBy) {
        case 'name':
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'role':
          cmp = (a.roleAtHospital || '').localeCompare(b.roleAtHospital || '');
          break;
        case 'status':
          cmp = (a.contactStatus || '').localeCompare(b.contactStatus || '');
          break;
        case 'primary':
          cmp = (a.isPrimaryContact === b.isPrimaryContact) ? 0 : (a.isPrimaryContact ? -1 : 1);
          break;
        case 'workingWithMe':
          cmp = (a.isWorkingWithMentor !== false) === (b.isWorkingWithMentor !== false) ? 0 : (a.isWorkingWithMentor !== false ? -1 : 1);
          break;
        default:
          break;
      }
      return cmp * dir;
    });
    return list;
  }, [hospitalContacts, contactSearch, contactSortBy, contactSortOrder]);

  return (
    <Box sx={{ py: 3 }}>
      <Alert severity="info" sx={{ mb: 2 }} icon={false}>
        <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in hospital or contact notes.
      </Alert>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h4">Hospital Contacts</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddContact}>
          Add Hospital or Contact
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your hospital list and PECC contacts from one popup flow.
      </Typography>

      {/* List View - Table */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
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
            {filteredAndSortedHospitals.length} of {displayedHospitals.length} hospitals
            {displayedHospitals.length !== hospitals.length && ` (${hospitals.length} total)`}
          </Typography>
        </Box>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search hospitals..."
              value={hospitalSearch}
              onChange={(e) => setHospitalSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>State</InputLabel>
              <Select
                value={hospitalFilterState}
                label="State"
                onChange={(e) => setHospitalFilterState(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {hospitalStateOptions.map(st => (
                  <MenuItem key={st} value={st}>{st}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Trauma Level</InputLabel>
              <Select
                value={hospitalFilterTrauma}
                label="Trauma Level"
                onChange={(e) => setHospitalFilterTrauma(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {TRAUMA_LEVELS.map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={hospitalSortBy}
                label="Sort by"
                onChange={(e) => setHospitalSortBy(e.target.value as typeof hospitalSortBy)}
              >
                <MenuItem value="name">Hospital Name</MenuItem>
                <MenuItem value="location">Location</MenuItem>
                <MenuItem value="traumaLevel">Trauma Level</MenuItem>
                <MenuItem value="status">Status</MenuItem>
                <MenuItem value="contactCount"># Contacts</MenuItem>
                <MenuItem value="primaryContact">Primary Contact</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={2} md={1}>
            <IconButton
              size="small"
              onClick={() => setHospitalSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              title={hospitalSortOrder === 'asc' ? 'Ascending (click for descending)' : 'Descending (click for ascending)'}
              aria-label={hospitalSortOrder === 'asc' ? 'Sort hospitals ascending, click to sort descending' : 'Sort hospitals descending, click to sort ascending'}
            >
              {hospitalSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            </IconButton>
          </Grid>
        </Grid>
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
                {filteredAndSortedHospitals.map(hospital => {
                  const hContacts = getDisplayedContactsForHospital(hospital);
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
                            {normalizeHospitalOrOrgName(hospital.name)}
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
                          <IconButton size="small" onClick={() => openAddContactForHospital(hospital)} aria-label="Add contact">
                            <PersonAddIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleEditHospital(hospital)} aria-label="Edit hospital">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setSelectedHospital(hospital);
                              setInviteDialogOpen(true);
                            }}
                            aria-label="Invite PECC"
                          >
                            <SendIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAndSortedHospitals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="textSecondary" gutterBottom>
                        {displayedHospitals.length === 0
                          ? 'No hospitals yet. Add hospitals from the CRM list to track contacts, log activities, and monitor Site Milestones.'
                          : 'No hospitals match the current filters. Try changing search or filters.'}
                      </Typography>
                      {displayedHospitals.length === 0 && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddHospital} sx={{ mt: 2 }}>
                          Add Hospital
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Hospital Details Dialog */}
      <Dialog open={hospitalDetailsDialogOpen} onClose={closeHospitalDetailsDialog} maxWidth="md" fullWidth>
        {selectedHospital && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{normalizeHospitalOrOrgName(selectedHospital.name)}</Typography>
                <IconButton onClick={closeHospitalDetailsDialog} size="small" aria-label="Close">
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* 1. Hospital name and basic info at top */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>{normalizeHospitalOrOrgName(selectedHospital.name)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {selectedHospital.isWorkingWith ? (
                      <Chip label="Working With" color="success" size="small" />
                    ) : (
                      <Chip label="Contact Only" color="default" size="small" />
                    )}
                    <Chip label={selectedHospital.traumaLevel} size="small" />
                  </Box>
                  <Typography variant="subtitle2" color="textSecondary">Address</Typography>
                  <Typography gutterBottom>
                    {selectedHospital.address}<br />
                    {selectedHospital.city}, {selectedHospital.state}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary">Phone</Typography>
                  <Typography gutterBottom>{selectedHospital.phone || '—'}</Typography>
                  <Typography variant="subtitle2" color="textSecondary">ED Size</Typography>
                  <Typography>{selectedHospital.edSize || '—'}</Typography>
                </Paper>

                {/* 2. Contacts */}
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography variant="h6">Contacts</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 480 }}>
                        PECCs assigned to this site appear here automatically. Add your own contacts for anyone not yet in ImPACTS.
                      </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
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
                  {hospitalContacts.length > 0 && (
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Search contacts..."
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3} md={2}>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Sort by</InputLabel>
                          <Select
                            value={contactSortBy}
                            label="Sort by"
                            onChange={(e) => setContactSortBy(e.target.value as typeof contactSortBy)}
                          >
                            <MenuItem value="name">Name</MenuItem>
                            <MenuItem value="role">Role</MenuItem>
                            <MenuItem value="status">Status</MenuItem>
                            <MenuItem value="primary">Primary first</MenuItem>
                            <MenuItem value="workingWithMe">Working with me first</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={6} sm={2} md={1}>
                        <IconButton
                          size="small"
                          onClick={() => setContactSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                          title={contactSortOrder === 'asc' ? 'Ascending' : 'Descending'}
                          aria-label={contactSortOrder === 'asc' ? 'Sort contacts ascending, click to sort descending' : 'Sort contacts descending, click to sort ascending'}
                        >
                          {contactSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                        </IconButton>
                      </Grid>
                    </Grid>
                  )}
                  <Divider sx={{ mb: 2 }} />
                  {hospitalContacts.length === 0 ? (
                    <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                      No contacts for this hospital yet. Add a contact to get started.
                    </Typography>
                  ) : filteredAndSortedContacts.length === 0 ? (
                    <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                      No contacts match the search. Try a different term.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {filteredAndSortedContacts.map((contact, index) => (
                        <HospitalContactListItem
                          key={contact.id}
                          contact={contact}
                          showDivider={index < filteredAndSortedContacts.length - 1}
                          onEdit={() => handleEditContact(contact)}
                          onToggleWorkingWith={() => handleToggleContactWorkingWith(contact)}
                        />
                      ))}
                    </List>
                  )}
                </Paper>

                {/* Site activity summary (hospital-scoped activities) */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>Site activity</Typography>
                  <Divider sx={{ mb: 2 }} />
                  {siteStats === null ? (
                    <Typography variant="body2" color="textSecondary">Loading…</Typography>
                  ) : (
                    <Typography variant="body2">
                      Activities logged for this site: <strong>{siteStats.activities}</strong> activities, <strong>{siteStats.hours.toFixed(1)}</strong> hours total.
                    </Typography>
                  )}
                </Paper>

                {/* 3. Notes underneath */}
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>Notes</Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" color="textSecondary">General notes</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                    {selectedHospital.notes || '—'}
                  </Typography>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>Dated notes</Typography>
                  {(selectedHospital.notesLog ?? []).length === 0 ? (
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>No dated notes yet.</Typography>
                  ) : (
                    <Box sx={{ mb: 2, maxHeight: 200, overflow: 'auto' }}>
                      {(selectedHospital.notesLog ?? []).map((entry, i) => (
                        <Box key={entry.id ?? i} sx={{ mb: 1.5, pb: 1.5, borderBottom: i < (selectedHospital.notesLog!.length - 1) ? 1 : 0, borderColor: 'divider', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" color="textSecondary">{entry.date}</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{entry.text}</Typography>
                          </Box>
                          {canEditNote(entry) && (
                            <Box sx={{ flexShrink: 0 }}>
                              <IconButton size="small" aria-label="Edit note" onClick={() => handleEditNoteClick(entry)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" aria-label="Delete note" color="error" onClick={() => handleDeleteNote(entry)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                  <TextField
                    size="small"
                    type="date"
                    label="Note date"
                    value={newNoteDate}
                    onChange={(e) => setNewNoteDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    sx={{ mb: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Add a dated note"
                    placeholder="e.g. Call with PECC lead, discussed timeline..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mb: 1 }}
                  />
                  <Button size="small" variant="outlined" onClick={handleAddDatedNote} disabled={!newNoteText.trim()}>
                    Add note
                  </Button>
                  <Divider sx={{ my: 2 }} />
                  <Button 
                    variant="outlined" 
                    fullWidth 
                    sx={{ mb: 1 }}
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
                    Remove from Support Tool
                  </Button>
                </Paper>
              </Box>
            </DialogContent>
              <DialogActions>
                <Button onClick={closeHospitalDetailsDialog}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>

      {/* Edit note dialog (own notes only) */}
      <Dialog open={Boolean(editingNote)} onClose={() => setEditingNote(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit note</DialogTitle>
        <DialogContent>
          <TextField
            size="small"
            type="date"
            label="Note date"
            value={editNoteDate}
            onChange={(e) => setEditNoteDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            size="small"
            label="Note text"
            value={editNoteText}
            onChange={(e) => setEditNoteText(e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingNote(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateNote}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Unified Add/Edit Hospital Dialog */}
      <Dialog open={hospitalDialogOpen} onClose={() => setHospitalDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingHospital ? 'Edit Hospital' : 'Add Hospital or Contact'}</DialogTitle>
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
                  Use this one popup to add a hospital, add a contact, or do both at once.
                </Typography>
              </Grid>
              {crmLoading ? (
                <Grid item xs={12}>
                  <Box sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary">Loading hospital list...</Typography>
                  </Box>
                </Grid>
              ) : (
                <>
                  <Grid item xs={12}>
                    <Autocomplete
                      options={crmHospitals}
                      value={selectedCrmHospital}
                      onChange={(_, newValue) => {
                        if (!newValue) {
                          setAddHospitalId('');
                          return;
                        }
                        setAddHospitalId(String(newValue.facility_id ?? newValue.id ?? ''));
                      }}
                      getOptionLabel={(option) =>
                        `${normalizeHospitalOrOrgName(option.name)}${option.city ? ` - ${option.city}` : ''}${option.state ? `, ${option.state}` : ''}`
                      }
                      filterOptions={(options, state) => {
                        const term = state.inputValue.trim().toLowerCase();
                        if (!term) return options.slice(0, 100);
                        return options
                          .filter((h) => {
                            const label = `${h.name} ${h.city ?? ''} ${h.state ?? ''}`.toLowerCase();
                            return label.includes(term);
                          })
                          .slice(0, 100);
                      }}
                      noOptionsText="No hospitals found"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Hospital"
                          placeholder="Type hospital name, city, or state"
                        />
                      )}
                      fullWidth
                    />
                  </Grid>
                  {addHospitalId && (
                    <Grid item xs={12}>
                      <FormControl fullWidth>
                        <InputLabel>Mentor Relationship</InputLabel>
                        <Select
                          value={addIsWorkingWith ? 'working' : 'contact'}
                          onChange={(e) => setAddIsWorkingWith(e.target.value === 'working')}
                          label="Mentor Relationship"
                        >
                          <MenuItem value="working">Actively working with this hospital</MenuItem>
                          <MenuItem value="contact">Contact only (not currently working with)</MenuItem>
                        </Select>
                      </FormControl>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                        Choose whether this is in your active mentorship roster or only kept as a contact reference.
                      </Typography>
                    </Grid>
                  )}
                  {addHospitalId && (
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1 }} />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={addIncludeContact}
                            onChange={(e) => setAddIncludeContact(e.target.checked)}
                          />
                        }
                        label="Add a contact in this same popup"
                      />
                    </Grid>
                  )}
                  {addHospitalId && addIncludeContact && (
                    <>
                      <Grid item xs={6}>
                        <TextField
                          label="Contact First Name"
                          value={contactForm.firstName}
                          onChange={(e) => setContactForm(prev => ({ ...prev, firstName: e.target.value }))}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          label="Contact Last Name"
                          value={contactForm.lastName}
                          onChange={(e) => setContactForm(prev => ({ ...prev, lastName: e.target.value }))}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Contact Email"
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Contact Phone"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Role at Hospital"
                          value={contactForm.roleAtHospital}
                          onChange={(e) => setContactForm(prev => ({ ...prev, roleAtHospital: e.target.value }))}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={contactForm.isWorkingWithMentor !== false}
                              onChange={(e) => setContactForm(prev => ({ ...prev, isWorkingWithMentor: e.target.checked }))}
                              color="primary"
                            />
                          }
                          label="Working with me (actively working with this mentor)"
                        />
                      </Grid>
                    </>
                  )}
                </>
              )}
            </Grid>
          )}
          {editingHospital && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Mentor Relationship</InputLabel>
                  <Select
                    value={hospitalForm.isWorkingWith ? 'working' : 'contact'}
                    onChange={(e) => setHospitalForm(prev => ({ ...prev, isWorkingWith: e.target.value === 'working' }))}
                    label="Mentor Relationship"
                  >
                    <MenuItem value="working">Actively working with this hospital</MenuItem>
                    <MenuItem value="contact">Contact only (not currently working with)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                  Choose whether this is in your active mentorship roster or only kept as a contact reference.
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
            {!editingContact && (
              <Grid item xs={12}>
                <Autocomplete
                  options={hospitals}
                  value={hospitals.find((h) => h.id === contactHospitalId) ?? null}
                  onChange={(_, newValue) => setContactHospitalId(newValue?.id ?? '')}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  getOptionLabel={(option) =>
                    `${normalizeHospitalOrOrgName(option.name)}${option.city || option.state ? ` (${[option.city, option.state].filter(Boolean).join(', ')})` : ''}`
                  }
                  noOptionsText="No hospitals found"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Hospital *"
                      placeholder="Search by hospital, city, or state"
                      required
                    />
                  )}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Pick the hospital this contact belongs to.
                </Typography>
              </Grid>
            )}
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
              <FormControlLabel
                control={
                  <Switch
                    checked={contactForm.isWorkingWithMentor !== false}
                    onChange={(e) => setContactForm(prev => ({ ...prev, isWorkingWithMentor: e.target.checked }))}
                    color="primary"
                  />
                }
                label="Working with me (actively working with this mentor)"
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
          <Box sx={{ flex: 1 }} />
          {editingContact && (
            <Button
              color="error"
              onClick={() => editingContact && handleDeleteContact(editingContact.id)}
            >
              Remove from list
            </Button>
          )}
          <Button onClick={handleSaveContact} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onClose={handleCloseInviteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Invite PECC to {selectedHospital ? normalizeHospitalOrOrgName(selectedHospital.name) : ''}</DialogTitle>
        <DialogContent>
          {inviteSuccessCode ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Invitation created. The registration link has been copied to your clipboard.
              </Alert>
              <Typography variant="body2" color="textSecondary">
                Share this link with the PECC: <strong>{window.location.origin}/invite/{inviteSuccessCode}</strong>
              </Typography>
              <Button
                startIcon={<CopyIcon />}
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteSuccessCode}`)}
                sx={{ mt: 2 }}
              >
                Copy link again
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create a registration link for a PECC. They will be associated with this hospital and you as their mentor.
              </Typography>
              <TextField
                label="PECC Email Address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                fullWidth
                placeholder="pecc@hospital.org"
                disabled={inviteSending}
                sx={{ mb: 2 }}
              />
              <Autocomplete
                multiple
                size="small"
                options={inviteCohorts}
                getOptionLabel={(option) => option.name}
                value={inviteCohorts.filter(c => inviteCohortIds.includes(c.id))}
                onChange={(_, value) => setInviteCohortIds(value.map(c => c.id))}
                renderInput={(params) => (
                  <TextField {...params} label="Pre-designate cohorts (optional)" placeholder="Select cohorts" />
                )}
                disabled={inviteSending}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Custom message (optional)"
                value={inviteCustomMessage}
                onChange={(e) => setInviteCustomMessage(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Add a personal message to the invitation..."
                disabled={inviteSending}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInviteDialog}>{inviteSuccessCode ? 'Close' : 'Cancel'}</Button>
          {!inviteSuccessCode && (
            <Button
              onClick={handleSendInvite}
              variant="contained"
              startIcon={inviteSending ? <CircularProgress size={20} /> : <CopyIcon />}
              disabled={!inviteEmail.trim() || inviteSending}
            >
              {inviteSending ? 'Creating...' : 'Create invitation & copy link'}
            </Button>
          )}
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
