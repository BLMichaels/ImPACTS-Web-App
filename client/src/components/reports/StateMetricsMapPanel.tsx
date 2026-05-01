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
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import statesTopo from 'us-atlas/states-10m.json';
import { supabase } from '../../supabase';
import { batchGetHospitalDataForKey, mapSiteRefsToHospitalRowIds } from '../../utils/userData';

type MetricKey =
  | 'hospitals'
  | 'peccs'
  | 'activeHospitals'
  | 'activePeccs'
  | 'simulations'
  | 'simulationParticipants'
  | 'completedGaps'
  | 'avgPrs'
  | 'prsImprovement';

interface HospitalRow {
  id: string;
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

const StateMetricsMapPanel: React.FC = () => {
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
      const { data: hospitalRows, error: hospitalsError } = await supabase
        .from('hospitals')
        .select('id, facility_id, name, state, is_active');
      if (hospitalsError) throw hospitalsError;

      const hospitals = (hospitalRows || []) as Array<{
        id: string;
        facility_id: string | null;
        name: string | null;
        state: string | null;
        is_active: boolean | null;
      }>;
      const validHospitals = hospitals
        .map((h) => ({
          id: h.id,
          facility_id: h.facility_id ? String(h.facility_id) : null,
          name: String(h.name ?? 'Unnamed Hospital'),
          stateCode: normalizeStateCode(h.state),
          isActive: h.is_active === true,
        }))
        .filter((h) => Boolean(h.stateCode));

      const hospitalIds = validHospitals.map((h) => h.id);
      const [simulationMap, gapPlansMap, readinessMap, peccRowsRes] = await Promise.all([
        batchGetHospitalDataForKey<SimulationSessionLike[]>(hospitalIds, 'simulation_sessions'),
        batchGetHospitalDataForKey<GapPlanLike[]>(hospitalIds, 'gapPlans'),
        batchGetHospitalDataForKey<ReadinessScoreLike[]>(hospitalIds, 'readinessScores'),
        supabase.from('users').select('id, hospital_facility_id, is_active').eq('role', 'pecc'),
      ]);
      if (peccRowsRes.error) throw peccRowsRes.error;

      const hospitalById = new Map(validHospitals.map((h) => [h.id, h]));
      const peccRows = (peccRowsRes.data || []) as Array<{
        id: string;
        hospital_facility_id: string | null;
        is_active: boolean | null;
      }>;
      const siteRefs = peccRows.map((r) => String(r.hospital_facility_id ?? '').trim()).filter(Boolean);
      const refMap = await mapSiteRefsToHospitalRowIds(siteRefs);
      const peccByHospital = new Map<string, { total: number; active: number }>();
      peccRows.forEach((row) => {
        const ref = String(row.hospital_facility_id ?? '').trim();
        if (!ref) return;
        const hospitalId = refMap.get(ref) || (hospitalById.has(ref) ? ref : null);
        if (!hospitalId || !hospitalById.has(hospitalId)) return;
        const current = peccByHospital.get(hospitalId) || { total: 0, active: 0 };
        current.total += 1;
        if (row.is_active === true) current.active += 1;
        peccByHospital.set(hospitalId, current);
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
          activePeccs: 0,
          simulations: 0,
          simulationParticipants: 0,
          completedGaps: 0,
          avgPrs: 0,
          prsImprovement: 0,
          hospitalsList: [],
        });
      });
      for (const hospital of validHospitals) {
        const stateCode = hospital.stateCode as string;
        const state = byState.get(stateCode)!;
        const sessions = Array.isArray(simulationMap.get(hospital.id)) ? simulationMap.get(hospital.id)! : [];
        const simulationParticipants = sessions.reduce((sum, s) => {
          const participants = Array.isArray(s.participants) ? s.participants.length : 0;
          return sum + participants;
        }, 0);
        const gapPlans = Array.isArray(gapPlansMap.get(hospital.id)) ? gapPlansMap.get(hospital.id)! : [];
        const completedGaps = gapPlans.filter((g) => String(g.status ?? '').trim().toLowerCase() === 'completed').length;
        const readinessScores = Array.isArray(readinessMap.get(hospital.id)) ? readinessMap.get(hospital.id)! : [];
        const { latest, improvement } = calcLatestAndImprovement(readinessScores);
        const peccCounts = peccByHospital.get(hospital.id) || { total: 0, active: 0 };

        state.hospitals += 1;
        if (hospital.isActive) state.activeHospitals += 1;
        state.peccs += peccCounts.total;
        state.activePeccs += peccCounts.active;
        state.simulations += sessions.length;
        state.simulationParticipants += simulationParticipants;
        state.completedGaps += completedGaps;
        state.hospitalsList.push({
          id: hospital.id,
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
  }, []);

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

  return (
    <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PublicIcon fontSize="small" />
              State Metrics Map
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hover a state for quick metrics. Click a state to zoom and review the full state metric list.
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
