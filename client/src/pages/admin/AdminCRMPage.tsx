import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useUsageAnalytics } from '../../context/UsageAnalyticsContext';
import { UserRole, PECC_TAB_KEYS } from '../../types/database';
import AdminTeamTab from './AdminTeamTab';
import {
  Alert,
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
  Radio,
  CircularProgress
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
  OpenInFull as OpenInFullIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  DragIndicator as DragIndicatorIcon,
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Upload as UploadIcon,
  Groups as GroupsIcon
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
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  hospitalType?: string;
  ownership?: string;
  hospitalSystem?: string;
  programs?: string[];
  cohorts?: string[];
  linkedOrganizationIds?: string[];
  linkedHospitalIds?: string[];
  customFields?: Record<string, string>;
  /** Hospital UUID for type 'hospital' (for usage by site) */
  hospitalId?: string;
  /** User ID from users table (for contacts sourced from users) */
  user_id?: string;
  /** Whether this contact was created in CRM vs sourced from users table */
  crmCreated?: boolean;
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

/** Filter autocomplete options by search text: every word/token in inputValue must appear in the option label (case-insensitive). */
function filterOptionsBySearch<T extends { label: string }>(
  options: T[],
  inputValue: string
): T[] {
  const tokens = inputValue.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return options;
  return options.filter((opt) => {
    const label = (opt.label ?? '').toLowerCase();
    return tokens.every((t) => label.includes(t));
  });
}

/** Tab index for Team (user management) - when selected, show AdminTeamTab instead of contacts. */
const TEAM_TAB_INDEX = 8;

const COLUMNS: { id: SortField | 'phone' | 'actions' | 'programs' | 'linkedTo'; label: string; sortable?: boolean; defaultVisible?: boolean }[] = [
  { id: 'firstName', label: 'First Name', sortable: true, defaultVisible: true },
  { id: 'lastName', label: 'Last Name', sortable: true, defaultVisible: true },
  { id: 'name', label: 'Name', sortable: true, defaultVisible: false },
  { id: 'type', label: 'Type', sortable: true, defaultVisible: true },
  { id: 'facilityId', label: 'Facility ID', sortable: true, defaultVisible: true },
  { id: 'organization', label: 'Organization', sortable: true, defaultVisible: true },
  { id: 'hospitalSystem', label: 'Hospital System', sortable: true, defaultVisible: false },
  { id: 'programs', label: 'Program(s)', sortable: false, defaultVisible: true },
  { id: 'linkedTo', label: 'Linked To', sortable: false, defaultVisible: true },
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
  { id: 'programs', label: 'Program(s)' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'region', label: 'Region' },
  { id: 'state', label: 'State' },
  { id: 'status', label: 'Status' },
  { id: 'createdAt', label: 'Added' },
  { id: 'address', label: 'Address Line 1' },
  { id: 'address2', label: 'Address Line 2' },
  { id: 'city', label: 'City' },
  { id: 'zip', label: 'Zip/Postal Code' },
  { id: 'county', label: 'County' },
  { id: 'hospitalType', label: 'Hospital Type' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'linkedOrganizations', label: 'Linked Organizations' },
  { id: 'linkedHospitals', label: 'Linked Hospitals' },
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
  allowMultiple?: boolean; // If true, allows multiple dated entries (like a log)
};

// Type for multiple entry custom field values
type CustomFieldMultiEntry = {
  date: string;
  value: string;
};

// Helper functions for multi-entry custom fields
const parseMultiEntryValue = (val: string | undefined): CustomFieldMultiEntry[] => {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.filter(e => e && typeof e.date === 'string' && typeof e.value === 'string');
  } catch {
    // If not valid JSON, treat as a single legacy entry
    if (val.trim()) return [{ date: '', value: val }];
  }
  return [];
};

const serializeMultiEntryValue = (entries: CustomFieldMultiEntry[]): string => {
  return JSON.stringify(entries.filter(e => e.value.trim()));
};

const formatEntryDate = (dateStr: string): string => {
  if (!dateStr) return 'No date';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { actualRole } = useUserProfile();
  const { trackClick } = useUsageAnalytics();
  const canSeeReminders = actualRole === UserRole.ADMIN || actualRole === UserRole.MANAGER || actualRole === UserRole.MENTOR;

  const [tabValue, setTabValue] = useState(() => (searchParams.get('tab') === 'team' ? TEAM_TAB_INDEX : 0));
  useEffect(() => {
    if (searchParams.get('tab') === 'team') setTabValue(TEAM_TAB_INDEX);
  }, [searchParams]);
  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setTabValue(v);
    if (v === TEAM_TAB_INDEX) setSearchParams({ tab: 'team' });
    else setSearchParams({});
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
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
  const [fullScreenEditMode, setFullScreenEditMode] = useState(false);
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
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        const allIds = COLUMNS.map(c => c.id) as string[];
        if (p.columnOrder && Array.isArray(p.columnOrder) && p.columnOrder.length > 0) {
          const valid = (p.columnOrder as string[]).filter(id => allIds.includes(id));
          const missing = allIds.filter((id: string) => !valid.includes(id));
          if (valid.length > 0) return [...valid, ...missing];
        }
      }
    } catch {}
    return COLUMNS.map(c => c.id) as string[];
  });
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<string[]>([]);
  const [programFilter, setProgramFilter] = useState<string[]>([]);
  const [cohortFilter, setCohortFilter] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ single?: string; bulk?: Set<string> } | null>(null);
  const [deleteConfirmTyped, setDeleteConfirmTyped] = useState('');
  const [bulkStatusAnchor, setBulkStatusAnchor] = useState<null | HTMLElement>(null);

  // PECC page (site) settings: tab visibility + shared access (when viewing a hospital contact)
  const [siteTabVisibility, setSiteTabVisibility] = useState<Record<string, boolean>>({});
  const [siteMembers, setSiteMembers] = useState<{ user_id: string; email?: string; first_name?: string; last_name?: string }[]>([]);
  const [siteSettingsLoading, setSiteSettingsLoading] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberLoading, setAddMemberLoading] = useState(false);

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
    state: '',
    notes: '',
    hospitalSystem: '',
    programs: [] as string[],
    cohorts: [] as string[],
    linkedOrganizationIds: [] as string[],
    linkedHospitalIds: [] as string[],
    customFields: {} as Record<string, string>,
    address: '',
    address2: '',
    city: '',
    county: '',
    zip: '',
    facilityId: ''
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
  const [newDefAllowMultiple, setNewDefAllowMultiple] = useState(false);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // State for new multi-entry field values (defId -> {date, value})
  const [multiEntryNewValues, setMultiEntryNewValues] = useState<Record<string, { date: string; value: string }>>({});
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'selected'>('all');
  const [exportColumnIds, setExportColumnIds] = useState<string[]>(() => EXPORT_COLUMNS.map(c => c.id));

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<Array<Record<string, string>>>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importColumnMapping, setImportColumnMapping] = useState<Record<string, string>>({});
  const [importContactType, setImportContactType] = useState<ContactType>('organization');
  const [importInProgress, setImportInProgress] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<{ count: number } | null>(null);

  const [reminders, setReminders] = useState<CrmReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [myRemindersOpen, setMyRemindersOpen] = useState(false);
  const [addNoteText, setAddNoteText] = useState('');
  const [addActivityType, setAddActivityType] = useState<ActivityLogType>('communication');
  const [addActivityText, setAddActivityText] = useState('');
  const [addActivityDate, setAddActivityDate] = useState('');
  const [addReminderDate, setAddReminderDate] = useState('');
  const [addReminderTitle, setAddReminderTitle] = useState('');
  const [contactUsage, setContactUsage] = useState<{ logins: number; pageViews: number } | null>(null);
  const [contactUsageLoading, setContactUsageLoading] = useState(false);
  const [contactUsagePeriod, setContactUsagePeriod] = useState<'7' | '30' | '90' | 'all'>('30');

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
              email: String(row.email ?? ''),
              phone: String(row.phone ?? ''),
              status: (row.crm_status != null ? String(row.crm_status) : null) || 'Active',
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
              programs: Array.isArray(row.programs) ? (row.programs as unknown[]).map((x) => String(x)).filter(Boolean) : undefined,
              cohorts: Array.isArray(row.cohorts) ? (row.cohorts as unknown[]).map((x) => String(x)).filter(Boolean) : undefined,
              customFields: (row.custom_fields && typeof row.custom_fields === 'object') ? (row.custom_fields as Record<string, string>) : undefined,
              hospitalId: row.id != null ? String(row.id) : undefined
            });
          }
          hasMore = batch.length >= chunk;
          offset += chunk;
        }
        // Load CRM contacts (organizations, other, and manually-added people types)
        if (mounted) {
          const { data: orgsData, error: orgsError } = await supabase
            .from('crm_organizations')
            .select('id, name, first_name, last_name, organization, email, phone, region, state, status, notes, notes_log, activity_log, custom_fields, programs, cohorts, created_at, updated_at, contact_type, linked_organization_ids, linked_hospital_ids, address, address2, city, county, zip');
          if (orgsError) {
            console.warn('CRM: could not load crm_organizations:', orgsError.message);
          } else if (orgsData && orgsData.length > 0) {
            for (const row of orgsData as Record<string, unknown>[]) {
              const id = String(row.id ?? '');
              const rawContactType = String(row.contact_type ?? 'organization');
              const contactType: ContactType = CONTACT_TYPES.includes(rawContactType as ContactType) ? (rawContactType as ContactType) : 'organization';
              const isPerson = isPersonType(contactType);
              const name = isPerson 
                ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.name ?? 'Unknown')
                : String(row.name ?? 'Unknown');
              const created = row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0];
              const rawNotesLog = row.notes_log;
              const rawActivityLog = row.activity_log;
              const notesLog: NotesLogEntry[] = Array.isArray(rawNotesLog)
                ? (rawNotesLog as unknown[]).filter((e): e is NotesLogEntry => typeof e === 'object' && e != null && 'date' in e && 'text' in e).map(e => ({ date: String((e as NotesLogEntry).date), text: String((e as NotesLogEntry).text) }))
                : [];
              const activityLog: ActivityLogEntry[] = Array.isArray(rawActivityLog)
                ? (rawActivityLog as unknown[]).filter((e): e is ActivityLogEntry => typeof e === 'object' && e != null && 'type' in e && 'date' in e && 'text' in e).map(e => ({ type: (e as ActivityLogEntry).type as ActivityLogType, date: String((e as ActivityLogEntry).date), text: String((e as ActivityLogEntry).text) }))
                : [];
              list.push({
                id,
                type: contactType,
                name,
                firstName: isPerson ? String(row.first_name ?? '') : undefined,
                lastName: isPerson ? String(row.last_name ?? '') : undefined,
                organization: isPerson ? String(row.organization ?? '') : name,
                email: String(row.email ?? ''),
                phone: String(row.phone ?? ''),
                status: String(row.status ?? 'Active'),
                region: String(row.region ?? ''),
                state: row.state != null ? String(row.state) : undefined,
                createdAt: created,
                notes: String(row.notes ?? ''),
                notesLog,
                activityLog,
                customFields: (row.custom_fields && typeof row.custom_fields === 'object') ? (row.custom_fields as Record<string, string>) : undefined,
                programs: Array.isArray(row.programs) ? (row.programs as string[]) : [],
                cohorts: Array.isArray(row.cohorts) ? (row.cohorts as string[]) : [],
                linkedOrganizationIds: Array.isArray(row.linked_organization_ids) ? (row.linked_organization_ids as string[]) : [],
                linkedHospitalIds: Array.isArray(row.linked_hospital_ids) ? (row.linked_hospital_ids as string[]) : [],
                address: row.address != null ? String(row.address) : undefined,
                address2: row.address2 != null ? String(row.address2) : undefined,
                city: row.city != null ? String(row.city) : undefined,
                county: row.county != null ? String(row.county) : undefined,
                zip: row.zip != null ? String(row.zip) : undefined,
                crmCreated: true  // Mark as CRM-created to differentiate from users table
              });
            }
          }
        }
        // Append app users (manager, mentor, pecc) so they show in CRM tabs — same fetch as Team tab, filter by role in JS
        if (mounted) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, phone, role, is_active, created_at');
          if (usersError) {
            console.warn('CRM: could not load users for contacts:', usersError.message, usersError.code);
            if (mounted) setUsersLoadError(usersError.message || 'Could not load team members');
          } else if (mounted) setUsersLoadError(null);
          const userRows = (usersData ?? []) as { id: string; email: string; first_name?: string; last_name?: string; phone?: string; role: string; is_active: boolean; created_at: string }[];
          const crmRoles = ['admin', 'manager', 'mentor', 'pecc'];
          const roleToContactType: Record<string, ContactType> = { admin: 'staff', manager: 'manager', mentor: 'mentor', pecc: 'pecc' };
          for (const u of userRows) {
            const role = (u.role && typeof u.role === 'string' ? u.role.toLowerCase() : '') as string;
            if (!crmRoles.includes(role)) continue;
            // Skip if we already have this user from crm_organizations
            if (list.some(c => c.email === u.email && c.crmCreated)) continue;
            const type = roleToContactType[role];
            const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || '—';
            list.push({
              id: u.id,
              type: type,
              name: displayName,
              firstName: u.first_name ?? '',
              lastName: u.last_name ?? '',
              organization: '',
              email: u.email ?? '',
              phone: u.phone ?? '',
              status: u.is_active ? 'Active' : 'Inactive',
              region: '',
              createdAt: u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              notes: '',
              user_id: u.id,  // Mark as user-sourced
              crmCreated: false
            });
          }
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
        pageSize,
        columnOrder
      }));
    } catch {}
  }, [viewMode, visibleColumns, pageSize, columnOrder]);

  // Load custom field definitions from Supabase (shared for all admins); fallback to localStorage if table missing
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.from('crm_custom_field_definitions').select('id, label, applicable_types, field_type, options, sort_order, allow_multiple').order('sort_order', { ascending: true });
      if (!mounted) return;
      if (!error && data && data.length > 0) {
        const mapped: CustomFieldDefinition[] = (data as Record<string, unknown>[]).map((row) => ({
          id: String(row.id),
          label: String(row.label),
          applicableTypes: (Array.isArray(row.applicable_types) ? row.applicable_types as string[] : ['hospital']).filter(t => CONTACT_TYPES.includes(t as ContactType)) as ContactType[],
          fieldType: (['checkbox', 'radio', 'date', 'numeric', 'short_answer', 'paragraph', 'dropdown', 'dropdown_csv'].includes(String(row.field_type)) ? row.field_type : 'short_answer') as CustomFieldType,
          options: Array.isArray(row.options) ? (row.options as string[]).filter(Boolean) : undefined,
          allowMultiple: Boolean(row.allow_multiple)
        }));
        setCustomFieldDefs(mapped);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load available programs and cohorts from database
  useEffect(() => {
    let mounted = true;
    (async () => {
      // Fetch programs
      const { data: programsData } = await supabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (mounted && programsData) {
        setAvailablePrograms(programsData.map(p => ({ id: p.id, name: p.name })));
      }
      
      // Fetch cohorts
      const { data: cohortsData } = await supabase
        .from('cohorts')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (mounted && cohortsData) {
        setAvailableCohorts(cohortsData.map(c => ({ id: c.id, name: c.name })));
      }
    })();
    return () => { mounted = false; };
  }, []);

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

  // Load usage for the selected contact – by user_id for person, by hospital_id for hospital; period = 7/30/90 days or all
  useEffect(() => {
    const c = detailContact;
    if (!c) {
      setContactUsage(null);
      return;
    }
    const isPerson = isPersonType(c.type);
    const hospitalId = c.type === 'hospital' ? c.hospitalId : null;
    if (!isPerson && !hospitalId) {
      setContactUsage(null);
      return;
    }
    let cancelled = false;
    setContactUsageLoading(true);
    let q = supabase.from('usage_events').select('id, event_type');
    if (contactUsagePeriod !== 'all') {
      const days = parseInt(contactUsagePeriod, 10);
      const since = new Date();
      since.setDate(since.getDate() - days);
      q = q.gte('created_at', since.toISOString());
    }
    const query = isPerson ? q.eq('user_id', c.id) : q.eq('hospital_id', hospitalId);
    query.then(({ data, error }) => {
      if (cancelled) return;
      setContactUsageLoading(false);
      if (error || !data) {
        setContactUsage(null);
        return;
      }
      const events = data as { event_type: string }[];
      const logins = events.filter((e) => e.event_type === 'login').length;
      const pageViews = events.filter((e) => e.event_type === 'page_view').length;
      setContactUsage({ logins, pageViews });
    });
    return () => { cancelled = true; };
  }, [detailContact?.id, detailContact?.type, detailContact?.hospitalId, contactUsagePeriod]);

  const persistNotesAndActivity = useCallback(async (c: Contact) => {
    const notesLog = c.notesLog ?? [];
    const activityLog = c.activityLog ?? [];
    if (c.type === 'hospital' && (c.facilityId ?? c.id)) {
      const key = String(c.facilityId ?? c.id);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
      const filterClause = isUuid ? `facility_id.eq.${key},id.eq.${key}` : `facility_id.eq.${key}`;
      await supabase.from('hospitals').update({ notes_log: notesLog, activity_log: activityLog }).or(filterClause);
    } else if (c.type !== 'hospital' && c.crmCreated && c.id) {
      // CRM-created contacts - update directly
      await supabase.from('crm_organizations').update({ notes_log: notesLog, activity_log: activityLog, updated_at: new Date().toISOString() }).eq('id', c.id);
    } else if (c.type !== 'hospital' && !c.crmCreated && c.user_id) {
      // User-sourced contact - need to create/update CRM record to store notes/activity
      const { data: existingCrm } = await supabase
        .from('crm_organizations')
        .select('id')
        .eq('email', c.email)
        .eq('contact_type', c.type)
        .maybeSingle();
      
      if (existingCrm) {
        // Update existing CRM record
        await supabase.from('crm_organizations')
          .update({ notes_log: notesLog, activity_log: activityLog, updated_at: new Date().toISOString() })
          .eq('id', existingCrm.id);
        // Update local state to reflect CRM record
        setContacts(prev => prev.map(x => x.id === c.id ? { ...x, id: existingCrm.id, crmCreated: true } : x));
        setDetailContact(prev => prev?.id === c.id ? { ...prev, id: existingCrm.id, crmCreated: true } : prev);
      } else {
        // Create new CRM record for this user
        const displayName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.name;
        const { data: inserted } = await supabase.from('crm_organizations')
          .insert({
            name: displayName,
            email: c.email || null,
            phone: c.phone || null,
            contact_type: c.type,
            first_name: c.firstName || null,
            last_name: c.lastName || null,
            status: c.status || 'Active',
            notes_log: notesLog,
            activity_log: activityLog
          })
          .select('id')
          .single();
        if (inserted) {
          // Update local state to use CRM record
          setContacts(prev => prev.map(x => x.id === c.id ? { ...x, id: (inserted as { id: string }).id, crmCreated: true } : x));
          setDetailContact(prev => prev?.id === c.id ? { ...prev, id: (inserted as { id: string }).id, crmCreated: true } : prev);
        }
      }
    }
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

  // Load PECC page (site) settings when viewing a hospital contact in full screen
  const currentSiteId = detailContact?.type === 'hospital' ? (detailContact.facilityId ?? detailContact.id) : null;
  useEffect(() => {
    let cancelled = false;
    if (!fullScreenOpen || !currentSiteId) {
      setSiteTabVisibility({});
      setSiteMembers([]);
      setSiteSettingsLoading(false);
      return;
    }
    setSiteSettingsLoading(true);
    (async () => {
      const sid = currentSiteId;
      const { data: tabRows } = await supabase.from('site_tab_visibility').select('tab_key, visible').eq('site_id', sid);
      if (cancelled) return;
      const tabVis: Record<string, boolean> = {};
      PECC_TAB_KEYS.forEach(k => { tabVis[k] = true; });
      if (tabRows?.length) {
        (tabRows as { tab_key: string; visible: boolean }[]).forEach(r => { tabVis[r.tab_key] = r.visible; });
      }
      setSiteTabVisibility(tabVis);

      const { data: memberRows } = await supabase.from('site_members').select('user_id').eq('site_id', sid);
      if (cancelled) return;
      if (memberRows?.length) {
        const ids = (memberRows as { user_id: string }[]).map(r => r.user_id);
        const { data: users } = await supabase.from('users').select('id, email, first_name, last_name').in('id', ids);
        const list = (users ?? []).map((u: { id: string; email?: string; first_name?: string; last_name?: string }) => ({
          user_id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name
        }));
        setSiteMembers(list);
      } else {
        setSiteMembers([]);
      }
      if (!cancelled) setSiteSettingsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fullScreenOpen, currentSiteId]);

  const saveSiteTabVisibility = useCallback(async (siteId: string, tabKey: string, visible: boolean) => {
    await supabase.from('site_tab_visibility').upsert(
      { site_id: siteId, tab_key: tabKey, visible, updated_at: new Date().toISOString() },
      { onConflict: 'site_id,tab_key' }
    );
    setSiteTabVisibility(prev => ({ ...prev, [tabKey]: visible }));
  }, []);

  const addSiteMemberByEmail = useCallback(async (siteId: string, email: string) => {
    if (!email.trim()) return;
    setAddMemberLoading(true);
    try {
      const { data: u } = await supabase.from('users').select('id').ilike('email', email.trim()).limit(1).maybeSingle();
      if (u && (u as { id: string }).id) {
        const uid = (u as { id: string }).id;
        await supabase.from('site_members').upsert({ site_id: siteId, user_id: uid }, { onConflict: 'site_id,user_id' });
        const { data: prof } = await supabase.from('users').select('id, email, first_name, last_name, phone').eq('id', uid).single();
        if (prof) {
          setSiteMembers(prev => [...prev, { user_id: (prof as { id: string }).id, email: (prof as { email?: string }).email, first_name: (prof as { first_name?: string }).first_name, last_name: (prof as { last_name?: string }).last_name }]);
          // Add this person to the CRM as a contact associated with this hospital
          const { data: hosp } = await supabase.from('hospitals').select('id').or(`id.eq.${siteId},facility_id.eq.${siteId}`).limit(1).maybeSingle();
          const hospitalId = hosp && typeof (hosp as { id?: string }).id === 'string' ? (hosp as { id: string }).id : null;
          if (hospitalId) {
            await supabase.from('hospital_contacts').upsert(
              {
                hospital_id: hospitalId,
                user_id: uid,
                first_name: (prof as { first_name?: string }).first_name ?? '',
                last_name: (prof as { last_name?: string }).last_name ?? '',
                email: (prof as { email?: string }).email ?? email.trim(),
                phone: (prof as { phone?: string | null }).phone ?? null,
                contact_status: 'Already a PECC',
                role_at_hospital: null,
                is_primary_contact: false,
                is_actively_engaged: true,
                updated_at: new Date().toISOString()
              },
              { onConflict: 'hospital_id,user_id' }
            );
          }
        }
        setAddMemberEmail('');
      }
    } finally {
      setAddMemberLoading(false);
    }
  }, []);

  const removeSiteMember = useCallback(async (siteId: string, userId: string) => {
    await supabase.from('site_members').delete().eq('site_id', siteId).eq('user_id', userId);
    setSiteMembers(prev => prev.filter(m => m.user_id !== userId));
  }, []);

  const regions = useMemo(() => [...new Set(contacts.map(c => c.region).filter(Boolean))].sort() as string[], [contacts]);
  const states = useMemo(() => [...new Set(contacts.map(c => c.state).filter(Boolean))].sort() as string[], [contacts]);
  const hospitalTypes = useMemo(() => [...new Set(contacts.map(c => c.hospitalType).filter(Boolean))].sort() as string[], [contacts]);
  // State for available programs and cohorts from database
  const [availablePrograms, setAvailablePrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [availableCohorts, setAvailableCohorts] = useState<Array<{ id: string; name: string }>>([]);
  
  // Combine database programs/cohorts with any existing ones on contacts
  const programOptions = useMemo(() => {
    const fromContacts = contacts.flatMap(c => c.programs ?? []).filter(Boolean);
    const fromDb = availablePrograms.map(p => p.name);
    return [...new Set([...fromContacts, ...fromDb])].sort() as string[];
  }, [contacts, availablePrograms]);
  
  const cohortOptions = useMemo(() => {
    const fromContacts = contacts.flatMap(c => c.cohorts ?? []).filter(Boolean);
    const fromDb = availableCohorts.map(c => c.name);
    return [...new Set([...fromContacts, ...fromDb])].sort() as string[];
  }, [contacts, availableCohorts]);

  const orderedDataColumnIds = useMemo(() =>
    columnOrder.filter(id => id !== 'actions' && visibleColumns.has(id)),
    [columnOrder, visibleColumns]
  );

  const handleColumnDragStart = (colId: string) => () => setDraggedColumnId(colId);
  const handleColumnDragEnd = () => setDraggedColumnId(null);
  const handleColumnDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleColumnDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetId) return;
    setColumnOrder(prev => {
      const without = prev.filter(id => id !== draggedColumnId);
      const insertIdx = without.indexOf(targetId);
      if (insertIdx === -1) return prev;
      const next = [...without];
      next.splice(insertIdx, 0, draggedColumnId);
      return next;
    });
    setDraggedColumnId(null);
  };

  const renderCellContent = (contact: Contact, colId: string): React.ReactNode => {
    switch (colId) {
      case 'firstName': return <Typography fontWeight={500}>{isPersonType(contact.type) ? (contact.firstName ?? '—') : (contact.type === 'organization' || contact.type === 'hospital' ? contact.name : '—')}</Typography>;
      case 'lastName': return <Typography fontWeight={500}>{isPersonType(contact.type) ? (contact.lastName ?? '—') : '—'}</Typography>;
      case 'name': return <Typography fontWeight={500}>{contactDisplayName(contact)}</Typography>;
      case 'type': return <Chip label={TYPE_LABELS[contact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[contact.type], color: 'white' }} />;
      case 'facilityId': return contact.facilityId ?? '—';
      case 'organization': return contact.organization || '—';
      case 'hospitalSystem': return contact.hospitalSystem ?? '—';
      case 'programs': return (contact.programs ?? []).length ? (contact.programs ?? []).join(', ') : '—';
      case 'linkedTo': {
        if (isPersonType(contact.type)) {
          const linkedOrgs = (contact.linkedOrganizationIds ?? []).map(id => contacts.find(c => c.id === id)?.name).filter(Boolean);
          const linkedHospitals = (contact.linkedHospitalIds ?? []).map(id => contacts.find(c => c.hospitalId === id || c.id === id)?.name).filter(Boolean);
          const all = [...linkedOrgs, ...linkedHospitals];
          return all.length > 0 ? all.join(', ') : '—';
        }
        if (contact.type === 'organization' || contact.type === 'hospital') {
          const linkedPeople = contacts.filter(p => isPersonType(p.type) && (
            (p.linkedOrganizationIds ?? []).includes(contact.id) || (p.linkedHospitalIds ?? []).includes(contact.id)
          ));
          return linkedPeople.length > 0 ? `${linkedPeople.length} contact(s)` : '—';
        }
        return '—';
      }
      case 'email': return contact.email;
      case 'phone': return contact.phone || '—';
      case 'region': return contact.region || '—';
      case 'state': return contact.state ?? '—';
      case 'status': return <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : 'default'} variant="outlined" />;
      case 'createdAt': return contact.createdAt;
      default: return '—';
    }
  };

  const getColById = (id: string) => COLUMNS.find(c => c.id === id);

  const filteredAndSortedContacts = useMemo(() => {
    const searchTokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let list = contacts.filter(contact => {
      const matchesSearch = (() => {
        if (!searchQuery || searchTokens.length === 0) return true;
        const namePart = [contact.firstName ?? '', contact.lastName ?? '', contact.name].filter(Boolean).join(' ').toLowerCase();
        const orgPart = (contact.organization || '').toLowerCase();
        const searchable = [namePart, orgPart, (contact.email || '').toLowerCase(), (contact.region || '').toLowerCase(), (contact.notes || '').toLowerCase(), (contact.hospitalSystem ?? '').toLowerCase(), (contact.address ?? '').toLowerCase(), (contact.city ?? '').toLowerCase(), (contact.state ?? '').toLowerCase(), (contact.county ?? '').toLowerCase(), ...(contact.programs ?? []).map(p => p.toLowerCase())].join(' ');
        return searchTokens.every(token => searchable.includes(token));
      })();
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
      if (programFilter.length > 0) {
        const contactPrograms = contact.programs ?? [];
        if (!programFilter.some(p => contactPrograms.includes(p))) return false;
      }
      if (cohortFilter.length > 0) {
        const contactCohorts = contact.cohorts ?? [];
        if (!cohortFilter.some(c => contactCohorts.includes(c))) return false;
      }
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
  }, [contacts, searchQuery, tabValue, sortField, sortOrder, statusFilter, regionFilter, stateFilter, hospitalTypeFilter, programFilter, cohortFilter]);

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

  const handleSaveContact = async (fromFullScreen = false) => {
    trackClick?.(editingContact ? 'CRM - Save contact (edit)' : 'CRM - Save contact (add)');
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
      state: formData.state,
      notes: formData.notes,
      hospitalSystem: formData.type === 'hospital' ? formData.hospitalSystem : undefined,
      programs: (formData.programs ?? []).length ? formData.programs : undefined,
      cohorts: (formData.cohorts ?? []).length ? formData.cohorts : undefined,
      linkedOrganizationIds: isPersonType(formData.type) ? formData.linkedOrganizationIds : undefined,
      linkedHospitalIds: isPersonType(formData.type) ? formData.linkedHospitalIds : undefined,
      createdAt: editingContact?.createdAt ?? new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      address: formData.address || undefined,
      address2: formData.address2 || undefined,
      city: formData.city || undefined,
      county: formData.county || undefined,
      zip: formData.zip || undefined,
      ...(Object.keys(formData.customFields || {}).length ? { customFields: formData.customFields } : {})
    };
    if (editingContact?.type === 'hospital' && (editingContact.facilityId || editingContact.id)) {
      // EDITING an existing hospital
      setSaveInProgress(true);
      const key = String(editingContact.facilityId ?? editingContact.id);
      const currentInState = contacts.find(c => c.id === editingContact.id);
      const updatePayload: { 
        name?: string; 
        facility_id?: string | null;
        company_name?: string | null;
        region: string | null; 
        state?: string | null; 
        crm_status?: string; 
        custom_fields?: Record<string, string>; 
        notes_log?: NotesLogEntry[]; 
        activity_log?: ActivityLogEntry[]; 
        hospital_system?: string | null; 
        programs?: string[];
        cohorts?: string[];
        address?: string | null;
        city?: string | null;
        county?: string | null;
        zip?: string | null;
        email?: string | null;
        phone?: string | null;
      } = { 
        region: formData.region || null, 
        state: formData.state?.trim() || null, 
        crm_status: formData.status || 'Active' 
      };
      // Add all editable fields
      updatePayload.name = formData.name?.trim() || '';
      updatePayload.facility_id = formData.facilityId?.trim() || null;
      updatePayload.company_name = formData.organization?.trim() || null;
      updatePayload.address = formData.address?.trim() || null;
      updatePayload.city = formData.city?.trim() || null;
      updatePayload.county = formData.county?.trim() || null;
      updatePayload.zip = formData.zip?.trim() || null;
      updatePayload.email = formData.email?.trim() || null;
      updatePayload.phone = formData.phone?.trim() || null;
      if (formData.customFields && Object.keys(formData.customFields).length > 0) {
        updatePayload.custom_fields = formData.customFields;
      }
      updatePayload.notes_log = currentInState?.notesLog ?? editingContact.notesLog ?? [];
      updatePayload.activity_log = currentInState?.activityLog ?? editingContact.activityLog ?? [];
      updatePayload.hospital_system = formData.hospitalSystem?.trim() || null;
      updatePayload.programs = formData.programs ?? [];
      updatePayload.cohorts = formData.cohorts ?? [];
      // Only include id.eq if key looks like a UUID (to avoid "invalid input syntax for type uuid" errors)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
      const filterClause = isUuid ? `facility_id.eq.${key},id.eq.${key}` : `facility_id.eq.${key}`;
      const { error } = await supabase
        .from('hospitals')
        .update(updatePayload)
        .or(filterClause);
      setSaveInProgress(false);
      // Build updated contact with all changes including facilityId
      const updatedContact: Partial<Contact> = {
        ...payload,
        facilityId: formData.facilityId?.trim() || editingContact.facilityId
      };
      if (error) {
        console.error('Failed to update hospital:', error);
        setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...updatedContact } : c)));
      } else {
        setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...updatedContact } : c)));
        // Also update detailContact if viewing this hospital
        setDetailContact(prev => (prev?.id === payload.id ? { ...prev, ...updatedContact } as Contact : prev));
      }
    } else if (formData.type === 'hospital' && !editingContact) {
      // ADDING a new hospital
      setSaveInProgress(true);
      const newHospitalPayload: Record<string, unknown> = {
        name: formData.name?.trim() || '',
        company_name: formData.organization?.trim() || null,
        region: formData.region?.trim() || null,
        state: formData.state?.trim() || null,
        crm_status: formData.status || 'Active',
        hospital_system: formData.hospitalSystem?.trim() || null,
        programs: formData.programs ?? [],
        cohorts: formData.cohorts ?? [],
        notes: formData.notes?.trim() || null,
        notes_log: [],
        activity_log: [],
        custom_fields: Object.keys(formData.customFields || {}).length ? formData.customFields : {},
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        county: formData.county?.trim() || null,
        zip: formData.zip?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null
      };
      // Only add facility_id if user provided one (otherwise let DB generate it)
      if (formData.facilityId?.trim()) {
        newHospitalPayload.facility_id = formData.facilityId.trim();
      }
      const { data: newHospital, error } = await supabase
        .from('hospitals')
        .insert(newHospitalPayload)
        .select()
        .single();
      setSaveInProgress(false);
      if (error) {
        console.error('Failed to add hospital:', error);
        setSaveError(`Failed to add hospital: ${error.message || 'Database error'}. Please check your RLS policies.`);
        return;
      }
      // Add to local state
      const newContact: Contact = {
        ...payload,
        id: newHospital.id,
        facilityId: newHospital.facility_id || newHospital.id
      };
      setContacts(prev => [...prev, newContact]);
      setSaveError(null);
    } else if (formData.type !== 'hospital') {
      // Save all non-hospital contacts to crm_organizations table
      // This includes: organization, other, manager, mentor, pecc, staff
      setSaveInProgress(true);
      const currentInState = contacts.find(c => c.id === (editingContact?.id ?? payload.id));
      const notesLog = currentInState?.notesLog ?? editingContact?.notesLog ?? [];
      const activityLog = currentInState?.activityLog ?? editingContact?.activityLog ?? [];
      // UUID validation helper - only valid UUIDs can be stored in the linked_*_ids columns
      const isValidUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      // Filter linked IDs to only include valid UUIDs (CRM-created records)
      // User-sourced contacts have numeric IDs that can't be stored as UUIDs
      const validLinkedOrgIds = (formData.linkedOrganizationIds ?? []).filter(isValidUuid);
      const validLinkedHospitalIds = (formData.linkedHospitalIds ?? []).filter(isValidUuid);
      
      // Warn if some linked items were filtered out
      const skippedOrgCount = (formData.linkedOrganizationIds ?? []).length - validLinkedOrgIds.length;
      const skippedHospitalCount = (formData.linkedHospitalIds ?? []).length - validLinkedHospitalIds.length;
      if (skippedOrgCount > 0 || skippedHospitalCount > 0) {
        console.warn(`Skipped ${skippedOrgCount} org(s) and ${skippedHospitalCount} hospital(s) with non-UUID IDs (user-sourced contacts must be saved to CRM first)`);
      }
      
      const payloadDb: Record<string, unknown> = {
        name: (isPersonType(formData.type) ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim() : formData.name?.trim()) || payload.name,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        region: formData.region?.trim() || null,
        state: formData.state?.trim() || null,
        status: formData.status || 'Active',
        notes: formData.notes?.trim() || null,
        notes_log: notesLog,
        activity_log: activityLog,
        custom_fields: Object.keys(formData.customFields || {}).length ? formData.customFields : {},
        programs: formData.programs ?? [],
        cohorts: formData.cohorts ?? [],
        contact_type: formData.type,
        first_name: isPersonType(formData.type) ? (formData.firstName?.trim() || null) : null,
        last_name: isPersonType(formData.type) ? (formData.lastName?.trim() || null) : null,
        organization: isPersonType(formData.type) ? (formData.organization?.trim() || null) : null,
        linked_organization_ids: isPersonType(formData.type) ? validLinkedOrgIds : [],
        linked_hospital_ids: isPersonType(formData.type) ? validLinkedHospitalIds : [],
        address: formData.address?.trim() || null,
        address2: formData.address2?.trim() || null,
        city: formData.city?.trim() || null,
        county: formData.county?.trim() || null,
        zip: formData.zip?.trim() || null
      };
      
      // Check if this is a user-sourced contact (from users table) vs CRM-created
      const isUserSourced = editingContact?.user_id && !editingContact?.crmCreated;
      
      if (editingContact && editingContact.id && !isUserSourced) {
        // Update existing CRM contact
        const { error } = await supabase
          .from('crm_organizations')
          .update({ ...payloadDb, updated_at: new Date().toISOString() })
          .eq('id', editingContact.id);
        setSaveInProgress(false);
        if (error) {
          console.error('Failed to update contact:', error);
          setSaveError(`Failed to update contact: ${error.message || 'Database error'}. Please check your RLS policies.`);
          return; // Don't close dialog
        }
        setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
        setSaveError(null);
      } else if (isUserSourced && editingContact) {
        // For user-sourced contacts, we need to create a CRM record to store any CRM-specific data
        // that can't be stored in the users table (which only has: email, first_name, last_name, phone, role)
        // We create a CRM record if ANY of these fields have values:
        const hasCrmData = validLinkedOrgIds.length > 0 || 
                           validLinkedHospitalIds.length > 0 ||
                           (formData.notes?.trim()) ||
                           Object.keys(formData.customFields || {}).length > 0 ||
                           (formData.region?.trim()) ||
                           (formData.organization?.trim()) ||
                           (formData.address?.trim()) ||
                           (formData.address2?.trim()) ||
                           (formData.city?.trim()) ||
                           (formData.county?.trim()) ||
                           (formData.zip?.trim()) ||
                           (formData.state?.trim());
        
        if (hasCrmData) {
          // Create/update a CRM record for this user to store CRM-specific data
          // Use upsert with the user's email as the unique identifier
          const { data: existingCrm } = await supabase
            .from('crm_organizations')
            .select('id')
            .eq('email', editingContact.email)
            .eq('contact_type', editingContact.type)
            .maybeSingle();
          
          // Also update phone in users table if it changed (phone is stored in users table)
          if (formData.phone?.trim() !== editingContact.phone && editingContact.user_id) {
            await supabase
              .from('users')
              .update({ phone: formData.phone?.trim() || null })
              .eq('id', editingContact.user_id);
          }
          
          if (existingCrm) {
            // Update existing CRM record
            const { error } = await supabase
              .from('crm_organizations')
              .update({
                ...payloadDb,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingCrm.id);
            setSaveInProgress(false);
            if (error) {
              console.error('Failed to update CRM data for user:', error);
              setSaveError(`Failed to save linked organizations: ${error.message || 'Database error'}.`);
              return;
            }
            // Update local state to reflect CRM record
            setContacts(prev => prev.map(c => (c.id === editingContact.id ? { ...c, ...payload, id: existingCrm.id, crmCreated: true } : c)));
            setSaveError(null);
          } else {
            // Create new CRM record for this user
            const { data: inserted, error } = await supabase
              .from('crm_organizations')
              .insert(payloadDb)
              .select('id, created_at')
              .single();
            setSaveInProgress(false);
            if (error) {
              console.error('Failed to create CRM record for user:', error);
              setSaveError(`Failed to save linked organizations: ${error.message || 'Database error'}. Run CRM_RLS_FIX.sql in Supabase.`);
              return;
            }
            if (inserted) {
              // Remove the user-sourced entry and add the CRM entry
              setContacts(prev => {
                const filtered = prev.filter(c => c.id !== editingContact.id);
                return [...filtered, { ...payload, id: (inserted as { id: string }).id, crmCreated: true }];
              });
              setSaveError(null);
            }
          }
        } else {
          // No CRM-specific data to save, but we might need to update the users table
          // for fields that are stored there (phone)
          if (formData.phone?.trim() !== editingContact.phone) {
            // Update phone in users table
            await supabase
              .from('users')
              .update({ phone: formData.phone?.trim() || null })
              .eq('id', editingContact.user_id);
          }
          setSaveInProgress(false);
          setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
        }
      } else {
        // Insert new CRM contact
        const { data: inserted, error } = await supabase
          .from('crm_organizations')
          .insert(payloadDb)
          .select('id, created_at')
          .single();
        setSaveInProgress(false);
        if (error) {
          console.error('Failed to insert contact:', error);
          // Show error to user - DON'T add to local state since it wasn't saved
          setSaveError(`Failed to save contact: ${error.message || 'Database error'}. Please check your RLS policies - run CRM_RLS_FIX.sql in Supabase.`);
          return; // Don't close dialog or add to state
        } else if (inserted && typeof (inserted as { id?: string }).id === 'string') {
          const id = (inserted as { id: string; created_at?: string }).id;
          const createdAt = (inserted as { created_at?: string }).created_at ? String((inserted as { created_at: string }).created_at).split('T')[0] : payload.createdAt;
          setContacts(prev => [...prev, { ...payload, id, createdAt, crmCreated: true }]);
          setSaveError(null);
        } else {
          // Insert succeeded but no data returned - still add to state
          setContacts(prev => [...prev, { ...payload, crmCreated: true }]);
          setSaveError(null);
        }
      }
    }
    if (fromFullScreen) {
      setFullScreenEditMode(false);
      setDetailContact(prev => (prev && prev.id === payload.id ? { ...prev, ...payload } : prev));
      setEditingContact(null);
    } else {
      setDialogOpen(false);
      setEditingContact(null);
    }
    setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', state: '', notes: '', hospitalSystem: '', programs: [], cohorts: [], linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {}, address: '', address2: '', city: '', county: '', zip: '', facilityId: '' });
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
    trackClick?.('CRM - Export');
    const contactsToExport = scope === 'selected'
      ? filteredAndSortedContacts.filter(c => selectedIds.has(c.id))
      : filteredAndSortedContacts;
    const ids = columnIds.filter(id => allExportColumns.some(col => col.id === id));
    const labels = ids.map(id => allExportColumns.find(col => col.id === id)!.label);
    const valueFor = (c: Contact, id: string): string => {
      if (customFieldDefs.some(d => d.id === id)) return c.customFields?.[id] ?? '';
      if (id === 'type') return TYPE_LABELS[c.type];
      if (id === 'name') return contactDisplayName(c);
      if (id === 'programs') return (c.programs ?? []).join('; ');
      if (id === 'linkedOrganizations') {
        return (c.linkedOrganizationIds ?? []).map(orgId => contacts.find(x => x.id === orgId)?.name ?? '').filter(Boolean).join('; ');
      }
      if (id === 'linkedHospitals') {
        return (c.linkedHospitalIds ?? []).map(hospId => contacts.find(x => x.hospitalId === hospId || x.id === hospId)?.name ?? '').filter(Boolean).join('; ');
      }
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

  // CSV Import functions
  const parseCSV = (text: string): { headers: string[]; rows: Array<Record<string, string>> } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };
    
    // Parse CSV respecting quoted fields
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = parseLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
    return { headers, rows };
  };

  const handleImportFileSelect = (file: File) => {
    setImportError(null);
    setImportSuccess(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0 || rows.length === 0) {
          setImportError('CSV file is empty or invalid');
          return;
        }
        setImportHeaders(headers);
        setImportData(rows);
        // Auto-map columns based on common names
        const mapping: Record<string, string> = {};
        const headerLower = headers.map(h => h.toLowerCase().replace(/[_\s-]+/g, ''));
        const fieldMappings: Array<{ field: string; matches: string[] }> = [
          { field: 'name', matches: ['name', 'organizationname', 'companyname', 'company', 'hospitalname'] },
          { field: 'firstName', matches: ['firstname', 'first', 'fname'] },
          { field: 'lastName', matches: ['lastname', 'last', 'lname', 'surname'] },
          { field: 'email', matches: ['email', 'emailaddress', 'mail'] },
          { field: 'phone', matches: ['phone', 'phonenumber', 'telephone', 'tel', 'mobile', 'cell'] },
          { field: 'organization', matches: ['organization', 'company', 'employer', 'org'] },
          { field: 'region', matches: ['region', 'area', 'territory'] },
          { field: 'state', matches: ['state', 'province', 'st'] },
          { field: 'status', matches: ['status', 'active'] },
          { field: 'address', matches: ['address', 'streetaddress', 'address1', 'street'] },
          { field: 'address2', matches: ['address2', 'addressline2', 'apt', 'suite', 'unit'] },
          { field: 'city', matches: ['city', 'town'] },
          { field: 'county', matches: ['county'] },
          { field: 'zip', matches: ['zip', 'zipcode', 'postalcode', 'postal'] },
          { field: 'notes', matches: ['notes', 'note', 'comments', 'description'] },
        ];
        fieldMappings.forEach(({ field, matches }) => {
          const idx = headerLower.findIndex(h => matches.includes(h));
          if (idx !== -1) mapping[field] = headers[idx];
        });
        setImportColumnMapping(mapping);
      } catch {
        setImportError('Failed to parse CSV file');
      }
    };
    reader.onerror = () => setImportError('Failed to read file');
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (importData.length === 0) return;
    setImportInProgress(true);
    setImportError(null);
    setImportSuccess(null);
    
    const isPerson = isPersonType(importContactType);
    let successCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < importData.length; i++) {
      const row = importData[i];
      const getValue = (field: string) => {
        const csvColumn = importColumnMapping[field];
        return csvColumn ? (row[csvColumn]?.trim() || null) : null;
      };
      
      // Build the payload
      const name = isPerson 
        ? [getValue('firstName'), getValue('lastName')].filter(Boolean).join(' ').trim() || getValue('name')
        : getValue('name');
      
      if (!name) {
        errors.push(`Row ${i + 2}: Missing name`);
        continue;
      }
      
      const payload: Record<string, unknown> = {
        name,
        email: getValue('email'),
        phone: getValue('phone'),
        region: getValue('region'),
        state: getValue('state'),
        status: getValue('status') || 'Active',
        notes: getValue('notes'),
        contact_type: importContactType,
        first_name: isPerson ? getValue('firstName') : null,
        last_name: isPerson ? getValue('lastName') : null,
        organization: isPerson ? getValue('organization') : null,
        address: getValue('address'),
        address2: getValue('address2'),
        city: getValue('city'),
        county: getValue('county'),
        zip: getValue('zip'),
      };
      
      const { error } = await supabase.from('crm_organizations').insert(payload);
      if (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      } else {
        successCount++;
      }
    }
    
    setImportInProgress(false);
    
    if (successCount > 0) {
      setImportSuccess({ count: successCount });
      // Reload contacts
      const { data: orgsData } = await supabase
        .from('crm_organizations')
        .select('id, name, first_name, last_name, organization, email, phone, region, state, status, notes, notes_log, activity_log, custom_fields, created_at, updated_at, contact_type, linked_organization_ids, linked_hospital_ids, address, address2, city, county, zip');
      if (orgsData) {
        const newContacts: Contact[] = [];
        for (const row of orgsData as Record<string, unknown>[]) {
          const id = String(row.id ?? '');
          const rawContactType = String(row.contact_type ?? 'organization');
          const contactType: ContactType = CONTACT_TYPES.includes(rawContactType as ContactType) ? (rawContactType as ContactType) : 'organization';
          const isP = isPersonType(contactType);
          const cName = isP 
            ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.name ?? 'Unknown')
            : String(row.name ?? 'Unknown');
          const created = row.created_at ? String(row.created_at).split('T')[0] : new Date().toISOString().split('T')[0];
          const rawNotesLog = row.notes_log;
          const rawActivityLog = row.activity_log;
          const notesLog: NotesLogEntry[] = Array.isArray(rawNotesLog)
            ? (rawNotesLog as unknown[]).filter((e): e is NotesLogEntry => typeof e === 'object' && e != null && 'date' in e && 'text' in e).map(e => ({ date: String((e as NotesLogEntry).date), text: String((e as NotesLogEntry).text) }))
            : [];
          const activityLog: ActivityLogEntry[] = Array.isArray(rawActivityLog)
            ? (rawActivityLog as unknown[]).filter((e): e is ActivityLogEntry => typeof e === 'object' && e != null && 'type' in e && 'date' in e && 'text' in e).map(e => ({ type: (e as ActivityLogEntry).type as ActivityLogType, date: String((e as ActivityLogEntry).date), text: String((e as ActivityLogEntry).text) }))
            : [];
          newContacts.push({
            id,
            type: contactType,
            name: cName,
            firstName: isP ? String(row.first_name ?? '') : undefined,
            lastName: isP ? String(row.last_name ?? '') : undefined,
            organization: isP ? String(row.organization ?? '') : cName,
            email: String(row.email ?? ''),
            phone: String(row.phone ?? ''),
            status: String(row.status ?? 'Active'),
            region: String(row.region ?? ''),
            state: row.state != null ? String(row.state) : undefined,
            createdAt: created,
            notes: String(row.notes ?? ''),
            notesLog,
            activityLog,
            customFields: (row.custom_fields && typeof row.custom_fields === 'object') ? (row.custom_fields as Record<string, string>) : undefined,
            linkedOrganizationIds: Array.isArray(row.linked_organization_ids) ? (row.linked_organization_ids as string[]) : [],
            linkedHospitalIds: Array.isArray(row.linked_hospital_ids) ? (row.linked_hospital_ids as string[]) : [],
            address: row.address != null ? String(row.address) : undefined,
            address2: row.address2 != null ? String(row.address2) : undefined,
            city: row.city != null ? String(row.city) : undefined,
            county: row.county != null ? String(row.county) : undefined,
            zip: row.zip != null ? String(row.zip) : undefined,
            crmCreated: true
          });
        }
        // Merge with existing non-CRM contacts (hospitals, users)
        setContacts(prev => {
          const nonCrm = prev.filter(c => !c.crmCreated);
          return [...nonCrm, ...newContacts];
        });
      }
    }
    
    if (errors.length > 0) {
      setImportError(`${errors.length} row(s) failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter([]);
    setRegionFilter([]);
    setStateFilter([]);
    setHospitalTypeFilter([]);
    setProgramFilter([]);
    setCohortFilter([]);
    setFilterMenuAnchor(null);
  };

  const activeFilterCount = statusFilter.length + regionFilter.length + stateFilter.length + hospitalTypeFilter.length + programFilter.length + cohortFilter.length;
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

  const activePendingFilter = statusFilter.includes('Pending') && statusFilter.length === 1 && !searchQuery && regionFilter.length === 0 && stateFilter.length === 0 && hospitalTypeFilter.length === 0 && programFilter.length === 0 && cohortFilter.length === 0;

  const handleDeleteContact = async (id: string) => {
    const contact = contacts.find(c => c.id === id);
    // Delete from crm_organizations if it's a CRM-created contact (not user-sourced)
    if (contact?.crmCreated && contact.type !== 'hospital') {
      await supabase.from('crm_organizations').delete().eq('id', id);
    }
    setContacts(prev => prev.filter(c => c.id !== id));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    if (detailContact?.id === id) { setPanelOpen(false); setFullScreenOpen(false); setDetailContact(null); }
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleBulkDelete = async () => {
    if (!deleteTarget?.bulk) return;
    for (const id of deleteTarget.bulk) {
      const contact = contacts.find(c => c.id === id);
      // Delete from crm_organizations if it's a CRM-created contact (not user-sourced)
      if (contact?.crmCreated && contact.type !== 'hospital') {
        await supabase.from('crm_organizations').delete().eq('id', id);
      }
    }
    setContacts(prev => prev.filter(c => !deleteTarget.bulk!.has(c.id)));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeleteConfirmTyped('');
    setSelectedIds(new Set());
    if (detailContact && deleteTarget.bulk.has(detailContact.id)) { setPanelOpen(false); setFullScreenOpen(false); setDetailContact(null); }
  };

  const handleBulkStatusChange = async (status: string) => {
    const selected = contacts.filter(c => selectedIds.has(c.id));
    for (const c of selected) {
      if (c.crmCreated && c.type !== 'hospital') {
        // CRM-created contact (organization, other, or person types)
        await supabase.from('crm_organizations').update({ status, updated_at: new Date().toISOString() }).eq('id', c.id);
      } else if (c.type === 'hospital' && (c.facilityId ?? c.id)) {
        const key = String(c.facilityId ?? c.id);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
        const filterClause = isUuid ? `facility_id.eq.${key},id.eq.${key}` : `facility_id.eq.${key}`;
        await supabase.from('hospitals').update({ crm_status: status }).or(filterClause);
      }
      // User-sourced contacts (from users table) status is read-only in CRM
    }
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
          <Tooltip title="Import contacts from a CSV file">
            <Button startIcon={<UploadIcon />} onClick={() => { setImportDialogOpen(true); setImportData([]); setImportHeaders([]); setImportColumnMapping({}); setImportError(null); setImportSuccess(null); }} size="medium">
              Import
            </Button>
          </Tooltip>
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { trackClick?.('CRM - Add contact'); setEditingContact(null); setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', state: '', notes: '', hospitalSystem: '', programs: [], cohorts: [], linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {}, address: '', address2: '', city: '', county: '', zip: '', facilityId: '' }); setSaveError(null); setDialogOpen(true); }}>
            Add Contact
          </Button>
        </Box>
      </Box>

      {usersLoadError && tabValue !== TEAM_TAB_INDEX && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setUsersLoadError(null)}>
          Team members (managers, mentors, PECCs) could not be loaded: {usersLoadError}. Check your connection and that you have access. You can manage users in the Team tab.
        </Alert>
      )}
      {/* Summary cards – single row (hidden on Team tab) */}
      {tabValue !== TEAM_TAB_INDEX && (
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1.5, mb: 3, overflowX: 'auto', pb: 0.5 }}>
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
            <Paper
              key={key}
              onClick={() => {
                if (isPending) { setTabValue(0); setStatusFilter(['Pending']); }
                else if (isAll) { setTabValue(0); setStatusFilter([]); }
                else { setTabValue(typeKeys.indexOf(key) + 1); setStatusFilter([]); }
              }}
              sx={{
                flex: '1 1 0',
                minWidth: 0,
                p: 1.5,
                textAlign: 'center',
                cursor: 'pointer',
                borderTop: 3,
                borderColor,
                bgcolor: isActive ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
              }}
            >
              {loading ? (
                <Skeleton variant="text" width={32} height={28} sx={{ mx: 'auto' }} />
              ) : (
                <Typography variant="h6" fontWeight={700} sx={{ color: isPending ? 'warning.main' : isAll ? 'primary.main' : TYPE_COLORS[key as ContactType] || 'text.primary' }}>
                  {count}
                </Typography>
              )}
              <Typography variant="caption" display="block" color="text.secondary" sx={{ lineHeight: 1.2 }}>{label}</Typography>
            </Paper>
          );
        })}
      </Box>
      )}

      {/* Toolbar: tabs, view mode, search, filters */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}>
          <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="All" />
            <Tab label="Organizations" />
            <Tab label="Hospitals" />
            <Tab label="Managers" />
            <Tab label="Mentors" />
            <Tab label="PECCs" />
            <Tab label="Staff" />
            <Tab label="Other" />
            <Tab label="Team" />
          </Tabs>
        </Box>
        {tabValue === TEAM_TAB_INDEX ? (
          <Box sx={{ p: 2 }}>
            <AdminTeamTab />
          </Box>
        ) : (
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
            <Divider />
            <ListItem dense>
              <ListItemText primary="Program" secondary={programFilter.length ? programFilter.join(', ') : 'Any'} />
            </ListItem>
            <Box sx={{ px: 2, py: 1 }}>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={programOptions}
                value={programFilter}
                onChange={(_, v) => setProgramFilter(v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean))}
                renderInput={(params) => <TextField {...params} placeholder="Select or type new program" variant="outlined" />}
                renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} label={opt} size="small" />)}
              />
            </Box>
            <Divider />
            <ListItem dense>
              <ListItemText primary="Cohort" secondary={cohortFilter.length ? cohortFilter.join(', ') : 'Any'} />
            </ListItem>
            <Box sx={{ px: 2, py: 1 }}>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={cohortOptions}
                value={cohortFilter}
                onChange={(_, v) => setCohortFilter(v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean))}
                renderInput={(params) => <TextField {...params} placeholder="Select or type new cohort" variant="outlined" />}
                renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} label={opt} size="small" color="secondary" />)}
              />
            </Box>
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
        )}
      </Paper>

      {/* Bulk actions bar (contacts only) */}
      {tabValue !== TEAM_TAB_INDEX && selectedIds.size > 0 && (
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

      {/* Content (contacts only; Team tab shows AdminTeamTab above) */}
      {tabValue !== TEAM_TAB_INDEX && (loading ? (
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
                <Button startIcon={<AddIcon />} onClick={() => { trackClick?.('CRM - Add contact'); setSaveError(null); setDialogOpen(true); setEditingContact(null); setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', state: '', notes: '', hospitalSystem: '', programs: [], cohorts: [], linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {}, address: '', address2: '', city: '', county: '', zip: '', facilityId: '' }); }} variant="contained" size="large">
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
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="medium" sx={{ minWidth: 140 * (orderedDataColumnIds.length + (visibleColumns.has('actions') ? 1 : 0) + 1) }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ minWidth: 48 }}>
                  <Checkbox
                    checked={displayedContacts.length > 0 && selectedIds.size === displayedContacts.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < displayedContacts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                {orderedDataColumnIds.map((colId) => {
                  const col = getColById(colId);
                  if (!col) return null;
                  const isDragging = draggedColumnId === colId;
                  return (
                    <TableCell
                      key={colId}
                      sx={{ minWidth: 120, whiteSpace: 'nowrap', cursor: 'grab', userSelect: 'none', opacity: isDragging ? 0.6 : 1, bgcolor: isDragging ? 'action.hover' : undefined }}
                      draggable
                      onDragStart={handleColumnDragStart(colId)}
                      onDragEnd={handleColumnDragEnd}
                      onDragOver={handleColumnDragOver}
                      onDrop={(e) => handleColumnDrop(e, colId)}
                    >
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <DragIndicatorIcon sx={{ fontSize: 16, color: 'action.disabled' }} />
                        {col.sortable ? (
                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort(col.id as SortField)}>
                            {col.label}
                            <SortIcon sx={{ fontSize: 16, ml: 0.5, opacity: sortField === col.id ? 1 : 0.4 }} />
                            {sortField === col.id && <Typography component="span" variant="caption" sx={{ ml: 0.25 }}>({sortOrder})</Typography>}
                          </Box>
                        ) : (
                          col.label
                        )}
                      </Box>
                    </TableCell>
                  );
                })}
                {visibleColumns.has('actions') && <TableCell align="right" sx={{ minWidth: 56 }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={1 + orderedDataColumnIds.length + (visibleColumns.has('actions') ? 1 : 0)} align="center" sx={{ py: 10 }}>
                    <ContactsIcon sx={{ fontSize: 64, color: 'action.disabled', display: 'block', mx: 'auto', mb: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
                    </Typography>
                    <Button startIcon={<AddIcon />} onClick={() => { trackClick?.('CRM - Add contact'); setSaveError(null); setDialogOpen(true); setEditingContact(null); setFormData({ type: 'other', name: '', firstName: '', lastName: '', organization: '', email: '', phone: '', status: 'Active', region: '', state: '', notes: '', hospitalSystem: '', programs: [], cohorts: [], linkedOrganizationIds: [], linkedHospitalIds: [], customFields: {}, address: '', address2: '', city: '', county: '', zip: '', facilityId: '' }); }} variant="contained" sx={{ mt: 2 }}>
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
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()} sx={{ minWidth: 48 }}>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onChange={(e) => handleSelectOne(contact.id, e.target.checked)}
                      />
                    </TableCell>
                    {orderedDataColumnIds.map((colId) => (
                      <TableCell key={colId} sx={{ minWidth: 120 }}>
                        {renderCellContent(contact, colId)}
                      </TableCell>
                    ))}
                    {visibleColumns.has('actions') && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()} sx={{ minWidth: 56 }}>
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
      ))}

      {/* Row actions menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { if (detailContact) openDetail(detailContact); setAnchorEl(null); }}>View details</MenuItem>
        {detailContact && isPersonType(detailContact.type) && (
          <MenuItem onClick={() => { setTabValue(TEAM_TAB_INDEX); setSearchParams({ tab: 'team' }); setAnchorEl(null); }}>
            <PersonIcon fontSize="small" sx={{ mr: 1 }} /> Manage in Team tab
          </MenuItem>
        )}
        <MenuItem onClick={() => { if (detailContact) { setEditingContact(detailContact); setFormData({ type: detailContact.type, name: detailContact.name, firstName: detailContact.firstName ?? '', lastName: detailContact.lastName ?? '', organization: detailContact.organization, email: detailContact.email, phone: detailContact.phone, status: detailContact.status, region: detailContact.region, state: detailContact.state ?? '', notes: detailContact.notes, hospitalSystem: detailContact.hospitalSystem ?? '', programs: detailContact.programs ?? [], cohorts: detailContact.cohorts ?? [], linkedOrganizationIds: detailContact.linkedOrganizationIds ?? [], linkedHospitalIds: detailContact.linkedHospitalIds ?? [], customFields: detailContact.customFields ?? {}, address: detailContact.address ?? '', address2: detailContact.address2 ?? '', city: detailContact.city ?? '', county: detailContact.county ?? '', zip: detailContact.zip ?? '', facilityId: detailContact.facilityId ?? '' }); setFullScreenOpen(true); setFullScreenEditMode(true); } setAnchorEl(null); }}>
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
          {!deleteTarget?.bulk && detailContact && isPersonType(detailContact.type) && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              This is an app user (manager/mentor/PECC). They will reappear in the list after refresh. To deactivate or edit them, use the Team tab.
            </Typography>
          )}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Avatar sx={{ width: 48, height: 48, bgcolor: TYPE_COLORS[detailContact.type], fontSize: '1.125rem' }}>
                {(contactDisplayName(detailContact) || '?')[0].toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} noWrap>{contactDisplayName(detailContact)}</Typography>
                <Chip label={TYPE_LABELS[detailContact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[detailContact.type], color: 'white', mt: 0.5 }} />
              </Box>
            </Box>
            {/* Linked organizations & hospitals - shown prominently below name for person types */}
            {isPersonType(detailContact.type) && (() => {
              const linkedOrgs = (detailContact.linkedOrganizationIds ?? []).map(id => contacts.find(c => c.id === id)).filter(Boolean) as Contact[];
              const linkedHospitals = (detailContact.linkedHospitalIds ?? []).map(id => contacts.find(c => c.hospitalId === id || c.id === id)).filter(Boolean) as Contact[];
              return (linkedOrgs.length > 0 || linkedHospitals.length > 0) ? (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Linked to</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {linkedOrgs.map((org) => (
                      <Chip
                        key={org.id}
                        label={org.name}
                        size="small"
                        icon={<BusinessIcon />}
                        onClick={() => { setDetailContact(org); }}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                    {linkedHospitals.map((hosp) => (
                      <Chip
                        key={hosp.id}
                        label={hosp.name}
                        size="small"
                        icon={<LocalHospitalIcon />}
                        onClick={() => { setDetailContact(hosp); }}
                        sx={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Box>
                </Box>
              ) : null;
            })()}
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
              {(detailContact.programs ?? []).length > 0 && (
                <ListItem disablePadding><ListItemText primary="Program(s)" secondary={(detailContact.programs ?? []).join(', ')} /></ListItem>
              )}
              {(detailContact.cohorts ?? []).length > 0 && (
                <ListItem disablePadding><ListItemText primary="Cohort(s)" secondary={(detailContact.cohorts ?? []).join(', ')} /></ListItem>
              )}
              {detailContact.customFields && Object.keys(detailContact.customFields).length > 0 && customFieldDefs.filter(d => d.applicableTypes.includes(detailContact.type)).length > 0 && (
                <>
                  {customFieldDefs.filter(d => d.applicableTypes.includes(detailContact.type) && detailContact.customFields![d.id]).map((d) => (
                    <ListItem key={d.id} disablePadding>
                      {d.allowMultiple ? (
                        <ListItemText 
                          primary={d.label} 
                          secondary={
                            <Box component="span" sx={{ display: 'block' }}>
                              {parseMultiEntryValue(detailContact.customFields![d.id]).length === 0 ? '—' : 
                                parseMultiEntryValue(detailContact.customFields![d.id]).slice(0, 5).map((entry, idx) => (
                                  <Typography key={idx} variant="body2" component="span" sx={{ display: 'block' }}>
                                    {formatEntryDate(entry.date)}: {entry.value}
                                  </Typography>
                                ))
                              }
                              {parseMultiEntryValue(detailContact.customFields![d.id]).length > 5 && (
                                <Typography variant="caption" color="text.secondary">+{parseMultiEntryValue(detailContact.customFields![d.id]).length - 5} more entries</Typography>
                              )}
                            </Box>
                          } 
                        />
                      ) : (
                        <ListItemText primary={d.label} secondary={d.fieldType === 'checkbox' ? (detailContact.customFields![d.id] === 'true' ? 'Yes' : 'No') : (detailContact.customFields![d.id] || '—')} />
                      )}
                    </ListItem>
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
              {(isPersonType(detailContact.type) || (detailContact.type === 'hospital' && detailContact.hospitalId)) && (
                <ListItem disablePadding sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <ListItemText primary="Usage" primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                    <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
                      <Select
                        value={contactUsagePeriod}
                        onChange={(e) => setContactUsagePeriod(e.target.value as '7' | '30' | '90' | 'all')}
                        sx={{ height: 28, fontSize: '0.875rem' }}
                      >
                        <MenuItem value="7">Last 7 days</MenuItem>
                        <MenuItem value="30">Last 30 days</MenuItem>
                        <MenuItem value="90">Last 90 days</MenuItem>
                        <MenuItem value="all">All time</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <ListItemText
                    secondary={contactUsageLoading ? 'Loading…' : contactUsage != null ? `${contactUsage.logins} login(s), ${contactUsage.pageViews} page view(s)` : '—'}
                    secondaryTypographyProps={{ variant: 'body2' }}
                  />
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
              {/* Show address if available */}
              {(detailContact.address || detailContact.city || detailContact.state || detailContact.zip) && (
                <ListItem disablePadding>
                  <ListItemText 
                    primary="Address" 
                    secondary={[detailContact.address, detailContact.address2, [detailContact.city, detailContact.state, detailContact.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ')} 
                  />
                </ListItem>
              )}
            </List>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button fullWidth variant="contained" startIcon={<OpenInFullIcon />} onClick={openFullScreen}>
                Expand to full view
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<EditIcon />} fullWidth onClick={() => {
                  const c = detailContact;
                  setFormData({ type: c.type, name: c.name, firstName: c.firstName ?? '', lastName: c.lastName ?? '', organization: c.organization, email: c.email, phone: c.phone, status: c.status, region: c.region, state: c.state ?? '', notes: c.notes, hospitalSystem: c.hospitalSystem ?? '', programs: c.programs ?? [], cohorts: c.cohorts ?? [], linkedOrganizationIds: c.linkedOrganizationIds ?? [], linkedHospitalIds: c.linkedHospitalIds ?? [], customFields: c.customFields ?? {}, address: c.address ?? '', address2: c.address2 ?? '', city: c.city ?? '', county: c.county ?? '', zip: c.zip ?? '', facilityId: c.facilityId ?? '' });
                  setEditingContact(c);
                  setPanelOpen(false);
                  setFullScreenOpen(true);
                  setFullScreenEditMode(true);
                }}>
                  Edit
                </Button>
                <Button size="small" variant="outlined" startIcon={<EmailIcon />} fullWidth>Email</Button>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Contact detail – full-screen popup (opened via Expand); can switch to edit mode in same view */}
      <Dialog fullScreen open={fullScreenOpen} onClose={() => { setFullScreenOpen(false); setFullScreenEditMode(false); setEditingContact(null); }}>
        {detailContact && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">{fullScreenEditMode ? 'Edit contact' : 'Contact'}</Typography>
              <IconButton onClick={() => { setFullScreenOpen(false); setFullScreenEditMode(false); setEditingContact(null); }}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }} icon={false}>
              <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in contact details or notes.
            </Alert>
            {fullScreenEditMode ? (
              /* Inline edit form in full-screen – same fields as Add/Edit dialog */
              <Grid container spacing={2}>
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
                    <Grid item xs={6}><TextField label="First name" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} fullWidth size="small" required /></Grid>
                    <Grid item xs={6}><TextField label="Last name" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} fullWidth size="small" required /></Grid>
                    <Grid item xs={12}>
                      <Autocomplete multiple size="small" options={contacts.filter(c => c.type === 'organization').map(c => ({ id: c.id, label: c.name }))} filterOptions={(opts, { inputValue }) => filterOptionsBySearch(opts, inputValue)} value={formData.linkedOrganizationIds.map(id => contacts.find(c => c.id === id)).filter(Boolean).map(c => ({ id: c!.id, label: c!.name }))} getOptionLabel={(opt) => opt.label} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_, arr) => setFormData(prev => ({ ...prev, linkedOrganizationIds: arr.map(x => x.id) }))} renderInput={(params) => <TextField {...params} label="Linked organizations" placeholder="Type to search (e.g. Riley, Memorial)" />} />
                    </Grid>
                    <Grid item xs={12}>
                      <Autocomplete multiple size="small" options={contacts.filter(c => c.type === 'hospital' && c.hospitalId).map(c => ({ id: c.hospitalId!, label: ((c.organization || c.hospitalSystem || '').trim()) ? `${(c.organization || c.hospitalSystem || '').trim()} – ${c.name}` : c.name }))} filterOptions={(opts, { inputValue }) => filterOptionsBySearch(opts, inputValue)} value={formData.linkedHospitalIds.map(id => contacts.find(c => c.hospitalId === id || c.id === id)).filter(Boolean).map(c => ({ id: c!.hospitalId || c!.id, label: ((c!.organization || c!.hospitalSystem || '').trim()) ? `${(c!.organization || c!.hospitalSystem || '').trim()} – ${c!.name}` : c!.name }))} getOptionLabel={(opt) => opt.label} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_, arr) => setFormData(prev => ({ ...prev, linkedHospitalIds: arr.map(x => x.id) }))} renderInput={(params) => <TextField {...params} label="Linked hospitals (by organization)" placeholder="Type to search (e.g. Riley, Memorial)" />} />
                    </Grid>
                  </>
                ) : (
                  <>
                    <Grid item xs={12}><TextField label="Hospital name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} fullWidth size="small" required /></Grid>
                    <Grid item xs={12}><TextField label="Facility ID" value={formData.facilityId} onChange={(e) => setFormData(prev => ({ ...prev, facilityId: e.target.value }))} fullWidth size="small" placeholder="Unique identifier for this facility" /></Grid>
                    <Grid item xs={12}><TextField label="Company / Parent organization" value={formData.organization} onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))} fullWidth size="small" placeholder="e.g. health system or owner" /></Grid>
                    <Grid item xs={12}><TextField label="Hospital system" value={formData.hospitalSystem} onChange={(e) => setFormData(prev => ({ ...prev, hospitalSystem: e.target.value }))} fullWidth size="small" placeholder="Health system or network this hospital is part of" /></Grid>
                  </>
                )}
                <Grid item xs={6}><TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={6}><TextField label="Phone" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={6}>
                  <Autocomplete freeSolo size="small" options={regions} value={formData.region || null} inputValue={formData.region} onInputChange={(_, v) => setFormData(prev => ({ ...prev, region: v }))} onChange={(_, v) => setFormData(prev => ({ ...prev, region: v == null ? '' : String(v) }))} renderInput={(params) => <TextField {...params} label="Region" placeholder="Select or type new" />} />
                </Grid>
                <Grid item xs={6}>
                  <Autocomplete freeSolo size="small" options={states} value={formData.state || null} inputValue={formData.state} onInputChange={(_, v) => setFormData(prev => ({ ...prev, state: v }))} onChange={(_, v) => setFormData(prev => ({ ...prev, state: v == null ? '' : String(v) }))} renderInput={(params) => <TextField {...params} label="State" placeholder="e.g. NY, TN, OH" />} />
                </Grid>
                {/* Address fields */}
                <Grid item xs={12}><Divider sx={{ my: 1 }} /><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Address</Typography></Grid>
                <Grid item xs={12}><TextField label="Address Line 1" value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} fullWidth size="small" placeholder="Street address" /></Grid>
                <Grid item xs={12}><TextField label="Address Line 2" value={formData.address2} onChange={(e) => setFormData(prev => ({ ...prev, address2: e.target.value }))} fullWidth size="small" placeholder="Apt, Suite, Unit, etc." /></Grid>
                <Grid item xs={6}><TextField label="City" value={formData.city} onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={6}><TextField label="County" value={formData.county} onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={6}><TextField label="Zip/Postal Code" value={formData.zip} onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value }))} fullWidth size="small" /></Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} label="Status">
                      <MenuItem value="Active">Active</MenuItem><MenuItem value="Inactive">Inactive</MenuItem><MenuItem value="Pending">Pending</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete multiple freeSolo size="small" options={programOptions} value={formData.programs ?? []} onChange={(_, v) => setFormData(prev => ({ ...prev, programs: v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean) }))} renderInput={(params) => <TextField {...params} label="Program(s)" placeholder="Select or type new" />} renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} label={opt} size="small" />)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete multiple freeSolo size="small" options={cohortOptions} value={formData.cohorts ?? []} onChange={(_, v) => setFormData(prev => ({ ...prev, cohorts: v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean) }))} renderInput={(params) => <TextField {...params} label="Cohort(s)" placeholder="Select or type new" />} renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} label={opt} size="small" color="secondary" />)} />
                </Grid>
                <Grid item xs={12}><TextField label="Notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} fullWidth size="small" multiline rows={3} /></Grid>
                {customFieldDefs.filter(d => d.applicableTypes.includes(formData.type)).length > 0 && (
                  <>
                    <Grid item xs={12}><Divider sx={{ mt: 1 }} /><Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>Custom fields</Typography></Grid>
                    {customFieldDefs.filter(d => d.applicableTypes.includes(formData.type)).map((def) => (
                      <Grid item xs={12} key={def.id}>
                        {def.allowMultiple ? (
                          /* Multi-entry field (log mode) */
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>{def.label} <Chip size="small" label="Multiple entries" variant="outlined" sx={{ ml: 1 }} /></Typography>
                            {/* Existing entries */}
                            {parseMultiEntryValue((formData.customFields || {})[def.id]).length > 0 && (
                              <Box sx={{ mb: 1.5 }}>
                                {parseMultiEntryValue((formData.customFields || {})[def.id]).map((entry, idx) => (
                                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, p: 0.5, bgcolor: 'action.hover', borderRadius: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>{formatEntryDate(entry.date)}</Typography>
                                    <Typography variant="body2" sx={{ flex: 1 }}>{entry.value}</Typography>
                                    <IconButton size="small" onClick={() => {
                                      const entries = parseMultiEntryValue((formData.customFields || {})[def.id]).filter((_, i) => i !== idx);
                                      setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: serializeMultiEntryValue(entries) } }));
                                    }}><DeleteIcon fontSize="small" /></IconButton>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            {/* Add new entry */}
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                              <TextField type="date" size="small" label="Date" value={multiEntryNewValues[def.id]?.date ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { ...prev[def.id], date: e.target.value, value: prev[def.id]?.value ?? '' } }))} InputLabelProps={{ shrink: true }} sx={{ width: 150 }} />
                              {def.fieldType === 'short_answer' && <TextField size="small" label="Value" value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value } }))} sx={{ flex: 1 }} />}
                              {def.fieldType === 'paragraph' && <TextField size="small" label="Value" multiline rows={2} value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value } }))} sx={{ flex: 1 }} />}
                              {def.fieldType === 'numeric' && <TextField size="small" type="number" label="Value" value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value } }))} sx={{ flex: 1 }} />}
                              {(def.fieldType === 'dropdown' || def.fieldType === 'dropdown_csv') && <FormControl size="small" sx={{ flex: 1 }}><InputLabel>Value</InputLabel><Select value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value as string } }))} label="Value">{(def.options ?? []).map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</Select></FormControl>}
                              {def.fieldType === 'radio' && <FormControl size="small" sx={{ flex: 1 }}><RadioGroup row value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value } }))}>{(def.options ?? []).map((opt) => <FormControlLabel key={opt} value={opt} control={<Radio size="small" />} label={opt} />)}</RadioGroup></FormControl>}
                              {def.fieldType === 'checkbox' && <FormControlLabel control={<Checkbox size="small" checked={(multiEntryNewValues[def.id]?.value ?? '') === 'true'} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.checked ? 'true' : 'false' } }))} />} label="Checked" />}
                              {def.fieldType === 'date' && <TextField size="small" type="date" label="Value" value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value } }))} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />}
                              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => {
                                const newEntry = multiEntryNewValues[def.id];
                                if (!newEntry?.value?.trim()) return;
                                const entries = parseMultiEntryValue((formData.customFields || {})[def.id]);
                                entries.push({ date: newEntry.date || new Date().toISOString().slice(0, 10), value: newEntry.value });
                                entries.sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first
                                setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: serializeMultiEntryValue(entries) } }));
                                setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: new Date().toISOString().slice(0, 10), value: '' } }));
                              }}>Add</Button>
                            </Box>
                          </Box>
                        ) : (
                          /* Single-value field (standard mode) */
                          <>
                            {def.fieldType === 'checkbox' && <FormControlLabel control={<Checkbox size="small" checked={((formData.customFields || {})[def.id] ?? '') === 'true'} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.checked ? 'true' : 'false' } }))} />} label={def.label} />}
                            {def.fieldType === 'radio' && <FormControl fullWidth size="small"><Typography variant="body2" sx={{ mb: 0.5 }}>{def.label}</Typography><RadioGroup row value={((formData.customFields || {})[def.id] ?? '')} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))}>{(def.options ?? []).map((opt) => <FormControlLabel key={opt} value={opt} control={<Radio size="small" />} label={opt} />)}</RadioGroup></FormControl>}
                            {def.fieldType === 'date' && <TextField label={def.label} type="date" value={((formData.customFields || {})[def.id] ?? '').slice(0, 10)} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" InputLabelProps={{ shrink: true }} />}
                            {def.fieldType === 'numeric' && <TextField label={def.label} type="number" value={(formData.customFields || {})[def.id] ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" inputProps={{ inputMode: 'numeric' }} />}
                            {def.fieldType === 'short_answer' && <TextField label={def.label} value={(formData.customFields || {})[def.id] ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" />}
                            {def.fieldType === 'paragraph' && <TextField label={def.label} multiline rows={3} value={(formData.customFields || {})[def.id] ?? ''} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} fullWidth size="small" />}
                            {(def.fieldType === 'dropdown' || def.fieldType === 'dropdown_csv') && <FormControl fullWidth size="small"><InputLabel>{def.label}</InputLabel><Select value={((formData.customFields || {})[def.id] ?? '')} onChange={(e) => setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: e.target.value } }))} label={def.label}><MenuItem value=""><em>—</em></MenuItem>{(def.options ?? []).map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}</Select></FormControl>}
                          </>
                        )}
                      </Grid>
                    ))}
                  </>
                )}
                <Grid item xs={12} sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button variant="outlined" onClick={() => { setFullScreenEditMode(false); setEditingContact(null); }}>Cancel</Button>
                  <Button variant="contained" onClick={() => handleSaveContact(true)} disabled={saveInProgress}>{saveInProgress ? 'Saving…' : 'Save changes'}</Button>
                </Grid>
              </Grid>
            ) : (
              <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 64, height: 64, bgcolor: TYPE_COLORS[detailContact.type], fontSize: '1.5rem' }}>
                  {(contactDisplayName(detailContact) || '?')[0].toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h5">{contactDisplayName(detailContact)}</Typography>
                  <Chip label={TYPE_LABELS[detailContact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[detailContact.type], color: 'white', mt: 0.5 }} />
                </Box>
              </Box>
              {/* Linked organizations & hospitals - shown prominently below name for person types */}
              {isPersonType(detailContact.type) && (() => {
                const linkedOrgs = (detailContact.linkedOrganizationIds ?? []).map(id => contacts.find(c => c.id === id)).filter(Boolean) as Contact[];
                const linkedHospitals = (detailContact.linkedHospitalIds ?? []).map(id => contacts.find(c => c.hospitalId === id || c.id === id)).filter(Boolean) as Contact[];
                return (linkedOrgs.length > 0 || linkedHospitals.length > 0) ? (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Linked organizations & hospitals</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {linkedOrgs.map((org) => (
                        <Chip
                          key={org.id}
                          label={org.name}
                          size="small"
                          icon={<BusinessIcon />}
                          onClick={() => { setDetailContact(org); }}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                      {linkedHospitals.map((hosp) => (
                        <Chip
                          key={hosp.id}
                          label={hosp.name}
                          size="small"
                          icon={<LocalHospitalIcon />}
                          onClick={() => { setDetailContact(hosp); }}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                ) : null;
              })()}
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
                    {(detailContact.programs ?? []).length > 0 && (
                      <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><BusinessIcon fontSize="small" /></ListItemIcon><ListItemText primary="Program(s)" secondary={(detailContact.programs ?? []).join(', ')} /></ListItem>
                    )}
                    {(detailContact.cohorts ?? []).length > 0 && (
                      <ListItem disablePadding><ListItemIcon sx={{ minWidth: 36 }}><GroupsIcon fontSize="small" /></ListItemIcon><ListItemText primary="Cohort(s)" secondary={(detailContact.cohorts ?? []).join(', ')} /></ListItem>
                    )}
                    {detailContact.customFields && Object.keys(detailContact.customFields).length > 0 && customFieldDefs.filter(d => d.applicableTypes.includes(detailContact.type) && detailContact.customFields![d.id]).map((d) => (
                      <ListItem key={d.id} disablePadding>
                        {d.allowMultiple ? (
                          <ListItemText 
                            primary={d.label} 
                            secondary={
                              <Box component="span" sx={{ display: 'block' }}>
                                {parseMultiEntryValue(detailContact.customFields![d.id]).length === 0 ? '—' : 
                                  parseMultiEntryValue(detailContact.customFields![d.id]).slice(0, 3).map((entry, idx) => (
                                    <Typography key={idx} variant="body2" component="span" sx={{ display: 'block' }}>
                                      {formatEntryDate(entry.date)}: {entry.value}
                                    </Typography>
                                  ))
                                }
                                {parseMultiEntryValue(detailContact.customFields![d.id]).length > 3 && (
                                  <Typography variant="caption" color="text.secondary">+{parseMultiEntryValue(detailContact.customFields![d.id]).length - 3} more</Typography>
                                )}
                              </Box>
                            } 
                          />
                        ) : (
                          <ListItemText primary={d.label} secondary={d.fieldType === 'checkbox' ? (detailContact.customFields![d.id] === 'true' ? 'Yes' : 'No') : (detailContact.customFields![d.id] || '—')} />
                        )}
                      </ListItem>
                    ))}
                    {(isPersonType(detailContact.type) || (detailContact.type === 'hospital' && detailContact.hospitalId)) && (
                      <ListItem disablePadding sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={500}>Usage</Typography>
                          <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
                            <Select
                              value={contactUsagePeriod}
                              onChange={(e) => setContactUsagePeriod(e.target.value as '7' | '30' | '90' | 'all')}
                              sx={{ height: 32, fontSize: '0.875rem' }}
                            >
                              <MenuItem value="7">Last 7 days</MenuItem>
                              <MenuItem value="30">Last 30 days</MenuItem>
                              <MenuItem value="90">Last 90 days</MenuItem>
                              <MenuItem value="all">All time</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {contactUsageLoading ? 'Loading…' : contactUsage != null ? `${contactUsage.logins} login(s), ${contactUsage.pageViews} page view(s)` : '—'}
                        </Typography>
                      </ListItem>
                    )}
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
              {/* PECC page (site) settings: tab visibility + shared access — only for hospital contacts */}
              {detailContact.type === 'hospital' && (detailContact.facilityId != null || detailContact.id) && (
                <Grid container spacing={3} sx={{ mt: 2 }}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>PECC page (site settings)</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      This site is the PECC page. Toggle which tabs PECCs see; add people to share access (e.g. Nurse Manager + PECC share one page). Activities record who submitted for per-person hours.
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Tab visibility for PECCs at this site</Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      {siteSettingsLoading ? (
                        <Typography variant="body2" color="text.secondary">Loading…</Typography>
                      ) : (
                        <FormGroup>
                          {([['activities', 'Activities'], ['snapshot', 'Snapshot'], ['milestones', 'Checklist'], ['education', 'Education'], ['gap-plan', 'Gap Plan'], ['simulation', 'Simulation']] as [string, string][]).map(([k, lbl]) => (
                            <FormControlLabel key={k} control={<Checkbox checked={siteTabVisibility[k] !== false} onChange={(_, v) => currentSiteId && saveSiteTabVisibility(currentSiteId, k, v)} />} label={lbl} />
                          ))}
                        </FormGroup>
                      )}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>People with access (share this page)</Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      {siteSettingsLoading ? (
                        <Typography variant="body2" color="text.secondary">Loading…</Typography>
                      ) : (
                        <>
                          <List dense disablePadding sx={{ mb: 1, maxHeight: 160, overflow: 'auto' }}>
                            {siteMembers.length === 0 ? (
                              <ListItem><ListItemText primary="No one added yet" secondary="Add by email below" /></ListItem>
                            ) : (
                              siteMembers.map((m) => (
                                <ListItem key={m.user_id} disablePadding secondaryAction={<IconButton size="small" onClick={() => currentSiteId && removeSiteMember(currentSiteId, m.user_id)}><DeleteIcon fontSize="small" /></IconButton>}>
                                  <ListItemText primary={[m.first_name, m.last_name].filter(Boolean).join(' ') || m.email || m.user_id} secondary={m.email} />
                                </ListItem>
                              ))
                            )}
                          </List>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField size="small" placeholder="User email" value={addMemberEmail} onChange={(e) => setAddMemberEmail(e.target.value)} sx={{ flex: 1 }} />
                            <Button size="small" variant="contained" startIcon={<PersonAddIcon />} disabled={addMemberLoading || !addMemberEmail.trim()} onClick={() => currentSiteId && addSiteMemberByEmail(currentSiteId, addMemberEmail)}>Add</Button>
                          </Box>
                        </>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              )}
              {!fullScreenEditMode && (
                <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                  <Button variant="outlined" startIcon={<EditIcon />} onClick={() => {
                    const c = detailContact;
                    setFormData({ type: c.type, name: c.name, firstName: c.firstName ?? '', lastName: c.lastName ?? '', organization: c.organization, email: c.email, phone: c.phone, status: c.status, region: c.region, state: c.state ?? '', notes: c.notes, hospitalSystem: c.hospitalSystem ?? '', programs: c.programs ?? [], cohorts: c.cohorts ?? [], linkedOrganizationIds: c.linkedOrganizationIds ?? [], linkedHospitalIds: c.linkedHospitalIds ?? [], customFields: c.customFields ?? {}, address: c.address ?? '', address2: c.address2 ?? '', city: c.city ?? '', county: c.county ?? '', zip: c.zip ?? '', facilityId: c.facilityId ?? '' });
                    setEditingContact(c);
                    setFullScreenEditMode(true);
                  }}>
                    Edit
                  </Button>
                  <Button variant="contained" startIcon={<EmailIcon />}>Email</Button>
                </Box>
              )}
            </>
            )}
            </Box>
          </Box>
        )}
      </Dialog>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingContact(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in contact details or notes.
          </Alert>
          {saveError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
              {saveError}
            </Alert>
          )}
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
                    filterOptions={(opts, { inputValue }) => filterOptionsBySearch(opts, inputValue)}
                    value={formData.linkedOrganizationIds.map(id => contacts.find(c => c.id === id)).filter(Boolean).map(c => ({ id: c!.id, label: c!.name }))}
                    getOptionLabel={(opt) => opt.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, arr) => setFormData(prev => ({ ...prev, linkedOrganizationIds: arr.map(x => x.id) }))}
                    renderInput={(params) => <TextField {...params} label="Linked organizations" placeholder="Type to search (e.g. Riley, Memorial)" />}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    size="small"
                    options={contacts.filter(c => c.type === 'hospital' && c.hospitalId).map(c => ({
                      id: c.hospitalId!,
                      label: ((c.organization || c.hospitalSystem || '').trim()) ? `${(c.organization || c.hospitalSystem || '').trim()} – ${c.name}` : c.name
                    }))}
                    filterOptions={(opts, { inputValue }) => filterOptionsBySearch(opts, inputValue)}
                    value={formData.linkedHospitalIds.map(id => contacts.find(c => c.hospitalId === id || c.id === id)).filter(Boolean).map(c => ({
                      id: c!.hospitalId || c!.id,
                      label: ((c!.organization || c!.hospitalSystem || '').trim()) ? `${(c!.organization || c!.hospitalSystem || '').trim()} – ${c!.name}` : c!.name
                    }))}
                    getOptionLabel={(opt) => opt.label}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, arr) => setFormData(prev => ({ ...prev, linkedHospitalIds: arr.map(x => x.id) }))}
                    renderInput={(params) => <TextField {...params} label="Linked hospitals (by organization)" placeholder="Type to search (e.g. Riley, Memorial)" />}
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
              <Autocomplete
                freeSolo
                size="small"
                options={states}
                value={formData.state || null}
                inputValue={formData.state}
                onInputChange={(_, v) => setFormData(prev => ({ ...prev, state: v }))}
                onChange={(_, v) => setFormData(prev => ({ ...prev, state: v == null ? '' : String(v) }))}
                renderInput={(params) => <TextField {...params} label="State" placeholder="e.g. NY, TN, OH" />}
              />
            </Grid>
            {/* Address fields */}
            <Grid item xs={12}><Divider sx={{ my: 1 }} /><Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Address</Typography></Grid>
            <Grid item xs={12}><TextField label="Address Line 1" value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} fullWidth size="small" placeholder="Street address" /></Grid>
            <Grid item xs={12}><TextField label="Address Line 2" value={formData.address2} onChange={(e) => setFormData(prev => ({ ...prev, address2: e.target.value }))} fullWidth size="small" placeholder="Apt, Suite, Unit, etc." /></Grid>
            <Grid item xs={6}><TextField label="City" value={formData.city} onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid item xs={6}><TextField label="County" value={formData.county} onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))} fullWidth size="small" /></Grid>
            <Grid item xs={6}><TextField label="Zip/Postal Code" value={formData.zip} onChange={(e) => setFormData(prev => ({ ...prev, zip: e.target.value }))} fullWidth size="small" /></Grid>
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
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={programOptions}
                value={formData.programs ?? []}
                onChange={(_, v) => setFormData(prev => ({ ...prev, programs: v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean) }))}
                renderInput={(params) => <TextField {...params} label="Program(s)" placeholder="Select or type new" />}
                renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} label={opt} size="small" />)}
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                size="small"
                options={cohortOptions}
                value={formData.cohorts ?? []}
                onChange={(_, v) => setFormData(prev => ({ ...prev, cohorts: v.map(x => (typeof x === 'string' ? x : '')).filter(Boolean) }))}
                renderInput={(params) => <TextField {...params} label="Cohort(s)" placeholder="Select or type new" />}
                renderTags={(value, getTagProps) => value.map((opt, i) => <Chip {...getTagProps({ index: i })} label={opt} size="small" color="secondary" />)}
              />
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
                    {def.allowMultiple ? (
                      /* Multi-entry field (log mode) */
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>{def.label} <Chip size="small" label="Multiple entries" variant="outlined" sx={{ ml: 1 }} /></Typography>
                        {/* Existing entries */}
                        {parseMultiEntryValue((formData.customFields || {})[def.id]).length > 0 && (
                          <Box sx={{ mb: 1.5, maxHeight: 150, overflow: 'auto' }}>
                            {parseMultiEntryValue((formData.customFields || {})[def.id]).map((entry, idx) => (
                              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, p: 0.5, bgcolor: 'action.hover', borderRadius: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, fontSize: '0.7rem' }}>{formatEntryDate(entry.date)}</Typography>
                                <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>{entry.value}</Typography>
                                <IconButton size="small" onClick={() => {
                                  const entries = parseMultiEntryValue((formData.customFields || {})[def.id]).filter((_, i) => i !== idx);
                                  setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: serializeMultiEntryValue(entries) } }));
                                }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                              </Box>
                            ))}
                          </Box>
                        )}
                        {/* Add new entry */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <TextField type="date" size="small" label="Date" value={multiEntryNewValues[def.id]?.date ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { ...prev[def.id], date: e.target.value, value: prev[def.id]?.value ?? '' } }))} InputLabelProps={{ shrink: true }} sx={{ width: 130 }} />
                          <TextField size="small" label="Value" value={multiEntryNewValues[def.id]?.value ?? ''} onChange={(e) => setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: prev[def.id]?.date ?? new Date().toISOString().slice(0, 10), value: e.target.value } }))} sx={{ flex: 1, minWidth: 120 }} />
                          <Button size="small" variant="outlined" onClick={() => {
                            const newEntry = multiEntryNewValues[def.id];
                            if (!newEntry?.value?.trim()) return;
                            const entries = parseMultiEntryValue((formData.customFields || {})[def.id]);
                            entries.push({ date: newEntry.date || new Date().toISOString().slice(0, 10), value: newEntry.value });
                            entries.sort((a, b) => b.date.localeCompare(a.date));
                            setFormData(prev => ({ ...prev, customFields: { ...(prev.customFields || {}), [def.id]: serializeMultiEntryValue(entries) } }));
                            setMultiEntryNewValues(prev => ({ ...prev, [def.id]: { date: new Date().toISOString().slice(0, 10), value: '' } }));
                          }}>Add</Button>
                        </Box>
                      </Box>
                    ) : (
                      /* Single-value field (standard mode) */
                      <>
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
                      </>
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
      <Dialog open={customFieldsDialogOpen} onClose={() => { setCustomFieldsDialogOpen(false); setEditingDefId(null); setNewDefLabel(''); setNewDefApplicableTypes(['hospital']); setNewDefFieldType('short_answer'); setNewDefOptions(''); setNewDefAllowMultiple(false); setCsvUploadError(null); }} maxWidth="sm" fullWidth>
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
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox size="small" checked={newDefAllowMultiple} onChange={(e) => setNewDefAllowMultiple(e.target.checked)} />}
                label={
                  <Box>
                    <Typography variant="body2">Allow multiple entries (log mode)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Enable for fields like phone calls, visits, etc. where you want to record multiple dated entries
                    </Typography>
                  </Box>
                }
              />
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
                onClick={async () => {
                  if (!newDefLabel.trim() || newDefApplicableTypes.length === 0) return;
                  const opts = newDefOptions.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
                  
                  if (editingDefId) {
                    // Update existing field
                    const updatePayload = { label: newDefLabel.trim(), applicable_types: newDefApplicableTypes, field_type: newDefFieldType, options: opts.length ? opts : [], allow_multiple: newDefAllowMultiple, updated_at: new Date().toISOString() };
                    const { error } = await supabase.from('crm_custom_field_definitions').update(updatePayload).eq('id', editingDefId);
                    if (error) {
                      console.error('Failed to update custom field:', error);
                      setCsvUploadError(`Failed to update field: ${error.message || 'Database error'}. Make sure CRM_TABLES_MIGRATION.sql has been run.`);
                      return;
                    }
                    const updatedDef: CustomFieldDefinition = { id: editingDefId, label: newDefLabel.trim(), applicableTypes: newDefApplicableTypes, fieldType: newDefFieldType, options: opts.length ? opts : undefined, allowMultiple: newDefAllowMultiple };
                    setCustomFieldDefs(prev => prev.map(d => d.id === editingDefId ? updatedDef : d));
                    setEditingDefId(null);
                  } else {
                    // Insert new field - don't send id, let database generate UUID
                    const insertPayload = { label: newDefLabel.trim(), applicable_types: newDefApplicableTypes, field_type: newDefFieldType, options: opts.length ? opts : [], allow_multiple: newDefAllowMultiple, sort_order: 0 };
                    const { data, error } = await supabase.from('crm_custom_field_definitions').insert(insertPayload).select().single();
                    if (error) {
                      console.error('Failed to add custom field:', error);
                      setCsvUploadError(`Failed to add field: ${error.message || 'Database error'}. Make sure CRM_TABLES_MIGRATION.sql has been run.`);
                      return;
                    }
                    const newDef: CustomFieldDefinition = { id: String(data.id), label: newDefLabel.trim(), applicableTypes: newDefApplicableTypes, fieldType: newDefFieldType, options: opts.length ? opts : undefined, allowMultiple: newDefAllowMultiple };
                    setCustomFieldDefs(prev => [...prev, newDef]);
                  }
                  setCsvUploadError(null);
                  setNewDefLabel(''); setNewDefApplicableTypes(['hospital']); setNewDefFieldType('short_answer'); setNewDefOptions(''); setNewDefAllowMultiple(false);
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
              <ListItem key={def.id} secondaryAction={<><IconButton size="small" onClick={() => { setEditingDefId(def.id); setNewDefLabel(def.label); setNewDefApplicableTypes(def.applicableTypes.length ? def.applicableTypes : ['hospital']); setNewDefFieldType(def.fieldType); setNewDefOptions((def.options ?? []).join('\n')); setNewDefAllowMultiple(def.allowMultiple ?? false); }}><EditIcon fontSize="small" /></IconButton><IconButton size="small" onClick={async () => { const { error } = await supabase.from('crm_custom_field_definitions').delete().eq('id', def.id); if (error) { console.error('Failed to delete custom field:', error); setCsvUploadError(`Failed to delete field: ${error.message}`); return; } setCsvUploadError(null); setCustomFieldDefs(prev => prev.filter(d => d.id !== def.id)); }}><DeleteIcon fontSize="small" /></IconButton></>}>
                <ListItemText primary={def.label} secondary={`${CUSTOM_FIELD_TYPE_LABELS[def.fieldType]}${def.allowMultiple ? ' (multiple entries)' : ''} · ${def.applicableTypes.map(t => TYPE_LABELS[t]).join(', ')}`} />
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

      {/* Import – upload CSV file */}
      <Dialog open={importDialogOpen} onClose={() => !importInProgress && setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import contacts from CSV</DialogTitle>
        <DialogContent>
          {importData.length === 0 ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Upload a CSV file with contact data. The first row should contain column headers.
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  sx={{ ml: 1 }}
                  onClick={() => {
                    const templateHeaders = ['First Name', 'Last Name', 'Email', 'Phone', 'Organization', 'Region', 'State', 'Address', 'City', 'County', 'Zip', 'Notes'];
                    const exampleRows = [
                      ['John', 'Smith', 'john.smith@example.com', '555-123-4567', 'Acme Healthcare', 'Midwest', 'Indiana', '123 Main St', 'Indianapolis', 'Marion', '46201', 'Initial contact'],
                      ['Jane', 'Doe', 'jane.doe@example.com', '555-987-6543', 'City Hospital', 'Northeast', 'Ohio', '456 Oak Ave', 'Columbus', 'Franklin', '43215', ''],
                      ['', '', '', '', '', '', '', '', '', '', '', ''],
                    ];
                    const csvContent = [
                      templateHeaders.join(','),
                      ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
                    ].join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'crm-import-template.csv';
                    link.click();
                    URL.revokeObjectURL(link.href);
                  }}
                >
                  Download Template
                </Button>
              </Alert>
              <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
                <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" sx={{ mb: 2 }}>Drag and drop a CSV file here, or click to select</Typography>
                <Button variant="contained" component="label">
                  Choose CSV File
                  <input
                    type="file"
                    accept=".csv,.txt"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFileSelect(file);
                      e.target.value = '';
                    }}
                  />
                </Button>
              </Box>
              {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
                Found {importData.length} row(s) with {importHeaders.length} columns. Map columns below and click Import.
              </Alert>
              
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Contact Type</Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <Select value={importContactType} onChange={(e) => setImportContactType(e.target.value as ContactType)}>
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <MenuItem key={val} value={val}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Column Mapping</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Map CSV columns to contact fields. Auto-detected mappings shown below.
              </Typography>
              
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {[
                  { key: 'name', label: 'Name', required: !isPersonType(importContactType) },
                  { key: 'firstName', label: 'First Name', required: isPersonType(importContactType) },
                  { key: 'lastName', label: 'Last Name', required: isPersonType(importContactType) },
                  { key: 'email', label: 'Email' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'organization', label: 'Organization' },
                  { key: 'region', label: 'Region' },
                  { key: 'state', label: 'State' },
                  { key: 'status', label: 'Status' },
                  { key: 'address', label: 'Address' },
                  { key: 'city', label: 'City' },
                  { key: 'county', label: 'County' },
                  { key: 'zip', label: 'Zip' },
                  { key: 'notes', label: 'Notes' },
                ].map(({ key, label, required }) => (
                  <Grid item xs={6} sm={4} key={key}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{label}{required ? ' *' : ''}</InputLabel>
                      <Select
                        value={importColumnMapping[key] || ''}
                        onChange={(e) => setImportColumnMapping(prev => ({ ...prev, [key]: e.target.value }))}
                        label={`${label}${required ? ' *' : ''}`}
                      >
                        <MenuItem value=""><em>— Not mapped —</em></MenuItem>
                        {importHeaders.map(h => (
                          <MenuItem key={h} value={h}>{h}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
              </Grid>
              
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview (first 5 rows)</Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, mb: 2 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                      {importHeaders.slice(0, 8).map(h => (
                        <th key={h} style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>{h}</th>
                      ))}
                      {importHeaders.length > 8 && <th style={{ padding: '4px 8px' }}>...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {importData.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {importHeaders.slice(0, 8).map(h => (
                          <td key={h} style={{ padding: '4px 8px', borderBottom: '1px solid #eee', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[h]}</td>
                        ))}
                        {importHeaders.length > 8 && <td style={{ padding: '4px 8px' }}>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
              
              {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}
              {importSuccess && <Alert severity="success" sx={{ mb: 2 }}>Successfully imported {importSuccess.count} contact(s)!</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importInProgress}>Cancel</Button>
          {importData.length > 0 && (
            <>
              <Button onClick={() => { setImportData([]); setImportHeaders([]); setImportError(null); setImportSuccess(null); }}>
                Choose Different File
              </Button>
              <Button
                variant="contained"
                startIcon={importInProgress ? <CircularProgress size={16} /> : <UploadIcon />}
                onClick={runImport}
                disabled={importInProgress || importData.length === 0}
              >
                {importInProgress ? 'Importing...' : `Import ${importData.length} Contact(s)`}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCRMPage;
