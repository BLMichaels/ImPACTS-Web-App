import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  alpha,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { downloadTableCsv } from '../../utils/reportCsvExport';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import statesTopo from 'us-atlas/states-10m.json';
import { supabase } from '../../supabase';
import { batchGetHospitalDataForKey, mapSiteRefsToHospitalRowIds } from '../../utils/userData';

type MetricKey =
  | 'hospitals'
  | 'peccs'
  | 'mentors'
  | 'managers'
  | 'staff'
  | 'activeHospitals'
  | 'activePeccs'
  | 'simulations'
  | 'simulationParticipants'
  | 'completedGaps'
  | 'avgPrs'
  | 'prsImprovement';

interface HospitalRow {
  id: string;
  canonicalHospitalId?: string;
  name: string;
  stateCode: string;
  isActive: boolean;
  simulations: number;
  simulationParticipants: number;
  completedGaps: number;
  latestPrs: number | null;
  prsImprovement: number | null;
  peccs: number;
  activePeccs: number;
}

interface StateMetrics {
  code: string;
  name: string;
  hospitals: number;
  activeHospitals: number;
  peccs: number;
  mentors: number;
  managers: number;
  staff: number;
  activePeccs: number;
  simulations: number;
  simulationParticipants: number;
  completedGaps: number;
  avgPrs: number;
  prsImprovement: number;
  hospitalsList: HospitalRow[];
}

interface SimulationSessionLike {
  participants?: unknown[];
}

interface GapPlanLike {
  status?: string;
}

interface ReadinessScoreLike {
  score?: number;
  date?: string;
}

interface CrmHospitalRowLike {
  id: string;
  name: string | null;
  state: string | null;
  status: string | null;
  linked_hospital_ids?: string[] | null;
}

interface CrmPeccRowLike {
  id: string;
  email: string | null;
  status: string | null;
  linked_hospital_ids?: string[] | null;
}

interface UserRoleRowLike {
  id: string;
  email: string | null;
  role: string | null;
  is_admin: boolean | null;
  is_active: boolean | null;
  hospital_facility_id: string | null;
  manager_id: string | null;
}

interface MentorAssignmentLike {
  mentor_id: string;
  hospital_id: string;
  is_active: boolean | null;
}

interface CrmPeopleRoleRowLike {
  id: string;
  email: string | null;
  contact_type: string | null;
  status: string | null;
  state: string | null;
  linked_hospital_ids?: string[] | null;
}
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
};

const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const ALL_STATE_CODES = Object.keys(STATE_CODE_TO_NAME).sort();

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string; format?: (value: number) => string }> = [
  { key: 'hospitals', label: '# Hospitals' },
  { key: 'mentors', label: '# Mentors' },
  { key: 'managers', label: '# Managers' },
  { key: 'staff', label: '# Staff' },
  { key: 'activeHospitals', label: '# Active Hospitals' },
  { key: 'peccs', label: '# PECCs' },
  { key: 'activePeccs', label: '# Active PECCs' },
  { key: 'simulations', label: '# Simulations' },
  { key: 'simulationParticipants', label: '# Simulation Participants' },
  { key: 'completedGaps', label: '# Gaps Completed' },
  { key: 'avgPrs', label: 'Avg Pediatric Readiness Score', format: (v) => v.toFixed(1) },
  { key: 'prsImprovement', label: 'Avg PRS Improvement', format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}` },
];

const NAME_TO_STATE_CODE = Object.entries(STATE_CODE_TO_NAME).reduce<Record<string, string>>((acc, [code, name]) => {
  acc[name.toLowerCase()] = code;
  return acc;
}, {});

const normalizeStateCode = (raw: string | null | undefined): string | null => {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const upper = value.toUpperCase();
  if (STATE_CODE_TO_NAME[upper]) return upper;
  return NAME_TO_STATE_CODE[value.toLowerCase()] ?? null;
};

const calcLatestAndImprovement = (scores: ReadinessScoreLike[]): { latest: number | null; improvement: number | null } => {
  const cleaned = scores
    .map((s) => ({ date: String(s.date ?? ''), score: Number(s.score) }))
    .filter((s) => Number.isFinite(s.score));
  if (!cleaned.length) return { latest: null, improvement: null };
  cleaned.sort((a, b) => a.date.localeCompare(b.date));
  const latest = cleaned[cleaned.length - 1]?.score ?? null;
  const improvement = cleaned.length >= 2 ? cleaned[cleaned.length - 1].score - cleaned[0].score : null;
  return { latest, improvement };
};

export interface StateMetricsMapPanelProps {
  /** When set, only hospitals in this manager/mentor scope appear on the map. */
  hospitalScopeKeys?: string[] | null;
  title?: string;
  subtitle?: string;
}

const StateMetricsMapPanel: React.FC<StateMetricsMapPanelProps> = ({
  hospitalScopeKeys = null,
  title = 'State Metrics Map',
  subtitle = 'Hover a state for quick metrics. Click a state to zoom and review the full state metric list.',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateMetrics, setStateMetrics] = useState<StateMetrics[]>([]);
  const [metricKey, setMetricKey] = useState<MetricKey>('hospitals');
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-97, 38]);
  const [mapZoom, setMapZoom] = useState(1);

  const loadStateMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hospitalRows, crmHospitalRows, peccRows, crmPeccRows, userRoleRows, mentorAssignmentsRows, crmPeopleRoleRows] = await Promise.all([
        fetchAllRows<{
          id: string;
          facility_id: string | null;
          name: string | null;
          state: string | null;
          is_active: boolean | null;
        }>(async (from, to) =>
          await supabase
            .from('hospitals')
            .select('id, facility_id, name, state, is_active')
            .range(from, to)
        ),
        fetchAllRows<CrmHospitalRowLike>(async (from, to) =>
          await supabase
            .from('crm_organizations')
            .select('id, name, state, status, linked_hospital_ids')
            .eq('contact_type', 'hospital')
            .range(from, to)
        ),
        fetchAllRows<{ id: string; hospital_facility_id: string | null; is_active: boolean | null }>(async (from, to) =>
          await supabase
            .from('users')
            .select('id, hospital_facility_id, is_active')
            .eq('role', 'pecc')
            .range(from, to)
        ),
        fetchAllRows<CrmPeccRowLike>(async (from, to) =>
          await supabase
            .from('crm_organizations')
            .select('id, email, status, linked_hospital_ids')
            .eq('contact_type', 'pecc')
            .range(from, to)
        ),
        fetchAllRows<UserRoleRowLike>(async (from, to) =>
          await supabase
            .from('users')
            .select('id, email, role, is_admin, is_active, hospital_facility_id, manager_id')
            .eq('is_active', true)
            .in('role', ['manager', 'mentor', 'admin'])
            .range(from, to)
        ),
        fetchAllRows<MentorAssignmentLike>(async (from, to) =>
          await supabase
            .from('mentor_hospital_assignments')
            .select('mentor_id, hospital_id, is_active')
            .eq('is_active', true)
            .range(from, to)
        ),
        fetchAllRows<CrmPeopleRoleRowLike>(async (from, to) =>
          await supabase
            .from('crm_organizations')
            .select('id, email, contact_type, status, state, linked_hospital_ids')
            .in('contact_type', ['manager', 'mentor', 'staff'])
            .range(from, to)
        ),
      ]);

      const validHospitals = hospitalRows
        .map((h) => ({
          id: h.id,
          name: String(h.name ?? 'Unnamed Hospital'),
          stateCode: normalizeStateCode(h.state),
          isActive: h.is_active === true,
        }))
        .filter((h) => Boolean(h.stateCode));

      // Merge CRM-created hospital contacts so map totals match CRM list,
      // while avoiding double-counting hospitals already represented by hospitals.id.
      const byUniqueHospitalKey = new Map<string, { id: string; canonicalHospitalId?: string; name: string; stateCode: string; isActive: boolean }>();
      validHospitals.forEach((h) => {
        byUniqueHospitalKey.set(`h:${h.id}`, {
          id: h.id,
          canonicalHospitalId: h.id,
          name: h.name,
          stateCode: h.stateCode as string,
          isActive: h.isActive,
        });
      });
      crmHospitalRows.forEach((r) => {
        const stateCode = normalizeStateCode(r.state);
        if (!stateCode) return;
        const linkedIds = Array.isArray(r.linked_hospital_ids)
          ? r.linked_hospital_ids.map((x) => String(x)).filter(Boolean)
          : [];
        const canonicalHospitalId = linkedIds.find((id) => validHospitals.some((h) => h.id === id));
        const key = canonicalHospitalId ? `h:${canonicalHospitalId}` : `crm:${String(r.id)}`;
        const isActive = String(r.status ?? 'Active').trim().toLowerCase() !== 'inactive';
        if (!byUniqueHospitalKey.has(key)) {
          byUniqueHospitalKey.set(key, {
            id: String(r.id),
            canonicalHospitalId,
            name: String(r.name ?? 'Unnamed Hospital'),
            stateCode,
            isActive,
          });
        }
      });
      let mergedHospitals = Array.from(byUniqueHospitalKey.values());
      let scopedValidHospitals = validHospitals;

      if (hospitalScopeKeys && hospitalScopeKeys.length > 0) {
        const scope = new Set(hospitalScopeKeys.map(String));
        const inScope = (id: string, canonicalId?: string) =>
          scope.has(id) || Boolean(canonicalId && scope.has(canonicalId));
        mergedHospitals = mergedHospitals.filter((h) => inScope(h.id, h.canonicalHospitalId));
        scopedValidHospitals = validHospitals.filter((h) => scope.has(h.id));
      }

      const scopedHospitalIdSet = new Set<string>();
      mergedHospitals.forEach((h) => {
        scopedHospitalIdSet.add(h.id);
        if (h.canonicalHospitalId) scopedHospitalIdSet.add(h.canonicalHospitalId);
      });
      const scopedMentorAssignments =
        hospitalScopeKeys && hospitalScopeKeys.length > 0
          ? mentorAssignmentsRows.filter((a) => scopedHospitalIdSet.has(String(a.hospital_id)))
          : mentorAssignmentsRows;

      const hospitalIds = scopedValidHospitals.map((h) => h.id);
      const [simulationMap, gapPlansMap, readinessMap] = await Promise.all([
        batchGetHospitalDataForKey<SimulationSessionLike[]>(hospitalIds, 'simulation_sessions'),
        batchGetHospitalDataForKey<GapPlanLike[]>(hospitalIds, 'gapPlans'),
        batchGetHospitalDataForKey<ReadinessScoreLike[]>(hospitalIds, 'readinessScores'),
      ]);

      const hospitalById = new Map(scopedValidHospitals.map((h) => [h.id, h]));
      const userHospitalRefs = [
        ...new Set(
          peccRows.map((r) => String(r.hospital_facility_id ?? '').trim()).filter(Boolean)
            .concat(
              userRoleRows
                .map((u) => String(u.hospital_facility_id ?? '').trim())
                .filter(Boolean)
            )
            .concat(
              crmPeopleRoleRows.flatMap((r) =>
                Array.isArray(r.linked_hospital_ids)
                  ? r.linked_hospital_ids.map((x) => String(x).trim()).filter(Boolean)
                  : []
              )
            )
        ),
      ];
      const siteRefs = userHospitalRefs;
      const refMap = await mapSiteRefsToHospitalRowIds(siteRefs);
      const peccByHospital = new Map<string, { all: Set<string>; active: Set<string> }>();
      peccRows.forEach((row) => {
        const ref = String(row.hospital_facility_id ?? '').trim();
        if (!ref) return;
        const hospitalId = refMap.get(ref) || (hospitalById.has(ref) ? ref : null);
        if (!hospitalId || !hospitalById.has(hospitalId)) return;
        const emailKey = `user:${row.id}`;
        const current = peccByHospital.get(hospitalId) || { all: new Set<string>(), active: new Set<string>() };
        current.all.add(emailKey);
        if (row.is_active === true) current.active.add(emailKey);
        peccByHospital.set(hospitalId, current);
      });
      crmPeccRows.forEach((row) => {
        if (String(row.status ?? '').trim().toLowerCase() === 'inactive') return;
        const links = Array.isArray(row.linked_hospital_ids)
          ? row.linked_hospital_ids.map((x) => String(x).trim()).filter(Boolean)
          : [];
        if (!links.length) return;
        const dedupeKey = `crm:${String(row.email || '').trim().toLowerCase() || row.id}`;
        links.forEach((link) => {
          const hospitalId = refMap.get(link) || (hospitalById.has(link) ? link : null);
          if (!hospitalId || !hospitalById.has(hospitalId)) return;
          const current = peccByHospital.get(hospitalId) || { all: new Set<string>(), active: new Set<string>() };
          current.all.add(dedupeKey);
          current.active.add(dedupeKey);
          peccByHospital.set(hospitalId, current);
        });
      });

      const mentorsByState = new Map<string, Set<string>>();
      const managersByState = new Map<string, Set<string>>();
      const staffByState = new Map<string, Set<string>>();

      const pushRoleKey = (map: Map<string, Set<string>>, stateCode: string | null, key: string) => {
        if (!stateCode || !key) return;
        const set = map.get(stateCode) || new Set<string>();
        set.add(key);
        map.set(stateCode, set);
      };

      const mentorStateById = new Map<string, Set<string>>();
      scopedMentorAssignments.forEach((assignment) => {
        if (!assignment.mentor_id || !assignment.hospital_id) return;
        const h = hospitalById.get(assignment.hospital_id);
        const stateCode = h?.stateCode || null;
        if (!stateCode) return;
        const set = mentorStateById.get(assignment.mentor_id) || new Set<string>();
        set.add(stateCode);
        mentorStateById.set(assignment.mentor_id, set);
      });

      userRoleRows.forEach((user) => {
        const role = String(user.role ?? '').trim().toLowerCase();
        const roleKey = String(user.email ?? '').trim().toLowerCase() || `user:${user.id}`;
        const states = new Set<string>();
        const directRef = String(user.hospital_facility_id ?? '').trim();
        if (directRef) {
          const hid = refMap.get(directRef) || (hospitalById.has(directRef) ? directRef : null);
          const stateCode = hid ? hospitalById.get(hid)?.stateCode || null : null;
          if (stateCode) states.add(stateCode);
        }
        if (role === 'mentor') {
          const assignedStates = mentorStateById.get(user.id);
          if (assignedStates) assignedStates.forEach((s) => states.add(s));
        }
        if (role === 'manager') {
          userRoleRows.forEach((maybeMentor) => {
            if (String(maybeMentor.role ?? '').trim().toLowerCase() !== 'mentor') return;
            if (String(maybeMentor.manager_id ?? '') !== user.id) return;
            const mentorStates = mentorStateById.get(maybeMentor.id);
            if (mentorStates) mentorStates.forEach((s) => states.add(s));
          });
        }
        states.forEach((stateCode) => {
          if (role === 'mentor') pushRoleKey(mentorsByState, stateCode, roleKey);
          else if (role === 'manager') pushRoleKey(managersByState, stateCode, roleKey);
          else if (role === 'admin' || user.is_admin === true) pushRoleKey(staffByState, stateCode, roleKey);
        });
      });

      crmPeopleRoleRows
        .filter((row) => String(row.status ?? '').trim().toLowerCase() !== 'inactive')
        .forEach((row) => {
          const role = String(row.contact_type ?? '').trim().toLowerCase();
          const key = String(row.email ?? '').trim().toLowerCase() || `crm:${row.id}`;
          const states = new Set<string>();
          const explicitState = normalizeStateCode(row.state);
          if (explicitState) states.add(explicitState);
          const links = Array.isArray(row.linked_hospital_ids)
            ? row.linked_hospital_ids.map((x) => String(x).trim()).filter(Boolean)
            : [];
          links.forEach((link) => {
            const hid = refMap.get(link) || (hospitalById.has(link) ? link : null);
            const stateCode = hid ? hospitalById.get(hid)?.stateCode || null : null;
            if (stateCode) states.add(stateCode);
          });
          states.forEach((stateCode) => {
            if (role === 'mentor') pushRoleKey(mentorsByState, stateCode, key);
            else if (role === 'manager') pushRoleKey(managersByState, stateCode, key);
            else if (role === 'staff') pushRoleKey(staffByState, stateCode, key);
          });
        });

      const byState = new Map<string, StateMetrics>();
      const prsLatestByState = new Map<string, number[]>();
      const prsImprovementByState = new Map<string, number[]>();
      // Seed every US state so all map clicks resolve to a detail panel, even with zero rows.
      ALL_STATE_CODES.forEach((stateCode) => {
        byState.set(stateCode, {
          code: stateCode,
          name: STATE_CODE_TO_NAME[stateCode] || stateCode,
          hospitals: 0,
          activeHospitals: 0,
          peccs: 0,
          mentors: 0,
          managers: 0,
          staff: 0,
          activePeccs: 0,
          simulations: 0,
          simulationParticipants: 0,
          completedGaps: 0,
          avgPrs: 0,
          prsImprovement: 0,
          hospitalsList: [],
        });
      });
      for (const hospital of mergedHospitals) {
        const stateCode = hospital.stateCode;
        const state = byState.get(stateCode)!;
        const canonicalId = hospital.canonicalHospitalId;
        const sessions = canonicalId && Array.isArray(simulationMap.get(canonicalId)) ? simulationMap.get(canonicalId)! : [];
        const simulationParticipants = sessions.reduce((sum, s) => {
          const participants = Array.isArray(s.participants) ? s.participants.length : 0;
          return sum + participants;
        }, 0);
        const gapPlans = canonicalId && Array.isArray(gapPlansMap.get(canonicalId)) ? gapPlansMap.get(canonicalId)! : [];
        const completedGaps = gapPlans.filter((g) => String(g.status ?? '').trim().toLowerCase() === 'completed').length;
        const readinessScores = canonicalId && Array.isArray(readinessMap.get(canonicalId)) ? readinessMap.get(canonicalId)! : [];
        const { latest, improvement } = calcLatestAndImprovement(readinessScores);
        const peccCountsSets = canonicalId
          ? (peccByHospital.get(canonicalId) || { all: new Set<string>(), active: new Set<string>() })
          : { all: new Set<string>(), active: new Set<string>() };
        const peccCounts = { total: peccCountsSets.all.size, active: peccCountsSets.active.size };

        state.hospitals += 1;
        if (hospital.isActive) state.activeHospitals += 1;
        state.peccs += peccCounts.total;
        state.activePeccs += peccCounts.active;
        state.simulations += sessions.length;
        state.simulationParticipants += simulationParticipants;
        state.completedGaps += completedGaps;
        state.hospitalsList.push({
          id: hospital.id,
          canonicalHospitalId: canonicalId,
          name: hospital.name,
          stateCode,
          isActive: hospital.isActive,
          simulations: sessions.length,
          simulationParticipants,
          completedGaps,
          latestPrs: latest,
          prsImprovement: improvement,
          peccs: peccCounts.total,
          activePeccs: peccCounts.active,
        });
        if (latest != null) {
          const arr = prsLatestByState.get(stateCode) || [];
          arr.push(latest);
          prsLatestByState.set(stateCode, arr);
        }
        if (improvement != null) {
          const arr = prsImprovementByState.get(stateCode) || [];
          arr.push(improvement);
          prsImprovementByState.set(stateCode, arr);
        }
      }

      const metrics = Array.from(byState.values()).map((state) => {
        const latestScores = prsLatestByState.get(state.code) || [];
        const improvements = prsImprovementByState.get(state.code) || [];
        const avgPrs = latestScores.length
          ? latestScores.reduce((sum, n) => sum + n, 0) / latestScores.length
          : 0;
        const avgImprovement = improvements.length
          ? improvements.reduce((sum, n) => sum + n, 0) / improvements.length
          : 0;
        return {
          ...state,
          mentors: (mentorsByState.get(state.code) || new Set()).size,
          managers: (managersByState.get(state.code) || new Set()).size,
          staff: (staffByState.get(state.code) || new Set()).size,
          avgPrs,
          prsImprovement: avgImprovement,
          hospitalsList: [...state.hospitalsList].sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
      setStateMetrics(metrics.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load state metrics');
    } finally {
      setLoading(false);
    }
  }, [hospitalScopeKeys]);

  useEffect(() => {
    void loadStateMetrics();
  }, [loadStateMetrics]);

  const metricsByCode = useMemo(() => {
    const map = new Map<string, StateMetrics>();
    stateMetrics.forEach((m) => map.set(m.code, m));
    return map;
  }, [stateMetrics]);

  const selectedMetric = useMemo(
    () => METRIC_OPTIONS.find((m) => m.key === metricKey) || METRIC_OPTIONS[0],
    [metricKey]
  );

  const getMetricValue = useCallback((row: StateMetrics): number => {
    switch (metricKey) {
      case 'hospitals': return row.hospitals;
      case 'mentors': return row.mentors;
      case 'managers': return row.managers;
      case 'staff': return row.staff;
      case 'activeHospitals': return row.activeHospitals;
      case 'peccs': return row.peccs;
      case 'activePeccs': return row.activePeccs;
      case 'simulations': return row.simulations;
      case 'simulationParticipants': return row.simulationParticipants;
      case 'completedGaps': return row.completedGaps;
      case 'avgPrs': return row.avgPrs;
      case 'prsImprovement': return row.prsImprovement;
      default: return 0;
    }
  }, [metricKey]);

  const maxAbsMetric = useMemo(() => {
    const values = stateMetrics.map(getMetricValue).map((v) => Math.abs(v));
    return Math.max(1, ...values);
  }, [stateMetrics, getMetricValue]);

  const getFillColor = useCallback((value: number): string => {
    if (!Number.isFinite(value) || value === 0) return '#e0e0e0';
    if (metricKey === 'prsImprovement') {
      const pct = Math.min(1, Math.abs(value) / maxAbsMetric);
      return value >= 0
        ? `rgba(46, 125, 50, ${0.2 + pct * 0.75})`
        : `rgba(198, 40, 40, ${0.2 + pct * 0.75})`;
    }
    const pct = Math.min(1, value / maxAbsMetric);
    return `rgba(25, 118, 210, ${0.15 + pct * 0.8})`;
  }, [maxAbsMetric, metricKey]);

  const hoveredMetrics = hoveredState ? metricsByCode.get(hoveredState) || null : null;
  const selectedMetrics = selectedState ? metricsByCode.get(selectedState) || null : null;
  const summaryMetrics = hoveredMetrics || selectedMetrics;

  const resetZoom = () => {
    setSelectedState(null);
    setMapCenter([-97, 38]);
    setMapZoom(1);
  };

  const exportStateMetricsCsv = () => {
    const headers = [
      'Section',
      'State',
      'State code',
      'Hospitals',
      'Active hospitals',
      'PECCs',
      'Active PECCs',
      'Mentors',
      'Managers',
      'Staff',
      'Simulations',
      'Simulation participants',
      'Gaps completed',
      'Avg PRS',
      'Avg PRS improvement',
      'Hospital name',
      'Hospital active',
      'Hospital PECCs',
      'Hospital sims',
      'Hospital gaps completed',
      'Hospital latest PRS',
      'Hospital PRS delta',
    ];
    const rows: Array<Array<string | number>> = [];
    stateMetrics.forEach((s) => {
      rows.push([
        'State summary',
        s.name,
        s.code,
        s.hospitals,
        s.activeHospitals,
        s.peccs,
        s.activePeccs,
        s.mentors,
        s.managers,
        s.staff,
        s.simulations,
        s.simulationParticipants,
        s.completedGaps,
        s.avgPrs.toFixed(1),
        s.prsImprovement.toFixed(1),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      s.hospitalsList.forEach((h) => {
        rows.push([
          'Hospital',
          s.name,
          s.code,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          h.name,
          h.isActive ? 'Yes' : 'No',
          h.peccs,
          h.simulations,
          h.completedGaps,
          h.latestPrs == null ? '' : h.latestPrs.toFixed(1),
          h.prsImprovement == null ? '' : h.prsImprovement.toFixed(1),
        ]);
      });
    });
    downloadTableCsv(`impacts-state-metrics-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PublicIcon fontSize="small" />
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Color metric</InputLabel>
              <Select
                value={metricKey}
                label="Color metric"
                onChange={(e) => setMetricKey(e.target.value as MetricKey)}
              >
                {METRIC_OPTIONS.map((option) => (
                  <MenuItem key={option.key} value={option.key}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={exportStateMetricsCsv}
              disabled={loading || stateMetrics.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={resetZoom}
              disabled={!selectedState && mapZoom === 1}
            >
              Reset map
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ p: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} action={
            <Button color="inherit" size="small" onClick={() => void loadStateMetrics()}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: '#f8fbff', mb: 2 }}>
              <ComposableMap projection="geoAlbersUsa" width={980} height={580} style={{ width: '100%', height: 'auto' }}>
                <ZoomableGroup center={mapCenter} zoom={mapZoom} minZoom={1} maxZoom={8}>
                  <Geographies geography={statesTopo as any}>
                    {({ geographies }) =>
                      geographies.map((geo: any) => {
                        const stateCode = FIPS_TO_STATE[String(geo.id)];
                        if (!stateCode) return null;
                        const state = metricsByCode.get(stateCode);
                        const value = state ? getMetricValue(state) : 0;
                        const fill = getFillColor(value);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() => setHoveredState(stateCode)}
                            onMouseLeave={() => setHoveredState((prev) => (prev === stateCode ? null : prev))}
                            onClick={() => {
                              const centroid = geoCentroid(geo) as [number, number];
                              if (selectedState === stateCode) {
                                resetZoom();
                                return;
                              }
                              setSelectedState(stateCode);
                              setMapCenter(centroid);
                              setMapZoom(stateCode === 'AK' ? 1.8 : stateCode === 'HI' ? 2.2 : 4);
                            }}
                            style={{
                              default: {
                                fill,
                                stroke: selectedState === stateCode ? '#0d47a1' : '#ffffff',
                                strokeWidth: selectedState === stateCode ? 1.5 : 0.7,
                                outline: 'none',
                                cursor: 'pointer',
                              },
                              hover: {
                                fill: '#42a5f5',
                                stroke: '#0d47a1',
                                strokeWidth: 1.2,
                                outline: 'none',
                                cursor: 'pointer',
                              },
                              pressed: {
                                fill: '#1e88e5',
                                stroke: '#0d47a1',
                                strokeWidth: 1.5,
                                outline: 'none',
                              },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Hover / selected summary
                  </Typography>
                  {summaryMetrics ? (
                    <>
                      <Typography variant="h6" fontWeight={700}>{summaryMetrics.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        {selectedMetric.label}: {selectedMetric.format ? selectedMetric.format(getMetricValue(summaryMetrics)) : Math.round(getMetricValue(summaryMetrics))}
                      </Typography>
                      <Typography variant="body2">Hospitals: {summaryMetrics.hospitals} ({summaryMetrics.activeHospitals} active)</Typography>
                      <Typography variant="body2">Mentors: {summaryMetrics.mentors}</Typography>
                      <Typography variant="body2">Managers: {summaryMetrics.managers}</Typography>
                      <Typography variant="body2">Staff: {summaryMetrics.staff}</Typography>
                      <Typography variant="body2">PECCs: {summaryMetrics.peccs} ({summaryMetrics.activePeccs} active)</Typography>
                      <Typography variant="body2">Sims: {summaryMetrics.simulations}</Typography>
                      <Typography variant="body2">Sim participants: {summaryMetrics.simulationParticipants}</Typography>
                      <Typography variant="body2">Gaps completed: {summaryMetrics.completedGaps}</Typography>
                      <Typography variant="body2">Avg PRS: {summaryMetrics.avgPrs.toFixed(1)}</Typography>
                      <Typography variant="body2">Avg PRS improvement: {summaryMetrics.prsImprovement >= 0 ? '+' : ''}{summaryMetrics.prsImprovement.toFixed(1)}</Typography>
                      {selectedMetrics && !hoveredMetrics && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Pinned from clicked state.
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Move your pointer over a state or click one to pin details.
                    </Typography>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={7}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    State leaderboard ({selectedMetric.label})
                  </Typography>
                  {stateMetrics.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No state metrics available.</Typography>
                  ) : (
                    <Stack spacing={0.75}>
                      {stateMetrics
                        .slice()
                        .sort((a, b) => getMetricValue(b) - getMetricValue(a))
                        .slice(0, 8)
                        .map((row) => (
                          <Box key={row.code} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2">{row.name}</Typography>
                            <Typography variant="body2" fontWeight={600}>
                              {selectedMetric.format ? selectedMetric.format(getMetricValue(row)) : Math.round(getMetricValue(row))}
                            </Typography>
                          </Box>
                        ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>

            {selectedMetrics && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {selectedMetrics.name} - Full State Metrics
                </Typography>
                <Grid container spacing={1.25} sx={{ mb: 2 }}>
                  {[
                    { label: '# Hospitals', value: selectedMetrics.hospitals },
                    { label: '# Active Hospitals', value: selectedMetrics.activeHospitals },
                    { label: '# Mentors', value: selectedMetrics.mentors },
                    { label: '# Managers', value: selectedMetrics.managers },
                    { label: '# Staff', value: selectedMetrics.staff },
                    { label: '# PECCs', value: selectedMetrics.peccs },
                    { label: '# Active PECCs', value: selectedMetrics.activePeccs },
                    { label: '# Simulations', value: selectedMetrics.simulations },
                    { label: '# Simulation Participants', value: selectedMetrics.simulationParticipants },
                    { label: '# Gaps Completed', value: selectedMetrics.completedGaps },
                    { label: 'Avg PRS', value: selectedMetrics.avgPrs.toFixed(1) },
                    { label: 'Avg PRS Improvement', value: `${selectedMetrics.prsImprovement >= 0 ? '+' : ''}${selectedMetrics.prsImprovement.toFixed(1)}` },
                  ].map((item) => (
                    <Grid key={item.label} item xs={12} sm={6} md={4}>
                      <Card variant="outlined" sx={{ height: '100%' }}>
                        <CardContent sx={{ py: 1.25 }}>
                          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                          <Typography variant="h6" fontWeight={700}>{item.value}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Hospital-level breakdown
                </Typography>
                {selectedMetrics.hospitalsList.length === 0 ? (
                  <Alert severity="info">
                    No hospitals are currently mapped to {selectedMetrics.name}.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Hospital</TableCell>
                          <TableCell align="right">PECCs</TableCell>
                          <TableCell align="right">Active PECCs</TableCell>
                          <TableCell align="right">Sims</TableCell>
                          <TableCell align="right">Participants</TableCell>
                          <TableCell align="right">Gaps Completed</TableCell>
                          <TableCell align="right">Latest PRS</TableCell>
                          <TableCell align="right">PRS Delta</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedMetrics.hospitalsList.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>
                              {h.name}
                              {!h.isActive ? (
                                <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1 }}>
                                  (inactive)
                                </Typography>
                              ) : null}
                            </TableCell>
                            <TableCell align="right">{h.peccs}</TableCell>
                            <TableCell align="right">{h.activePeccs}</TableCell>
                            <TableCell align="right">{h.simulations}</TableCell>
                            <TableCell align="right">{h.simulationParticipants}</TableCell>
                            <TableCell align="right">{h.completedGaps}</TableCell>
                            <TableCell align="right">{h.latestPrs == null ? '-' : h.latestPrs.toFixed(1)}</TableCell>
                            <TableCell align="right">
                              {h.prsImprovement == null ? '-' : `${h.prsImprovement >= 0 ? '+' : ''}${h.prsImprovement.toFixed(1)}`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default StateMetricsMapPanel;
