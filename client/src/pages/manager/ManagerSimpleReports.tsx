/**
 * Simple manager reports — canned exports for the team hierarchy only.
 * Intentionally not the admin Advanced report builder.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { format, subDays } from 'date-fns';
import { supabase } from '../../supabase';
import {
  fetchManagerVisibleUserIdsSet,
  getManagedHospitalScopeKeysForManager,
  getManagedMentorIdsForManager,
  getManagedCohortPeopleIdsForManager,
} from '../../utils/managerTeamScope';
import { loadSiteChecklistItems, loadSiteChecklistStats } from '../../utils/checklistTemplates';
import { batchGetMentorActivitiesForUsers } from '../../utils/mentorActivities';
import {
  batchGetHospitalDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
  batchGetUserDataForKey,
} from '../../utils/userData';
import { buildHospitalsTableOrClause, isHospitalUuid, isQueryableHospitalRef } from '../../utils/hospitalId';
import { downloadTableCsv } from '../../utils/reportCsvExport';
import { adminSectionShellSx } from '../../components/admin/AdminPageChrome';

type ReportId = 'team_summary' | 'checklist' | 'pecc_activities' | 'mentor_hours';

type PreviewRow = Record<string, string>;

interface ReportDef {
  id: ReportId;
  title: string;
  description: string;
  columns: { id: string; label: string }[];
}

const REPORTS: ReportDef[] = [
  {
    id: 'team_summary',
    title: 'Team summary',
    description: 'Mentors and PECCs on your team — last login, activity count, and site checklist progress.',
    columns: [
      { id: 'role', label: 'Role' },
      { id: 'name', label: 'Name' },
      { id: 'email', label: 'Email' },
      { id: 'hospital', label: 'Site' },
      { id: 'lastLogin', label: 'Last login' },
      { id: 'activities', label: 'Activities' },
      { id: 'checklist', label: 'Checklist %' },
    ],
  },
  {
    id: 'checklist',
    title: 'Checklist item status',
    description: 'Every item on each site’s default or custom checklist, including incomplete items.',
    columns: [
      { id: 'hospital', label: 'Site' },
      { id: 'peccs', label: 'PECCs' },
      { id: 'checklist', label: 'Checklist' },
      { id: 'stage', label: 'Stage' },
      { id: 'item', label: 'Checklist item' },
      { id: 'status', label: 'Status' },
      { id: 'completedDate', label: 'Completed date' },
    ],
  },
  {
    id: 'pecc_activities',
    title: 'PECC activities (90 days)',
    description: 'Activity logs from PECCs on your team in the last 90 days.',
    columns: [
      { id: 'date', label: 'Date' },
      { id: 'name', label: 'PECC' },
      { id: 'hospital', label: 'Site' },
      { id: 'category', label: 'Category' },
      { id: 'hours', label: 'Hours' },
      { id: 'description', label: 'Description' },
    ],
  },
  {
    id: 'mentor_hours',
    title: 'Mentor & manager hours (90 days)',
    description: 'Hours logged by you and mentors you supervise in the last 90 days.',
    columns: [
      { id: 'date', label: 'Date' },
      { id: 'name', label: 'Mentor' },
      { id: 'hospital', label: 'Site' },
      { id: 'hours', label: 'Hours' },
      { id: 'category', label: 'Category' },
      { id: 'description', label: 'Description' },
    ],
  },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function displayName(first?: string | null, last?: string | null, email?: string | null): string {
  const n = `${first || ''} ${last || ''}`.trim();
  return n || email || '';
}

async function resolveHospitalUuids(scopeKeys: string[]): Promise<string[]> {
  const queryable = scopeKeys.map((k) => String(k || '').trim()).filter(isQueryableHospitalRef);
  if (!queryable.length) return [];
  const uuids = new Set<string>();
  for (const part of chunk(queryable, 40)) {
    const orClause = buildHospitalsTableOrClause(part);
    if (!orClause || orClause.includes('__no_match__')) continue;
    const { data } = await supabase.from('hospitals').select('id').or(orClause);
    (data || []).forEach((h: { id: string }) => uuids.add(h.id));
  }
  queryable.filter(isHospitalUuid).forEach((id) => uuids.add(id));
  return [...uuids];
}

async function loadTeamSummary(managerId: string): Promise<PreviewRow[]> {
  const [visibleIds, mentorIds, cohortPeople] = await Promise.all([
    fetchManagerVisibleUserIdsSet(managerId),
    getManagedMentorIdsForManager(managerId),
    getManagedCohortPeopleIdsForManager(managerId),
  ]);
  const personIds = [...visibleIds].filter((id) => id !== managerId);
  if (!personIds.length) return [];

  const users: {
    id: string;
    role: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    last_login: string | null;
    hospital_facility_id: string | null;
  }[] = [];
  for (const part of chunk(personIds, 80)) {
    const { data } = await supabase
      .from('users')
      .select('id, role, first_name, last_name, email, last_login, hospital_facility_id')
      .in('id', part)
      .in('role', ['mentor', 'pecc'])
      .eq('is_active', true);
    users.push(...((data || []) as typeof users));
  }

  const mentorIdSet = new Set([...mentorIds, ...cohortPeople]);
  const mentors = users.filter((u) => u.role === 'mentor' && mentorIdSet.has(u.id));
  const peccs = users.filter((u) => u.role === 'pecc');

  const hospitalRefs = peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
  const refMap = await mapSiteRefsToHospitalRowIds(hospitalRefs);
  const hospitalUuids = [...new Set(hospitalRefs.map((r) => refMap.get(r)).filter(Boolean))] as string[];

  const [checklist, mentorActs, hospActs, userActs] = await Promise.all([
    hospitalUuids.length ? loadSiteChecklistStats(hospitalUuids) : Promise.resolve(new Map()),
    mentors.length ? batchGetMentorActivitiesForUsers(mentors.map((m) => m.id)) : Promise.resolve(new Map()),
    hospitalUuids.length ? batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'activities') : Promise.resolve(new Map()),
    shouldMirrorLegacyUserData() && peccs.length
      ? batchGetUserDataForKey<unknown[]>(peccs.map((p) => p.id), 'activities')
      : Promise.resolve(new Map()),
  ]);

  const hospitalNames = new Map<string, string>();
  if (hospitalUuids.length) {
    for (const part of chunk(hospitalUuids, 80)) {
      const { data } = await supabase.from('hospitals').select('id, name, facility_id').in('id', part);
      (data || []).forEach((h: { id: string; name: string; facility_id: string | null }) => {
        hospitalNames.set(h.id, h.name);
        if (h.facility_id) hospitalNames.set(String(h.facility_id), h.name);
      });
    }
  }
  const mentorHospitalNames = new Map<string, Set<string>>();
  for (const part of chunk(mentors.map((m) => m.id), 80)) {
    const { data, error } = await supabase
      .from('mentor_hospital_assignments')
      .select('mentor_id, hospital:hospital_id(name)')
      .in('mentor_id', part)
      .eq('is_active', true);
    if (error) throw error;
    (data || []).forEach((row: { mentor_id: string; hospital: unknown }) => {
      const hospital = Array.isArray(row.hospital) ? row.hospital[0] : row.hospital;
      const name = String((hospital as { name?: unknown } | null)?.name || '').trim();
      if (!name) return;
      const names = mentorHospitalNames.get(row.mentor_id) || new Set<string>();
      names.add(name);
      mentorHospitalNames.set(row.mentor_id, names);
    });
  }

  const rows: PreviewRow[] = [];
  mentors.forEach((m) => {
    const acts = mentorActs.get(m.id) || [];
    rows.push({
      role: 'Mentor',
      name: displayName(m.first_name, m.last_name, m.email),
      email: m.email || '',
      hospital: [...(mentorHospitalNames.get(m.id) || [])].join('; '),
      lastLogin: m.last_login ? format(new Date(m.last_login), 'yyyy-MM-dd') : '',
      activities: String(acts.length),
      checklist: '',
    });
  });
  peccs.forEach((p) => {
    const hid = p.hospital_facility_id ? refMap.get(p.hospital_facility_id) : undefined;
    const stats = hid ? checklist.get(hid) : undefined;
    const hActs = hid ? hospActs.get(hid) : undefined;
    const uActs = userActs.get(p.id);
    const activities = Array.isArray(hActs) ? hActs : Array.isArray(uActs) ? uActs : [];
    const pct = stats && stats.total > 0 ? String(Math.round((stats.completed / stats.total) * 100)) : '';
    rows.push({
      role: 'PECC',
      name: displayName(p.first_name, p.last_name, p.email),
      email: p.email || '',
      hospital: (p.hospital_facility_id && hospitalNames.get(p.hospital_facility_id)) || (hid && hospitalNames.get(hid)) || '',
      lastLogin: p.last_login ? format(new Date(p.last_login), 'yyyy-MM-dd') : '',
      activities: String(activities.length),
      checklist: pct,
    });
  });

  return rows.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
}

async function loadChecklistReport(managerId: string): Promise<PreviewRow[]> {
  const scopeKeys = await getManagedHospitalScopeKeysForManager(managerId);
  const uuids = await resolveHospitalUuids(scopeKeys);
  if (!uuids.length) return [];

  const [items, hospitals] = await Promise.all([
    loadSiteChecklistItems(uuids),
    (async () => {
      const out: { id: string; name: string; facility_id: string | null }[] = [];
      for (const part of chunk(uuids, 80)) {
        const { data } = await supabase.from('hospitals').select('id, name, facility_id').in('id', part);
        out.push(...((data || []) as typeof out));
      }
      return out;
    })(),
  ]);
  const hospitalById = new Map(hospitals.map((h) => [h.id, h]));
  const refs = [...new Set(hospitals.flatMap((h) => [h.id, h.facility_id || '']).filter(Boolean))];
  const peccNamesByHospital = new Map<string, Set<string>>();
  for (const part of chunk(refs, 80)) {
    const { data } = await supabase
      .from('users')
      .select('first_name, last_name, email, hospital_facility_id')
      .eq('role', 'pecc')
      .eq('is_active', true)
      .in('hospital_facility_id', part);
    (data || []).forEach((p: {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      hospital_facility_id: string | null;
    }) => {
      const ref = String(p.hospital_facility_id || '');
      const hospital = hospitals.find((h) => h.id === ref || String(h.facility_id || '') === ref);
      if (!hospital) return;
      const names = peccNamesByHospital.get(hospital.id) || new Set<string>();
      names.add(displayName(p.first_name, p.last_name, p.email));
      peccNamesByHospital.set(hospital.id, names);
    });
  }

  return items
    .map((item) => {
      const hospital = hospitalById.get(item.hospitalId);
      return {
        hospital: hospital?.name || item.hospitalId,
        peccs: [...(peccNamesByHospital.get(item.hospitalId) || [])].join('; '),
        checklist: item.checklistName,
        stage: item.stageLabel,
        item: item.text,
        status: item.completed ? 'Complete' : 'Not complete',
        completedDate: item.completedAt ? format(new Date(item.completedAt), 'yyyy-MM-dd') : '',
      };
    })
    .sort(
      (a, b) =>
        a.hospital.localeCompare(b.hospital) ||
        a.checklist.localeCompare(b.checklist) ||
        a.stage.localeCompare(b.stage) ||
        a.item.localeCompare(b.item)
    );
}

async function loadPeccActivities(managerId: string): Promise<PreviewRow[]> {
  const visible = await fetchManagerVisibleUserIdsSet(managerId);
  const peccIds = [...visible];
  if (!peccIds.length) return [];

  const peccs: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    hospital_facility_id: string | null;
  }[] = [];
  for (const part of chunk(peccIds, 80)) {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, hospital_facility_id')
      .in('id', part)
      .eq('role', 'pecc')
      .eq('is_active', true);
    peccs.push(...((data || []) as typeof peccs));
  }
  if (!peccs.length) return [];

  const refs = peccs.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
  const refMap = await mapSiteRefsToHospitalRowIds(refs);
  const hospitalUuids = [...new Set(refs.map((r) => refMap.get(r)).filter(Boolean))] as string[];
  const [hospActs, userActs, hospitals] = await Promise.all([
    hospitalUuids.length ? batchGetHospitalDataForKey<unknown[]>(hospitalUuids, 'activities') : Promise.resolve(new Map()),
    shouldMirrorLegacyUserData()
      ? batchGetUserDataForKey<unknown[]>(peccs.map((p) => p.id), 'activities')
      : Promise.resolve(new Map()),
    (async () => {
      const names = new Map<string, string>();
      if (!hospitalUuids.length) return names;
      for (const part of chunk(hospitalUuids, 80)) {
        const { data } = await supabase.from('hospitals').select('id, name, facility_id').in('id', part);
        (data || []).forEach((h: { id: string; name: string; facility_id: string | null }) => {
          names.set(h.id, h.name);
          if (h.facility_id) names.set(String(h.facility_id), h.name);
        });
      }
      return names;
    })(),
  ]);

  const since = subDays(new Date(), 90).getTime();
  const rows: PreviewRow[] = [];
  peccs.forEach((p) => {
    const hid = p.hospital_facility_id ? refMap.get(p.hospital_facility_id) : undefined;
    const raw = (hid && hospActs.get(hid)) || userActs.get(p.id) || [];
    const list = Array.isArray(raw) ? raw : [];
    list.forEach((entry: any, idx: number) => {
      const dateRaw = entry?.date || entry?.activity_date || entry?.created_at || '';
      const t = dateRaw ? new Date(dateRaw).getTime() : NaN;
      if (!Number.isFinite(t) || t < since) return;
      rows.push({
        date: format(new Date(t), 'yyyy-MM-dd'),
        name: displayName(p.first_name, p.last_name, p.email),
        hospital:
          (p.hospital_facility_id && hospitals.get(p.hospital_facility_id)) ||
          (hid && hospitals.get(hid)) ||
          '',
        category: String(entry?.category || entry?.type || ''),
        hours: entry?.hours != null ? String(entry.hours) : '',
        description: String(entry?.description || entry?.notes || entry?.title || '').slice(0, 200),
        _sort: String(t),
      });
    });
  });

  return rows
    .sort((a, b) => String(b._sort || '').localeCompare(String(a._sort || '')))
    .map((row) => {
      const { _sort, ...rest } = row;
      return rest;
    });
}

async function loadMentorHours(managerId: string): Promise<PreviewRow[]> {
  const [managed, cohortPeople] = await Promise.all([
    getManagedMentorIdsForManager(managerId),
    getManagedCohortPeopleIdsForManager(managerId),
  ]);
  const mentorIds = new Set(managed);
  mentorIds.add(managerId);
  for (const part of chunk(cohortPeople, 80)) {
    const { data } = await supabase.from('users').select('id').in('id', part).eq('role', 'mentor').eq('is_active', true);
    (data || []).forEach((r: { id: string }) => mentorIds.add(r.id));
  }
  const ids = [...mentorIds];
  if (!ids.length) return [];

  const mentors: { id: string; first_name: string | null; last_name: string | null; email: string | null }[] = [];
  for (const part of chunk(ids, 80)) {
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', part)
      .eq('is_active', true);
    mentors.push(...((data || []) as typeof mentors));
  }
  const acts = await batchGetMentorActivitiesForUsers(mentors.map((m) => m.id));
  const activityHospitalRefs = [
    ...new Set(
      [...acts.values()]
        .flat()
        .flatMap((entry: any) => (Array.isArray(entry?.hospitalIds) ? entry.hospitalIds : []))
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ];
  const activityHospitalNames = new Map<string, string>();
  for (const part of chunk(activityHospitalRefs, 40)) {
    const orClause = buildHospitalsTableOrClause(part);
    if (!orClause || orClause.includes('__no_match__')) continue;
    const { data, error } = await supabase.from('hospitals').select('id, facility_id, name').or(orClause);
    if (error) throw error;
    (data || []).forEach((h: { id: string; facility_id: string | null; name: string }) => {
      activityHospitalNames.set(h.id, h.name);
      if (h.facility_id) activityHospitalNames.set(String(h.facility_id), h.name);
    });
  }
  const since = subDays(new Date(), 90).getTime();
  const rows: PreviewRow[] = [];
  mentors.forEach((m) => {
    (acts.get(m.id) || []).forEach((entry: any, idx: number) => {
      const dateRaw = entry?.date || entry?.activity_date || entry?.created_at || '';
      const t = dateRaw ? new Date(dateRaw).getTime() : NaN;
      if (!Number.isFinite(t) || t < since) return;
      rows.push({
        date: format(new Date(t), 'yyyy-MM-dd'),
        name: displayName(m.first_name, m.last_name, m.email),
        hospital: (Array.isArray(entry?.hospitalIds) ? entry.hospitalIds : [])
          .map((id: unknown) => activityHospitalNames.get(String(id)) || String(id))
          .join('; '),
        hours: entry?.hours != null ? String(entry.hours) : '',
        category: String(entry?.category || entry?.type || ''),
        description: String(entry?.description || entry?.notes || entry?.title || '').slice(0, 200),
        _sort: String(t),
      });
    });
  });
  return rows
    .sort((a, b) => String(b._sort || '').localeCompare(String(a._sort || '')))
    .map((row) => {
      const { _sort, ...rest } = row;
      return rest;
    });
}

async function runReport(id: ReportId, managerId: string): Promise<PreviewRow[]> {
  switch (id) {
    case 'team_summary':
      return loadTeamSummary(managerId);
    case 'checklist':
      return loadChecklistReport(managerId);
    case 'pecc_activities':
      return loadPeccActivities(managerId);
    case 'mentor_hours':
      return loadMentorHours(managerId);
    default:
      return [];
  }
}

interface Props {
  actorUserId: string;
}

const ManagerSimpleReports: React.FC<Props> = ({ actorUserId }) => {
  const [active, setActive] = useState<ReportId | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = useMemo(() => REPORTS.find((r) => r.id === active) || null, [active]);

  const load = useCallback(
    async (id: ReportId) => {
      setActive(id);
      setLoading(true);
      setError(null);
      setRows([]);
      try {
        const data = await runReport(id, actorUserId);
        setRows(data);
      } catch (e: any) {
        console.error('[ManagerSimpleReports]', e);
        setError(e?.message || 'Could not load this report.');
      } finally {
        setLoading(false);
      }
    },
    [actorUserId]
  );

  const download = useCallback(
    async (id: ReportId) => {
      const report = REPORTS.find((r) => r.id === id);
      if (!report) return;
      setLoading(true);
      setError(null);
      try {
        const data = active === id && rows.length ? rows : await runReport(id, actorUserId);
        if (active !== id) {
          setActive(id);
          setRows(data);
        }
        if (!data.length) {
          setError('No data is available for this report yet. Check Team → Roster to confirm people and sites are linked.');
          return;
        }
        downloadTableCsv(
          `impacts-${id}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
          report.columns.map((c) => c.label),
          data.map((row) => report.columns.map((c) => row[c.id] ?? ''))
        );
      } catch (e: any) {
        console.error('[ManagerSimpleReports] download', e);
        setError(e?.message || 'Could not download this report.');
      } finally {
        setLoading(false);
      }
    },
    [active, actorUserId, rows]
  );

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pick a report for your mentors and PECCs. Preview it here, or download a CSV.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          mb: 2.5,
        }}
      >
        {REPORTS.map((report) => (
          <Card key={report.id} variant="outlined" sx={{ ...adminSectionShellSx, m: 0 }}>
            <CardContent sx={{ pb: 1 }}>
              <Typography variant="subtitle1" fontWeight={650}>
                {report.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {report.description}
              </Typography>
            </CardContent>
            <CardActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
              <Button
                size="small"
                variant={active === report.id ? 'contained' : 'outlined'}
                startIcon={<VisibilityIcon />}
                onClick={() => void load(report.id)}
                disabled={loading}
              >
                Preview
              </Button>
              <Button
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => void download(report.id)}
                disabled={loading}
              >
                Download CSV
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {!loading && def && (
        <Box sx={{ ...adminSectionShellSx, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={650}>
              {def.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {rows.length} row{rows.length === 1 ? '' : 's'}
            </Typography>
          </Box>
          {rows.length === 0 ? (
            <Alert severity="info" sx={{ m: 2 }}>
              No rows for this report yet. Check that mentors and PECCs are assigned to you, then try again.
            </Alert>
          ) : (
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {def.columns.map((c) => (
                      <TableCell key={c.id}>{c.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 200).map((row, i) => (
                    <TableRow key={i} hover>
                      {def.columns.map((c) => (
                        <TableCell key={c.id}>{row[c.id] || '—'}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {rows.length > 200 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1 }}>
              Showing first 200 rows. Download CSV for the full export.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ManagerSimpleReports;
