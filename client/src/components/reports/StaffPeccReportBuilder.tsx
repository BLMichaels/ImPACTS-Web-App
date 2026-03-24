import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Autocomplete,
  CircularProgress,
  Alert,
  Drawer,
  Divider,
  alpha,
  ListSubheader,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Link,
  Menu,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import RefreshIcon from '@mui/icons-material/Refresh';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { supabase } from '../../supabase';
import { format, subDays } from 'date-fns';
import { isSupabaseMissingRelationError } from '../../utils/supabaseErrors';
import {
  buildReportDetailHref,
  saveReportSnapshotForRestore,
  readReportSnapshotRestore,
  clearReportSnapshotRestore,
  loadSavedReportPresets,
  saveReportPreset,
  deleteSavedReportPreset,
  type ReportRowLinkHints,
  type ReportStateSnapshot,
  type SavedReportPreset,
  type StaffReportScopeNav,
} from '../../utils/reportPresets';

export type StaffReportScope = 'admin' | 'manager' | 'mentor';

export type ReportDataset = 'pecc' | 'hospital' | 'organization' | 'staff' | 'contacts';

/** PostgREST returns at most 1000 rows per request unless we paginate. */
const POSTGREST_PAGE = 1000;

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const ACTIVITY_PRESETS = [
  { value: 'any', label: 'Ignore platform activity (include all PECC rows)' },
  { value: '7', label: 'Used platform in last 7 days' },
  { value: '30', label: 'Used platform in last 30 days' },
  { value: '90', label: 'Used platform in last 90 days' },
  { value: 'inactive30', label: 'No activity in last 30 days' },
];

/** Staff report = operational roles, not platform admins (unless explicitly included). */
const STAFF_ROLE_OPTIONS = [
  { value: 'pecc', label: 'PECC' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'manager', label: 'Manager' },
];

/** One row: string cells keyed by column id (includes dynamic CRM keys). */
export interface ReportDataRow {
  id: string;
  cells: Record<string, string>;
  /** Targets for opening CRM / hospital views (not included in exports). */
  linkHints?: ReportRowLinkHints;
}

/** Loaded-row breakdown for PECC dataset (helps reconcile CRM vs report). */
export interface PeccAuditSnapshot {
  userAccountRows: number;
  hospitalContactRows: number;
  crmOrganizationRows: number;
  totalLoadedRows: number;
}

function crmPeccRowId(crmId: string, hospitalId: string | null): string {
  return `crm:${crmId}:${hospitalId ?? 'unlinked'}`;
}

interface ColumnMeta {
  id: string;
  label: string;
  defaultOn: boolean;
  group?: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAllRows<T extends Record<string, unknown>>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await run(from, from + POSTGREST_PAGE - 1);
    if (error) throw error;
    const part = data || [];
    out.push(...part);
    if (part.length < POSTGREST_PAGE) break;
    from += POSTGREST_PAGE;
  }
  return out;
}

/** Same as fetchAllRows but returns [] if the table is missing from PostgREST (404 / PGRST205). */
async function fetchAllRowsOrEmpty<T extends Record<string, unknown>>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await run(from, from + POSTGREST_PAGE - 1);
    if (error) {
      if (isSupabaseMissingRelationError(error)) return [];
      throw error;
    }
    const part = data || [];
    out.push(...part);
    if (part.length < POSTGREST_PAGE) break;
    from += POSTGREST_PAGE;
  }
  return out;
}

async function fetchActiveProgramsList(): Promise<{ id: string; name: string }[]> {
  return fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
    supabase.from('programs').select('id, name').eq('is_active', true).order('name').range(from, to)
  );
}

async function fetchActiveCohortsList(): Promise<{ id: string; name: string }[]> {
  return fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
    supabase.from('cohorts').select('id, name').eq('is_active', true).order('name').range(from, to)
  );
}

async function fetchUserDataBatch(
  userIds: string[],
  dataKeys: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (!userIds.length || !dataKeys.length) return map;
  for (const part of chunk(userIds, 80)) {
    const { data, error } = await supabase
      .from('user_data')
      .select('user_id, data_key, value')
      .in('user_id', part)
      .in('data_key', dataKeys);
    if (error) {
      if (isSupabaseMissingRelationError(error)) return new Map();
      console.warn('user_data batch:', error.message);
      continue;
    }
    (data || []).forEach((row: { user_id: string; data_key: string; value: unknown }) => {
      const uid = row.user_id;
      if (!map.has(uid)) map.set(uid, {});
      map.get(uid)![row.data_key] = row.value;
    });
  }
  return map;
}

function countGapPlans(value: unknown): { total: number; completed: number; open: number } {
  if (!Array.isArray(value)) return { total: 0, completed: 0, open: 0 };
  let completed = 0;
  for (const g of value) {
    if (g && typeof g === 'object' && (g as { status?: string }).status === 'Completed') completed++;
  }
  const total = value.length;
  return { total, completed, open: total - completed };
}

function countActivities(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function checklistPercent(stats: { total: number; completed: number } | undefined): string {
  if (!stats || stats.total <= 0) return '';
  return String(Math.round((stats.completed / stats.total) * 100));
}

async function resolveHospitalIdsForScope(scope: StaffReportScope, userId: string): Promise<string[] | null> {
  if (scope === 'admin') return null;
  const set = new Set<string>();
  if (scope === 'mentor') {
    const rows = await fetchAllRowsOrEmpty<{ hospital_id: string }>((from, to) =>
      supabase
        .from('mentor_hospital_assignments')
        .select('hospital_id')
        .eq('mentor_id', userId)
        .eq('is_active', true)
        .range(from, to)
    );
    rows.forEach((r) => r.hospital_id && set.add(r.hospital_id));
    return [...set];
  }
  const { data: mentors } = await supabase.from('users').select('id').eq('manager_id', userId).eq('role', 'mentor').eq('is_active', true);
  const mentorIds = [...(mentors || []).map((m: { id: string }) => m.id), userId];
  for (const mentorPart of chunk(mentorIds, 80)) {
    const rows = await fetchAllRowsOrEmpty<{ hospital_id: string }>((from, to) =>
      supabase
        .from('mentor_hospital_assignments')
        .select('hospital_id')
        .in('mentor_id', mentorPart)
        .eq('is_active', true)
        .range(from, to)
    );
    rows.forEach((r) => r.hospital_id && set.add(r.hospital_id));
  }
  return [...set];
}

/** Build column list for drawer + exports (order preserved). */
function buildColumnList(
  dataset: ReportDataset,
  hospitalFieldDefs: { id: string; label: string }[],
  orgFieldDefs: { id: string; label: string }[]
): ColumnMeta[] {
  const pecc: ColumnMeta[] = [
    { id: 'accountSource', label: 'Record source', defaultOn: true, group: 'PECC' },
    { id: 'registrationStatus', label: 'Account status', defaultOn: true, group: 'PECC' },
    { id: 'name', label: 'Name', defaultOn: true, group: 'PECC' },
    { id: 'email', label: 'Email', defaultOn: true, group: 'PECC' },
    { id: 'peccPhone', label: 'PECC phone', defaultOn: false, group: 'PECC' },
    { id: 'userCreatedAt', label: 'User created', defaultOn: false, group: 'PECC' },
    { id: 'hospitalName', label: 'Site / hospital', defaultOn: true, group: 'Site (CRM)' },
    { id: 'facilityId', label: 'Facility ID', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalCompany', label: 'Organization (site)', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalAddress', label: 'Site address', defaultOn: false, group: 'Site (CRM)' },
    { id: 'city', label: 'City', defaultOn: true, group: 'Site (CRM)' },
    { id: 'state', label: 'State', defaultOn: true, group: 'Site (CRM)' },
    { id: 'hospitalZip', label: 'ZIP', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalCounty', label: 'County', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalPhone', label: 'Site phone', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalEmail', label: 'Site email', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalSystem', label: 'Hospital system', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalRegion', label: 'Region', defaultOn: false, group: 'Site (CRM)' },
    { id: 'hospitalCrmStatus', label: 'Site CRM status', defaultOn: false, group: 'Site (CRM)' },
    { id: 'traumaLevel', label: 'Trauma level', defaultOn: false, group: 'Site (CRM)' },
    { id: 'edSize', label: 'ED size', defaultOn: false, group: 'Site (CRM)' },
    { id: 'lastLogin', label: 'Last login', defaultOn: true, group: 'Engagement' },
    { id: 'activeWindow', label: 'Met activity filter (user accounts)', defaultOn: true, group: 'Engagement' },
    { id: 'checklistProgress', label: 'Site checklist %', defaultOn: true, group: 'Checklist & gaps' },
    { id: 'activitiesCount', label: 'Activities logged', defaultOn: false, group: 'Checklist & gaps' },
    { id: 'gapPlansTotal', label: 'Gap plans (total)', defaultOn: false, group: 'Checklist & gaps' },
    { id: 'gapPlansOpen', label: 'Gap plans (open)', defaultOn: false, group: 'Checklist & gaps' },
    { id: 'gapPlansCompleted', label: 'Gap plans (completed)', defaultOn: false, group: 'Checklist & gaps' },
    { id: 'mentorName', label: 'Mentor', defaultOn: true, group: 'Team' },
    { id: 'managerName', label: 'Manager', defaultOn: true, group: 'Team' },
    { id: 'programs', label: 'Programs (membership)', defaultOn: true, group: 'Programs & cohorts' },
    { id: 'cohorts', label: 'Cohorts (membership)', defaultOn: true, group: 'Programs & cohorts' },
    { id: 'hospitalPrograms', label: 'Programs (on site record)', defaultOn: false, group: 'Programs & cohorts' },
    { id: 'hospitalCohorts', label: 'Cohorts (on site record)', defaultOn: false, group: 'Programs & cohorts' },
  ];
  hospitalFieldDefs.forEach((d) => {
    pecc.push({
      id: `hcf_${d.id}`,
      label: `Site custom: ${d.label}`,
      defaultOn: false,
      group: 'CRM custom fields (site)',
    });
  });

  const hosp: ColumnMeta[] = [
    { id: 'hospitalName', label: 'Site name', defaultOn: true, group: 'Site' },
    { id: 'facilityId', label: 'Facility ID', defaultOn: true, group: 'Site' },
    { id: 'city', label: 'City', defaultOn: true, group: 'Site' },
    { id: 'state', label: 'State', defaultOn: true, group: 'Site' },
    { id: 'hospitalAddress', label: 'Address', defaultOn: false, group: 'Site' },
    { id: 'hospitalZip', label: 'ZIP', defaultOn: false, group: 'Site' },
    { id: 'hospitalCounty', label: 'County', defaultOn: false, group: 'Site' },
    { id: 'hospitalPhone', label: 'Phone', defaultOn: false, group: 'Site' },
    { id: 'hospitalEmail', label: 'Email', defaultOn: false, group: 'Site' },
    { id: 'hospitalCompany', label: 'Organization', defaultOn: false, group: 'Site' },
    { id: 'hospitalSystem', label: 'Hospital system', defaultOn: true, group: 'Site' },
    { id: 'hospitalRegion', label: 'Region', defaultOn: false, group: 'Site' },
    { id: 'hospitalCrmStatus', label: 'CRM status', defaultOn: false, group: 'Site' },
    { id: 'traumaLevel', label: 'Trauma level', defaultOn: false, group: 'Site' },
    { id: 'edSize', label: 'ED size', defaultOn: false, group: 'Site' },
    { id: 'peccCount', label: 'PECCs at site (all sources, deduped)', defaultOn: true, group: 'Metrics' },
    { id: 'checklistProgress', label: 'Site checklist %', defaultOn: true, group: 'Metrics' },
    { id: 'hospitalPrograms', label: 'Programs (site)', defaultOn: false, group: 'Programs' },
    { id: 'hospitalCohorts', label: 'Cohorts (site)', defaultOn: false, group: 'Programs' },
  ];
  hospitalFieldDefs.forEach((d) => {
    hosp.push({ id: `hcf_${d.id}`, label: `Custom: ${d.label}`, defaultOn: false, group: 'CRM custom fields' });
  });

  const org: ColumnMeta[] = [
    { id: 'orgName', label: 'Name', defaultOn: true, group: 'Organization' },
    { id: 'contactType', label: 'Contact type', defaultOn: true, group: 'Organization' },
    { id: 'orgEmail', label: 'Email', defaultOn: false, group: 'Organization' },
    { id: 'orgPhone', label: 'Phone', defaultOn: false, group: 'Organization' },
    { id: 'city', label: 'City', defaultOn: false, group: 'Organization' },
    { id: 'state', label: 'State', defaultOn: true, group: 'Organization' },
    { id: 'orgRegion', label: 'Region', defaultOn: false, group: 'Organization' },
    { id: 'orgStatus', label: 'Status', defaultOn: true, group: 'Organization' },
    { id: 'linkedHospitals', label: 'Linked hospitals', defaultOn: true, group: 'Organization' },
    { id: 'orgPrograms', label: 'Programs', defaultOn: false, group: 'Organization' },
    { id: 'orgCohorts', label: 'Cohorts', defaultOn: false, group: 'Organization' },
    { id: 'orgCreated', label: 'Created', defaultOn: false, group: 'Organization' },
  ];
  orgFieldDefs.forEach((d) => {
    org.push({ id: `ocf_${d.id}`, label: `Custom: ${d.label}`, defaultOn: false, group: 'CRM custom fields' });
  });

  const staff: ColumnMeta[] = [
    { id: 'name', label: 'Name', defaultOn: true, group: 'Staff' },
    { id: 'email', label: 'Email', defaultOn: true, group: 'Staff' },
    { id: 'userRole', label: 'Primary role', defaultOn: true, group: 'Staff' },
    { id: 'platformAdminAccess', label: 'Platform admin (is_admin)', defaultOn: false, group: 'Staff' },
    { id: 'userPhone', label: 'Phone', defaultOn: false, group: 'Staff' },
    { id: 'lastLogin', label: 'Last login', defaultOn: true, group: 'Staff' },
    { id: 'userCreatedAt', label: 'Created', defaultOn: false, group: 'Staff' },
    { id: 'managerName', label: 'Manager', defaultOn: false, group: 'Staff' },
    { id: 'mentorName', label: 'Mentor', defaultOn: false, group: 'Staff' },
    { id: 'hospitalName', label: 'Primary site', defaultOn: false, group: 'Staff' },
    { id: 'state', label: 'Site state', defaultOn: false, group: 'Staff' },
  ];

  const contactsCols: ColumnMeta[] = [
    { id: 'contactName', label: 'Name', defaultOn: true, group: 'Hospital contact' },
    { id: 'email', label: 'Email', defaultOn: true, group: 'Hospital contact' },
    { id: 'phone', label: 'Phone', defaultOn: false, group: 'Hospital contact' },
    { id: 'hospitalName', label: 'Hospital / site', defaultOn: true, group: 'Hospital contact' },
    { id: 'state', label: 'State', defaultOn: false, group: 'Hospital contact' },
    { id: 'roleAtHospital', label: 'Role at hospital', defaultOn: true, group: 'Hospital contact' },
    { id: 'contactStatus', label: 'Contact status', defaultOn: false, group: 'Hospital contact' },
    { id: 'isPrimary', label: 'Primary contact', defaultOn: false, group: 'Hospital contact' },
    { id: 'isEngaged', label: 'Actively engaged', defaultOn: false, group: 'Hospital contact' },
    { id: 'linkedUser', label: 'Linked user account', defaultOn: true, group: 'Hospital contact' },
    { id: 'notes', label: 'Notes', defaultOn: false, group: 'Hospital contact' },
  ];

  switch (dataset) {
    case 'pecc':
      return pecc;
    case 'hospital':
      return hosp;
    case 'organization':
      return org;
    case 'staff':
      return staff;
    case 'contacts':
      return contactsCols;
    default:
      return pecc;
  }
}

function defaultVisibility(cols: ColumnMeta[]): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  cols.forEach((c) => {
    o[c.id] = c.defaultOn;
  });
  return o;
}

/** Keep saved order, drop removed ids, append new column ids at the end. */
function mergeColumnOrder(prev: string[], metas: ColumnMeta[]): string[] {
  const metaIds = metas.map((c) => c.id);
  const allowed = new Set(metaIds);
  if (prev.length === 0) return metaIds;
  const next = prev.filter((id) => allowed.has(id));
  metaIds.forEach((id) => {
    if (!next.includes(id)) next.push(id);
  });
  return next;
}

function isLinkedNameColumn(dataset: ReportDataset, columnId: string): boolean {
  const map: Record<ReportDataset, string[]> = {
    pecc: ['name'],
    hospital: ['hospitalName'],
    organization: ['orgName'],
    contacts: ['contactName', 'hospitalName'],
    staff: ['name', 'hospitalName'],
  };
  return map[dataset]?.includes(columnId) ?? false;
}

interface Props {
  scope: StaffReportScope;
  actorUserId: string;
}

const StaffPeccReportBuilder: React.FC<Props> = ({ scope, actorUserId }) => {
  const location = useLocation();
  const [dataset, setDataset] = useState<ReportDataset>('pecc');
  const [rows, setRows] = useState<ReportDataRow[]>([]);
  const [programIdsByRow, setProgramIdsByRow] = useState<Record<string, string[]>>({});
  const [cohortIdsByRow, setCohortIdsByRow] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [activityPreset, setActivityPreset] = useState('any');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string[]>(['pecc', 'mentor', 'manager']);
  const [includePlatformAdminAccounts, setIncludePlatformAdminAccounts] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [hospitalCustomDefs, setHospitalCustomDefs] = useState<{ id: string; label: string }[]>([]);
  const [orgCustomDefs, setOrgCustomDefs] = useState<{ id: string; label: string }[]>([]);
  const [columns, setColumns] = useState<Record<string, boolean>>({});
  /** Left-to-right order of all column ids for the current dataset (visibility is separate). */
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [peccAudit, setPeccAudit] = useState<PeccAuditSnapshot | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [savedPresetsTick, setSavedPresetsTick] = useState(0);
  const [savedMenuAnchor, setSavedMenuAnchor] = useState<null | HTMLElement>(null);
  const skipColumnResetRef = useRef(false);
  const skipSortResetRef = useRef(false);
  const dragColumnIdRef = useRef<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const prevDatasetForColumnsRef = useRef<ReportDataset | null>(null);

  const columnMetas = useMemo(
    () => buildColumnList(dataset, hospitalCustomDefs, orgCustomDefs),
    [dataset, hospitalCustomDefs, orgCustomDefs]
  );

  const applySnapshot = useCallback((snap: ReportStateSnapshot) => {
    setDataset(snap.dataset as ReportDataset);
    prevDatasetForColumnsRef.current = snap.dataset as ReportDataset;
    setActivityPreset(snap.activityPreset);
    setProgramFilter(snap.programFilter);
    setCohortFilter(snap.cohortFilter);
    setStaffRoleFilter(snap.staffRoleFilter);
    setIncludePlatformAdminAccounts(snap.includePlatformAdminAccounts);
    setSearch(snap.search);
    setStateFilter(snap.stateFilter);
    setSortBy(snap.sortBy);
    setSortDir(snap.sortDir);
    setColumns(snap.columns);
    setColumnOrder(snap.columnOrder?.length ? snap.columnOrder : []);
    skipColumnResetRef.current = true;
    skipSortResetRef.current = true;
  }, []);

  useLayoutEffect(() => {
    const snap = readReportSnapshotRestore(actorUserId);
    if (snap) {
      applySnapshot(snap);
      clearReportSnapshotRestore(actorUserId);
    }
  }, [actorUserId, applySnapshot]);

  useEffect(() => {
    if (skipColumnResetRef.current) {
      skipColumnResetRef.current = false;
      setColumnOrder((prev) => mergeColumnOrder(prev, columnMetas));
      return;
    }
    setColumns(defaultVisibility(columnMetas));
    const prevDs = prevDatasetForColumnsRef.current;
    prevDatasetForColumnsRef.current = dataset;
    if (prevDs === null || prevDs !== dataset) {
      setColumnOrder(columnMetas.map((c) => c.id));
    } else {
      setColumnOrder((prev) => mergeColumnOrder(prev, columnMetas));
    }
  }, [dataset, columnMetas]);

  useEffect(() => {
    if (skipSortResetRef.current) {
      skipSortResetRef.current = false;
      return;
    }
    if (dataset === 'organization') setSortBy('orgName');
    else if (dataset === 'contacts') setSortBy('contactName');
    else if (dataset === 'hospital') setSortBy('hospitalName');
    else setSortBy('name');
  }, [dataset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: defs, error } = await supabase
        .from('crm_custom_field_definitions')
        .select('id, label, applicable_types')
        .order('sort_order');
      if (cancelled) return;
      if (error) {
        if (isSupabaseMissingRelationError(error)) {
          setHospitalCustomDefs([]);
          setOrgCustomDefs([]);
        } else {
          console.warn('crm_custom_field_definitions:', error.message);
        }
        return;
      }
      const h: { id: string; label: string }[] = [];
      const o: { id: string; label: string }[] = [];
      (defs || []).forEach((row: { id: string; label: string; applicable_types?: string[] }) => {
        const types = Array.isArray(row.applicable_types) ? row.applicable_types : [];
        if (types.includes('hospital')) h.push({ id: String(row.id), label: String(row.label || '') });
        if (types.includes('organization')) o.push({ id: String(row.id), label: String(row.label || '') });
      });
      setHospitalCustomDefs(h.filter((x) => x.id && x.label));
      setOrgCustomDefs(o.filter((x) => x.id && x.label));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setError(null);
    setProgramIdsByRow({});
    setCohortIdsByRow({});
    setPeccAudit(null);
    try {
      const hospitalScope = await resolveHospitalIdsForScope(scope, actorUserId);
      if (hospitalScope && hospitalScope.length === 0 && dataset !== 'staff') {
        setRows([]);
        setPeccAudit(null);
        setLoading(false);
        return;
      }

      let progList: { id: string; name: string }[] = [];
      let coList: { id: string; name: string }[] = [];
      try {
        [progList, coList] = await Promise.all([fetchActiveProgramsList(), fetchActiveCohortsList()]);
      } catch (e) {
        console.warn('programs/cohorts list:', e);
      }
      setPrograms(progList);
      setCohorts(coList);
      const progMap = new Map(progList.map((p) => [p.id, p.name]));
      const coMap = new Map(coList.map((c) => [c.id, c.name]));

      if (dataset === 'pecc') {
        await loadPeccDataset({
          hospitalScope,
          activityPreset,
          progMap,
          coMap,
          setRows,
          setProgramIdsByRow,
          setCohortIdsByRow,
          setPeccAudit,
        });
      } else if (dataset === 'hospital') {
        await loadHospitalDataset({
          hospitalScope,
          progMap,
          setRows,
        });
      } else if (dataset === 'organization') {
        await loadOrganizationDataset({
          hospitalScope,
          scope,
          progMap,
          setRows,
        });
      } else if (dataset === 'contacts') {
        await loadContactsDataset({
          hospitalScope,
          setRows,
        });
      } else {
        await loadStaffDataset({
          scope,
          actorUserId,
          hospitalScope,
          staffRoleFilter,
          includePlatformAdminAccounts,
          setRows,
        });
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load report data');
      setRows([]);
      setPeccAudit(null);
    } finally {
      setLoading(false);
    }
  }, [scope, actorUserId, activityPreset, dataset, staffRoleFilter, includePlatformAdminAccounts]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleColumnIds = useMemo(() => {
    const allowed = new Set(columnMetas.map((c) => c.id));
    return columnOrder.filter((id) => allowed.has(id) && columns[id]);
  }, [columnMetas, columnOrder, columns]);

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => Object.values(r.cells).some((v) => (v || '').toLowerCase().includes(q)));
    }
    if (stateFilter.length) {
      const allow = new Set(stateFilter);
      list = list.filter((r) => {
        const st = r.cells.state || '';
        return st && allow.has(st.toUpperCase());
      });
    }
    if (dataset === 'pecc') {
      if (programFilter !== 'all') {
        list = list.filter((r) => {
          if (r.id.startsWith('hc:') || r.id.startsWith('crm:')) return false;
          return (programIdsByRow[r.id] || []).includes(programFilter);
        });
      }
      if (cohortFilter !== 'all') {
        list = list.filter((r) => {
          if (r.id.startsWith('hc:') || r.id.startsWith('crm:')) return false;
          return (cohortIdsByRow[r.id] || []).includes(cohortFilter);
        });
      }
      if (activityPreset !== 'any') {
        list = list.filter((r) => {
          if (r.id.startsWith('hc:') || r.id.startsWith('crm:')) {
            return activityPreset === 'inactive30';
          }
          return r.cells.activeWindow === 'Yes';
        });
      }
    }
    return list;
  }, [rows, search, stateFilter, dataset, programFilter, cohortFilter, activityPreset, programIdsByRow, cohortIdsByRow]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    const numericSortIds = new Set([
      'peccCount',
      'activitiesCount',
      'gapPlansTotal',
      'gapPlansOpen',
      'gapPlansCompleted',
      'checklistProgress',
    ]);
    copy.sort((a, b) => {
      if (numericSortIds.has(sortBy)) {
        const av = a.cells[sortBy] ?? '';
        const bv = b.cells[sortBy] ?? '';
        const an = parseFloat(String(av).replace(/[^\d.-]/g, '')) || 0;
        const bn = parseFloat(String(bv).replace(/[^\d.-]/g, '')) || 0;
        if (an !== bn) return (an - bn) * dir;
        return String(a.id).localeCompare(String(b.id)) * dir;
      }
      const av = a.cells[sortBy] ?? '';
      const bv = b.cells[sortBy] ?? '';
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
    });
    return copy;
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const handleColumnDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    dragColumnIdRef.current = columnId;
    setDraggingColumnId(columnId);
    e.dataTransfer.setData('text/plain', columnId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleColumnDragEnd = useCallback(() => {
    dragColumnIdRef.current = null;
    setDraggingColumnId(null);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    const sourceId = dragColumnIdRef.current || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetColumnId) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(sourceId);
      const toIdx = next.indexOf(targetColumnId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
    dragColumnIdRef.current = null;
    setDraggingColumnId(null);
  }, []);

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${datasetLabel(dataset)} — ImPACTS`, 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated ${format(new Date(), 'PPpp')} · Scope: ${scope} · Rows: ${sorted.length}`, 14, 22);

    const head = visibleColumnIds.map((id) => columnMetas.find((c) => c.id === id)?.label || id);
    const body = sorted.map((r) => visibleColumnIds.map((id) => r.cells[id] ?? ''));

    autoTable(doc, { head: [head], body, startY: 28, styles: { fontSize: 6 }, headStyles: { fillColor: [33, 150, 243] } });
    doc.save(`impacts-${dataset}-${scope}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportExcel = () => {
    const head = visibleColumnIds.map((id) => columnMetas.find((c) => c.id === id)?.label || id);
    const aoa: string[][] = [head];
    sorted.forEach((r) => {
      aoa.push(visibleColumnIds.map((id) => r.cells[id] ?? ''));
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, datasetLabel(dataset).slice(0, 28));
    XLSX.writeFile(wb, `impacts-${dataset}-${scope}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const columnsByGroup = useMemo(() => {
    const m = new Map<string, ColumnMeta[]>();
    columnMetas.forEach((c) => {
      const g = c.group || 'Other';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    });
    return m;
  }, [columnMetas]);

  const returnTo = `${location.pathname}${location.search}`;

  const pushSnapshotForNavigate = useCallback(() => {
    saveReportSnapshotForRestore(actorUserId, {
      dataset: dataset as ReportStateSnapshot['dataset'],
      activityPreset,
      programFilter,
      cohortFilter,
      staffRoleFilter,
      includePlatformAdminAccounts,
      search,
      stateFilter,
      sortBy,
      sortDir,
      columns,
      columnOrder,
    });
  }, [
    actorUserId,
    dataset,
    activityPreset,
    programFilter,
    cohortFilter,
    staffRoleFilter,
    includePlatformAdminAccounts,
    search,
    stateFilter,
    sortBy,
    sortDir,
    columns,
    columnOrder,
  ]);

  const savedReportPresets = useMemo(() => loadSavedReportPresets(actorUserId), [actorUserId, savedPresetsTick]);

  const buildSnapshot = useCallback(
    (): ReportStateSnapshot => ({
      dataset: dataset as ReportStateSnapshot['dataset'],
      activityPreset,
      programFilter,
      cohortFilter,
      staffRoleFilter,
      includePlatformAdminAccounts,
      search,
      stateFilter,
      sortBy,
      sortDir,
      columns,
      columnOrder,
    }),
    [
      dataset,
      activityPreset,
      programFilter,
      cohortFilter,
      staffRoleFilter,
      includePlatformAdminAccounts,
      search,
      stateFilter,
      sortBy,
      sortDir,
      columns,
      columnOrder,
    ]
  );

  const handleSavePresetConfirm = () => {
    const name = savePresetName.trim() || 'Saved report';
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `preset-${Date.now()}`;
    saveReportPreset(actorUserId, {
      id,
      name,
      createdAt: new Date().toISOString(),
      snapshot: buildSnapshot(),
    });
    setSaveDialogOpen(false);
    setSavePresetName('');
    setSavedPresetsTick((t) => t + 1);
  };

  const renderCellContent = (r: ReportDataRow, cid: string) => {
    const raw = r.cells[cid] || '';
    if (cid === 'activeWindow') {
      return (
        <Chip
          size="small"
          label={raw || '—'}
          color={raw === 'Yes' ? 'success' : raw === 'No' ? 'warning' : 'default'}
          variant="outlined"
          sx={{ height: 20, maxWidth: '100%', fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75, py: 0 } }}
        />
      );
    }
    const hints = r.linkHints;
    const href =
      hints && isLinkedNameColumn(dataset, cid)
        ? buildReportDetailHref(scope as StaffReportScopeNav, hints)
        : null;
    if (href) {
      return (
        <Link
          component={RouterLink}
          to={href}
          state={{ returnTo }}
          onClick={() => pushSnapshotForNavigate()}
          underline="hover"
          fontWeight={500}
          sx={{ fontSize: 'inherit' }}
          color="primary"
        >
          {raw || '—'}
        </Link>
      );
    }
    return raw || '—';
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', boxShadow: (t) => t.shadows[1] }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Advanced reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PECCs (including CRM contacts without accounts), sites, organizations, hospital contacts, and staff — CRM fields, checklists, gap plans, activities, and custom columns. Exports respect your role scope.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => load()}>
              Refresh
            </Button>
            <Button size="small" variant="outlined" onClick={(e) => setSavedMenuAnchor(e.currentTarget)}>
              Load saved layout
            </Button>
            <Menu anchorEl={savedMenuAnchor} open={Boolean(savedMenuAnchor)} onClose={() => setSavedMenuAnchor(null)}>
              {savedReportPresets.length === 0 ? (
                <MenuItem disabled>No saved layouts yet</MenuItem>
              ) : (
                savedReportPresets.map((p) => (
                  <MenuItem
                    key={p.id}
                    onClick={() => {
                      applySnapshot(p.snapshot);
                      setSavedMenuAnchor(null);
                    }}
                    sx={{ pr: 6, position: 'relative' }}
                  >
                    {p.name}
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      aria-label={`Delete ${p.name}`}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        deleteSavedReportPreset(actorUserId, p.id);
                        setSavedPresetsTick((t) => t + 1);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </MenuItem>
                ))
              )}
            </Menu>
            <Button size="small" variant="outlined" startIcon={<BookmarkAddIcon />} onClick={() => setSaveDialogOpen(true)}>
              Save layout
            </Button>
            <Button size="small" variant="outlined" startIcon={<ViewColumnIcon />} onClick={() => setColumnDrawer(true)}>
              Columns
            </Button>
            <Button size="small" variant="contained" color="secondary" startIcon={<PictureAsPdfIcon />} onClick={exportPdf}>
              PDF
            </Button>
            <Button size="small" variant="contained" startIcon={<TableChartIcon />} onClick={exportExcel}>
              Excel
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Report dataset</InputLabel>
                <Select
                  value={dataset}
                  label="Report dataset"
                  onChange={(e) => setDataset(e.target.value as ReportDataset)}
                >
                  <MenuItem value="pecc">PECCs (people at sites)</MenuItem>
                  <MenuItem value="hospital">Hospitals &amp; sites</MenuItem>
                  <MenuItem value="organization">CRM organizations</MenuItem>
                  <MenuItem value="contacts">Hospital contacts (CRM)</MenuItem>
                  <MenuItem value="staff">Staff (mentors, managers, PECCs…)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                placeholder="Search any visible field…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Autocomplete
                multiple
                size="small"
                options={US_STATES}
                value={stateFilter}
                onChange={(_, v) => setStateFilter(v)}
                renderInput={(params) => <TextField {...params} label="State(s)" placeholder="e.g. CT" />}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => <Chip {...getTagProps({ index })} key={option} size="small" label={option} />)
                }
              />
            </Grid>
            {dataset === 'pecc' && (
              <>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Platform activity</InputLabel>
                    <Select value={activityPreset} label="Platform activity" onChange={(e) => setActivityPreset(e.target.value)}>
                      {ACTIVITY_PRESETS.map((p) => (
                        <MenuItem key={p.value} value={p.value}>
                          {p.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Program (membership)</InputLabel>
                    <Select value={programFilter} label="Program (membership)" onChange={(e) => setProgramFilter(e.target.value)}>
                      <MenuItem value="all">All programs</MenuItem>
                      {programs.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Cohort (membership)</InputLabel>
                    <Select value={cohortFilter} label="Cohort (membership)" onChange={(e) => setCohortFilter(e.target.value)}>
                      <MenuItem value="all">All cohorts</MenuItem>
                      {cohorts.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </>
            )}
            {dataset === 'staff' && (
              <>
                <Grid item xs={12} md={5}>
                  <Autocomplete
                    multiple
                    size="small"
                    options={STAFF_ROLE_OPTIONS}
                    getOptionLabel={(o) => o.label}
                    value={STAFF_ROLE_OPTIONS.filter((o) => staffRoleFilter.includes(o.value))}
                    onChange={(_, v) => setStaffRoleFilter(v.map((x) => x.value))}
                    renderInput={(params) => <TextField {...params} label="Include roles" placeholder="Roles" />}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includePlatformAdminAccounts}
                        onChange={(_, v) => setIncludePlatformAdminAccounts(v)}
                        size="small"
                      />
                    }
                    label="Include platform admin accounts"
                  />
                </Grid>
              </>
            )}
          </Grid>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <FilterListIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Showing {sorted.length} of {rows.length} rows (after scope &amp; filters)
            </Typography>
            {scope !== 'admin' && <Chip size="small" label={`Scope: ${scope}`} variant="outlined" />}
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {dataset === 'hospital' && !loading && (
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <Typography variant="caption" color="text.secondary">
              PECCs at site includes platform users with role PECC assigned to the site, PECC-tagged hospital contacts, and CRM PECC people linked to the site. The same email is counted once per site.
            </Typography>
          </Alert>
        )}

        {dataset === 'pecc' && peccAudit && !loading && (
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              PECC row audit (what was loaded)
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 0.5 }}>
              <Chip size="small" variant="outlined" label={`User accounts (role=PECC): ${peccAudit.userAccountRows}`} />
              <Chip size="small" variant="outlined" label={`Hospital contacts (PECC): ${peccAudit.hospitalContactRows}`} />
              <Chip size="small" variant="outlined" label={`CRM organization PECCs: ${peccAudit.crmOrganizationRows}`} />
              <Chip size="small" color="primary" variant="outlined" label={`Total rows: ${peccAudit.totalLoadedRows}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block">
              Visible now: {filtered.length} of {rows.length} loaded rows. Program and cohort filters apply to user accounts only. Platform activity filters apply to user accounts; for &quot;No activity in last 30 days&quot;, hospital/CRM rows without a login are still listed. CRM PECCs can exist in more than one place; this report merges user accounts, hospital_contacts, and crm_organizations (contact_type=pecc).
            </Typography>
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Drag the grip beside a column header to reorder. Click the column title to sort.
            </Typography>
            <TableContainer
              sx={{
                maxHeight: 'min(70vh, 680px)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: (t) => t.shadows[1],
              }}
            >
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& .MuiTableCell-root': {
                    py: 0.5,
                    px: 1,
                    fontSize: '0.8125rem',
                    lineHeight: 1.35,
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    verticalAlign: 'top',
                  },
                  '& .MuiTableCell-head': {
                    py: 0.65,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.1),
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    {visibleColumnIds.map((cid) => (
                      <TableCell
                        key={cid}
                        onDragOver={handleColumnDragOver}
                        onDrop={(e) => handleColumnDrop(e, cid)}
                        sx={{
                          opacity: draggingColumnId === cid ? 0.45 : 1,
                          transition: 'opacity 0.12s ease',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
                          <Box
                            component="span"
                            draggable
                            onDragStart={(e) => handleColumnDragStart(e, cid)}
                            onDragEnd={handleColumnDragEnd}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                              cursor: 'grab',
                              display: 'inline-flex',
                              alignItems: 'center',
                              flexShrink: 0,
                              color: 'text.disabled',
                              '&:active': { cursor: 'grabbing' },
                              touchAction: 'none',
                            }}
                            title="Drag to reorder columns"
                          >
                            <DragIndicatorIcon sx={{ fontSize: 14 }} />
                          </Box>
                          <TableSortLabel
                            active={sortBy === cid}
                            direction={sortBy === cid ? sortDir : 'asc'}
                            onClick={() => toggleSort(cid)}
                            sx={{
                              flex: 1,
                              minWidth: 0,
                              '& .MuiTableSortLabel-icon': { fontSize: '0.85rem' },
                            }}
                          >
                            {columnMetas.find((c) => c.id === cid)?.label || cid}
                          </TableSortLabel>
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow key={r.id} hover>
                      {visibleColumnIds.map((cid) => (
                        <TableCell
                          key={cid}
                          sx={{
                            maxWidth: 240,
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            opacity: draggingColumnId === cid ? 0.45 : 1,
                            transition: 'opacity 0.12s ease',
                          }}
                        >
                          {renderCellContent(r, cid)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save report layout</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={savePresetName}
            onChange={(e) => setSavePresetName(e.target.value)}
            placeholder="e.g. Inactive PECCs — last 30 days"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePresetConfirm}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={columnDrawer} onClose={() => setColumnDrawer(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Visible columns
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Toggle groups; custom fields match CRM definitions. PDF and Excel use the same selection. Reorder columns in the table using the grip icons; order is saved with &quot;Save layout&quot;.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {[...columnsByGroup.entries()].map(([group, list]) => (
            <Box key={group} sx={{ mb: 2 }}>
              <ListSubheader disableSticky sx={{ pl: 0, lineHeight: 2 }}>
                {group}
              </ListSubheader>
              <FormGroup>
                {list.map((col) => (
                  <FormControlLabel
                    key={col.id}
                    control={
                      <Checkbox
                        checked={!!columns[col.id]}
                        onChange={(_, v) => setColumns((c) => ({ ...c, [col.id]: v }))}
                      />
                    }
                    label={col.label}
                  />
                ))}
              </FormGroup>
            </Box>
          ))}
        </Box>
      </Drawer>
    </Paper>
  );
};

function datasetLabel(d: ReportDataset): string {
  switch (d) {
    case 'pecc':
      return 'pecc';
    case 'hospital':
      return 'hospitals';
    case 'organization':
      return 'organizations';
    case 'staff':
      return 'staff';
    case 'contacts':
      return 'contacts';
    default:
      return 'report';
  }
}

async function loadChecklistForHospitals(hospitalIds: string[]): Promise<Map<string, { total: number; completed: number }>> {
  const map = new Map<string, { total: number; completed: number }>();
  if (!hospitalIds.length) return map;
  for (const part of chunk(hospitalIds, 80)) {
    const rows = await fetchAllRowsOrEmpty<{ hospital_id: string; completed: boolean }>((from, to) =>
      supabase.from('site_checklist_progress').select('hospital_id, completed').in('hospital_id', part).range(from, to)
    );
    rows.forEach((row) => {
      const prev = map.get(row.hospital_id) || { total: 0, completed: 0 };
      prev.total += 1;
      if (row.completed) prev.completed += 1;
      map.set(row.hospital_id, prev);
    });
  }
  return map;
}

function peccDedupeKey(source: 'user' | 'hc' | 'crm', id: string, email: string | null | undefined): string {
  const e = (email || '').trim().toLowerCase();
  if (e) return `email:${e}`;
  return `${source}:${id}`;
}

function isPeccHospitalContactRecord(
  c: { user_id: string | null; role_at_hospital: string | null; contact_status?: string | null },
  linkedUserRole: Map<string, string>
): boolean {
  const status = (c.contact_status || '').toLowerCase();
  const roleAt = (c.role_at_hospital || '').toLowerCase();
  const userRole = c.user_id ? (linkedUserRole.get(c.user_id) || '').toLowerCase() : '';
  if (userRole === 'pecc') return true;
  if (status.includes('new pecc') || status.includes('already a pecc')) return true;
  if (roleAt.includes('pecc')) return true;
  return false;
}

async function loadLinkedUserRoles(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const part of chunk(userIds, 80)) {
    const { data } = await supabase.from('users').select('id, role').in('id', part);
    (data || []).forEach((u: { id: string; role: string }) => map.set(u.id, u.role || ''));
  }
  return map;
}

/** PECCs at site: users (role=pecc) + PECC hospital_contacts + CRM PECC orgs linked to the site; dedupe by email when present. */
async function loadPeccCountByHospital(hospitalIds: string[]): Promise<Map<string, number>> {
  const sets = new Map<string, Set<string>>();
  hospitalIds.forEach((id) => sets.set(id, new Set()));
  if (!hospitalIds.length) return new Map();

  const hidAllow = new Set(hospitalIds);

  for (const part of chunk(hospitalIds, 80)) {
    const users = await fetchAllRows<{ id: string; email: string; hospital_facility_id: string | null }>((from, to) =>
      supabase.from('users').select('id, email, hospital_facility_id').eq('role', 'pecc').in('hospital_facility_id', part).range(from, to)
    );
    users.forEach((u) => {
      if (!u.hospital_facility_id) return;
      const s = sets.get(u.hospital_facility_id);
      if (s) s.add(peccDedupeKey('user', u.id, u.email));
    });
  }

  for (const part of chunk(hospitalIds, 80)) {
    const contacts = await fetchAllRowsOrEmpty<{
      id: string;
      hospital_id: string;
      user_id: string | null;
      email: string;
      role_at_hospital: string | null;
      contact_status: string | null;
    }>((from, to) =>
      supabase
        .from('hospital_contacts')
        .select('id, hospital_id, user_id, email, role_at_hospital, contact_status')
        .in('hospital_id', part)
        .range(from, to)
    );
    const linkedIds = [...new Set(contacts.map((c) => c.user_id).filter(Boolean))] as string[];
    const linkedUserRole = await loadLinkedUserRoles(linkedIds);
    contacts.forEach((c) => {
      if (!isPeccHospitalContactRecord(c, linkedUserRole)) return;
      const s = sets.get(c.hospital_id);
      if (s) s.add(peccDedupeKey('hc', c.id, c.email));
    });
  }

  const crmPeccs = await fetchAllRowsOrEmpty<Record<string, unknown>>((from, to) =>
    supabase.from('crm_organizations').select('id, email, linked_hospital_ids').eq('contact_type', 'pecc').range(from, to)
  );
  crmPeccs.forEach((row) => {
    const id = String(row.id);
    const email = row.email != null ? String(row.email) : '';
    const links = Array.isArray(row.linked_hospital_ids) ? (row.linked_hospital_ids as string[]) : [];
    links.forEach((hid) => {
      if (!hidAllow.has(hid)) return;
      const s = sets.get(hid);
      if (s) s.add(peccDedupeKey('crm', id, email));
    });
  });

  const counts = new Map<string, number>();
  sets.forEach((set, hid) => counts.set(hid, set.size));
  return counts;
}

async function loadPeccDataset(params: {
  hospitalScope: string[] | null;
  activityPreset: string;
  progMap: Map<string, string>;
  coMap: Map<string, string>;
  setRows: (r: ReportDataRow[]) => void;
  setProgramIdsByRow: (m: Record<string, string[]>) => void;
  setCohortIdsByRow: (m: Record<string, string[]>) => void;
  setPeccAudit: (a: PeccAuditSnapshot | null) => void;
}): Promise<void> {
  const { hospitalScope, activityPreset, progMap, coMap, setRows, setProgramIdsByRow, setCohortIdsByRow, setPeccAudit } = params;

  let peccs = (await fetchAllRows<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    last_login: string | null;
    hospital_facility_id: string | null;
    mentor_id: string | null;
    manager_id: string | null;
    created_at: string | null;
    is_active: boolean | null;
  }>((from, to) =>
    supabase
      .from('users')
      .select('id, first_name, last_name, email, phone, last_login, hospital_facility_id, mentor_id, manager_id, created_at, is_active')
      .eq('role', 'pecc')
      .order('last_name')
      .range(from, to)
  )) as {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    last_login: string | null;
    hospital_facility_id: string | null;
    mentor_id: string | null;
    manager_id: string | null;
    created_at: string | null;
    is_active: boolean | null;
  }[];

  if (hospitalScope) {
    const allow = new Set(hospitalScope);
    peccs = peccs.filter((p) => p.hospital_facility_id && allow.has(p.hospital_facility_id));
  }

  let hospitalContactRows: {
    id: string;
    hospital_id: string;
    user_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    role_at_hospital: string | null;
    contact_status?: string | null;
  }[] = [];

  if (hospitalScope && hospitalScope.length > 0) {
    hospitalContactRows = await fetchAllRowsOrEmpty((from, to) =>
      supabase
        .from('hospital_contacts')
        .select('id, hospital_id, user_id, first_name, last_name, email, phone, role_at_hospital, contact_status')
        .in('hospital_id', hospitalScope)
        .range(from, to)
    );
  } else if (!hospitalScope) {
    hospitalContactRows = await fetchAllRowsOrEmpty((from, to) =>
      supabase
        .from('hospital_contacts')
        .select('id, hospital_id, user_id, first_name, last_name, email, phone, role_at_hospital, contact_status')
        .range(from, to)
    );
  }

  const linkedUserIds = [...new Set(hospitalContactRows.map((c) => c.user_id).filter(Boolean))] as string[];
  const linkedUserRole = await loadLinkedUserRoles(linkedUserIds);
  const peccHospitalContactRows = hospitalContactRows.filter((c) => isPeccHospitalContactRecord(c, linkedUserRole));

  const crmPeccPeople = await fetchAllRowsOrEmpty<Record<string, unknown>>((from, to) =>
    supabase
      .from('crm_organizations')
      .select('id, name, first_name, last_name, email, phone, linked_hospital_ids, status, contact_type')
      .eq('contact_type', 'pecc')
      .order('last_name')
      .range(from, to)
  );

  const crmPeccRows = crmPeccPeople.flatMap((row) => {
    const links = Array.isArray(row.linked_hospital_ids) ? (row.linked_hospital_ids as string[]) : [];
    const filteredLinks = hospitalScope ? links.filter((hid) => hospitalScope.includes(hid)) : links;
    if (hospitalScope && links.length > 0 && filteredLinks.length === 0) return [];
    if (hospitalScope && links.length === 0) return [];
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.name ?? '');
    const base = {
      id: String(row.id),
      first_name: fullName.split(' ').slice(0, -1).join(' ') || fullName,
      last_name: fullName.split(' ').slice(-1).join(' '),
      email: String(row.email ?? ''),
      phone: row.phone != null ? String(row.phone) : null,
      crm_status: row.status != null ? String(row.status) : '',
    };
    const hospitalIds = (filteredLinks.length ? filteredLinks : [null]) as (string | null)[];
    return hospitalIds.map((hid) => ({ ...base, hospital_id: hid }));
  }) as {
      id: string;
      hospital_id: string | null;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      crm_status: string;
    }[];

  const hidSet = [
    ...new Set([
      ...peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[],
      ...peccHospitalContactRows.map((c) => c.hospital_id),
      ...crmPeccRows.map((c) => c.hospital_id).filter(Boolean) as string[],
    ]),
  ] as string[];
  let hospById = new Map<
    string,
    {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      facility_id: string | null;
      address: string | null;
      zip: string | null;
      county: string | null;
      phone: string | null;
      email: string | null;
      trauma_level: string | null;
      ed_size: string | null;
      region: string | null;
      hospital_system: string | null;
      crm_status: string | null;
      company_name: string | null;
      custom_fields: Record<string, string> | null;
      programs: string[] | null;
      cohorts: string[] | null;
    }
  >();
  if (hidSet.length) {
    type HospRow = {
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      facility_id: string | null;
      address: string | null;
      zip: string | null;
      county: string | null;
      phone: string | null;
      email: string | null;
      trauma_level: string | null;
      ed_size: string | null;
      region: string | null;
      hospital_system: string | null;
      crm_status: string | null;
      company_name: string | null;
      custom_fields: Record<string, string> | null;
      programs: string[] | null;
      cohorts: string[] | null;
    };
    for (const hidPart of chunk(hidSet, 80)) {
      const { data: hospitals, error } = await supabase
        .from('hospitals')
        .select(
          'id, name, facility_id, address, city, state, zip, county, phone, email, trauma_level, ed_size, region, hospital_system, crm_status, company_name, custom_fields, programs, cohorts'
        )
        .in('id', hidPart);
      if (error) throw error;
      (hospitals || []).forEach((h: Record<string, unknown>) => {
        const row: HospRow = {
          id: String(h.id),
          name: String(h.name ?? ''),
          city: h.city != null ? String(h.city) : null,
          state: h.state != null ? String(h.state) : null,
          facility_id: h.facility_id != null ? String(h.facility_id) : null,
          address: h.address != null ? String(h.address) : null,
          zip: h.zip != null ? String(h.zip) : null,
          county: h.county != null ? String(h.county) : null,
          phone: h.phone != null ? String(h.phone) : null,
          email: h.email != null ? String(h.email) : null,
          trauma_level: h.trauma_level != null ? String(h.trauma_level) : null,
          ed_size: h.ed_size != null ? String(h.ed_size) : null,
          region: h.region != null ? String(h.region) : null,
          hospital_system: h.hospital_system != null ? String(h.hospital_system) : null,
          crm_status: h.crm_status != null ? String(h.crm_status) : null,
          company_name: h.company_name != null ? String(h.company_name) : null,
          custom_fields: h.custom_fields && typeof h.custom_fields === 'object' ? (h.custom_fields as Record<string, string>) : null,
          programs: Array.isArray(h.programs) ? (h.programs as string[]) : null,
          cohorts: Array.isArray(h.cohorts) ? (h.cohorts as string[]) : null,
        };
        hospById.set(row.id, row);
      });
    }
  }

  const mentorIds = [...new Set(peccs.map((p) => p.mentor_id).filter(Boolean))] as string[];
  const managerIds = [...new Set(peccs.map((p) => p.manager_id).filter(Boolean))] as string[];
  const staffIds = [...new Set([...mentorIds, ...managerIds])];
  const { data: staff } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', staffIds.length ? staffIds : ['00000000-0000-0000-0000-000000000000']);
  const staffName = (id: string | null) => {
    if (!id) return '—';
    const u = (staff || []).find((s: { id: string }) => s.id === id);
    return u ? `${(u as { first_name?: string }).first_name || ''} ${(u as { last_name?: string }).last_name || ''}`.trim() || '—' : '—';
  };

  const pm = await fetchAllRowsOrEmpty<{ program_id: string; user_id: string }>((from, to) =>
    supabase.from('program_members').select('program_id, user_id').eq('status', 'active').range(from, to)
  );
  const cm = await fetchAllRowsOrEmpty<{ cohort_id: string; user_id: string }>((from, to) =>
    supabase.from('cohort_members').select('cohort_id, user_id').eq('status', 'active').range(from, to)
  );

  const programLabelsFor = (uid: string) => {
    const ids = (pm || []).filter((x: { user_id: string }) => x.user_id === uid).map((x: { program_id: string }) => x.program_id);
    return ids.map((id: string) => progMap.get(id) || id).filter(Boolean).join('; ') || '';
  };
  const cohortLabelsFor = (uid: string) => {
    const ids = (cm || []).filter((x: { user_id: string }) => x.user_id === uid).map((x: { cohort_id: string }) => x.cohort_id);
    return ids.map((id: string) => coMap.get(id) || id).filter(Boolean).join('; ') || '';
  };

  const pidMap: Record<string, string[]> = {};
  const cidMap: Record<string, string[]> = {};
  peccs.forEach((p) => {
    pidMap[p.id] = (pm || []).filter((x: { user_id: string }) => x.user_id === p.id).map((x: { program_id: string }) => x.program_id);
    cidMap[p.id] = (cm || []).filter((x: { user_id: string }) => x.user_id === p.id).map((x: { cohort_id: string }) => x.cohort_id);
  });
  peccHospitalContactRows.forEach((c) => {
    const key = `hc:${c.id}`;
    pidMap[key] = [];
    cidMap[key] = [];
  });
  crmPeccRows.forEach((c) => {
    const key = crmPeccRowId(c.id, c.hospital_id);
    pidMap[key] = [];
    cidMap[key] = [];
  });
  setProgramIdsByRow(pidMap);
  setCohortIdsByRow(cidMap);

  const peccIds = peccs.map((p) => p.id);
  let usageInWindow = new Set<string>();
  if (peccIds.length && activityPreset !== 'any' && activityPreset !== 'inactive30') {
    const days = parseInt(activityPreset, 10);
    const sinceIso = subDays(new Date(), days).toISOString();
    for (const part of chunk(peccIds, 100)) {
      const evRows = await fetchAllRowsOrEmpty<{ user_id: string }>((from, to) =>
        supabase.from('usage_events').select('user_id').in('user_id', part).gte('created_at', sinceIso).range(from, to)
      );
      for (const e of evRows) usageInWindow.add(e.user_id);
    }
  } else if (activityPreset === 'inactive30' && peccIds.length) {
    const sinceIso = subDays(new Date(), 30).toISOString();
    for (const part of chunk(peccIds, 100)) {
      const evRows = await fetchAllRowsOrEmpty<{ user_id: string }>((from, to) =>
        supabase.from('usage_events').select('user_id').in('user_id', part).gte('created_at', sinceIso).range(from, to)
      );
      for (const e of evRows) usageInWindow.add(e.user_id);
    }
  }

  const checklistByHospital = await loadChecklistForHospitals(hidSet);

  const udMap = await fetchUserDataBatch(peccIds, ['gapPlans', 'activities']);

  const userRows: ReportDataRow[] = peccs.map((p) => {
    const h = p.hospital_facility_id ? hospById.get(p.hospital_facility_id) : null;
    let activeInWindow = true;
    if (activityPreset === 'any') {
      activeInWindow = true;
    } else if (activityPreset === 'inactive30') {
      const since30 = subDays(new Date(), 30);
      const loginRecent = !!(p.last_login && new Date(p.last_login) >= since30);
      activeInWindow = !usageInWindow.has(p.id) && !loginRecent;
    } else if (['7', '30', '90'].includes(activityPreset)) {
      const days = parseInt(activityPreset, 10);
      const since = subDays(new Date(), days);
      const loginOk = !!(p.last_login && new Date(p.last_login) >= since);
      activeInWindow = usageInWindow.has(p.id) || loginOk;
    }

    const chk = p.hospital_facility_id ? checklistByHospital.get(p.hospital_facility_id) : undefined;
    const gap = countGapPlans(udMap.get(p.id)?.gapPlans);
    const actCount = countActivities(udMap.get(p.id)?.activities);

    const cf = h?.custom_fields || {};
    const registrationStatus = !p.is_active ? 'Inactive' : p.last_login ? 'Active' : 'Invited / pending login';
    const cells: Record<string, string> = {
      accountSource: 'User account',
      registrationStatus,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      email: p.email || '',
      peccPhone: p.phone || '',
      userCreatedAt: p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd') : '',
      hospitalName: h?.name || '',
      facilityId: h?.facility_id || '',
      hospitalCompany: h?.company_name || '',
      hospitalAddress: h?.address || '',
      city: h?.city || '',
      state: (h?.state || '').toString().toUpperCase(),
      hospitalZip: h?.zip || '',
      hospitalCounty: h?.county || '',
      hospitalPhone: h?.phone || '',
      hospitalEmail: h?.email || '',
      hospitalSystem: h?.hospital_system || '',
      hospitalRegion: h?.region || '',
      hospitalCrmStatus: h?.crm_status || '',
      traumaLevel: h?.trauma_level || '',
      edSize: h?.ed_size || '',
      lastLogin: p.last_login ? format(new Date(p.last_login), 'yyyy-MM-dd') : '',
      activeWindow: activeInWindow ? 'Yes' : 'No',
      checklistProgress: checklistPercent(chk) + (chk && chk.total > 0 ? '%' : ''),
      activitiesCount: String(actCount),
      gapPlansTotal: String(gap.total),
      gapPlansOpen: String(gap.open),
      gapPlansCompleted: String(gap.completed),
      mentorName: staffName(p.mentor_id),
      managerName: staffName(p.manager_id),
      programs: programLabelsFor(p.id),
      cohorts: cohortLabelsFor(p.id),
      hospitalPrograms: (h?.programs || []).map((id) => progMap.get(id) || id).join('; '),
      hospitalCohorts: (h?.cohorts || []).map((id) => coMap.get(id) || id).join('; '),
    };

    Object.keys(cf).forEach((k) => {
      cells[`hcf_${k}`] = cf[k] ?? '';
    });

    return { id: p.id, cells, linkHints: { userId: p.id } };
  });

  const contactRows: ReportDataRow[] = peccHospitalContactRows.map((c) => {
    const h = hospById.get(c.hospital_id);
    const chk = c.hospital_id ? checklistByHospital.get(c.hospital_id) : undefined;
    const cf = h?.custom_fields || {};

    const cells: Record<string, string> = {
      accountSource: 'Hospital contact (no user account yet)',
      registrationStatus: c.user_id ? 'Linked to user account' : 'No user account (hospital contact)',
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      email: c.email || '',
      peccPhone: c.phone || '',
      userCreatedAt: '',
      hospitalName: h?.name || '',
      facilityId: h?.facility_id || '',
      hospitalCompany: h?.company_name || '',
      hospitalAddress: h?.address || '',
      city: h?.city || '',
      state: (h?.state || '').toString().toUpperCase(),
      hospitalZip: h?.zip || '',
      hospitalCounty: h?.county || '',
      hospitalPhone: h?.phone || '',
      hospitalEmail: h?.email || '',
      hospitalSystem: h?.hospital_system || '',
      hospitalRegion: h?.region || '',
      hospitalCrmStatus: h?.crm_status || '',
      traumaLevel: h?.trauma_level || '',
      edSize: h?.ed_size || '',
      lastLogin: '',
      activeWindow: 'N/A',
      checklistProgress: checklistPercent(chk) + (chk && chk.total > 0 ? '%' : ''),
      activitiesCount: '0',
      gapPlansTotal: '0',
      gapPlansOpen: '0',
      gapPlansCompleted: '0',
      mentorName: '—',
      managerName: '—',
      programs: '',
      cohorts: '',
      hospitalPrograms: (h?.programs || []).map((id) => progMap.get(id) || id).join('; '),
      hospitalCohorts: (h?.cohorts || []).map((id) => coMap.get(id) || id).join('; '),
    };

    Object.keys(cf).forEach((k) => {
      cells[`hcf_${k}`] = cf[k] ?? '';
    });

    return { id: `hc:${c.id}`, cells, linkHints: { hospitalContactId: c.id, hospitalId: c.hospital_id } };
  });

  const crmRows: ReportDataRow[] = crmPeccRows.map((c) => {
    const h = c.hospital_id ? hospById.get(c.hospital_id) : null;
    const chk = c.hospital_id ? checklistByHospital.get(c.hospital_id) : undefined;
    const cf = h?.custom_fields || {};

    const cells: Record<string, string> = {
      accountSource: 'CRM PECC contact',
      registrationStatus: 'No user account (CRM only)',
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      email: c.email || '',
      peccPhone: c.phone || '',
      userCreatedAt: '',
      hospitalName: h?.name || '',
      facilityId: h?.facility_id || '',
      hospitalCompany: h?.company_name || '',
      hospitalAddress: h?.address || '',
      city: h?.city || '',
      state: (h?.state || '').toString().toUpperCase(),
      hospitalZip: h?.zip || '',
      hospitalCounty: h?.county || '',
      hospitalPhone: h?.phone || '',
      hospitalEmail: h?.email || '',
      hospitalSystem: h?.hospital_system || '',
      hospitalRegion: h?.region || '',
      hospitalCrmStatus: h?.crm_status || c.crm_status || '',
      traumaLevel: h?.trauma_level || '',
      edSize: h?.ed_size || '',
      lastLogin: '',
      activeWindow: 'N/A',
      checklistProgress: checklistPercent(chk) + (chk && chk.total > 0 ? '%' : ''),
      activitiesCount: '0',
      gapPlansTotal: '0',
      gapPlansOpen: '0',
      gapPlansCompleted: '0',
      mentorName: '—',
      managerName: '—',
      programs: '',
      cohorts: '',
      hospitalPrograms: (h?.programs || []).map((id) => progMap.get(id) || id).join('; '),
      hospitalCohorts: (h?.cohorts || []).map((id) => coMap.get(id) || id).join('; '),
    };

    Object.keys(cf).forEach((k) => {
      cells[`hcf_${k}`] = cf[k] ?? '';
    });

    return {
      id: crmPeccRowId(c.id, c.hospital_id),
      cells,
      linkHints: { crmContactId: c.id, hospitalId: c.hospital_id || undefined },
    };
  });

  const merged = [...userRows, ...contactRows, ...crmRows];
  setPeccAudit({
    userAccountRows: userRows.length,
    hospitalContactRows: contactRows.length,
    crmOrganizationRows: crmRows.length,
    totalLoadedRows: merged.length,
  });
  setRows(merged);
}

async function loadHospitalDataset(params: {
  hospitalScope: string[] | null;
  progMap: Map<string, string>;
  setRows: (r: ReportDataRow[]) => void;
}): Promise<void> {
  const { hospitalScope, progMap, setRows } = params;
  const coList = await fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
    supabase.from('cohorts').select('id, name').eq('is_active', true).order('name').range(from, to)
  );
  const cohortMap = new Map(coList.map((c) => [c.id, c.name]));

  const hospitalSelect =
    'id, name, facility_id, address, city, state, zip, county, phone, email, trauma_level, ed_size, region, hospital_system, crm_status, company_name, custom_fields, programs, cohorts';

  let hospitals: Record<string, unknown>[] = [];
  if (hospitalScope && hospitalScope.length) {
    for (const part of chunk(hospitalScope, 80)) {
      const partRows = await fetchAllRows<Record<string, unknown>>((from, to) =>
        supabase.from('hospitals').select(hospitalSelect).in('id', part).eq('is_active', true).order('name').range(from, to)
      );
      hospitals.push(...partRows);
    }
    hospitals.sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' }));
  } else if (!hospitalScope) {
    hospitals = await fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase.from('hospitals').select(hospitalSelect).eq('is_active', true).order('name').range(from, to)
    );
  } else {
    setRows([]);
    return;
  }

  const ids = hospitals.map((h) => String(h.id));
  const peccCounts = ids.length ? await loadPeccCountByHospital(ids) : new Map<string, number>();

  const checklistByHospital = await loadChecklistForHospitals(ids);

  const rows: ReportDataRow[] = hospitals.map((h: Record<string, unknown>) => {
    const id = String(h.id);
    const custom = (h.custom_fields && typeof h.custom_fields === 'object' ? h.custom_fields : {}) as Record<string, string>;
    const stats = checklistByHospital.get(id);
    const cells: Record<string, string> = {
      hospitalName: String(h.name ?? ''),
      facilityId: h.facility_id != null ? String(h.facility_id) : '',
      city: h.city != null ? String(h.city) : '',
      state: h.state != null ? String(h.state).toUpperCase() : '',
      hospitalAddress: h.address != null ? String(h.address) : '',
      hospitalZip: h.zip != null ? String(h.zip) : '',
      hospitalCounty: h.county != null ? String(h.county) : '',
      hospitalPhone: h.phone != null ? String(h.phone) : '',
      hospitalEmail: h.email != null ? String(h.email) : '',
      hospitalCompany: h.company_name != null ? String(h.company_name) : '',
      hospitalSystem: h.hospital_system != null ? String(h.hospital_system) : '',
      hospitalRegion: h.region != null ? String(h.region) : '',
      hospitalCrmStatus: h.crm_status != null ? String(h.crm_status) : '',
      traumaLevel: h.trauma_level != null ? String(h.trauma_level) : '',
      edSize: h.ed_size != null ? String(h.ed_size) : '',
      peccCount: String(peccCounts.get(id) ?? 0),
      checklistProgress: checklistPercent(stats) + (stats && stats.total > 0 ? '%' : ''),
      hospitalPrograms: (Array.isArray(h.programs) ? h.programs : []).map((x: string) => progMap.get(x) || x).join('; '),
      hospitalCohorts: (Array.isArray(h.cohorts) ? h.cohorts : []).map((x: string) => cohortMap.get(x) || x).join('; '),
    };
    Object.keys(custom).forEach((k) => {
      cells[`hcf_${k}`] = custom[k] ?? '';
    });
    return { id, cells, linkHints: { hospitalId: id } };
  });

  setRows(rows);
}

async function loadOrganizationDataset(params: {
  hospitalScope: string[] | null;
  scope: StaffReportScope;
  progMap: Map<string, string>;
  setRows: (r: ReportDataRow[]) => void;
}): Promise<void> {
  const { hospitalScope, scope, progMap, setRows } = params;
  const coList = await fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
    supabase.from('cohorts').select('id, name').eq('is_active', true).order('name').range(from, to)
  );
  const coMap = new Map(coList.map((c) => [c.id, c.name]));

  const orgs = await fetchAllRowsOrEmpty<Record<string, unknown>>((from, to) =>
    supabase
      .from('crm_organizations')
      .select(
        'id, name, first_name, last_name, organization, email, phone, region, state, status, custom_fields, programs, cohorts, created_at, contact_type, linked_hospital_ids'
      )
      .order('name')
      .range(from, to)
  );

  const hospNames = await fetchAllRowsOrEmpty<{ id: string; name: string }>((from, to) =>
    supabase.from('hospitals').select('id, name').order('id').range(from, to)
  );
  const hidToName = new Map(hospNames.map((h) => [h.id, h.name]));

  const scopeSet = hospitalScope === null ? null : new Set(hospitalScope);

  const filtered = orgs.filter((row: Record<string, unknown>) => {
    if (scope === 'admin' || hospitalScope === null) return true;
    if (hospitalScope.length === 0) return false;
    const links = Array.isArray(row.linked_hospital_ids) ? (row.linked_hospital_ids as string[]) : [];
    if (links.length === 0) return false;
    return links.some((hid) => scopeSet!.has(hid));
  });

  const rows: ReportDataRow[] = filtered.map((row: Record<string, unknown>) => {
    const id = String(row.id);
    const rawType = String(row.contact_type ?? 'organization');
    const isPerson = ['mentor', 'pecc', 'manager', 'staff', 'other'].includes(rawType);
    const displayName = isPerson
      ? [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.name ?? '')
      : String(row.name ?? '');
    const links = Array.isArray(row.linked_hospital_ids) ? (row.linked_hospital_ids as string[]) : [];
    const linkedLabels = links.map((hid) => hidToName.get(hid) || hid).join('; ');
    const custom = (row.custom_fields && typeof row.custom_fields === 'object' ? row.custom_fields : {}) as Record<string, string>;
    const progs = Array.isArray(row.programs) ? (row.programs as string[]) : [];
    const cos = Array.isArray(row.cohorts) ? (row.cohorts as string[]) : [];

    const cells: Record<string, string> = {
      orgName: displayName,
      contactType: rawType,
      orgEmail: String(row.email ?? ''),
      orgPhone: String(row.phone ?? ''),
      city: row.city != null ? String(row.city) : '',
      state: row.state != null ? String(row.state).toUpperCase() : '',
      orgRegion: String(row.region ?? ''),
      orgStatus: String(row.status ?? ''),
      linkedHospitals: linkedLabels,
      orgPrograms: progs.map((x) => progMap.get(x) || x).join('; '),
      orgCohorts: cos.map((x) => coMap.get(x) || x).join('; '),
      orgCreated: row.created_at ? format(new Date(String(row.created_at)), 'yyyy-MM-dd') : '',
    };
    Object.keys(custom).forEach((k) => {
      cells[`ocf_${k}`] = custom[k] ?? '';
    });
    return { id, cells, linkHints: { crmContactId: id } };
  });

  setRows(rows);
}

async function loadContactsDataset(params: {
  hospitalScope: string[] | null;
  setRows: (r: ReportDataRow[]) => void;
}): Promise<void> {
  const { hospitalScope, setRows } = params;

  type HcRow = {
    id: string;
    hospital_id: string;
    user_id: string | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    role_at_hospital: string | null;
    contact_status: string;
    is_primary_contact: boolean;
    is_actively_engaged: boolean;
    notes: string | null;
  };

  const hcSelect =
    'id, hospital_id, user_id, first_name, last_name, email, phone, role_at_hospital, contact_status, is_primary_contact, is_actively_engaged, notes';

  let contacts: HcRow[] = [];
  if (hospitalScope && hospitalScope.length > 0) {
    for (const hidPart of chunk(hospitalScope, 80)) {
      const part = await fetchAllRowsOrEmpty<HcRow>((from, to) =>
        supabase.from('hospital_contacts').select(hcSelect).in('hospital_id', hidPart).order('last_name').range(from, to)
      );
      contacts.push(...part);
    }
  } else if (!hospitalScope) {
    contacts = await fetchAllRowsOrEmpty<HcRow>((from, to) =>
      supabase.from('hospital_contacts').select(hcSelect).order('last_name').range(from, to)
    );
  } else {
    setRows([]);
    return;
  }

  const hospitalIds = [...new Set(contacts.map((c) => c.hospital_id))];
  const hospById = new Map<string, { name: string; state: string | null }>();
  for (const hidPart of chunk(hospitalIds, 80)) {
    const { data: hospChunk, error } = await supabase.from('hospitals').select('id, name, state').in('id', hidPart);
    if (error) throw error;
    (hospChunk || []).forEach((h: { id: string; name: string; state: string | null }) => {
      hospById.set(h.id, { name: h.name, state: h.state });
    });
  }

  const userIds = [...new Set(contacts.map((c) => c.user_id).filter(Boolean))] as string[];
  const userById = new Map<string, { email: string; first_name?: string; last_name?: string }>();
  for (const uidPart of chunk(userIds, 80)) {
    const { data: usersChunk, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .in('id', uidPart);
    if (error) throw error;
    (usersChunk || []).forEach((u: { id: string; email: string; first_name?: string; last_name?: string }) => {
      userById.set(u.id, u);
    });
  }

  const rows: ReportDataRow[] = contacts.map((c) => {
    const h = hospById.get(c.hospital_id);
    const u = c.user_id ? userById.get(c.user_id) : null;
    const linked =
      u && u.email
        ? `${`${u.first_name || ''} ${u.last_name || ''}`.trim()} (${u.email})`
        : c.user_id
          ? String(c.user_id)
          : 'None';
    return {
      id: c.id,
      cells: {
        contactName: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email || '',
        phone: c.phone || '',
        hospitalName: h?.name || '',
        state: h?.state ? String(h.state).toUpperCase() : '',
        roleAtHospital: c.role_at_hospital || '',
        contactStatus: c.contact_status || '',
        isPrimary: c.is_primary_contact ? 'Yes' : 'No',
        isEngaged: c.is_actively_engaged ? 'Yes' : 'No',
        linkedUser: linked,
        notes: c.notes || '',
      },
      linkHints: { hospitalContactId: c.id, hospitalId: c.hospital_id },
    };
  });

  setRows(rows);
}

async function loadStaffDataset(params: {
  scope: StaffReportScope;
  actorUserId: string;
  hospitalScope: string[] | null;
  staffRoleFilter: string[];
  includePlatformAdminAccounts: boolean;
  setRows: (r: ReportDataRow[]) => void;
}): Promise<void> {
  const { scope, actorUserId, hospitalScope, staffRoleFilter, includePlatformAdminAccounts, setRows } = params;

  if (!staffRoleFilter.length) {
    setRows([]);
    return;
  }

  let allowedIds: string[] | null = null;

  if (scope === 'admin') {
    allowedIds = null;
  } else if (scope === 'manager') {
    const { data: mentors } = await supabase.from('users').select('id').eq('manager_id', actorUserId).eq('role', 'mentor').eq('is_active', true);
    const mentorIds = (mentors || []).map((m: { id: string }) => m.id);
    const hs = hospitalScope || [];
    const peccIdSet = new Set<string>();
    if (hs.length > 0) {
      for (const hpart of chunk(hs, 80)) {
        const rows = await fetchAllRowsOrEmpty<{ id: string }>((from, to) =>
          supabase.from('users').select('id').eq('role', 'pecc').eq('is_active', true).in('hospital_facility_id', hpart).range(from, to)
        );
        rows.forEach((r) => peccIdSet.add(r.id));
      }
    }
    const peccIds = [...peccIdSet];
    allowedIds = [...new Set([actorUserId, ...mentorIds, ...peccIds])];
  } else {
    const hs = hospitalScope || [];
    const peccIdSet = new Set<string>();
    if (hs.length > 0) {
      for (const hpart of chunk(hs, 80)) {
        const rows = await fetchAllRowsOrEmpty<{ id: string }>((from, to) =>
          supabase.from('users').select('id').eq('role', 'pecc').eq('is_active', true).in('hospital_facility_id', hpart).range(from, to)
        );
        rows.forEach((r) => peccIdSet.add(r.id));
      }
    }
    const peccIds = [...peccIdSet];
    allowedIds = [...new Set([actorUserId, ...peccIds])];
  }

  type URow = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    role: string;
    last_login: string | null;
    manager_id: string | null;
    mentor_id: string | null;
    hospital_facility_id: string | null;
    created_at: string | null;
    is_admin: boolean | null;
  };

  let urows: URow[] = [];

  if (allowedIds === null) {
    urows = await fetchAllRows<URow>((from, to) =>
      supabase
        .from('users')
        .select(
          'id, first_name, last_name, email, phone, role, last_login, manager_id, mentor_id, hospital_facility_id, created_at, is_admin'
        )
        .eq('is_active', true)
        .in('role', staffRoleFilter)
        .order('last_name')
        .range(from, to)
    );
  } else if (allowedIds.length === 0) {
    setRows([]);
    return;
  } else {
    for (const idPart of chunk(allowedIds, 80)) {
      const part = await fetchAllRows<URow>((from, to) =>
        supabase
          .from('users')
          .select(
            'id, first_name, last_name, email, phone, role, last_login, manager_id, mentor_id, hospital_facility_id, created_at, is_admin'
          )
          .eq('is_active', true)
          .in('role', staffRoleFilter)
          .in('id', idPart)
          .order('last_name')
          .range(from, to)
      );
      urows.push(...part);
    }
  }

  if (!includePlatformAdminAccounts) {
    urows = urows.filter((u) => !u.is_admin);
  }

  const userRefIds = [...new Set(urows.flatMap((u) => [u.manager_id, u.mentor_id].filter(Boolean)))] as string[];
  const hospitalIds = [...new Set(urows.map((u) => u.hospital_facility_id).filter(Boolean))] as string[];

  const nameById = new Map<string, string>();
  for (const uidPart of chunk(userRefIds, 80)) {
    const { data: refUsers } = await supabase.from('users').select('id, first_name, last_name').in('id', uidPart);
    (refUsers || []).forEach((u: { id: string; first_name?: string; last_name?: string }) => {
      nameById.set(u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim());
    });
  }

  const hospById = new Map<string, { name: string; state?: string }>();
  for (const hidPart of chunk(hospitalIds, 80)) {
    const { data: refHosp } = await supabase.from('hospitals').select('id, name, state').in('id', hidPart);
    (refHosp || []).forEach((h: { id: string; name: string; state?: string }) => hospById.set(h.id, h));
  }

  const rows: ReportDataRow[] = urows.map((u) => {
    const h = u.hospital_facility_id ? hospById.get(u.hospital_facility_id) : null;
    return {
      id: u.id,
      cells: {
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        email: u.email || '',
        userRole: u.role || '',
        platformAdminAccess: u.is_admin ? 'Yes' : 'No',
        userPhone: u.phone || '',
        lastLogin: u.last_login ? format(new Date(u.last_login), 'yyyy-MM-dd') : '',
        userCreatedAt: u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd') : '',
        managerName: u.manager_id ? nameById.get(u.manager_id) || '' : '',
        mentorName: u.mentor_id ? nameById.get(u.mentor_id) || '' : '',
        hospitalName: h ? String(h.name) : '',
        state: h && h.state ? String(h.state).toUpperCase() : '',
      },
      linkHints: { userId: u.id, hospitalId: u.hospital_facility_id || undefined },
    };
  });

  setRows(rows);
}

export default StaffPeccReportBuilder;
