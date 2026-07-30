import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Paper,
  Avatar,
  FormControlLabel,
  Checkbox,
  Stack,
  alpha,
} from '@mui/material';
import {
  PictureAsPdf as PictureAsPdfIcon,
  LocalHospital as HospitalIcon,
} from '@mui/icons-material';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';
import {
  getActivityCategories,
  isSimulationActivity,
} from '../../utils/mentorActivityCategories';
import {
  getUserData,
  batchGetHospitalDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
} from '../../utils/userData';
import { fetchMergedMentorHospitals } from '../../utils/mentorHospitalScope';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';
import {
  contactMatchesPeccAtHospital,
  contactNameMatchesPecc,
  resolvePeccsForMentorHospital,
  type MentorContactLike,
  type PeccUserLike,
} from '../../utils/mentorPeccHospitalMatch';
import { hospitalKeysMatch } from '../../utils/hospitalId';
import { buildPeccHospitalFacilityOrClause, expandHospitalRefsForPeccQuery } from '../../utils/mentorHospitalAssignments';
import { rollupMentorHoursByHospital, sumUnlinkedMentorHours } from '../../utils/mentorHoursByHospital';
import { MentorPrsTrendChart, type MentorPrsSeries } from '../../components/mentor/MentorPrsTrendChart';
import { MentorHoursByHospitalPanel } from '../../components/mentor/MentorHoursByHospitalPanel';
import { REPORT_CHART_COLORS } from '../../components/admin/AdminReportCharts';

interface MentorActivity {
  id: string;
  date: string;
  category: string;
  categories?: string[];
  hours: number;
  notes: string;
  hospital?: string;
  hospitalIds?: string[];
  simulation?: string;
}

interface PECCData {
  id: string;
  name: string;
  email: string;
  hospital: string;
  /** Mentor assignment row id — used for hospital toggles and metrics alignment */
  hospitalRowId: string;
  canonicalHospitalId: string;
  checklistProgress: number;
  activityCount: number;
  lastActivity: string | null;
  gapPlanCount: number;
  readinessScores: Array<{ id: string; score: number; date: string }>;
}

interface HospitalMetrics {
  hospitalId: string;
  hospitalName: string;
  siteActivityCount: number;
  siteHours: number;
  simulations: number;
  peccCount: number;
}

const peccMatchesHospitalRefs = (pecc: PECCData, refs: Set<string>): boolean =>
  [...refs].some(
    (ref) =>
      hospitalKeysMatch(ref, pecc.hospitalRowId) ||
      hospitalKeysMatch(ref, pecc.canonicalHospitalId)
  );

const MentorSnapshotPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile, effectiveUserId } = useUserProfile();
  const mentorUserId = effectiveUserId ?? userProfile?.id;
  
  const [activities, setActivities] = useState<MentorActivity[]>([]);
  const [peccData, setPeccData] = useState<PECCData[]>([]);
  const [assignedHospitals, setAssignedHospitals] = useState<any[]>([]);
  const [hospitalMetrics, setHospitalMetrics] = useState<HospitalMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [siteActivities, setSiteActivities] = useState<MentorActivity[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  // Load all data for mentor snapshot
  useEffect(() => {
    const loadData = async () => {
      if (!mentorUserId) return;
      
      try {
        setIsLoading(true);
        setHasError(false);

        // Load mentor's own activities from Supabase (user_data)
        const parsedMentorActivities = await getMentorActivitiesForUser(mentorUserId);
        setActivities(parsedMentorActivities);

        const mergedRows = await fetchMergedMentorHospitals(mentorUserId);
        const storedMentorHospitals =
          (await getUserData<Array<{ id: string; isWorkingWith?: boolean }>>(mentorUserId, 'mentorHospitals')) || [];
        const storedById = new Map(storedMentorHospitals.map((h) => [String(h.id), h]));
        const mergedHospitals = mergedRows
          .filter((row) => {
            const stored = storedById.get(row.hospital.id);
            return !(stored && stored.isWorkingWith === false);
          })
          .map((row) => ({
          id: row.id,
          hospital_id: row.hospital_id,
          mentor_id: row.mentor_id,
          is_active: row.is_active,
          hospital: {
            id: row.hospital.id,
            facility_id: row.hospital.facility_id ?? row.hospital.id,
            name: row.hospital.name,
          },
          ...(row.storedHospital
            ? { storedHospital: { city: row.storedHospital.city || '', state: row.storedHospital.state || '' } }
            : {}),
        }));

        setAssignedHospitals(mergedHospitals);
        const mentorContacts = (await getUserData<MentorContactLike[]>(mentorUserId, 'mentorContacts')) || [];

        if (mergedHospitals.length > 0) {
          const hospitalIds = Array.from(
            new Set(
              mergedHospitals.flatMap((h) => {
                const id = h.hospital?.id;
                const fid = h.hospital?.facility_id;
                return [id, fid].filter(Boolean) as string[];
              })
            )
          );
          const hospitalRefToUuid = await mapSiteRefsToHospitalRowIds(hospitalIds);
          const canonicalHospitalIds = [...new Set([...hospitalRefToUuid.values()])];
          const [hospActivitiesMap, hospGapPlansMap, hospReadinessMap, hospPrsReadinessMap] = await Promise.all([
            batchGetHospitalDataForKey<any[]>(canonicalHospitalIds, 'activities'),
            batchGetHospitalDataForKey<any[]>(canonicalHospitalIds, 'gapPlans'),
            batchGetHospitalDataForKey<any[]>(canonicalHospitalIds, 'readinessScores'),
            batchGetHospitalDataForKey<any[]>(canonicalHospitalIds, 'prsReadinessScores'),
          ]);

          // Load PECCs assigned to these hospitals
          const { refs: expandedPeccRefs } = await expandHospitalRefsForPeccQuery(hospitalIds);
          const peccHospitalOrClause = buildPeccHospitalFacilityOrClause(expandedPeccRefs);
          const [{ data: byHospital, error: byHospitalError }, { data: byMentor, error: byMentorError }] = await Promise.all([
            peccHospitalOrClause
              ? supabase
                  .from('users')
                  .select('id, first_name, last_name, email, hospital_facility_id, mentor_id')
                  .eq('role', 'pecc')
                  .or(peccHospitalOrClause)
              : Promise.resolve({ data: [] as PeccUserLike[], error: null }),
            supabase
              .from('users')
              .select('id, first_name, last_name, email, hospital_facility_id, mentor_id')
              .eq('role', 'pecc')
              .eq('mentor_id', mentorUserId),
          ]);
          if (byHospitalError) throw byHospitalError;
          if (byMentorError) throw byMentorError;
          const mentorLinkedPeccs = (byMentor || []) as PeccUserLike[];
          const peccsMap = new Map<string, PeccUserLike>();
          for (const h of mergedHospitals) {
            const hospitalRefs = new Set(
              [h.hospital?.id, h.hospital?.facility_id, hospitalRefToUuid.get(h.hospital?.id || ''), hospitalRefToUuid.get(String(h.hospital?.facility_id || ''))]
                .map((ref) => String(ref || '').trim())
                .filter(Boolean)
            );
            const byHospPeccs = ((byHospital || []) as PeccUserLike[]).filter((p) =>
              [...hospitalRefs].some((ref) => hospitalKeysMatch(p.hospital_facility_id, ref))
            );
            const { mergedPeccUsers } = resolvePeccsForMentorHospital({
              hospitalRefs,
              contacts: mentorContacts,
              mentorLinkedPeccs,
              peccUsersByHospital: byHospPeccs,
              siteMemberPeccIds: [],
              mentorId: mentorUserId,
            });
            mergedPeccUsers.forEach((row) => peccsMap.set(row.id, row));
          }
          const peccs = [...peccsMap.values()];

          const siteActivitiesByCanonical = new Map<string, MentorActivity[]>();

          // Load checklist progress for each PECC
          const peccDataPromises = (peccs || []).map(async (pecc) => {
            const peccHospitalId = pecc.hospital_facility_id;
            const hospital = mergedHospitals.find((h) => {
              const refs = new Set(
                [h.hospital?.id, h.hospital?.facility_id].map((ref) => String(ref || '').trim()).filter(Boolean)
              );
              if (peccHospitalId && [...refs].some((ref) => hospitalKeysMatch(ref, peccHospitalId))) return true;
              return mentorContacts.some(
                (contact) =>
                  contactMatchesPeccAtHospital(contact, pecc, refs) ||
                  (refs.has(String(contact.hospitalId || '').trim()) &&
                    contactNameMatchesPecc(contact, pecc))
              );
            });

            const canonicalHospitalId =
              (peccHospitalId ? hospitalRefToUuid.get(peccHospitalId) : undefined) ||
              (hospital?.hospital?.id ? hospitalRefToUuid.get(hospital.hospital.id) : undefined) ||
              (hospital?.hospital?.facility_id ? hospitalRefToUuid.get(hospital.hospital.facility_id) : undefined) ||
              '';

            let checklistProgress = 0;
            if (canonicalHospitalId) {
              const { data: checklistData } = await supabase
                .from('site_checklist_progress')
                .select('completed')
                .eq('hospital_id', canonicalHospitalId);
              const rows = checklistData || [];
              const completedTasks = rows.filter((t) => t.completed).length;
              checklistProgress = rows.length > 0 ? Math.round((completedTasks / rows.length) * 100) : 0;
            }

            const hospitalActivities = canonicalHospitalId ? hospActivitiesMap.get(canonicalHospitalId) : null;
            const hospitalGapPlans = canonicalHospitalId ? hospGapPlansMap.get(canonicalHospitalId) : null;
            const hospitalReadiness = canonicalHospitalId ? hospReadinessMap.get(canonicalHospitalId) : null;
            const hospitalPrsReadiness = canonicalHospitalId ? hospPrsReadinessMap.get(canonicalHospitalId) : null;
            const legacy = shouldMirrorLegacyUserData();
            const [peccActivitiesVal, peccGapPlansVal, prsScoresVal, readinessVal] = await Promise.all([
              legacy && !Array.isArray(hospitalActivities) ? getUserData<any[]>(pecc.id, 'activities') : Promise.resolve<any[] | null>(null),
              legacy && !Array.isArray(hospitalGapPlans) ? getUserData<any[]>(pecc.id, 'gapPlans') : Promise.resolve<any[] | null>(null),
              legacy && !Array.isArray(hospitalPrsReadiness) ? getUserData<any[]>(pecc.id, 'prsReadinessScores') : Promise.resolve<any[] | null>(null),
              legacy && !Array.isArray(hospitalReadiness) ? getUserData<any[]>(pecc.id, 'readinessScores') : Promise.resolve<any[] | null>(null),
            ]);

            const activities = Array.isArray(hospitalActivities)
              ? hospitalActivities
              : (Array.isArray(peccActivitiesVal) ? peccActivitiesVal : []);
            if (canonicalHospitalId && activities.length > 0) {
              siteActivitiesByCanonical.set(canonicalHospitalId, activities as MentorActivity[]);
            }
            const activityCount = activities.length;
            const lastActivity = activities.length > 0
              ? activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
              : null;
            const gapPlanCount = Array.isArray(hospitalGapPlans)
              ? hospitalGapPlans.length
              : (Array.isArray(peccGapPlansVal) ? peccGapPlansVal.length : 0);
            let readinessScores: Array<{ id: string; score: number; date: string }> = [];
            const scoresRaw = Array.isArray(hospitalPrsReadiness) && hospitalPrsReadiness.length > 0
              ? hospitalPrsReadiness
              : (
                Array.isArray(hospitalReadiness)
                  ? hospitalReadiness
                  : (Array.isArray(prsScoresVal) ? prsScoresVal : (Array.isArray(readinessVal) ? readinessVal : []))
              );
            if (scoresRaw.length > 0) readinessScores = scoresRaw as Array<{ id: string; score: number; date: string }>;

            const hospitalRowId = String(hospital?.hospital?.id || '');
            return {
              id: pecc.id,
              name: `${pecc.first_name} ${pecc.last_name}`.trim() || 'PECC',
              email: String(pecc.email || ''),
              hospital: normalizeHospitalOrOrgName(hospital?.hospital?.name || 'Unknown Hospital'),
              hospitalRowId,
              canonicalHospitalId,
              checklistProgress,
              activityCount,
              lastActivity,
              gapPlanCount,
              readinessScores
            };
          });

          const resolvedPeccData = await Promise.all(peccDataPromises);
          setPeccData(resolvedPeccData);
          const flattenedSiteActivities = [...siteActivitiesByCanonical.values()].flat();
          setSiteActivities(flattenedSiteActivities);

          // Calculate per-hospital metrics
          const metrics: HospitalMetrics[] = mergedHospitals.map(h => {
            const hospitalId = String(h.hospital?.id || '');
            const hospitalName = normalizeHospitalOrOrgName(h.hospital?.name || 'Unknown Hospital');
            const hospitalFacilityId = String(h.hospital?.facility_id || hospitalId);
            const canonicalHospitalId =
              hospitalRefToUuid.get(hospitalId) ||
              hospitalRefToUuid.get(hospitalFacilityId) ||
              '';
            const hospitalActivities = canonicalHospitalId
              ? (hospActivitiesMap.get(canonicalHospitalId) || [])
              : [];
            const siteHours = hospitalActivities.reduce((sum: number, a: any) => sum + (Number(a?.hours) || 0), 0);
            const simulations = hospitalActivities.filter((a: any) => isSimulationActivity(a)).length;
            const hospitalRefSet = new Set([hospitalId, hospitalFacilityId, canonicalHospitalId].filter(Boolean));
            const peccCount = resolvedPeccData.filter((p) => peccMatchesHospitalRefs(p, hospitalRefSet)).length;

            return {
              hospitalId,
              hospitalName,
              siteActivityCount: hospitalActivities.length,
              siteHours,
              simulations,
              peccCount
            };
          });

          setHospitalMetrics(metrics);

          const prsHospitalIds = resolvedPeccData
            .filter((p) => p.readinessScores.length > 0)
            .map((p) => p.hospitalRowId)
            .filter(Boolean);
          setSelectedHospitals([...new Set(prsHospitalIds.length > 0 ? prsHospitalIds : metrics.map((m) => m.hospitalId))]);
        }
        
      } catch (err) {
        console.error('Error loading mentor snapshot data:', err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [mentorUserId, retryCount]);

  // Calculate metrics
  const totalHours = useMemo(() => 
    activities.reduce((sum, a) => sum + (a.hours || 0), 0), 
    [activities]
  );

  const thisMonthHours = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    return activities
      .filter(a => {
        const activityDate = new Date(a.date);
        return activityDate >= monthStart && activityDate <= monthEnd;
      })
      .reduce((sum, a) => sum + (a.hours || 0), 0);
  }, [activities]);

  const lastMonthHours = useMemo(() => {
    const now = new Date();
    const lastMonth = subMonths(now, 1);
    const monthStart = startOfMonth(lastMonth);
    const monthEnd = endOfMonth(lastMonth);
    
    return activities
      .filter(a => {
        const activityDate = new Date(a.date);
        return activityDate >= monthStart && activityDate <= monthEnd;
      })
      .reduce((sum, a) => sum + (a.hours || 0), 0);
  }, [activities]);

  const avgPECCProgress = useMemo(() => {
    if (peccData.length === 0) return 0;
    return Math.round(peccData.reduce((sum, p) => sum + p.checklistProgress, 0) / peccData.length);
  }, [peccData]);

  const activePECCs = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return peccData.filter(p => 
      p.lastActivity && new Date(p.lastActivity) > thirtyDaysAgo
    ).length;
  }, [peccData]);

  const hospitalsAwaitingPeccSetup = useMemo(
    () => hospitalMetrics.filter((metric) => metric.peccCount === 0),
    [hospitalMetrics]
  );

  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; hours: number }> = {};
    activities.forEach(a => {
      const categories = getActivityCategories(a);
      const normalized = categories.length > 0 ? categories : ['Uncategorized'];
      normalized.forEach((category) => {
        if (!breakdown[category]) {
          breakdown[category] = { count: 0, hours: 0 };
        }
        breakdown[category].count += 1;
        breakdown[category].hours += a.hours || 0;
      });
    });
    return breakdown;
  }, [activities]);

  const uniqueSiteActivityTotals = useMemo(() => {
    const seen = new Set<string>();
    let activities = 0;
    let gapPlans = 0;
    for (const p of peccData) {
      const key = p.canonicalHospitalId || p.hospitalRowId;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      activities += p.activityCount;
      gapPlans += p.gapPlanCount;
    }
    return { activities, gapPlans };
  }, [peccData]);

  // Site simulation breakdown (hospital_data activities, not mentor log)
  const simulationBreakdown = useMemo(() => {
    const simActivities = siteActivities.filter((a) => isSimulationActivity(a));
    const breakdown: Record<string, number> = {};
    simActivities.forEach(a => {
      const simType = a.simulation || 'Other';
      breakdown[simType] = (breakdown[simType] || 0) + 1;
    });
    return breakdown;
  }, [siteActivities]);

  // Toggle hospital selection for PRS chart
  const handleToggleHospital = (hospitalId: string) => {
    setSelectedHospitals(prev => 
      prev.includes(hospitalId) 
        ? prev.filter(id => id !== hospitalId)
        : [...prev, hospitalId]
    );
  };

  const handleSelectAllHospitals = () => {
    setSelectedHospitals(hospitalMetrics.map(m => m.hospitalId));
  };

  const handleDeselectAllHospitals = () => {
    setSelectedHospitals([]);
  };

  const hospitalRefsForRollup = useMemo(
    () =>
      assignedHospitals.map((h) => ({
        id: String(h.hospital?.id || ''),
        facilityId: String(h.hospital?.facility_id || ''),
        name: normalizeHospitalOrOrgName(h.hospital?.name || 'Hospital'),
      })),
    [assignedHospitals]
  );

  const mentorHoursByHospital = useMemo(
    () => rollupMentorHoursByHospital(activities, hospitalRefsForRollup),
    [activities, hospitalRefsForRollup]
  );

  const unlinkedMentorHours = useMemo(() => sumUnlinkedMentorHours(activities), [activities]);

  const prsChartSeries = useMemo((): MentorPrsSeries[] => {
    return peccData
      .filter((p) => selectedHospitals.includes(p.hospitalRowId) && p.readinessScores.length > 0)
      .map((pecc, index) => ({
        seriesKey: `hospital_${index}`,
        label: pecc.hospital,
        scores: [...pecc.readinessScores].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
      }));
  }, [peccData, selectedHospitals]);

  const exportToPDF = () => {
    window.print();
  };

  // Loading state
  if (isLoading) {
    return (
      <AdminPageShell>
        <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 5, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Loading Snapshot…
          </Typography>
          <LinearProgress color="secondary" sx={{ maxWidth: 360, mx: 'auto', mt: 2 }} />
        </Paper>
      </AdminPageShell>
    );
  }

  if (hasError) {
    return (
      <AdminPageShell>
        <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 5, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom color="error" sx={{ fontWeight: 600 }}>
            Couldn&apos;t load snapshot
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            There was an error loading your snapshot data. Please try again.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => setRetryCount((c) => c + 1)}
            sx={{ mr: 1 }}
          >
            Retry
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </Paper>
      </AdminPageShell>
    );
  }

  if (assignedHospitals.length === 0) {
    return (
      <AdminPageShell>
        <AdminHero
          overline="Mentoring metrics"
          title="Snapshot"
          description="Your overview shows data for hospitals assigned to you."
        />
        <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 5, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
            No assigned hospitals
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 520, mx: 'auto' }}>
            Add or link hospitals from the <strong>Hospitals</strong> page, or ask your manager to assign you in the CRM.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
            <Button variant="contained" color="secondary" onClick={() => navigate('/mentor/hospitals')}>
              Go to Hospitals
            </Button>
            <Button variant="outlined" onClick={() => navigate('/mentor/dashboard')}>
              Dashboard
            </Button>
          </Stack>
        </Paper>
      </AdminPageShell>
    );
  }

  const kpiItems = [
    {
      label: 'Activities',
      value: String(activities.length),
      caption: `${totalHours.toFixed(1)} hours logged`,
    },
    {
      label: 'Assigned PECCs',
      value: String(peccData.length),
      caption: `${activePECCs} active in last 30 days`,
    },
    {
      label: 'Avg PECC progress',
      value: `${avgPECCProgress}%`,
      caption: 'Across assigned PECCs',
    },
    {
      label: 'Hospitals',
      value: String(assignedHospitals.length),
      caption: 'Active mentoring sites',
    },
    {
      label: 'This month',
      value: `${thisMonthHours.toFixed(1)}h`,
      caption: 'Your mentoring hours',
    },
  ];

  return (
    <AdminPageShell>
      <AdminHero
        overline="Mentoring metrics"
        title="Snapshot"
        description="Track your activities, monitor PECC progress, and measure engagement across assigned hospitals."
        actions={
          <>
            <Button size="small" variant="outlined" onClick={() => navigate('/mentor/dashboard')}>
              Dashboard
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<PictureAsPdfIcon />}
              onClick={exportToPDF}
            >
              Export PDF
            </Button>
          </>
        }
      />

      <Alert
        severity="info"
        variant="outlined"
        sx={{ bgcolor: (t) => alpha(t.palette.secondary.main, 0.04) }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {peccData.length} PECCs · {assignedHospitals.length} hospitals
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Average checklist progress: {avgPECCProgress}% · {activePECCs} PECC
              {activePECCs === 1 ? '' : 's'} active in last 30 days
            </Typography>
            {hospitalsAwaitingPeccSetup.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {hospitalsAwaitingPeccSetup.length} assigned hospital
                {hospitalsAwaitingPeccSetup.length === 1 ? '' : 's'} awaiting PECC setup or account creation
              </Typography>
            )}
          </Box>
          <Chip
            label={`${thisMonthHours.toFixed(1)} hours this month`}
            color="secondary"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Alert>

      <Paper elevation={0} sx={adminSectionShellSx}>
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
          >
            At a glance
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Key mentoring metrics across your network
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(5, minmax(0, 1fr))',
            },
            '& > *': {
              borderRight: { xs: 'none', sm: '1px solid' },
              borderBottom: { xs: '1px solid', md: 'none' },
              borderColor: 'divider',
            },
            '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
          }}
        >
          {kpiItems.map((item) => (
            <Box key={item.label} sx={{ px: { xs: 1.75, md: 2 }, py: 1.75, textAlign: 'center' }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase', fontSize: '0.65rem' }}
              >
                {item.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.35rem',
                  letterSpacing: -0.02,
                  color: 'secondary.dark',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.15,
                  mt: 0.5,
                }}
              >
                {item.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                {item.caption}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid item xs={12} md={6}>
          <AdminSection
            overline="Your log"
            title="Activity breakdown"
            description="Mentoring hours by category"
          >
            {Object.keys(categoryBreakdown).length > 0 ? (
              Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b.hours - a.hours)
                .map(([category, data]) => {
                  const percentage = totalHours > 0 ? (data.hours / totalHours) * 100 : 0;
                  return (
                    <Box key={category} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {category}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {data.hours.toFixed(1)}h ({Math.round(percentage)}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        color="secondary"
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  );
                })
            ) : (
              <Typography variant="body2" color="text.secondary">
                No activity data yet. Start logging mentoring activities.
              </Typography>
            )}
          </AdminSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <AdminSection overline="Your log" title="Hours overview" description="Time invested in PECC mentoring">
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
                overflow: 'hidden',
                '& > *': { borderColor: 'divider' },
              }}
            >
              {[
                { label: 'This month', value: thisMonthHours.toFixed(1) },
                { label: 'Last month', value: lastMonthHours.toFixed(1) },
                { label: 'Total hours', value: totalHours.toFixed(1) },
                {
                  label: 'Avg per activity',
                  value: activities.length > 0 ? (totalHours / activities.length).toFixed(1) : '0.0',
                },
              ].map((item, i) => (
                <Box
                  key={item.label}
                  sx={{
                    px: 1.75,
                    py: 1.5,
                    textAlign: 'center',
                    borderRight: i % 2 === 0 ? '1px solid' : 'none',
                    borderBottom: i < 2 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase', fontSize: '0.65rem' }}
                  >
                    {item.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '1.25rem',
                      color: 'secondary.dark',
                      fontVariantNumeric: 'tabular-nums',
                      mt: 0.35,
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </AdminSection>
        </Grid>

        <Grid item xs={12}>
          <AdminSection overline="Your log" title="Hours by hospital">
            <MentorHoursByHospitalPanel
              rollups={mentorHoursByHospital}
              unlinkedHours={unlinkedMentorHours}
            />
          </AdminSection>
        </Grid>
      </Grid>

      <AdminSection
        overline="PECC development"
        title="Checklist progress"
        description="Completion rates for assigned PECCs, plus hospitals still awaiting kickoff"
      >
        {peccData.length > 0 ? (
          <Grid container spacing={1.25}>
            {peccData.map((pecc) => (
              <Grid item xs={12} md={6} key={pecc.id}>
                <Box
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    borderLeft: '3px solid',
                    borderLeftColor:
                      pecc.checklistProgress >= 75
                        ? 'success.main'
                        : pecc.checklistProgress >= 50
                          ? 'warning.main'
                          : 'error.main',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: (t) => alpha(t.palette.secondary.main, 0.15),
                        color: 'secondary.dark',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                      }}
                    >
                      {pecc.name.charAt(0)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {pecc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {pecc.hospital}
                      </Typography>
                    </Box>
                    <Chip
                      label={`${pecc.checklistProgress}%`}
                      size="small"
                      color={
                        pecc.checklistProgress >= 75
                          ? 'success'
                          : pecc.checklistProgress >= 50
                            ? 'warning'
                            : 'error'
                      }
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pecc.checklistProgress}
                    color="secondary"
                    sx={{ height: 6, borderRadius: 1, mb: 1 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {pecc.activityCount} activities
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pecc.gapPlanCount} gap plans
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pecc.lastActivity
                        ? `Active ${format(new Date(pecc.lastActivity), 'MMM d')}`
                        : 'No recent activity'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : hospitalMetrics.length > 0 ? (
          <Grid container spacing={1.25}>
            {hospitalMetrics.map((metric) => (
              <Grid item xs={12} md={6} key={metric.hospitalId}>
                <Box
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    borderLeft: '3px solid',
                    borderLeftColor: 'secondary.main',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: (t) => alpha(t.palette.secondary.main, 0.15),
                        color: 'secondary.dark',
                      }}
                    >
                      <HospitalIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {metric.hospitalName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Assigned hospital
                      </Typography>
                    </Box>
                    <Chip label="Awaiting PECC setup" size="small" color="info" variant="outlined" />
                  </Box>
                  <LinearProgress variant="determinate" value={0} sx={{ height: 6, borderRadius: 1, mb: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Ready to begin once site work starts
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No PECCs assigned yet
          </Typography>
        )}
      </AdminSection>

      <Paper elevation={0} sx={adminSectionShellSx}>
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
          >
            Site engagement
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Activity and gap-plan volume across assigned hospitals
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
            '& > *': {
              borderRight: { xs: 'none', sm: '1px solid' },
              borderBottom: { xs: '1px solid', sm: 'none' },
              borderColor: 'divider',
            },
            '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
          }}
        >
          {[
            {
              label: 'Site activities',
              value: String(uniqueSiteActivityTotals.activities),
              caption:
                assignedHospitals.length > 0
                  ? `${(uniqueSiteActivityTotals.activities / assignedHospitals.length).toFixed(1)} avg per hospital`
                  : 'None yet',
            },
            {
              label: 'Gap plans',
              value: String(uniqueSiteActivityTotals.gapPlans),
              caption:
                assignedHospitals.length > 0
                  ? `${(uniqueSiteActivityTotals.gapPlans / assignedHospitals.length).toFixed(1)} avg per hospital`
                  : 'None yet',
            },
            {
              label: 'Active PECCs',
              value: `${activePECCs}/${peccData.length}`,
              caption: `${peccData.length > 0 ? Math.round((activePECCs / peccData.length) * 100) : 0}% engagement (30 days)`,
            },
          ].map((item) => (
            <Box key={item.label} sx={{ px: { xs: 1.75, md: 2 }, py: 1.75, textAlign: 'center' }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase', fontSize: '0.65rem' }}
              >
                {item.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '1.35rem',
                  letterSpacing: -0.02,
                  color: 'secondary.dark',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.15,
                  mt: 0.5,
                }}
              >
                {item.value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                {item.caption}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <AdminSection
        overline="Sites"
        title="Hospital site activity"
        description="Activities logged at each site, plus linked PECC count"
      >
        {hospitalMetrics.length > 0 ? (
          <Grid container spacing={1.25}>
            {hospitalMetrics.map((metric) => (
              <Grid item xs={12} md={6} key={metric.hospitalId}>
                <Box
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    {metric.hospitalName}
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 1,
                    }}
                  >
                    {[
                      { label: 'Site activities', value: String(metric.siteActivityCount) },
                      { label: 'Site hours', value: metric.siteHours.toFixed(1) },
                      { label: 'Simulations', value: String(metric.simulations) },
                      { label: 'PECCs', value: String(metric.peccCount) },
                    ].map((cell) => (
                      <Box
                        key={cell.label}
                        sx={{
                          p: 1,
                          textAlign: 'center',
                          borderRadius: 1,
                          bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
                        }}
                      >
                        <Typography
                          sx={{
                            fontWeight: 700,
                            color: 'secondary.dark',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '1.05rem',
                          }}
                        >
                          {cell.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {cell.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No hospital metrics available
          </Typography>
        )}
      </AdminSection>

      <Grid container spacing={{ xs: 2, md: 2.5 }}>
        <Grid item xs={12} md={6}>
          <AdminSection
            overline="Simulations"
            title="Simulation types"
            description="Cases logged at your assigned sites"
          >
            {Object.keys(simulationBreakdown).length > 0 ? (
              Object.entries(simulationBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([simType, count]) => {
                  const total = Object.values(simulationBreakdown).reduce((sum, c) => sum + c, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <Box key={simType} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                          {simType}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {count} ({Math.round(percentage)}%)
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        color="secondary"
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  );
                })
            ) : (
              <Typography variant="body2" color="text.secondary">
                No simulation data available
              </Typography>
            )}
          </AdminSection>
        </Grid>

        <Grid item xs={12} md={6}>
          <AdminSection
            overline="Simulations"
            title="By hospital"
            description="Simulation cases completed at each hospital"
          >
            {hospitalMetrics.some((h) => h.simulations > 0) ? (
              hospitalMetrics
                .filter((h) => h.simulations > 0)
                .sort((a, b) => b.simulations - a.simulations)
                .map((metric) => {
                  const maxSims = Math.max(...hospitalMetrics.map((h) => h.simulations));
                  const percentage = maxSims > 0 ? (metric.simulations / maxSims) * 100 : 0;
                  return (
                    <Box key={metric.hospitalId} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }} noWrap>
                          {metric.hospitalName.length > 30
                            ? metric.hospitalName.substring(0, 30) + '…'
                            : metric.hospitalName}
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {metric.simulations}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={percentage}
                        color="secondary"
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  );
                })
            ) : (
              <Typography variant="body2" color="text.secondary">
                No simulation data available
              </Typography>
            )}
          </AdminSection>
        </Grid>
      </Grid>

      {peccData.some((p) => p.readinessScores.length > 0) && (
        <AdminSection
          overline="Readiness"
          title="Pediatric Readiness Score trends"
          description="Scores stored per hospital (hospital or PECC legacy data)"
          actions={
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={handleSelectAllHospitals}>
                Select all
              </Button>
              <Button size="small" onClick={handleDeselectAllHospitals}>
                Clear
              </Button>
            </Stack>
          }
        >
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (t) => alpha(t.palette.secondary.main, 0.03),
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Hospitals to display
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {peccData
                .filter((p) => p.readinessScores.length > 0)
                .map((pecc, index) => (
                  <FormControlLabel
                    key={pecc.id}
                    control={
                      <Checkbox
                        checked={selectedHospitals.includes(pecc.hospitalRowId)}
                        onChange={() => handleToggleHospital(pecc.hospitalRowId)}
                        size="small"
                        color="secondary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length],
                          }}
                        />
                        <Typography variant="body2">
                          {pecc.hospital.length > 25
                            ? pecc.hospital.substring(0, 25) + '…'
                            : pecc.hospital}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
            </Box>
          </Box>

          {prsChartSeries.length > 0 && selectedHospitals.length > 0 ? (
            <Box sx={{ mt: 1 }}>
              <MentorPrsTrendChart series={prsChartSeries} />
            </Box>
          ) : selectedHospitals.length === 0 ? (
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
              Select at least one hospital to view PRS trends
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
              No PRS assessment data available for selected hospitals
            </Typography>
          )}
        </AdminSection>
      )}
    </AdminPageShell>
  );

};

export default MentorSnapshotPage;
