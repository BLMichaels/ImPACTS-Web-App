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

export type ColumnId =
  | 'name'
  | 'email'
  | 'hospital'
  | 'city'
  | 'state'
  | 'lastLogin'
  | 'activeWindow'
  | 'mentor'
  | 'manager'
  | 'programs'
  | 'cohorts';

const DEFAULT_COLUMNS: Record<ColumnId, boolean> = {
  name: true,
  email: true,
  hospital: true,
  city: true,
  state: true,
  lastLogin: true,
  activeWindow: true,
  mentor: true,
  manager: true,
  programs: true,
  cohorts: true,
};

const COLUMN_LABELS: Record<ColumnId, string> = {
  name: 'Name',
  email: 'Email',
  hospital: 'Site / hospital',
  city: 'City',
  state: 'State',
  lastLogin: 'Last login',
  activeWindow: 'Met activity filter',
  mentor: 'Mentor',
  manager: 'Manager',
  programs: 'Programs',
  cohorts: 'Cohorts',
};

export interface PeccReportRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospitalName: string;
  city: string;
  state: string;
  lastLogin: string | null;
  activeInWindow: boolean;
  mentorName: string;
  managerName: string;
  programLabels: string;
  cohortLabels: string;
  programIds: string[];
  cohortIds: string[];
}

interface Props {
  scope: StaffReportScope;
  /** Current signed-in user id (manager/mentor/admin). */
  actorUserId: string;
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

const StaffPeccReportBuilder: React.FC<Props> = ({ scope, actorUserId }) => {
  const [rows, setRows] = useState<PeccReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [activityPreset, setActivityPreset] = useState('30');
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [columns, setColumns] = useState<Record<ColumnId, boolean>>({ ...DEFAULT_COLUMNS });
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [sortBy, setSortBy] = useState<keyof PeccReportRow>('lastName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const load = useCallback(async () => {
    if (!actorUserId) return;
    setLoading(true);
    setError(null);
    try {
      const hospitalScope = await resolveHospitalIdsForScope(scope, actorUserId);
      if (hospitalScope && hospitalScope.length === 0) {
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

      let q = supabase
        .from('users')
        .select('id, first_name, last_name, email, last_login, hospital_facility_id, mentor_id, manager_id, created_at')
        .eq('role', 'pecc')
        .eq('is_active', true);

      const { data: peccRaw, error: peErr } = await q;
      if (peErr) throw peErr;
      let peccs = (peccRaw || []) as {
        id: string;
        first_name: string;
        last_name: string;
        email: string;
        last_login: string | null;
        hospital_facility_id: string | null;
        mentor_id: string | null;
        manager_id: string | null;
      }[];

      if (hospitalScope) {
        const allow = new Set(hospitalScope);
        peccs = peccs.filter((p) => p.hospital_facility_id && allow.has(p.hospital_facility_id));
      }

      const hidSet = [...new Set(peccs.map((p) => p.hospital_facility_id).filter(Boolean))] as string[];
      let hospById = new Map<string, { id: string; name: string; city: string | null; state: string | null }>();
      if (hidSet.length) {
        const { data: hospitals } = await supabase.from('hospitals').select('id, name, city, state').in('id', hidSet);
        hospById = new Map((hospitals || []).map((h: any) => [h.id, h]));
      }

      const mentorIds = [...new Set(peccs.map((p) => p.mentor_id).filter(Boolean))] as string[];
      const managerIds = [...new Set(peccs.map((p) => p.manager_id).filter(Boolean))] as string[];
      const staffIds = [...new Set([...mentorIds, ...managerIds])];
      const { data: staff } = await supabase.from('users').select('id, first_name, last_name').in('id', staffIds.length ? staffIds : ['00000000-0000-0000-0000-000000000000']);
      const staffName = (id: string | null) => {
        if (!id) return '—';
        const u = (staff || []).find((s: any) => s.id === id);
        return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—' : '—';
      };

      const { data: pm } = await supabase.from('program_members').select('program_id, user_id').eq('status', 'active');
      const { data: cm } = await supabase.from('cohort_members').select('cohort_id, user_id').eq('status', 'active');
      const progMap = new Map((progList || []).map((p: any) => [p.id, p.name]));
      const coMap = new Map((coList || []).map((c: any) => [c.id, c.name]));

      const programLabelsFor = (uid: string) => {
        const ids = (pm || []).filter((x: any) => x.user_id === uid).map((x: any) => x.program_id);
        return ids.map((id: string) => progMap.get(id) || id).filter(Boolean).join('; ') || '—';
      };
      const cohortLabelsFor = (uid: string) => {
        const ids = (cm || []).filter((x: any) => x.user_id === uid).map((x: any) => x.cohort_id);
        return ids.map((id: string) => coMap.get(id) || id).filter(Boolean).join('; ') || '—';
      };

      const peccIds = peccs.map((p) => p.id);
      let usageInWindow = new Set<string>();
      if (peccIds.length && activityPreset !== 'any' && activityPreset !== 'inactive30') {
        const days = parseInt(activityPreset, 10);
        const sinceIso = subDays(new Date(), days).toISOString();
        try {
          const { data: ev } = await supabase.from('usage_events').select('user_id').in('user_id', peccIds).gte('created_at', sinceIso);
          usageInWindow = new Set((ev || []).map((e: any) => e.user_id));
        } catch {
          usageInWindow = new Set();
        }
      } else if (activityPreset === 'inactive30' && peccIds.length) {
        const sinceIso = subDays(new Date(), 30).toISOString();
        try {
          const { data: ev } = await supabase.from('usage_events').select('user_id').in('user_id', peccIds).gte('created_at', sinceIso);
          usageInWindow = new Set((ev || []).map((e: any) => e.user_id));
        } catch {
          usageInWindow = new Set();
        }
      }

      const built: PeccReportRow[] = peccs.map((p) => {
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

        const pids = (pm || []).filter((x: any) => x.user_id === p.id).map((x: any) => x.program_id as string);
        const cids = (cm || []).filter((x: any) => x.user_id === p.id).map((x: any) => x.cohort_id as string);

        return {
          id: p.id,
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          email: p.email || '',
          hospitalName: h?.name || '—',
          city: h?.city || '',
          state: (h?.state || '').toString().toUpperCase(),
          lastLogin: p.last_login,
          activeInWindow,
          mentorName: staffName(p.mentor_id),
          managerName: staffName(p.manager_id),
          programLabels: programLabelsFor(p.id),
          cohortLabels: cohortLabelsFor(p.id),
          programIds: pids,
          cohortIds: cids,
        };
      });

      setRows(built);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load report data');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, actorUserId, activityPreset]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.hospitalName.toLowerCase().includes(q) ||
          r.programLabels.toLowerCase().includes(q) ||
          r.cohortLabels.toLowerCase().includes(q)
      );
    }
    if (stateFilter.length) {
      const allow = new Set(stateFilter);
      list = list.filter((r) => r.state && allow.has(r.state));
    }
    if (programFilter !== 'all') {
      list = list.filter((r) => r.programIds.includes(programFilter));
    }
    if (cohortFilter !== 'all') {
      list = list.filter((r) => r.cohortIds.includes(cohortFilter));
    }
    if (activityPreset !== 'any') {
      list = list.filter((r) => r.activeInWindow);
    }
    return list;
  }, [rows, search, stateFilter, programFilter, cohortFilter, activityPreset]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      const av = (a as any)[sortBy];
      const bv = (b as any)[sortBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'boolean') return (av === bv ? 0 : av ? -dir : dir);
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
    });
    return copy;
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (key: keyof PeccReportRow) => {
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
    doc.text('PECC report', 14, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generated ${format(new Date(), 'PPpp')} · Scope: ${scope}`, 14, 22);

    const head: string[] = [];
    const body: string[][] = [];
    const colIds = (Object.keys(columns) as ColumnId[]).filter((c) => columns[c]);
    colIds.forEach((c) => head.push(COLUMN_LABELS[c]));

    sorted.forEach((r) => {
      const line: string[] = [];
      colIds.forEach((c) => {
        switch (c) {
          case 'name':
            line.push(`${r.firstName} ${r.lastName}`);
            break;
          case 'email':
            line.push(r.email);
            break;
          case 'hospital':
            line.push(r.hospitalName);
            break;
          case 'city':
            line.push(r.city);
            break;
          case 'state':
            line.push(r.state);
            break;
          case 'lastLogin':
            line.push(r.lastLogin ? format(new Date(r.lastLogin), 'yyyy-MM-dd') : '—');
            break;
          case 'activeWindow':
            line.push(r.activeInWindow ? 'Yes' : 'No');
            break;
          case 'mentor':
            line.push(r.mentorName);
            break;
          case 'manager':
            line.push(r.managerName);
            break;
          case 'programs':
            line.push(r.programLabels);
            break;
          case 'cohorts':
            line.push(r.cohortLabels);
            break;
          default:
            line.push('');
        }
      });
      body.push(line);
    });

    autoTable(doc, { head: [head], body, startY: 28, styles: { fontSize: 7 }, headStyles: { fillColor: [33, 150, 243] } });
    doc.save(`impacts-pecc-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportExcel = () => {
    const colIds = (Object.keys(columns) as ColumnId[]).filter((c) => columns[c]);
    const aoa: (string | boolean)[][] = [colIds.map((c) => COLUMN_LABELS[c])];
    sorted.forEach((r) => {
      const line: (string | boolean)[] = [];
      colIds.forEach((c) => {
        switch (c) {
          case 'name':
            line.push(`${r.firstName} ${r.lastName}`);
            break;
          case 'email':
            line.push(r.email);
            break;
          case 'hospital':
            line.push(r.hospitalName);
            break;
          case 'city':
            line.push(r.city);
            break;
          case 'state':
            line.push(r.state);
            break;
          case 'lastLogin':
            line.push(r.lastLogin ? format(new Date(r.lastLogin), 'yyyy-MM-dd') : '');
            break;
          case 'activeWindow':
            line.push(r.activeInWindow);
            break;
          case 'mentor':
            line.push(r.mentorName);
            break;
          case 'manager':
            line.push(r.managerName);
            break;
          case 'programs':
            line.push(r.programLabels);
            break;
          case 'cohorts':
            line.push(r.cohortLabels);
            break;
          default:
            line.push('');
        }
      });
      aoa.push(line);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PECCs');
    XLSX.writeFile(wb, `impacts-pecc-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const visibleColumnIds = (Object.keys(columns) as ColumnId[]).filter((c) => columns[c]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              PECC directory report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Filter, sort, and choose columns—then export to PDF or Excel. Data respects your role scope.
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
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                placeholder="Name, email, site, program…"
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
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Program</InputLabel>
                <Select value={programFilter} label="Program" onChange={(e) => setProgramFilter(e.target.value)}>
                  <MenuItem value="all">All programs</MenuItem>
                  {programs.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Cohort</InputLabel>
                <Select value={cohortFilter} label="Cohort" onChange={(e) => setCohortFilter(e.target.value)}>
                  <MenuItem value="all">All cohorts</MenuItem>
                  {cohorts.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <FilterListIcon fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              Showing {sorted.length} of {rows.length} PECCs (after scope)
            </Typography>
            {scope !== 'admin' && (
              <Chip size="small" label={`Scope: ${scope}`} variant="outlined" />
            )}
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
                  {visibleColumnIds.includes('name') && (
                    <TableCell sortDirection={sortBy === 'lastName' ? sortDir : false}>
                      <TableSortLabel active={sortBy === 'lastName'} direction={sortBy === 'lastName' ? sortDir : 'asc'} onClick={() => toggleSort('lastName')}>
                        Name
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {visibleColumnIds.includes('email') && (
                    <TableCell sortDirection={sortBy === 'email' ? sortDir : false}>
                      <TableSortLabel active={sortBy === 'email'} direction={sortBy === 'email' ? sortDir : 'asc'} onClick={() => toggleSort('email')}>
                        Email
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {visibleColumnIds.includes('hospital') && (
                    <TableCell>
                      <TableSortLabel active={sortBy === 'hospitalName'} direction={sortBy === 'hospitalName' ? sortDir : 'asc'} onClick={() => toggleSort('hospitalName')}>
                        Site
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {visibleColumnIds.includes('city') && <TableCell>City</TableCell>}
                  {visibleColumnIds.includes('state') && (
                    <TableCell sortDirection={sortBy === 'state' ? sortDir : false}>
                      <TableSortLabel active={sortBy === 'state'} direction={sortBy === 'state' ? sortDir : 'asc'} onClick={() => toggleSort('state')}>
                        ST
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {visibleColumnIds.includes('lastLogin') && (
                    <TableCell>
                      <TableSortLabel active={sortBy === 'lastLogin'} direction={sortBy === 'lastLogin' ? sortDir : 'asc'} onClick={() => toggleSort('lastLogin')}>
                        Last login
                      </TableSortLabel>
                    </TableCell>
                  )}
                  {visibleColumnIds.includes('activeWindow') && <TableCell align="center">Active (filter)</TableCell>}
                  {visibleColumnIds.includes('mentor') && <TableCell>Mentor</TableCell>}
                  {visibleColumnIds.includes('manager') && <TableCell>Manager</TableCell>}
                  {visibleColumnIds.includes('programs') && <TableCell>Programs</TableCell>}
                  {visibleColumnIds.includes('cohorts') && <TableCell>Cohorts</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id} hover>
                    {visibleColumnIds.includes('name') && (
                      <TableCell>
                        {r.firstName} {r.lastName}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('email') && <TableCell>{r.email}</TableCell>}
                    {visibleColumnIds.includes('hospital') && <TableCell>{r.hospitalName}</TableCell>}
                    {visibleColumnIds.includes('city') && <TableCell>{r.city || '—'}</TableCell>}
                    {visibleColumnIds.includes('state') && <TableCell>{r.state || '—'}</TableCell>}
                    {visibleColumnIds.includes('lastLogin') && (
                      <TableCell>{r.lastLogin ? format(new Date(r.lastLogin), 'MMM d, yyyy') : '—'}</TableCell>
                    )}
                    {visibleColumnIds.includes('activeWindow') && (
                      <TableCell align="center">
                        <Chip size="small" label={r.activeInWindow ? 'Yes' : 'No'} color={r.activeInWindow ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('mentor') && <TableCell>{r.mentorName}</TableCell>}
                    {visibleColumnIds.includes('manager') && <TableCell>{r.managerName}</TableCell>}
                    {visibleColumnIds.includes('programs') && (
                      <TableCell sx={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.programLabels}</TableCell>
                    )}
                    {visibleColumnIds.includes('cohorts') && (
                      <TableCell sx={{ maxWidth: 220, whiteSpace: 'normal' }}>{r.cohortLabels}</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Drawer anchor="right" open={columnDrawer} onClose={() => setColumnDrawer(false)}>
        <Box sx={{ width: 300, p: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Visible columns
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose which fields appear in the table and exports.
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <FormGroup>
            {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((id) => (
              <FormControlLabel
                key={id}
                control={<Checkbox checked={columns[id]} onChange={(_, v) => setColumns((c) => ({ ...c, [id]: v }))} />}
                label={COLUMN_LABELS[id]}
              />
            ))}
          </FormGroup>
        </Box>
      </Drawer>
    </Paper>
  );
};

export default StaffPeccReportBuilder;
