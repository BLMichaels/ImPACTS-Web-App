import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { UserRole } from '../../types/database';
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
  Select,
  Drawer,
  Checkbox,
  Tooltip,
  alpha,
  useTheme,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Autocomplete,
  FormGroup,
  FormControlLabel,
  RadioGroup,
  Radio
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  ViewModule as GridIcon,
  ViewList as TableIcon,
  ViewColumn as ViewColumnIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Sort as SortIcon,
  Delete as DeleteIcon,
  Contacts as ContactsIcon,
  KeyboardArrowUp as ArrowUpIcon,
  OpenInFull as OpenInFullIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon
} from '@mui/icons-material';

export type ContactType = 'organization' | 'hospital' | 'manager' | 'mentor' | 'pecc' | 'staff' | 'other';

export type ActivityLogType = 'communication' | 'visit' | 'follow_up';

export interface NotesLogEntry {
  date: string;
  text: string;
}

export interface ActivityLogEntry {
  type: ActivityLogType;
  date: string;
  text: string;
}

const PEOPLE_TYPES: ContactType[] = ['manager', 'mentor', 'pecc', 'staff', 'other'];
const isPersonType = (t: ContactType) => PEOPLE_TYPES.includes(t);

interface Contact {
  id: string;
  type: ContactType;
  name: string;
  firstName?: string;
  lastName?: string;
  organization: string;
  email: string;
  phone: string;
  status: string;
  region: string;
  createdAt: string;
  updatedAt?: string;
  lastContactAt?: string;
  notes: string;
  notesLog?: NotesLogEntry[];
  activityLog?: ActivityLogEntry[];
  tags?: string[];
  facilityId?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  hospitalType?: string;
  ownership?: string;
  hospitalSystem?: string;
  linkedOrganizationIds?: string[];
  linkedHospitalIds?: string[];
  customFields?: Record<string, string>;
}

function contactDisplayName(c: Contact): string {
  if (isPersonType(c.type) && (c.firstName != null || c.lastName != null)) {
    const parts = [c.lastName, c.firstName].filter(Boolean);
    return parts.length ? parts.join(', ') : (c.name || '—');
  }
  return c.name || '—';
}

type SortField = 'name' | 'firstName' | 'lastName' | 'email' | 'type' | 'status' | 'region' | 'state' | 'organization' | 'createdAt' | 'facilityId' | 'hospitalSystem';
type SortOrder = 'asc' | 'desc';

const TYPE_LABELS: Record<ContactType, string> = {
  organization: 'Organization',
  hospital: 'Hospital',
  manager: 'Manager',
  mentor: 'Mentor',
  pecc: 'PECC',
  staff: 'Staff',
  other: 'Other'
};

const TYPE_COLORS: Record<ContactType, string> = {
  organization: '#2196f3',
  hospital: '#4caf50',
  manager: '#9c27b0',
  mentor: '#ff9800',
  pecc: '#e91e63',
  staff: '#00bcd4',
  other: '#607d8b'
};

const CONTACT_TYPES: ContactType[] = ['organization', 'hospital', 'manager', 'mentor', 'pecc', 'staff', 'other'];

const COLUMNS: { id: SortField | 'phone' | 'actions'; label: string; sortable?: boolean; defaultVisible?: boolean }[] = [
  { id: 'firstName', label: 'First Name', sortable: true, defaultVisible: true },
  { id: 'lastName', label: 'Last Name', sortable: true, defaultVisible: true },
  { id: 'name', label: 'Name', sortable: true, defaultVisible: false },
  { id: 'type', label: 'Type', sortable: true, defaultVisible: true },
  { id: 'facilityId', label: 'Facility ID', sortable: true, defaultVisible: true },
  { id: 'organization', label: 'Organization', sortable: true, defaultVisible: true },
  { id: 'hospitalSystem', label: 'Hospital System', sortable: true, defaultVisible: false },
  { id: 'email', label: 'Email', sortable: true, defaultVisible: true },
  { id: 'phone', label: 'Phone', sortable: false, defaultVisible: true },
  { id: 'region', label: 'Region', sortable: true, defaultVisible: true },
  { id: 'state', label: 'State', sortable: true, defaultVisible: true },
  { id: 'status', label: 'Status', sortable: true, defaultVisible: true },
  { id: 'createdAt', label: 'Added', sortable: true, defaultVisible: true },
  { id: 'actions', label: '', sortable: false, defaultVisible: true }
];

const EXPORT_COLUMNS: { id: string; label: string }[] = [
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'name', label: 'Name' },
  { id: 'type', label: 'Type' },
  { id: 'facilityId', label: 'Facility ID' },
  { id: 'organization', label: 'Organization' },
  { id: 'hospitalSystem', label: 'Hospital System' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'region', label: 'Region' },
  { id: 'state', label: 'State' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Added' },
  { id: 'address', label: 'Address' },
  { id: 'city', label: 'City' },
  { id: 'zip', label: 'ZIP' },
  { id: 'county', label: 'County' },
  { id: 'hospitalType', label: 'Hospital Type' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'notes', label: 'Notes' }
];

const CRM_PREFS_KEY = 'adminCrm_prefs';
const CRM_CUSTOM_FIELD_DEFS_KEY = 'adminCrm_customFieldDefinitions';

export type CustomFieldType = 'checkbox' | 'radio' | 'date' | 'numeric' | 'short_answer' | 'paragraph' | 'dropdown' | 'dropdown_csv';
type CustomFieldDefinition = {
  id: string;
  label: string;
  applicableTypes: ContactType[];
  fieldType: CustomFieldType;
  options?: string[];
};
const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  checkbox: 'Checkbox',
  radio: 'Radio',
  date: 'Date',
  numeric: 'Numeric',
  short_answer: 'Short answer',
  paragraph: 'Paragraph',
  dropdown: 'Dropdown (type options)',
  dropdown_csv: 'Dropdown (upload options from CSV)'
};
const OPTIONS_FIELD_TYPES: CustomFieldType[] = ['radio', 'dropdown', 'dropdown_csv'];
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 1000, 'all'] as const;
type PageSize = number | 'all';

type CrmReminder = { id: string; contact_id: string; contact_name: string | null; remind_at: string; title: string; created_at: string };

const ACTIVITY_TYPE_LABELS: Record<ActivityLogType, string> = {
  communication: 'Communication',
  visit: 'Visit',
  follow_up: 'Follow-up'
};

const AdminCRMPage: React.FC = () => {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { actualRole } = useUserProfile();
  const canSeeReminders = actualRole === UserRole.ADMIN || actualRole === UserRole.MANAGER || actualRole === UserRole.MENTOR;

  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        const v = p.pageSize as unknown;
        if (v === 'all') return 'all';
        if (typeof v === 'number' && [25, 50, 100, 250, 1000].includes(v)) return v as PageSize;
      }
    } catch {}
    return 25;
  });
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.viewMode === 'grid' || p.viewMode === 'table') return p.viewMode;
      }
    } catch {}
    return 'table';
  });
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.visibleColumns && Array.isArray(p.visibleColumns)) {
          const valid = new Set((p.visibleColumns as string[]).filter(id => COLUMNS.some(c => c.id === id)));
          if (valid.size > 0) return valid;
        }
      }
    } catch {}
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ single?: string; bulk?: Set<string> } | null>(null);
  const [deleteConfirmTyped, setDeleteConfirmTyped] = useState('');
  const [bulkStatusAnchor, setBulkStatusAnchor] = useState<null | HTMLElement>(null);

  const [formData, setFormData] = useState({
    type: 'other' as ContactType,
    name: '',
    firstName: '',
    lastName: '',
    organization: '',
    email: '',
    phone: '',
    status: 'Active' as string,
    region: '',
    notes: '',
    hospitalSystem: '',
    linkedOrganizationIds: [] as string[],
    linkedHospitalIds: [] as string[],
    customFields: {} as Record<string, string>
  });

  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDefinition[]>(() => {
    try {
      const s = localStorage.getItem(CRM_CUSTOM_FIELD_DEFS_KEY);
      if (s) {
        const parsed = JSON.parse(s) as unknown[];
        if (Array.isArray(parsed)) {
          return parsed.map((x: unknown) => {
            const o = x as Record<string, unknown>;
            if (!o || typeof o !== 'object' || !('id' in o) || !('label' in o)) return null;
            const def: CustomFieldDefinition = {
              id: String(o.id),
              label: String(o.label),
              applicableTypes: Array.isArray(o.applicableTypes) && o.applicableTypes.length
                ? (o.applicableTypes as ContactType[]).filter(t => CONTACT_TYPES.includes(t))
                : (['organization', 'hospital', 'manager', 'mentor', 'pecc', 'staff', 'other'] as ContactType[]),
              fieldType: (o.fieldType && ['checkbox', 'radio', 'date', 'numeric', 'short_answer', 'paragraph', 'dropdown', 'dropdown_csv'].includes(String(o.fieldType)))
                ? o.fieldType as CustomFieldType
                : 'short_answer',
              options: Array.isArray(o.options) ? (o.options as string[]).filter(Boolean) : undefined
            };
            return def;
          }).filter((d): d is CustomFieldDefinition => d !== null);
        }
      }
    } catch {}
    return [];
  });
  const [customFieldsDialogOpen, setCustomFieldsDialogOpen] = useState(false);
  const [editingDefId, setEditingDefId] = useState<string | null>(null);
  const [newDefLabel, setNewDefLabel] = useState('');
  const [newDefApplicableTypes, setNewDefApplicableTypes] = useState<ContactType[]>(['hospital']);
  const [newDefFieldType, setNewDefFieldType] = useState<CustomFieldType>('short_answer');
  const [newDefOptions, setNewDefOptions] = useState('');
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [exportColumnIds, setExportColumnIds] = useState<string[]>(() => EXPORT_COLUMNS.map(c => c.id));

  const [reminders, setReminders] = useState<CrmReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [myRemindersOpen, setMyRemindersOpen] = useState(false);
  const [addNoteText, setAddNoteText] = useState('');
  const [addActivityType, setAddActivityType] = useState<ActivityLogType>('communication');
  const [addActivityText, setAddActivityText] = useState('');
  const [addActivityDate, setAddActivityDate] = useState('');
  const [addReminderDate, setAddReminderDate] = useState('');
  const [addReminderTitle, setAddReminderTitle] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const list: Contact[] = [];
      try {
        const chunk = 1000;
        let offset = 0;
        let hasMore = true;
        while (mounted && hasMore) {
          const { data: batch, error } = await supabase
            .from('hospitals')
            .select('*')
            .range(offset, offset + chunk - 1);
          if (!mounted) return;
          if (error || !batch || batch.length === 0) break;
          for (const row of batch as Record<string, unknown>[]) {
            const id = String(row.facility_id ?? row.id ?? '');
            const name = String(row.name ?? 'Unknown');
            const organization = String(row.company_name ?? '');
            const region = String(row.region ?? '');
            const created = row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0];
            const legacyNotes = row.notes != null ? String(row.notes) : '';
            const rawNotesLog = row.notes_log;
            const rawActivityLog = row.activity_log;
            let notesLog: NotesLogEntry[] = Array.isArray(rawNotesLog)
              ? (rawNotesLog as unknown[]).filter((e): e is NotesLogEntry => typeof e === 'object' && e != null && 'date' in e && 'text' in e).map(e => ({ date: String((e as NotesLogEntry).date), text: String((e as NotesLogEntry).text) }))
              : [];
            let activityLog: ActivityLogEntry[] = Array.isArray(rawActivityLog)
              ? (rawActivityLog as unknown[]).filter((e): e is ActivityLogEntry => typeof e === 'object' && e != null && 'type' in e && 'date' in e && 'text' in e).map(e => ({ type: (e as ActivityLogEntry).type as ActivityLogType, date: String((e as ActivityLogEntry).date), text: String((e as ActivityLogEntry).text) }))
              : [];
            if (legacyNotes.trim() && notesLog.length === 0) {
              notesLog = [{ date: created, text: legacyNotes.trim() }];
            }
            list.push({
              id,
              type: 'hospital',
              name,
              organization,
              email: '',
              phone: String(row.phone ?? ''),
              status: 'Active',
              region,
              createdAt: created,
              notes: legacyNotes,
              notesLog,
              activityLog,
              facilityId: row.facility_id != null ? String(row.facility_id) : undefined,
              address: row.address != null ? String(row.address) : undefined,
              city: row.city != null ? String(row.city) : undefined,
              state: row.state != null ? String(row.state) : undefined,
              zip: row.zip != null ? String(row.zip) : undefined,
              county: row.county != null ? String(row.county) : undefined,
              hospitalType: row.hospital_type != null ? String(row.hospital_type) : undefined,
              ownership: row.ownership != null ? String(row.ownership) : undefined,
              hospitalSystem: row.hospital_system != null ? String(row.hospital_system) : undefined,
              customFields: (row.custom_fields && typeof row.custom_fields === 'object') ? (row.custom_fields as Record<string, string>) : undefined
            });
          }
          hasMore = batch.length >= chunk;
          offset += chunk;
        }
      } catch (_) {
        if (mounted) list.length = 0;
      }
      if (mounted) {
        setContacts(list);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CRM_PREFS_KEY, JSON.stringify({
        viewMode,
        visibleColumns: Array.from(visibleColumns),
        pageSize
      }));
    } catch {}
  }, [viewMode, visibleColumns, pageSize]);

  useEffect(() => {
    try {
      localStorage.setItem(CRM_CUSTOM_FIELD_DEFS_KEY, JSON.stringify(customFieldDefs));
    } catch {}
  }, [customFieldDefs]);

  useEffect(() => {
    if (!canSeeReminders || !currentUser?.id) {
      setReminders([]);
      return;
    }
    let cancelled = false;
    setRemindersLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('crm_reminders')
        .select('id, contact_id, contact_name, remind_at, title, created_at')
        .eq('user_id', currentUser.id)
        .gte('remind_at', new Date().toISOString());
      if (cancelled) return;
      setRemindersLoading(false);
      if (error) {
        setReminders([]);
        return;
      }
      setReminders((data as CrmReminder[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [canSeeReminders, currentUser?.id]);

  const persistNotesAndActivity = useCallback(async (c: Contact) => {
    if (c.type !== 'hospital' || !(c.facilityId ?? c.id)) return;
    const key = String(c.facilityId ?? c.id);
    const notesLog = c.notesLog ?? [];
    const activityLog = c.activityLog ?? [];
    await supabase.from('hospitals').update({ notes_log: notesLog, activity_log: activityLog }).eq('facility_id', key);
  }, []);

  const addNote = useCallback((c: Contact, entry: NotesLogEntry) => {
    const nextLog = [...(c.notesLog ?? []), entry].sort((a, b) => (b.date.localeCompare(a.date)));
    const updated = { ...c, notesLog: nextLog };
    setContacts(prev => prev.map(x => (x.id === c.id ? updated : x)));
    setDetailContact(prev => (prev?.id === c.id ? updated : prev));
    persistNotesAndActivity(updated);
  }, [persistNotesAndActivity]);

  const addActivityEntry = useCallback((c: Contact, entry: ActivityLogEntry) => {
    const nextLog = [...(c.activityLog ?? []), entry].sort((a, b) => (b.date.localeCompare(a.date)));
    const updated = { ...c, activityLog: nextLog };
    setContacts(prev => prev.map(x => (x.id === c.id ? updated : x)));
    setDetailContact(prev => (prev?.id === c.id ? updated : prev));
    persistNotesAndActivity(updated);
  }, [persistNotesAndActivity]);

  const addReminder = useCallback(async (contactId: string, contactName: string, remind_at: string, title: string) => {
    if (!currentUser?.id) return;
    const { data, error } = await supabase.from('crm_reminders').insert({
      user_id: currentUser.id,
      contact_id: contactId,
      contact_name: contactName || null,
      remind_at: new Date(remind_at).toISOString(),
      title: title || 'Follow up'
    }).select('id, contact_id, contact_name, remind_at, title, created_at').single();
    if (error) return;
    setReminders(prev => [...prev, data as CrmReminder]);
  }, [currentUser?.id]);

  const deleteReminder = useCallback(async (id: string) => {
    await supabase.from('crm_reminders').delete().eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
  }, []);

  const regions = useMemo(() => [...new Set(contacts.map(c => c.region).filter(Boolean))].sort() as string[], [contacts]);
  const states = useMemo(() => [...new Set(contacts.map(c => c.state).filter(Boolean))].sort() as string[], [contacts]);
  const hospitalTypes = useMemo(() => [...new Set(contacts.map(c => c.hospitalType).filter(Boolean))].sort() as string[], [contacts]);

  const filteredAndSortedContacts = useMemo(() => {
    let list = contacts.filter(contact => {
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.firstName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.lastName ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.region || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.hospitalSystem ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (tabValue === 0) {}
      else if (tabValue === 1 && contact.type !== 'organization') return false;
      else if (tabValue === 2 && contact.type !== 'hospital') return false;
      else if (tabValue === 3 && contact.type !== 'manager') return false;
      else if (tabValue === 4 && contact.type !== 'mentor') return false;
      else if (tabValue === 5 && contact.type !== 'pecc') return false;
      else if (tabValue === 6 && contact.type !== 'staff') return false;
      else if (tabValue === 7 && contact.type !== 'other') return false;

      if (statusFilter.length && !statusFilter.includes(contact.status)) return false;
      if (regionFilter.length && !regionFilter.includes(contact.region)) return false;
      if (stateFilter.length && !(contact.state && stateFilter.includes(contact.state))) return false;
      if (hospitalTypeFilter.length && !(contact.hospitalType && hospitalTypeFilter.includes(contact.hospitalType))) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let av: string | number = ((a as unknown as Record<string, unknown>)[sortField] as string | number | undefined) ?? '';
      let bv: string | number = ((b as unknown as Record<string, unknown>)[sortField] as string | number | undefined) ?? '';
      if (sortField === 'name') {
        av = contactDisplayName(a);
        bv = contactDisplayName(b);
      }
      if (sortField === 'createdAt') {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      if (sortField === 'lastName' || sortField === 'firstName') {
        const aOther = sortField === 'lastName' ? (a.firstName ?? '') : (a.lastName ?? '');
        const bOther = sortField === 'lastName' ? (b.firstName ?? '') : (b.lastName ?? '');
        return sortOrder === 'asc' ? aOther.localeCompare(bOther) : bOther.localeCompare(aOther);
      }
      return 0;
    });
    return list;
  }, [contacts, searchQuery, tabValue, sortField, sortOrder, statusFilter, regionFilter, stateFilter, hospitalTypeFilter]);

  const displayedContacts = useMemo(() => {
    if (pageSize === 'all') return filteredAndSortedContacts;
    return filteredAndSortedContacts.slice(0, pageSize);
  }, [filteredAndSortedContacts, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else setSortField(field);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(displayedContacts.map(c => c.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSaveContact = async () => {
    const displayName = isPersonType(formData.type) ? [formData.firstName, formData.lastName].filter(Boolean).join(' ') : formData.name;
    const payload: Contact = {
      id: editingContact?.id ?? `contact_${Date.now()}`,
      type: formData.type,
      name: displayName || formData.name,
      firstName: isPersonType(formData.type) ? formData.firstName : undefined,
      lastName: isPersonType(formData.type) ? formData.lastName : undefined,
      organization: formData.organization,
      email: formData.email,
      phone: formData.phone,
      status: formData.status,
      region: formData.region,
      notes: formData.notes,
      hospitalSystem: formData.type === 'hospital' ? formData.hospitalSystem : undefined,
      linkedOrganizationIds: isPersonType(formData.type) ? formData.linkedOrganizationIds : undefined,
      linkedHospitalIds: isPersonType(formData.type) ? formData.linkedHospitalIds : undefined,
      createdAt: editingContact?.createdAt ?? new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      ...(Object.keys(formData.customFields || {}).length ? { customFields: formData.customFields } : {})
    };
    if (editingContact?.type === 'hospital' && (editingContact.facilityId || editingContact.id)) {
      setSaveInProgress(true);
      const key = String(editingContact.facilityId ?? editingContact.id);
      const currentInState = contacts.find(c => c.id === editingContact.id);
      const updatePayload: { region: string | null; custom_fields?: Record<string, string>; notes_log?: NotesLogEntry[]; activity_log?: ActivityLogEntry[]; hospital_system?: string | null } = { region: formData.region || null };
      if (formData.customFields && Object.keys(formData.customFields).length > 0) {
        updatePayload.custom_fields = formData.customFields;
      }
      updatePayload.notes_log = currentInState?.notesLog ?? editingContact.notesLog ?? [];
      updatePayload.activity_log = currentInState?.activityLog ?? editingContact.activityLog ?? [];
      updatePayload.hospital_system = formData.hospitalSystem?.trim() || null;
      const { error } = await supabase
        .from('hospitals')
        .update(updatePayload)
        .eq('facility_id', key);
      setSaveInProgress(false);
      if (error) {
        console.error('Failed to update hospital:', error);
        setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
      } else {
        setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
      }
    } else if (editingContact) {
      setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
    } else {
      setContacts(prev => [...prev, payload]);
    }
    setDialogOpen(false);
    setEditingContact(null);
    setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '', hospitalSystem: '', linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {} });
  };

  const openDetail = (c: Contact) => {
    setDetailContact(c);
    setPanelOpen(true);
  };

  const openFullScreen = () => {
    setPanelOpen(false);
    setFullScreenOpen(true);
  };

  const allExportColumns = useMemo(() => [...EXPORT_COLUMNS, ...customFieldDefs.map(d => ({ id: d.id, label: d.label }))], [customFieldDefs]);

  const runExport = (scope: 'all' | 'selected', columnIds: string[]) => {
    const contactsToExport = scope === 'selected'
      ? filteredAndSortedContacts.filter(c => selectedIds.has(c.id))
      : filteredAndSortedContacts;
    const ids = columnIds.filter(id => allExportColumns.some(col => col.id === id));
    const labels = ids.map(id => allExportColumns.find(col => col.id === id)!.label);
    const valueFor = (c: Contact, id: string): string => {
      if (customFieldDefs.some(d => d.id === id)) return c.customFields?.[id] ?? '';
      if (id === 'type') return TYPE_LABELS[c.type];
      if (id === 'name') return contactDisplayName(c);
      const v = (c as unknown as Record<string, unknown>)[id];
      return v != null ? String(v) : '';
    };
    const rows = contactsToExport.map(c => ids.map(id => valueFor(c, id)));
    const csv = [labels.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `crm-contacts-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    setExportDialogOpen(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter([]);
    setRegionFilter([]);
    setStateFilter([]);
    setHospitalTypeFilter([]);
    setFilterMenuAnchor(null);
  };

  const activeFilterCount = statusFilter.length + regionFilter.length + stateFilter.length + hospitalTypeFilter.length;
  const hasActiveFilters = searchQuery || activeFilterCount > 0;

  const summaryCounts = useMemo(() => ({
    all: contacts.length,
    organization: contacts.filter(c => c.type === 'organization').length,
    hospital: contacts.filter(c => c.type === 'hospital').length,
    manager: contacts.filter(c => c.type === 'manager').length,
    mentor: contacts.filter(c => c.type === 'mentor').length,
    pecc: contacts.filter(c => c.type === 'pecc').length,
    staff: contacts.filter(c => c.type === 'staff').length,
    other: contacts.filter(c => c.type === 'other').length,
    pending: contacts.filter(c => c.status === 'Pending').length
  }), [contacts]);

  const activePendingFilter = statusFilter.includes('Pending') && statusFilter.length === 1 && !searchQuery && regionFilter.length === 0 && stateFilter.length === 0 && hospitalTypeFilter.length === 0;

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    if (detailContact?.id === id) { setPanelOpen(false); setFullScreenOpen(false); setDetailContact(null); }
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleBulkDelete = () => {
    if (!deleteTarget?.bulk) return;
    setContacts(prev => prev.filter(c => !deleteTarget.bulk!.has(c.id)));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeleteConfirmTyped('');
    setSelectedIds(new Set());
    if (detailContact && deleteTarget.bulk.has(detailContact.id)) { setPanelOpen(false); setFullScreenOpen(false); setDetailContact(null); }
  };

  const handleBulkStatusChange = (status: string) => {
    setContacts(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, status } : c));
    setBulkStatusAnchor(null);
  };

  return (
    <Box sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>CRM</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage organizations, hospitals, and contacts
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {canSeeReminders && (
            <Tooltip title="View your follow-up reminders across all contacts">
              <Button startIcon={<NotificationsIcon />} onClick={() => setMyRemindersOpen(true)} size="medium" color={reminders.length > 0 ? 'primary' : 'inherit'}>
                My reminders {reminders.length > 0 ? `(${reminders.length})` : ''}
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Choose columns and export all filtered or selected contacts">
            <Button startIcon={<DownloadIcon />} onClick={() => setExportDialogOpen(true)} size="medium">
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Add or remove custom fields for contacts (Admins only)">
            <Button startIcon={<SettingsIcon />} onClick={() => setCustomFieldsDialogOpen(true)} size="medium" variant="outlined">
              Manage custom fields
            </Button>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingContact(null); setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '', hospitalSystem: '', linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {} }); setDialogOpen(true); }}>
            Add Contact
          </Button>
        </Box>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'all', label: 'All', count: summaryCounts.all },
          { key: 'organization', label: 'Organizations', count: summaryCounts.organization },
          { key: 'hospital', label: 'Hospitals', count: summaryCounts.hospital },
          { key: 'manager', label: 'Managers', count: summaryCounts.manager },
          { key: 'mentor', label: 'Mentors', count: summaryCounts.mentor },
          { key: 'pecc', label: 'PECCs', count: summaryCounts.pecc },
          { key: 'staff', label: 'Staff', count: summaryCounts.staff },
          { key: 'other', label: 'Other', count: summaryCounts.other },
          { key: 'pending', label: 'Pending', count: summaryCounts.pending }
        ].map(({ key, label, count }) => {
          const isPending = key === 'pending';
          const isAll = key === 'all';
          const typeKeys = ['organization', 'hospital', 'manager', 'mentor', 'pecc', 'staff', 'other'];
          const isActive = isPending ? activePendingFilter : isAll ? tabValue === 0 && !activePendingFilter : tabValue > 0 && typeKeys[tabValue - 1] === key;
          const borderColor = isPending ? theme.palette.warning.main : isAll ? theme.palette.primary.main : TYPE_COLORS[key as ContactType] || theme.palette.grey[400];
          return (
            <Grid item xs={6} sm={4} md={2} key={key}>
              <Paper
                onClick={() => {
                  if (isPending) { setTabValue(0); setStatusFilter(['Pending']); }
                  else if (isAll) { setTabValue(0); setStatusFilter([]); }
                  else { setTabValue(typeKeys.indexOf(key) + 1); setStatusFilter([]); }
                }}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderTop: 3,
                  borderColor,
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                }}
              >
                {loading ? (
                  <Skeleton variant="text" width={40} height={36} sx={{ mx: 'auto' }} />
                ) : (
                  <Typography variant="h5" fontWeight={700} sx={{ color: isPending ? 'warning.main' : isAll ? 'primary.main' : TYPE_COLORS[key as ContactType] || 'text.primary' }}>
                    {count}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">{label}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Toolbar: tabs, view mode, search, filters */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="All" />
            <Tab label="Organizations" />
            <Tab label="Hospitals" />
            <Tab label="Managers" />
            <Tab label="Mentors" />
            <Tab label="PECCs" />
            <Tab label="Staff" />
            <Tab label="Other" />
          </Tabs>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: 2 }}>
          <TextField
            size="small"
            placeholder="Search name, email, organization, region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
            }}
            sx={{ minWidth: 280 }}
          />
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
            variant={hasActiveFilters ? 'contained' : 'outlined'}
          >
            Filters {hasActiveFilters ? `(${activeFilterCount})` : ''}
          </Button>
          <Menu anchorEl={filterMenuAnchor} open={Boolean(filterMenuAnchor)} onClose={() => setFilterMenuAnchor(null)} PaperProps={{ sx: { maxHeight: 400 } }}>
            <ListItem dense>
              <ListItemText primary="Status" secondary={statusFilter.join(', ') || 'Any'} />
            </ListItem>
            {['Active', 'Inactive', 'Pending'].map(s => (
              <MenuItem key={s} onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>
                <Checkbox checked={statusFilter.includes(s)} size="small" />
                <ListItemText primary={s} />
              </MenuItem>
            ))}
            <Divider />
            <ListItem dense>
              <ListItemText primary="State" secondary={stateFilter.join(', ') || 'Any'} />
            </ListItem>
            {states.map(st => (
              <MenuItem key={st} onClick={() => setStateFilter(prev => prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st])}>
                <Checkbox checked={stateFilter.includes(st)} size="small" />
                <ListItemText primary={st || '(blank)'} />
              </MenuItem>
            ))}
            <Divider />
            <ListItem dense>
              <ListItemText primary="Region" secondary={regionFilter.join(', ') || 'Any'} />
            </ListItem>
            {regions.map(r => (
              <MenuItem key={r} onClick={() => setRegionFilter(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}>
                <Checkbox checked={regionFilter.includes(r)} size="small" />
                <ListItemText primary={r || '(blank)'} />
              </MenuItem>
            ))}
            <Divider />
            <ListItem dense>
              <ListItemText primary="Hospital type" secondary={hospitalTypeFilter.join(', ') || 'Any'} />
            </ListItem>
            {hospitalTypes.map(ht => (
              <MenuItem key={ht} onClick={() => setHospitalTypeFilter(prev => prev.includes(ht) ? prev.filter(x => x !== ht) : [...prev, ht])}>
                <Checkbox checked={hospitalTypeFilter.includes(ht)} size="small" />
                <ListItemText primary={ht || '(blank)'} />
              </MenuItem>
            ))}
            <MenuItem onClick={clearFilters}><ClearIcon fontSize="small" sx={{ mr: 1 }} /> Clear filters</MenuItem>
          </Menu>
          <Button size="small" startIcon={<ViewColumnIcon />} onClick={(e) => setColumnMenuAnchor(e.currentTarget)} variant="outlined">
            Columns
          </Button>
          <Menu anchorEl={columnMenuAnchor} open={Boolean(columnMenuAnchor)} onClose={() => setColumnMenuAnchor(null)}>
            {COLUMNS.filter(c => c.id !== 'actions').map((col) => (
              <MenuItem
                key={col.id}
                onClick={() => setVisibleColumns(prev => { const n = new Set(prev); if (n.has(col.id)) n.delete(col.id); else n.add(col.id); return n; })}
              >
                <Checkbox checked={visibleColumns.has(col.id)} size="small" />
                <ListItemText primary={col.label} />
              </MenuItem>
            ))}
          </Menu>
          <Button size="small" startIcon={<TableIcon />} onClick={() => setViewMode('table')} variant={viewMode === 'table' ? 'contained' : 'outlined'}>
            Table
          </Button>
          <Button size="small" startIcon={<GridIcon />} onClick={() => setViewMode('grid')} variant={viewMode === 'grid' ? 'contained' : 'outlined'}>
            Cards
          </Button>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} displayEmpty variant="outlined">
              {PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={String(n)} value={n}>{n === 'all' ? 'All' : n}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          {selectedIds.size > 0 && (
            <Chip label={`${selectedIds.size} selected`} onDelete={() => setSelectedIds(new Set())} sx={{ mr: 1 }} />
          )}
          <Typography variant="body2" color="text.secondary">
            {filteredAndSortedContacts.length === 0 ? '0 contacts' : pageSize === 'all' ? `${filteredAndSortedContacts.length} contact${filteredAndSortedContacts.length !== 1 ? 's' : ''}` : `Showing 1–${displayedContacts.length} of ${filteredAndSortedContacts.length}`}
          </Typography>
        </Box>
      </Paper>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Paper sx={{ mb: 2, py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: alpha(theme.palette.primary.main, 0.06), border: '1px solid', borderColor: 'primary.main' }}>
          <Chip label={`${selectedIds.size} selected`} color="primary" onDelete={() => setSelectedIds(new Set())} />
          <Button size="small" variant="outlined" startIcon={<FilterIcon />} onClick={(e) => setBulkStatusAnchor(e.currentTarget)}>
            Change status
          </Button>
          <Menu anchorEl={bulkStatusAnchor} open={Boolean(bulkStatusAnchor)} onClose={() => setBulkStatusAnchor(null)}>
            {['Active', 'Inactive', 'Pending'].map(s => (
              <MenuItem key={s} onClick={() => handleBulkStatusChange(s)}>{s}</MenuItem>
            ))}
          </Menu>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => { setDeleteConfirmTyped(''); setDeleteTarget({ bulk: new Set(selectedIds) }); setDeleteConfirmOpen(true); }}>
            Delete selected
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
        </Paper>
      )}

      {/* Content */}
      {loading ? (
        <Paper sx={{ p: 4 }}>
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5].map(i => (
              <Grid item xs={12} key={i}><Skeleton variant="rectangular" height={52} /></Grid>
            ))}
          </Grid>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {filteredAndSortedContacts.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ py: 10, px: 3, textAlign: 'center' }}>
                <ContactsIcon sx={{ fontSize: 80, color: 'action.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto', mb: 3 }}>
                  {hasActiveFilters ? 'Try clearing filters or search, or add a new contact.' : 'Add organizations, hospitals, and people to build your CRM.'}
                </Typography>
                <Button startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setEditingContact(null); setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '', hospitalSystem: '', linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {} }); }} variant="contained" size="large">
                  {hasActiveFilters ? 'Add contact' : 'Add your first contact'}
                </Button>
              </Paper>
            </Grid>
          ) : (
            displayedContacts.map((contact) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={contact.id}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 },
                    borderLeft: 4,
                    borderColor: TYPE_COLORS[contact.type]
                  }}
                  onClick={() => openDetail(contact)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Avatar sx={{ bgcolor: TYPE_COLORS[contact.type], width: 40, height: 40 }}>
                      {(contactDisplayName(contact) || '?')[0].toUpperCase()}
                    </Avatar>
                    <Chip label={TYPE_LABELS[contact.type]} size="small" sx={{ bgcolor: alpha(TYPE_COLORS[contact.type], 0.2), color: TYPE_COLORS[contact.type] }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600} noWrap>{contactDisplayName(contact)}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{contact.organization || '—'}</Typography>
                  <Typography variant="body2" noWrap sx={{ mt: 0.5 }}>{contact.email}</Typography>
                  <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : 'default'} sx={{ mt: 1 }} />
                </Paper>
              </Grid>
            ))
          )}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={displayedContacts.length > 0 && selectedIds.size === displayedContacts.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < displayedContacts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                {COLUMNS.filter(c => c.id !== 'actions' && visibleColumns.has(c.id)).map((col) => (
                  <TableCell key={col.id}>
                    {col.sortable ? (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort(col.id as SortField)}>
                        {col.label}
                        <SortIcon sx={{ fontSize: 16, ml: 0.5, opacity: sortField === col.id ? 1 : 0.4 }} />
                        {sortField === col.id && <Typography component="span" variant="caption" sx={{ ml: 0.25 }}>({sortOrder})</Typography>}
                      </Box>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
                {visibleColumns.has('actions') && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 10 }}>
                    <ContactsIcon sx={{ fontSize: 64, color: 'action.disabled', display: 'block', mx: 'auto', mb: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
                    </Typography>
                    <Button startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setEditingContact(null); setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '', hospitalSystem: '', linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {} }); }} variant="contained" sx={{ mt: 2 }}>
                      {hasActiveFilters ? 'Add contact' : 'Add your first contact'}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                displayedContacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDetail(contact)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onChange={(e) => handleSelectOne(contact.id, e.target.checked)}
                      />
                    </TableCell>
                    {visibleColumns.has('firstName') && (
                      <TableCell>
                        <Typography fontWeight={500}>{isPersonType(contact.type) ? (contact.firstName ?? '—') : (contact.type === 'organization' || contact.type === 'hospital' ? contact.name : '—')}</Typography>
                      </TableCell>
                    )}
                    {visibleColumns.has('lastName') && (
                      <TableCell>
                        <Typography fontWeight={500}>{isPersonType(contact.type) ? (contact.lastName ?? '—') : '—'}</Typography>
                      </TableCell>
                    )}
                    {visibleColumns.has('name') && (
                      <TableCell>
                        <Typography fontWeight={500}>{contactDisplayName(contact)}</Typography>
                      </TableCell>
                    )}
                    {visibleColumns.has('type') && (
                      <TableCell>
                        <Chip label={TYPE_LABELS[contact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[contact.type], color: 'white' }} />
                      </TableCell>
                    )}
                    {visibleColumns.has('facilityId') && <TableCell>{contact.facilityId ?? '—'}</TableCell>}
                    {visibleColumns.has('organization') && <TableCell>{contact.organization || '—'}</TableCell>}
                    {visibleColumns.has('hospitalSystem') && <TableCell>{contact.hospitalSystem ?? '—'}</TableCell>}
                    {visibleColumns.has('email') && <TableCell>{contact.email}</TableCell>}
                    {visibleColumns.has('phone') && <TableCell>{contact.phone || '—'}</TableCell>}
                    {visibleColumns.has('region') && <TableCell>{contact.region || '—'}</TableCell>}
                    {visibleColumns.has('state') && <TableCell>{contact.state ?? '—'}</TableCell>}
                    {visibleColumns.has('status') && (
                      <TableCell>
                        <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                    )}
                    {visibleColumns.has('createdAt') && <TableCell>{contact.createdAt}</TableCell>}
                    {visibleColumns.has('actions') && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); setDetailContact(contact); }}>
                          <MoreIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Row actions menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { if (detailContact) openDetail(detailContact); setAnchorEl(null); }}>View details</MenuItem>
        <MenuItem onClick={() => { if (detailContact) { setEditingContact(detailContact); setFormData({ type: detailContact.type, name: detailContact.name, firstName: detailContact.firstName ?? '', lastName: detailContact.lastName ?? '', organization: detailContact.organization, email: detailContact.email, phone: detailContact.phone, status: detailContact.status, region: detailContact.region, notes: detailContact.notes, hospitalSystem: detailContact.hospitalSystem ?? '', linkedOrganizationIds: detailContact.linkedOrganizationIds ?? [], linkedHospitalIds: detailContact.linkedHospitalIds ?? [], customFields: detailContact.customFields ?? {} }); setDialogOpen(true); } setAnchorEl(null); }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><EmailIcon fontSize="small" sx={{ mr: 1 }} /> Email</MenuItem>
        <MenuItem onClick={() => { if (detailContact) { setDeleteTarget({ single: detailContact.id }); setDeleteConfirmOpen(true); } setAnchorEl(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); setDeleteConfirmTyped(''); }}>
        <DialogTitle>
          {deleteTarget?.bulk ? `Delete ${deleteTarget.bulk.size} contacts?` : 'Delete contact?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {deleteTarget?.bulk
              ? 'These contacts will be removed. This cannot be undone.'
              : 'This contact will be removed. This cannot be undone.'}
          </Typography>
          {deleteTarget?.bulk && (
            <TextField
              autoFocus
              fullWidth
              size="small"
              label='Type DELETE to confirm'
              value={deleteConfirmTyped}
              onChange={(e) => setDeleteConfirmTyped(e.target.value)}
              placeholder="DELETE"
              sx={{ mt: 2 }}
              error={deleteConfirmTyped.length > 0 && deleteConfirmTyped !== 'DELETE'}
              helperText={deleteConfirmTyped.length > 0 && deleteConfirmTyped !== 'DELETE' ? 'Must type exactly DELETE' : undefined}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); setDeleteConfirmTyped(''); }}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => { if (deleteTarget?.single) handleDeleteContact(deleteTarget.single); else if (deleteTarget?.bulk && deleteConfirmTyped === 'DELETE') handleBulkDelete(); }}
            disabled={Boolean(deleteTarget?.bulk) && deleteConfirmTyped !== 'DELETE'}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* My reminders – per-user, Mentor/Manager/Admin only */}
      <Dialog open={myRemindersOpen} onClose={() => setMyRemindersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>My follow-up reminders</DialogTitle>
        <DialogContent>
          {remindersLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : reminders.length === 0 ? (
            <Typography color="text.secondary">No upcoming reminders. Add reminders from a contact&#39;s full view.</Typography>
          ) : (
            <List dense>
              {reminders.map((r) => (
                <ListItem
                  key={r.id}
                  secondaryAction={<IconButton size="small" onClick={() => deleteReminder(r.id)}><DeleteIcon fontSize="small" /></IconButton>}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    const c = contacts.find(x => x.id === r.contact_id);
                    if (c) { setDetailContact(c); setPanelOpen(false); setMyRemindersOpen(false); setFullScreenOpen(true); }
                  }}
                >
                  <ListItemText primary={r.title || 'Follow up'} secondary={`${r.contact_name || r.contact_id} · ${new Date(r.remind_at).toLocaleString()}`} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMyRemindersOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Right-side quick-view panel */}
      <Drawer anchor="right" open={panelOpen} onClose={() => setPanelOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 380 } } }}>
        {detailContact && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Quick view</Typography>
              <IconButton size="small" onClick={() => setPanelOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Avatar sx={{ width: 48, height: 48, bgcolor: TYPE_COLORS[detailContact.type], fontSize: '1.125rem' }}>
                {(contactDisplayName(detailContact) || '?')[0].toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} noWrap>{contactDisplayName(detailContact)}</Typography>
                <Chip label={TYPE_LABELS[detailContact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[detailContact.type], color: 'white', mt: 0.5 }} />
              </Box>
            </Box>
            <List dense disablePadding sx={{ flex: 1, minHeight: 0 }}>
              {detailContact.type === 'hospital' && detailContact.facilityId != null && (
                <ListItem disablePadding><ListItemText primary="Facility ID" secondary={detailContact.facilityId} /></ListItem>
              )}
              {detailContact.type === 'hospital' && (detailContact.hospitalSystem ?? '') && (
                <ListItem disablePadding><ListItemText primary="Hospital system" secondary={detailContact.hospitalSystem} /></ListItem>
              )}
              <ListItem disablePadding><ListItemText primary="Organization" secondary={detailContact.organization || '—'} /></ListItem>
              <ListItem disablePadding><ListItemText primary="Region" secondary={detailContact.region || '—'} /></ListItem>
              <ListItem disablePadding><ListItemText primary="State" secondary={detailContact.state ?? '—'} /></ListItem>
              <ListItem disablePadding><ListItemText primary="Status" secondary={detailContact.status} /></ListItem>
              {detailContact.customFields && Object.keys(detailContact.customFields).length > 0 && customFieldDefs.filter(d => d.applicableTypes.includes(detailContact.type)).length > 0 && (
                <>
                  {customFieldDefs.filter(d => d.applicableTypes.includes(detailContact.type) && detailContact.customFields![d.id]).map((d) => (
                    <ListItem key={d.id} disablePadding><ListItemText primary={d.label} secondary={d.fieldType === 'checkbox' ? (detailContact.customFields![d.id] === 'true' ? 'Yes' : 'No') : (detailContact.customFields![d.id] || '—')} /></ListItem>
                  ))}
                </>
              )}
              {(detailContact.notesLog?.length ?? 0) > 0 && (
                <ListItem disablePadding>
                  <ListItemText primary="Notes log" secondary={`${detailContact.notesLog!.length} dated note(s). Expand for full log.`} />
                </ListItem>
              )}
              {(detailContact.activityLog?.length ?? 0) > 0 && (
                <ListItem disablePadding>
                  <ListItemText primary="Activity log" secondary={`${detailContact.activityLog!.length} communication/visit/follow-up entries. Expand for full log.`} />
                </ListItem>
              )}
              {canSeeReminders && (reminders.filter(r => r.contact_id === detailContact.id).length > 0) && (
                <ListItem disablePadding>
                  <ListItemText primary="My reminders" secondary={`${reminders.filter(r => r.contact_id === detailContact.id).length} upcoming for this contact.`} />
                </ListItem>
              )}
              {(detailContact.type === 'organization' || detailContact.type === 'hospital') && (() => {
                const linked = contacts.filter(p => isPersonType(p.type) && (
                  (p.linkedOrganizationIds ?? []).includes(detailContact.id) ||
                  (p.linkedHospitalIds ?? []).includes(detailContact.id)
                ));
                return linked.length > 0 ? (
                  <ListItem disablePadding>
                    <ListItemText primary="Contacts" secondary={`${linked.length} person(s) linked. Expand for full view.`} />
                  </ListItem>
                ) : null;
              })()}
            </List>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button fullWidth variant="contained" startIcon={<OpenInFullIcon />} onClick={openFullScreen}>
                Expand to full view
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<EditIcon />} fullWidth onClick={() => {
                  const c = detailContact;
                  setFormData({ type: c.type, name: c.name, firstName: c.firstName ?? '', lastName: c.lastName ?? '', organization: c.organization, email: c.email, phone: c.phone, status: c.status, region: c.region, notes: c.notes, hospitalSystem: c.hospitalSystem ?? '', linkedOrganizationIds: c.linkedOrganizationIds ?? [], linkedHospitalIds: c.linkedHospitalIds ?? [], customFields: c.customFields ?? {} });
                  setPanelOpen(false);
                  setTimeout(() => { setEditingContact(c); setDialogOpen(true); }, 150);
                }}>
                  Edit
                </Button>
                <Button size="small" variant="outlined" startIcon={<EmailIcon />} fullWidth>Email</Button>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Contact detail – full-screen popup (opened via Expand) */}
      <Dialog fullScreen open={fullScreenOpen} onClose={() => setFullScreenOpen(false)}>
        {detailContact && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">Contact</Typography>
              <IconButton onClick={() => setFullScreenOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: TYPE_COLORS[detailContact.type], fontSize: '1.5rem' }}>
                  {(contactDisplayName(detailContact) || '?')[0].toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h5">{contactDisplayName(detailContact)}</Typography>
                  <Chip label={TYPE_LABELS[detailContact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[detailContact.type], color: 'white', mt: 0.5 }} />
                </Box>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Details</Typography>
                  <List dense disablePadding>
                    {detailContact.type === 'hospital' && (
                      <>
                        {detailContact.facilityId != null && (
                          <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><BusinessIcon fontSize="small" /></ListItemIcon><ListItemText primary="Facility ID" secondary={detailContact.facilityId} /></ListItem>
                        )}
                        {(detailContact.hospitalSystem ?? '') && (
                          <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><BusinessIcon fontSize="small" /></ListItemIcon><ListItemText primary="Hospital system" secondary={detailContact.hospitalSystem} /></ListItem>
                        )}
                        {detailContact.address != null && <ListItem disablePadding><ListItemText primary="Address" secondary={detailContact.address} /></ListItem>}
                        {detailContact.city != null && <ListItem disablePadding><ListItemText primary="City" secondary={detailContact.city} /></ListItem>}
                        {(detailContact.state != null || detailContact.zip != null) && (
                          <ListItem disablePadding><ListItemText primary="State / ZIP" secondary={[detailContact.state, detailContact.zip].filter(Boolean).join(' ') || '—'} /></ListItem>
                        )}
                        {detailContact.county != null && <ListItem disablePadding><ListItemText primary="County" secondary={detailContact.county} /></ListItem>}
                        {detailContact.hospitalType != null && <ListItem disablePadding><ListItemText primary="Hospital type" secondary={detailContact.hospitalType} /></ListItem>}
                        {detailContact.ownership != null && <ListItem disablePadding><ListItemText primary="Ownership" secondary={detailContact.ownership} /></ListItem>}
                      </>
                    )}
                    <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><BusinessIcon fontSize="small" /></ListItemIcon><ListItemText primary="Organization" secondary={detailContact.organization || '—'} /></ListItem>
                    <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><EmailIcon fontSize="small" /></ListItemIcon><ListItemText primary="Email" secondary={detailContact.email} /></ListItem>
                    <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><PhoneIcon fontSize="small" /></ListItemIcon><ListItemText primary="Phone" secondary={detailContact.phone || '—'} /></ListItem>
                    <ListItem disablePadding><ListItemText primary="Region" secondary={detailContact.region || '—'} /></ListItem>
                    <ListItem disablePadding><ListItemText primary="Status" secondary={detailContact.status} /></ListItem>
                    <ListItem disablePadding><ListItemText primary="Added" secondary={detailContact.createdAt} /></ListItem>
                    {detailContact.customFields && Object.keys(detailContact.customFields).length > 0 && customFieldDefs.filter(d => d.applicableTypes.includes(detailContact.type) && detailContact.customFields![d.id]).map((d) => (
                      <ListItem key={d.id} disablePadding><ListItemText primary={d.label} secondary={d.fieldType === 'checkbox' ? (detailContact.customFields![d.id] === 'true' ? 'Yes' : 'No') : (detailContact.customFields![d.id] || '—')} /></ListItem>
                    ))}
                  </List>
                  {(detailContact.type === 'organization' || detailContact.type === 'hospital') && (() => {
                    const linked = contacts.filter(p => isPersonType(p.type) && (
                      (p.linkedOrganizationIds ?? []).includes(detailContact.id) || (p.linkedHospitalIds ?? []).includes(detailContact.id)
                    ));
                    return linked.length > 0 ? (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Contacts at this {detailContact.type === 'hospital' ? 'hospital' : 'organization'}</Typography>
                        <List dense disablePadding>
                          {linked.map((p) => (
                            <ListItem key={p.id} disablePadding sx={{ py: 0.25, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => { setDetailContact(p); setFullScreenOpen(false); setPanelOpen(true); }}>
                              <ListItemText primary={contactDisplayName(p)} secondary={TYPE_LABELS[p.type]} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    ) : null;
                  })()}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Notes log</Typography>
                  <Paper variant="outlined" sx={{ p: 2, minHeight: 120, maxHeight: 220, overflow: 'auto' }}>
                    {(detailContact.notesLog?.length ?? 0) === 0 ? (
                      <Typography variant="body2" color="text.secondary">No dated notes yet.</Typography>
                    ) : (
                      <List dense disablePadding>
                        {(detailContact.notesLog ?? []).map((e, i) => (
                          <ListItem key={i} disablePadding sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">{e.date}</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{e.text}</Typography>
                          </ListItem>
                        ))}
                      </List>
                    )}
                    <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField size="small" placeholder="Add note…" value={addNoteText} onChange={(e) => setAddNoteText(e.target.value)} multiline minRows={1} maxRows={3} sx={{ flex: 1 }} />
                      <Button size="small" variant="contained" onClick={() => { if (addNoteText.trim()) { addNote(detailContact, { date: new Date().toISOString().slice(0, 10), text: addNoteText.trim() }); setAddNoteText(''); } }}>Add</Button>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Activity log (communications, visits, follow-ups)</Typography>
                  <Paper variant="outlined" sx={{ p: 2, minHeight: 120, maxHeight: 260, overflow: 'auto' }}>
                    {(detailContact.activityLog?.length ?? 0) === 0 ? (
                      <Typography variant="body2" color="text.secondary">No activity entries yet.</Typography>
                    ) : (
                      <List dense disablePadding>
                        {(detailContact.activityLog ?? []).map((e, i) => (
                          <ListItem key={i} disablePadding sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 0.5 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip size="small" label={ACTIVITY_TYPE_LABELS[e.type]} sx={{ fontSize: '0.7rem' }} />
                              <Typography variant="caption" color="text.secondary">{e.date}</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{e.text}</Typography>
                          </ListItem>
                        ))}
                      </List>
                    )}
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel>Type</InputLabel>
                          <Select value={addActivityType} onChange={(e) => setAddActivityType(e.target.value as ActivityLogType)} label="Type">
                            {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityLogType[]).map(t => (
                              <MenuItem key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField size="small" type="date" value={addActivityDate || new Date().toISOString().slice(0, 10)} onChange={(e) => setAddActivityDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 140 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                        <TextField size="small" placeholder="Details…" value={addActivityText} onChange={(e) => setAddActivityText(e.target.value)} multiline minRows={1} maxRows={2} sx={{ flex: 1 }} />
                        <Button size="small" variant="contained" onClick={() => { if (addActivityText.trim()) { addActivityEntry(detailContact, { type: addActivityType, date: (addActivityDate || new Date().toISOString().slice(0, 10)), text: addActivityText.trim() }); setAddActivityText(''); } }}>Add</Button>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                {canSeeReminders && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>My follow-up reminders (this contact)</Typography>
                    <Paper variant="outlined" sx={{ p: 2, minHeight: 120, maxHeight: 260, overflow: 'auto' }}>
                      {reminders.filter(r => r.contact_id === detailContact.id).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No reminders for this contact.</Typography>
                      ) : (
                        <List dense disablePadding>
                          {reminders.filter(r => r.contact_id === detailContact.id).map((r) => (
                            <ListItem key={r.id} disablePadding secondaryAction={<IconButton size="small" onClick={() => deleteReminder(r.id)}><DeleteIcon fontSize="small" /></IconButton>}>
                              <ListItemText primary={r.title || 'Follow up'} secondary={`${new Date(r.remind_at).toLocaleDateString()} ${new Date(r.remind_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`} />
                            </ListItem>
                          ))}
                        </List>
                      )}
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextField size="small" type="datetime-local" value={addReminderDate} onChange={(e) => setAddReminderDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 200 }} />
                        <TextField size="small" placeholder="Reminder title" value={addReminderTitle} onChange={(e) => setAddReminderTitle(e.target.value)} sx={{ minWidth: 140 }} />
                        <Button size="small" variant="contained" onClick={() => { const d = addReminderDate || new Date(Date.now() + 86400000).toISOString().slice(0, 16); addReminder(detailContact.id, contactDisplayName(detailContact), d, addReminderTitle || 'Follow up'); setAddReminderTitle(''); }}>Add reminder</Button>
                      </Box>
                    </Paper>
                  </Grid>
                )}
              </Grid>
              <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => {
                  const c = detailContact;
                  setFormData({ type: c.type, name: c.name, firstName: c.firstName ?? '', lastName: c.lastName ?? '', organization: c.organization, email: c.email, phone: c.phone, status: c.status, region: c.region, notes: c.notes, hospitalSystem: c.hospitalSystem ?? '', linkedOrganizationIds: c.linkedOrganizationIds ?? [], linkedHospitalIds: c.linkedHospitalIds ?? [], customFields: c.customFields ?? {} });
                  setFullScreenOpen(false);
                  setTimeout(() => { setEditingContact(c); setDialogOpen(true); }, 150);
                }}>
                  Edit
                </Button>
                <Button variant="contained" startIcon={<EmailIcon />}>Email</Button>
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingContact(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as ContactType }))} label="Type">
                  {Object.entries(TYPE_LABELS).map(([val, label]) => <MenuItem key={val} value={val}>{label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {formData.type === 'organization' ? (
              <Grid item xs={12}>
                <TextField label="Organization name" value={formData.name} onChange={(e) => { const v = e.target.value; setFormData(prev => ({ ...prev, name: v, organization: v })); }} fullWidth size="small" required />
              </Grid>
            ) : isPersonType(formData.type) ? (
              <>
                <Grid item xs={6}>
                  <TextField label="First name" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} fullWidth size="small" required />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Last name" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} fullWidth size="small" required />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    size="small"
                    options={contacts.filter(c => c.type === 'organization').map(c => ({ id: c.id, label: c.name }))}
                    value={formData.linkedOrganizationIds.map(id => contacts.find(c => c.id === id)).filter(Boolean).map(c => ({ id: c!.id, label: c!.name }))}
                    getOptionLabel={(opt) => opt.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, arr) => setFormData(prev => ({ ...prev, linkedOrganizationIds: arr.map(x => x.id) }))}
                    renderInput={(params) => <TextField {...params} label="Linked organizations" placeholder="Select organizations" />}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    size="small"
                    options={contacts.filter(c => c.type === 'hospital').map(c => ({ id: c.id, label: c.name }))}
                    value={formData.linkedHospitalIds.map(id => contacts.find(c => c.id === id)).filter(Boolean).map(c => ({ id: c!.id, label: c!.name }))}
                    getOptionLabel={(opt) => opt.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, arr) => setFormData(prev => ({ ...prev, linkedHospitalIds: arr.map(x => x.id) }))}
                    renderInput={(params) => <TextField {...params} label="Linked hospitals" placeholder="Select hospitals" />}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12}>
                  <TextField label="Hospital name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} fullWidth size="small" required />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Company / Parent organization" value={formData.organization} onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))} fullWidth size="small" placeholder="e.g. health system or owner" />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Hospital system" value={formData.hospitalSystem} onChange={(e) => setFormData(prev => ({ ...prev, hospitalSystem: e.target.value }))} fullWidth size="small" placeholder="Health system or network this hospital is part of" />
                </Grid>
              </>
            )}
            <Grid item xs={6}>
              <TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <Autocomplete
                freeSolo
                size="small"
                options={regions}
                value={formData.region || null}
                inputValue={formData.region}
                onInputChange={(_, v) => setFormData(prev => ({ ...prev, region: v }))}
                onChange={(_, v) => setFormData(prev => ({ ...prev, region: v == null ? '' : String(v) }))}
                renderInput={(params) => <TextField {...params} label="Region" placeholder="Select or type new" />}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} label="Status">
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} fullWidth size="small" multiline rows={3} />
            </Grid>
            {customFieldDefs.filter(d => d.applicableTypes.includes(formData.type)).length > 0 && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ mt: 1 }} />
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>Custom fields</Typography>
                </Grid>
                {customFieldDefs.filter(d => d.applicableTypes.includes(formData.type)).map((def) => (
                  <Grid item xs={12} key={def.id}>
                    {def.fieldType === 'checkbox' && (
                      <FormControlLabel
                        control={<Checkbox size="small" checked={((formData.customFields || {})[def.id] ?? '') === 'true'} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.checked ? 'true' : 'false' } }))} />}
                        label={def.label}
                      />
                    )}
                    {def.fieldType === 'radio' && (
                      <FormControl fullWidth size="small">
                        <Typography variant="body2" sx={{ mb: 0.5 }}>{def.label}</Typography>
                        <RadioGroup row value={((formData.customFields || {})[def.id] ?? '')} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))}>
                          {(def.options ?? []).map((opt) => (
                            <FormControlLabel key={opt} value={opt} control={<Radio size="small" />} label={opt} />
                          ))}
                          {(!def.options || def.options.length === 0) && <Typography variant="caption" color="text.secondary">Add options in Manage custom fields</Typography>}
                        </RadioGroup>
                      </FormControl>
                    )}
                    {def.fieldType === 'date' && (
                      <TextField label={def.label} type="date" value={((formData.customFields || {})[def.id] ?? '').slice(0, 10)} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" InputLabelProps={{ shrink: true }} />
                    )}
                    {def.fieldType === 'numeric' && (
                      <TextField label={def.label} type="number" value={(formData.customFields || {})[def.id] ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" inputProps={{ inputMode: 'numeric' }} />
                    )}
                    {def.fieldType === 'short_answer' && (
                      <TextField label={def.label} value={(formData.customFields || {})[def.id] ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" />
                    )}
                    {def.fieldType === 'paragraph' && (
                      <TextField label={def.label} multiline rows={3} value={(formData.customFields || {})[def.id] ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" />
                    )}
                    {(def.fieldType === 'dropdown' || def.fieldType === 'dropdown_csv') && (
                      <FormControl fullWidth size="small">
                        <InputLabel>{def.label}</InputLabel>
                        <Select value={((formData.customFields || {})[def.id] ?? '')} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} label={def.label}>
                          <MenuItem value=""><em>—</em></MenuItem>
                          {(def.options ?? []).map((opt) => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                          ))}
                          {(!def.options || def.options.length === 0) && <MenuItem value="" disabled>Add options in Manage custom fields</MenuItem>}
                        </Select>
                      </FormControl>
                    )}
                  </Grid>
                ))}
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setEditingContact(null); }}>Cancel</Button>
          <Button onClick={() => handleSaveContact()} variant="contained" disabled={saveInProgress}>{saveInProgress ? 'Saving…' : (editingContact ? 'Save changes' : 'Save contact')}</Button>
        </DialogActions>
      </Dialog>

      {/* Manage custom fields (Admins only) */}
      <Dialog open={customFieldsDialogOpen} onClose={() => { setCustomFieldsDialogOpen(false); setEditingDefId(null); setNewDefLabel(''); setNewDefApplicableTypes(['hospital']); setNewDefFieldType('short_answer'); setNewDefOptions(''); setCsvUploadError(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Manage custom fields</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define fields and which contact types they apply to (e.g. trauma level for hospitals only). Values are saved per contact.
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <TextField size="small" label="Field label" value={newDefLabel} onChange={(e) => setNewDefLabel(e.target.value)} fullWidth placeholder="e.g. Trauma center level" />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Applies to</Typography>
              <FormGroup row>
                {CONTACT_TYPES.map((t) => (
                  <FormControlLabel
                    key={t}
                    control={<Checkbox size="small" checked={newDefApplicableTypes.includes(t)} onChange={(e) => setNewDefApplicableTypes(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t))} />}
                    label={TYPE_LABELS[t]}
                  />
                ))}
              </FormGroup>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Field type</InputLabel>
                <Select value={newDefFieldType} onChange={(e) => { setNewDefFieldType(e.target.value as CustomFieldType); setNewDefOptions(''); setCsvUploadError(null); }} label="Field type">
                  {(Object.keys(CUSTOM_FIELD_TYPE_LABELS) as CustomFieldType[]).map((ft) => (
                    <MenuItem key={ft} value={ft}>{CUSTOM_FIELD_TYPE_LABELS[ft]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {OPTIONS_FIELD_TYPES.includes(newDefFieldType) && (
              <Grid item xs={12}>
                {newDefFieldType === 'dropdown_csv' ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Upload CSV or paste (first column = options)</Typography>
                    <TextField size="small" multiline rows={3} fullWidth value={newDefOptions} onChange={(e) => setNewDefOptions(e.target.value)} placeholder="Paste CSV here, one value per line or comma-separated. Or use file upload below." />
                    <Button component="label" size="small" sx={{ mt: 1 }}>Choose CSV file
                      <input type="file" accept=".csv,.txt" hidden onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setCsvUploadError(null);
                        const r = new FileReader();
                        r.onload = () => {
                          const text = String(r.result ?? '');
                          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                          const opts = lines.flatMap(l => l.split(',').map(c => c.trim()).filter(Boolean));
                          setNewDefOptions(opts.join('\n'));
                        };
                        r.onerror = () => setCsvUploadError('Could not read file');
                        r.readAsText(f);
                      }} />
                    </Button>
                    {csvUploadError && <Typography color="error" variant="caption" display="block">{csvUploadError}</Typography>}
                  </Box>
                ) : (
                  <TextField size="small" multiline rows={3} fullWidth label="Options (one per line)" value={newDefOptions} onChange={(e) => setNewDefOptions(e.target.value)} placeholder="Option 1&#10;Option 2&#10;Option 3" />
                )}
              </Grid>
            )}
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  if (!newDefLabel.trim() || newDefApplicableTypes.length === 0) return;
                  const opts = newDefOptions.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
                  const def: CustomFieldDefinition = { id: editingDefId ?? `cf_${Date.now()}`, label: newDefLabel.trim(), applicableTypes: newDefApplicableTypes, fieldType: newDefFieldType, options: opts.length ? opts : undefined };
                  if (editingDefId) {
                    setCustomFieldDefs(prev => prev.map(d => d.id === editingDefId ? def : d));
                    setEditingDefId(null);
                  } else {
                    setCustomFieldDefs(prev => [...prev, def]);
                  }
                  setNewDefLabel(''); setNewDefApplicableTypes(['hospital']); setNewDefFieldType('short_answer'); setNewDefOptions('');
                }}
              >
                {editingDefId ? 'Update field' : 'Add field'}
              </Button>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Existing fields</Typography>
          <List dense>
            {customFieldDefs.map((def) => (
              <ListItem key={def.id} secondaryAction={<><IconButton size="small" onClick={() => { setEditingDefId(def.id); setNewDefLabel(def.label); setNewDefApplicableTypes(def.applicableTypes.length ? def.applicableTypes : ['hospital']); setNewDefFieldType(def.fieldType); setNewDefOptions((def.options ?? []).join('\n')); }}><EditIcon fontSize="small" /></IconButton><IconButton size="small" onClick={() => setCustomFieldDefs(prev => prev.filter(d => d.id !== def.id))}><DeleteIcon fontSize="small" /></IconButton></>}>
                <ListItemText primary={def.label} secondary={`${CUSTOM_FIELD_TYPE_LABELS[def.fieldType]} · ${def.applicableTypes.map(t => TYPE_LABELS[t]).join(', ')}`} />
              </ListItem>
            ))}
            {customFieldDefs.length === 0 && <ListItem><ListItemText primary="No custom fields yet. Use the form above to add one." /></ListItem>}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCustomFieldsDialogOpen(false); setEditingDefId(null); setNewDefLabel(''); setNewDefApplicableTypes(['hospital']); setNewDefFieldType('short_answer'); setNewDefOptions(''); }}>Done</Button>
        </DialogActions>
      </Dialog>

      {/* Export – choose scope and columns */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export contacts</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ mt: 0.5, mb: 1 }}>What to export</Typography>
          <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
            <RadioGroup value={exportScope} onChange={(e) => setExportScope(e.target.value as 'all' | 'selected')}>
              <FormControlLabel
                value="all"
                control={<Radio size="small" />}
                label={`All filtered contacts (${filteredAndSortedContacts.length})`}
              />
              <FormControlLabel
                value="selected"
                control={<Radio size="small" />}
                label={`Selected contacts only (${selectedIds.size})`}
                disabled={selectedIds.size === 0}
              />
            </RadioGroup>
            {exportScope === 'selected' && selectedIds.size === 0 && (
              <Typography variant="caption" color="text.secondary">Select contacts in the table first.</Typography>
            )}
          </FormControl>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Columns to include</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button size="small" onClick={() => setExportColumnIds(allExportColumns.map(c => c.id))}>Select all</Button>
            <Button size="small" onClick={() => setExportColumnIds([])}>Clear all</Button>
          </Box>
          <Box sx={{ maxHeight: 280, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, px: 1.5, py: 0.5 }}>
            <FormGroup>
              {allExportColumns.map((col) => (
                <FormControlLabel
                  key={col.id}
                  control={<Checkbox size="small" checked={exportColumnIds.includes(col.id)} onChange={(e) => setExportColumnIds(prev => e.target.checked ? [...prev, col.id] : prev.filter(id => id !== col.id))} />}
                  label={col.label}
                />
              ))}
            </FormGroup>
          </Box>
          {exportColumnIds.length === 0 && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>Select at least one column.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => runExport(exportScope, exportColumnIds)} disabled={exportColumnIds.length === 0 || (exportScope === 'selected' && selectedIds.size === 0)}>
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Back to top – fixed bottom-right */}
      <Tooltip title="Back to top">
        <IconButton
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1300,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <ArrowUpIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default AdminCRMPage;
