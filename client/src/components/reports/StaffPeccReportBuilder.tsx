import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import RefreshIcon from '@mui/icons-material/Refresh';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabase';
import { format, subDays } from 'date-fns';

export type StaffReportScope = 'admin' | 'manager' | 'mentor';

export type ReportDataset = 'pecc' | 'hospital' | 'organization' | 'staff';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const ACTIVITY_PRESETS = [
  { value: 'any', label: 'Any activity' },
  { value: '7', label: 'Used platform in last 7 days' },
  { value: '30', label: 'Used platform in last 30 days' },
  { value: '90', label: 'Used platform in last 90 days' },
  { value: 'inactive30', label: 'No activity in last 30 days' },
];

const STAFF_ROLE_OPTIONS = [
  { value: 'pecc', label: 'PECC' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

/** One row: string cells keyed by column id (includes dynamic CRM keys). */
export interface ReportDataRow {
  id: string;
  cells: Record<string, string>;
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
    const { data } = await supabase
      .from('mentor_hospital_assignments')
      .select('hospital_id')
      .eq('mentor_id', userId)
      .eq('is_active', true);
    (data || []).forEach((r: { hospital_id: string }) => r.hospital_id && set.add(r.hospital_id));
    return [...set];
  }
  const { data: mentors } = await supabase.from('users').select('id').eq('manager_id', userId).eq('role', 'mentor').eq('is_active', true);
  const mentorIds = [...(mentors || []).map((m: { id: string }) => m.id), userId];
  const { data: assigns } = await supabase
    .from('mentor_hospital_assignments')
    .select('hospital_id')
    .in('mentor_id', mentorIds)
    .eq('is_active', true);
  (assigns || []).forEach((r: { hospital_id: string }) => r.hospital_id && set.add(r.hospital_id));
  return [...set];
}

/** Build column list for drawer + exports (order preserved). */
function buildColumnList(
  dataset: ReportDataset,
  hospitalFieldDefs: { id: string; label: string }[],
  orgFieldDefs: { id: string; label: string }[]
): ColumnMeta[] {
  const pecc: ColumnMeta[] = [
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
    { id: 'activeWindow', label: 'Met activity filter', defaultOn: true, group: 'Engagement' },
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
    { id: 'peccCount', label: 'PECCs at site', defaultOn: true, group: 'Metrics' },
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
    { id: 'name', label: 'Name', defaultOn: true, group: 'User' },
    { id: 'email', label: 'Email', defaultOn: true, group: 'User' },
    { id: 'userRole', label: 'Role', defaultOn: true, group: 'User' },
    { id: 'userPhone', label: 'Phone', defaultOn: false, group: 'User' },
    { id: 'lastLogin', label: 'Last login', defaultOn: true, group: 'User' },
    { id: 'userCreatedAt', label: 'Created', defaultOn: false, group: 'User' },
    { id: 'managerName', label: 'Manager', defaultOn: false, group: 'User' },
    { id: 'mentorName', label: 'Mentor', defaultOn: false, group: 'User' },
    { id: 'hospitalName', label: 'Primary site', defaultOn: false, group: 'User' },
    { id: 'state', label: 'Site state', defaultOn: false, group: 'User' },
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

interface Props {
  scope: StaffReportScope;
  actorUserId: string;
}

const StaffPeccReportBuilder: React.FC<Props> = ({ scope, actorUserId }) => {
  const [dataset, setDataset] = useState<ReportDataset>('pecc');
  const [rows, setRows] = useState<ReportDataRow[]>([]);
  const [programIdsByRow, setProgramIdsByRow] = useState<Record<string, string[]>>({});
  const [cohortIdsByRow, setCohortIdsByRow] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [activityPreset, setActivityPreset] = useState('30');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string[]>(['pecc', 'mentor', 'manager']);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [hospitalCustomDefs, setHospitalCustomDefs] = useState<{ id: string; label: string }[]>([]);
  const [orgCustomDefs, setOrgCustomDefs] = useState<{ id: string; label: string }[]>([]);
  const [columns, setColumns] = useState<Record<string, boolean>>({});
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const columnMetas = useMemo(
    () => buildColumnList(dataset, hospitalCustomDefs, orgCustomDefs),
    [dataset, hospitalCustomDefs, orgCustomDefs]
  );

  useEffect(() => {
    setColumns(defaultVisibility(columnMetas));
    setSortBy(dataset === 'organization' ? 'orgName' : 'name');
  }, [dataset, columnMetas]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: defs } = await supabase.from('crm_custom_field_definitions').select('id, label, applicable_types').order('sort_order');
      if (cancelled) return;
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
    try {
      const hospitalScope = await resolveHospitalIdsForScope(scope, actorUserId);
      if (hospitalScope && hospitalScope.length === 0 && dataset !== 'staff') {
        setRows([]);
        setLoading(false);
        return;
      }

      const [{ data: progList }, { data: coList }] = await Promise.all([
        supabase.from('programs').select('id, name').eq('is_active', true).order('name'),
        supabase.from('cohorts').select('id, name').eq('is_active', true).order('name'),
      ]);
      setPrograms((progList || []) as { id: string; name: string }[]);
      setCohorts((coList || []) as { id: string; name: string }[]);
      const progMap = new Map((progList || []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const coMap = new Map((coList || []).map((c: { id: string; name: string }) => [c.id, c.name]));

      if (dataset === 'pecc') {
        await loadPeccDataset({
          hospitalScope,
          activityPreset,
          progMap,
          coMap,
          setRows,
          setProgramIdsByRow,
          setCohortIdsByRow,
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
      } else {
        await loadStaffDataset({
          scope,
          actorUserId,
          hospitalScope,
          staffRoleFilter,
          setRows,
        });
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to load report data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, actorUserId, activityPreset, dataset, staffRoleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleColumnIds = useMemo(() => columnMetas.map((c) => c.id).filter((id) => columns[id]), [columnMetas, columns]);

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
        list = list.filter((r) => (programIdsByRow[r.id] || []).includes(programFilter));
      }
      if (cohortFilter !== 'all') {
        list = list.filter((r) => (cohortIdsByRow[r.id] || []).includes(cohortFilter));
      }
      if (activityPreset !== 'any') {
        list = list.filter((r) => r.cells.activeWindow === 'Yes');
      }
    }
    return list;
  }, [rows, search, stateFilter, dataset, programFilter, cohortFilter, activityPreset, programIdsByRow, cohortIdsByRow]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
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

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`${datasetLabel(dataset)} — ImPACTS`, 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated ${format(new Date(), 'PPpp')} · Scope: ${scope}`, 14, 22);

    const head = visibleColumnIds.map((id) => columnMetas.find((c) => c.id === id)?.label || id);
    const body = sorted.map((r) => visibleColumnIds.map((id) => r.cells[id] ?? ''));

    autoTable(doc, { head: [head], body, startY: 28, styles: { fontSize: 6 }, headStyles: { fillColor: [33, 150, 243] } });
    doc.save(`impacts-${dataset}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
    XLSX.writeFile(wb, `impacts-${dataset}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Advanced reports
            </Typography>
            <Typography variant="body2" color="text.secondary">
              PECCs, hospitals, organizations, and team — CRM fields, checklists, gap plans, activities, and custom columns. Exports respect your role scope.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => load()}>
              Refresh
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

      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2} sx={{ mb: 3 }}>
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
                  <MenuItem value="staff">Users (mentors, managers, PECCs…)</MenuItem>
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
              <Grid item xs={12} md={8}>
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

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 560, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {visibleColumnIds.map((cid) => (
                    <TableCell key={cid}>
                      <TableSortLabel active={sortBy === cid} direction={sortBy === cid ? sortDir : 'asc'} onClick={() => toggleSort(cid)}>
                        {columnMetas.find((c) => c.id === cid)?.label || cid}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id} hover>
                    {visibleColumnIds.map((cid) => (
                      <TableCell key={cid} sx={{ maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {cid === 'activeWindow' ? (
                          <Chip
                            size="small"
                            label={r.cells[cid] || '—'}
                            color={r.cells[cid] === 'Yes' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        ) : (
                          r.cells[cid] || '—'
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Drawer anchor="right" open={columnDrawer} onClose={() => setColumnDrawer(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Visible columns
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Toggle groups; custom fields match CRM definitions. PDF and Excel use the same selection.
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
    default:
      return 'report';
  }
}

async function loadPeccDataset(params: {
  hospitalScope: string[] | null;
  activityPreset: string;
  progMap: Map<string, string>;
  coMap: Map<string, string>;
  setRows: (r: ReportDataRow[]) => void;
  setProgramIdsByRow: (m: Record<string, string[]>) => void;
  setCohortIdsByRow: (m: Record<string, string[]>) => void;
}): Promise<void> {
  const { hospitalScope, activityPreset, progMap, coMap, setRows, setProgramIdsByRow, setCohortIdsByRow } = params;

  let q = supabase
    .from('users')
    .select('id, first_name, last_name, email, phone, last_login, hospital_facility_id, mentor_id, manager_id, created_at')
    .eq('role', 'pecc')
    .eq('is_active', true);

  const { data: peccRaw, error: peErr } = await q;
  if (peErr) throw peErr;
  let peccs = (peccRaw || []) as {
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
  }[];

  if (hospitalScope) {
    const allow = new Set(hospitalScope);
    peccs = peccs.filter((p) => p.hospital_facility_id && allow.has(p.hospital_facility_id));
  }

  const hidSet = [...new Set(peccs.map((p) => p.hospital_facility_id).filter(Boolean))] as string[];
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
    const { data: hospitals } = await supabase
      .from('hospitals')
      .select(
        'id, name, facility_id, address, city, state, zip, county, phone, email, trauma_level, ed_size, region, hospital_system, crm_status, company_name, custom_fields, programs, cohorts'
      )
      .in('id', hidSet);
    hospById = new Map(
      (hospitals || []).map((h: Record<string, unknown>) => [
        String(h.id),
        {
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
        },
      ])
    );
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

  const { data: pm } = await supabase.from('program_members').select('program_id, user_id').eq('status', 'active');
  const { data: cm } = await supabase.from('cohort_members').select('cohort_id, user_id').eq('status', 'active');

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
  setProgramIdsByRow(pidMap);
  setCohortIdsByRow(cidMap);

  const peccIds = peccs.map((p) => p.id);
  let usageInWindow = new Set<string>();
  if (peccIds.length && activityPreset !== 'any' && activityPreset !== 'inactive30') {
    const days = parseInt(activityPreset, 10);
    const sinceIso = subDays(new Date(), days).toISOString();
    try {
      const { data: ev } = await supabase.from('usage_events').select('user_id').in('user_id', peccIds).gte('created_at', sinceIso);
      usageInWindow = new Set((ev || []).map((e: { user_id: string }) => e.user_id));
    } catch {
      usageInWindow = new Set();
    }
  } else if (activityPreset === 'inactive30' && peccIds.length) {
    const sinceIso = subDays(new Date(), 30).toISOString();
    try {
      const { data: ev } = await supabase.from('usage_events').select('user_id').in('user_id', peccIds).gte('created_at', sinceIso);
      usageInWindow = new Set((ev || []).map((e: { user_id: string }) => e.user_id));
    } catch {
      usageInWindow = new Set();
    }
  }

  const checklistByHospital = new Map<string, { total: number; completed: number }>();
  if (hidSet.length) {
    const { data: chk } = await supabase.from('site_checklist_progress').select('hospital_id, completed').in('hospital_id', hidSet);
    (chk || []).forEach((row: { hospital_id: string; completed: boolean }) => {
      const prev = checklistByHospital.get(row.hospital_id) || { total: 0, completed: 0 };
      prev.total += 1;
      if (row.completed) prev.completed += 1;
      checklistByHospital.set(row.hospital_id, prev);
    });
  }

  const udMap = await fetchUserDataBatch(peccIds, ['gapPlans', 'activities']);

  const out: ReportDataRow[] = peccs.map((p) => {
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
    const cells: Record<string, string> = {
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

    return { id: p.id, cells };
  });

  setRows(out);
}

async function loadHospitalDataset(params: {
  hospitalScope: string[] | null;
  progMap: Map<string, string>;
  setRows: (r: ReportDataRow[]) => void;
}): Promise<void> {
  const { hospitalScope, progMap, setRows } = params;
  const { data: coList } = await supabase.from('cohorts').select('id, name').eq('is_active', true);
  const cohortMap = new Map((coList || []).map((c: { id: string; name: string }) => [c.id, c.name]));

  let query = supabase
    .from('hospitals')
    .select(
      'id, name, facility_id, address, city, state, zip, county, phone, email, trauma_level, ed_size, region, hospital_system, crm_status, company_name, custom_fields, programs, cohorts'
    )
    .eq('is_active', true)
    .order('name');

  if (hospitalScope && hospitalScope.length) {
    query = query.in('id', hospitalScope);
  }

  const { data: hospitals, error } = await query;
  if (error) throw error;

  const ids = (hospitals || []).map((h: { id: string }) => h.id);
  const peccCounts = new Map<string, number>();
  if (ids.length) {
    const { data: peccs } = await supabase.from('users').select('hospital_facility_id').eq('role', 'pecc').eq('is_active', true).in('hospital_facility_id', ids);
    (peccs || []).forEach((r: { hospital_facility_id: string | null }) => {
      if (!r.hospital_facility_id) return;
      peccCounts.set(r.hospital_facility_id, (peccCounts.get(r.hospital_facility_id) || 0) + 1);
    });
  }

  const checklistByHospital = new Map<string, { total: number; completed: number }>();
  if (ids.length) {
    const { data: chk } = await supabase.from('site_checklist_progress').select('hospital_id, completed').in('hospital_id', ids);
    (chk || []).forEach((row: { hospital_id: string; completed: boolean }) => {
      const prev = checklistByHospital.get(row.hospital_id) || { total: 0, completed: 0 };
      prev.total += 1;
      if (row.completed) prev.completed += 1;
      checklistByHospital.set(row.hospital_id, prev);
    });
  }

  const rows: ReportDataRow[] = (hospitals || []).map((h: Record<string, unknown>) => {
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
    return { id, cells };
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
  const { data: coList } = await supabase.from('cohorts').select('id, name').eq('is_active', true);
  const coMap = new Map((coList || []).map((c: { id: string; name: string }) => [c.id, c.name]));

  const { data: orgs, error } = await supabase
    .from('crm_organizations')
    .select(
      'id, name, first_name, last_name, organization, email, phone, region, state, status, custom_fields, programs, cohorts, created_at, contact_type, linked_hospital_ids'
    )
    .order('name');
  if (error) throw error;

  const { data: hospNames } = await supabase.from('hospitals').select('id, name');
  const hidToName = new Map((hospNames || []).map((h: { id: string; name: string }) => [h.id, h.name]));

  const scopeSet = hospitalScope && hospitalScope.length ? new Set(hospitalScope) : null;

  const filtered = (orgs || []).filter((row: Record<string, unknown>) => {
    if (scope === 'admin' || !scopeSet) return true;
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
    return { id, cells };
  });

  setRows(rows);
}

async function loadStaffDataset(params: {
  scope: StaffReportScope;
  actorUserId: string;
  hospitalScope: string[] | null;
  staffRoleFilter: string[];
  setRows: (r: ReportDataRow[]) => void;
}): Promise<void> {
  const { scope, actorUserId, hospitalScope, staffRoleFilter, setRows } = params;

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
    const { data: peccs } =
      hs.length > 0
        ? await supabase.from('users').select('id').eq('role', 'pecc').eq('is_active', true).in('hospital_facility_id', hs)
        : { data: [] };
    const peccIds = (peccs || []).map((p: { id: string }) => p.id);
    allowedIds = [...new Set([actorUserId, ...mentorIds, ...peccIds])];
  } else {
    const hs = hospitalScope || [];
    const { data: peccs } =
      hs.length > 0
        ? await supabase.from('users').select('id').eq('role', 'pecc').eq('is_active', true).in('hospital_facility_id', hs)
        : { data: [] };
    const peccIds = (peccs || []).map((p: { id: string }) => p.id);
    allowedIds = [...new Set([actorUserId, ...peccIds])];
  }

  let q = supabase
    .from('users')
    .select('id, first_name, last_name, email, phone, role, last_login, manager_id, mentor_id, hospital_facility_id, created_at')
    .eq('is_active', true)
    .in('role', staffRoleFilter);

  if (allowedIds) {
    q = q.in('id', allowedIds);
  }

  const { data: users, error } = await q.limit(5000);
  if (error) throw error;

  const urows = (users || []) as {
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
  }[];

  const userRefIds = [...new Set(urows.flatMap((u) => [u.manager_id, u.mentor_id].filter(Boolean)))] as string[];
  const hospitalIds = [...new Set(urows.map((u) => u.hospital_facility_id).filter(Boolean))] as string[];
  const { data: refUsers } = await supabase
    .from('users')
    .select('id, first_name, last_name')
    .in('id', userRefIds.length ? userRefIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: refHosp } = await supabase
    .from('hospitals')
    .select('id, name, state')
    .in('id', hospitalIds.length ? hospitalIds : ['00000000-0000-0000-0000-000000000000']);

  const nameById = new Map((refUsers || []).map((u: { id: string; first_name?: string; last_name?: string }) => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]));
  const hospById = new Map((refHosp || []).map((h: { id: string; name: string; state?: string }) => [h.id, h]));

  const rows: ReportDataRow[] = urows.map((u) => {
    const h = u.hospital_facility_id ? hospById.get(u.hospital_facility_id) : null;
    return {
      id: u.id,
      cells: {
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        email: u.email || '',
        userRole: u.role || '',
        userPhone: u.phone || '',
        lastLogin: u.last_login ? format(new Date(u.last_login), 'yyyy-MM-dd') : '',
        userCreatedAt: u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd') : '',
        managerName: u.manager_id ? nameById.get(u.manager_id) || '' : '',
        mentorName: u.mentor_id ? nameById.get(u.mentor_id) || '' : '',
        hospitalName: h ? String((h as { name: string }).name) : '',
        state: h && (h as { state?: string }).state ? String((h as { state: string }).state).toUpperCase() : '',
      },
    };
  });

  setRows(rows);
}

export default StaffPeccReportBuilder;
