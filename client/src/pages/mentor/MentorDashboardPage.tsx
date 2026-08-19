import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  List,
  ListItem,
  Chip,
  LinearProgress,
  Drawer,
  IconButton,
  Divider,
  Stack,
  Paper,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  AccessTime as HoursIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { fetchMergedMentorHospitals } from '../../utils/mentorHospitalScope';
import { format } from 'date-fns';
import { supabase } from '../../supabase';
import { batchGetHospitalDataForKey, getUserData, mapSiteRefsToHospitalRowIds } from '../../utils/userData';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';
import {
  displayActivityCategories,
  isSimulationActivity,
} from '../../utils/mentorActivityCategories';
import {
  resolvePeccsForMentorHospital,
  type MentorContactLike,
  type PeccUserLike,
} from '../../utils/mentorPeccHospitalMatch';
import { buildHospitalsTableOrClause, hospitalKeysMatch } from '../../utils/hospitalId';
import { buildPeccHospitalFacilityOrClause, expandHospitalRefsForPeccQuery } from '../../utils/mentorHospitalAssignments';
import { rollupMentorHoursByHospital, sumUnlinkedMentorHours } from '../../utils/mentorHoursByHospital';
import { MentorHoursByHospitalPanel } from '../../components/mentor/MentorHoursByHospitalPanel';
import DashboardResources from '../../components/DashboardResources';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';

export type PeccLinkStatus = 'linked' | 'contact_only' | 'none';

interface DashboardStats {
  totalHospitals: number;
  totalPeccs: number;
  siteActivitiesThisMonth: number;
  siteHoursThisMonth: number;
  mentorHoursThisMonth: number;
  simulationsThisMonth: number;
}

interface StoredHospital {
  id: string;
  facilityId?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  traumaLevel?: string;
  edSize?: string;
  notes?: string;
  isWorkingWith?: boolean;
}

interface StoredContact {
  id: string;
  hospitalId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isPrimaryContact?: boolean;
  contactStatus?: string;
}

interface StoredActivity {
  id: string;
  date: string;
  activityName?: string;
  activity_type?: string;
  category?: string;
  categories?: string[];
  hours?: number;
  description?: string;
  enteredByName?: string;
  entered_by_name?: string;
  enteredBy?: string;
  userName?: string;
  hospitalIds?: string[];
}

interface HospitalSummary {
  id: string;
  facilityId?: string;
  name: string;
  city?: string;
  state?: string;
  phone?: string;
  traumaLevel?: string;
  address?: string;
  notes?: string;
  peccName: string;
  peccEmail: string;
  peccUserId: string | null;
  peccLinkStatus: PeccLinkStatus;
  mentorHours: number;
  mentorHoursThisMonth: number;
  mentorActivityCount: number;
  activityCount: number;
  totalHours: number;
  lastActivityAt: string | null;
  activities: StoredActivity[];
}

const MentorDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile, effectiveUserId } = useUserProfile();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [stats, setStats] = useState<DashboardStats>({
    totalHospitals: 0,
    totalPeccs: 0,
    siteActivitiesThisMonth: 0,
    siteHoursThisMonth: 0,
    mentorHoursThisMonth: 0,
    simulationsThisMonth: 0
  });
  const [hospitalSummaries, setHospitalSummaries] = useState<HospitalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<HospitalSummary | null>(null);
  const [hospitalDrawerOpen, setHospitalDrawerOpen] = useState(false);
  const [mentorHoursRollups, setMentorHoursRollups] = useState<
    ReturnType<typeof rollupMentorHoursByHospital>
  >([]);
  const [unlinkedMentorHours, setUnlinkedMentorHours] = useState(0);

  const loadDashboardData = async () => {
    const uid = effectiveUserId ?? currentUser?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoadError(null);
    try {
    const [hospitalsVal, contactsVal] = await Promise.all([
      getUserData<any[]>(uid, 'mentorHospitals'),
      getUserData<any[]>(uid, 'mentorContacts')
    ]);
    let mergedRows: Awaited<ReturnType<typeof fetchMergedMentorHospitals>> = [];
    try {
      mergedRows = await fetchMergedMentorHospitals(uid);
    } catch (e) {
      console.warn('[MentorDashboard] merged mentor hospitals unavailable:', e);
    }
    const storedHospitals: StoredHospital[] = Array.isArray(hospitalsVal) ? hospitalsVal : [];
    const contacts: StoredContact[] = Array.isArray(contactsVal) ? contactsVal : [];

    const storedById = new Map(storedHospitals.map((h) => [h.id, h]));
    let workingHospitals: StoredHospital[];
    if (mergedRows.length > 0) {
      workingHospitals = mergedRows
        .map((m) => {
          const s = storedById.get(m.hospital.id);
          if (s && s.isWorkingWith === false) return null;
          const base: StoredHospital = s ?? {
            id: m.hospital.id,
            facilityId: String(m.hospital.facility_id ?? m.hospital.id),
            name: m.hospital.name || 'Hospital',
            city: m.storedHospital?.city,
            state: m.storedHospital?.state
          };
          return {
            ...base,
            id: m.hospital.id,
            facilityId: String(m.hospital.facility_id ?? base.facilityId ?? m.hospital.id),
            name: base.name || m.hospital.name || 'Hospital'
          };
        })
        .filter(Boolean) as StoredHospital[];
    } else {
      workingHospitals = storedHospitals.filter((h: StoredHospital) => h.isWorkingWith !== false);
    }

    // Sync hospital names from CRM (Supabase) so updates in CRM appear in tabs
    const nameByKey: Record<string, string> = {};
    if (workingHospitals.length > 0) {
      const ids = workingHospitals.flatMap((h: StoredHospital) =>
        [h.id, h.facilityId].map((ref) => String(ref || '').trim()).filter(Boolean)
      );
      const { data: rows } = await supabase
        .from('hospitals')
        .select('id, facility_id, name')
        .or(buildHospitalsTableOrClause(ids));
      (rows || []).forEach((r: { id?: string; facility_id?: string; name?: string }) => {
        const name = r.name != null ? normalizeHospitalOrOrgName(r.name) : '';
        if (r.id) nameByKey[r.id] = name;
        if (r.facility_id != null) nameByKey[String(r.facility_id)] = name;
      });
    }

    const hospitalRefs = [...new Set(
      workingHospitals.flatMap((h: StoredHospital) =>
        [h.id, h.facilityId].map((ref) => String(ref || '').trim()).filter(Boolean)
      )
    )];
    const hospitalRefToUuid = hospitalRefs.length > 0 ? await mapSiteRefsToHospitalRowIds(hospitalRefs) : new Map<string, string>();
    const canonicalHospitalIds = [...new Set([...hospitalRefToUuid.values()])];
    const hospitalActivitiesMap = canonicalHospitalIds.length > 0
      ? await batchGetHospitalDataForKey<any[]>(canonicalHospitalIds, 'activities')
      : new Map<string, any[] | null>();

    const mentorContacts: MentorContactLike[] = contacts.map((c) => ({
      hospitalId: c.hospitalId,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      isPrimaryContact: c.isPrimaryContact,
    }));

    const { refs: expandedPeccRefs } = await expandHospitalRefsForPeccQuery(hospitalRefs);
    const peccHospitalOrClause = buildPeccHospitalFacilityOrClause(expandedPeccRefs);
    const [{ data: byHospital }, { data: byMentor }] = await Promise.all([
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
        .eq('mentor_id', uid),
    ]);
    const mentorLinkedPeccs = (byMentor || []) as PeccUserLike[];
    const peccsByHospital = (byHospital || []) as PeccUserLike[];

    const mentorActivities = await getMentorActivitiesForUser(uid);
    const mentorHoursRollups = rollupMentorHoursByHospital(
      mentorActivities,
      workingHospitals.map((h: StoredHospital) => ({
        id: h.id,
        facilityId: h.facilityId,
        name: nameByKey[h.id] ?? normalizeHospitalOrOrgName(h.name ?? 'Unknown'),
      }))
    );
    const mentorHoursByHospitalId = new Map(mentorHoursRollups.map((r) => [r.hospitalId, r]));

    const summaries: HospitalSummary[] = workingHospitals.map((h: StoredHospital) => {
      const hospitalRefSet = new Set(
        [h.id, h.facilityId].map((ref) => String(ref || '').trim()).filter(Boolean)
      );
      const hContacts = contacts.filter((c: StoredContact) =>
        [...hospitalRefSet].some((ref) => hospitalKeysMatch(c.hospitalId, ref))
      );
      const primaryContact = hContacts.find((c: StoredContact) => c.isPrimaryContact) || hContacts[0];

      const canonicalHospitalId =
        hospitalRefToUuid.get(h.id) ||
        (h.facilityId ? hospitalRefToUuid.get(h.facilityId) : undefined) ||
        null;
      if (canonicalHospitalId) hospitalRefSet.add(canonicalHospitalId);

      const byHospPeccs = peccsByHospital.filter((p) =>
        [...hospitalRefSet].some((ref) => hospitalKeysMatch(p.hospital_facility_id, ref))
      );
      const { mergedPeccUsers } = resolvePeccsForMentorHospital({
        hospitalRefs: hospitalRefSet,
        contacts: mentorContacts,
        mentorLinkedPeccs,
        peccUsersByHospital: byHospPeccs,
        siteMemberPeccIds: [],
        mentorId: uid,
      });
      const linkedPecc = mergedPeccUsers[0];
      const peccName = linkedPecc
        ? `${linkedPecc.first_name || ''} ${linkedPecc.last_name || ''}`.trim() || '—'
        : primaryContact
          ? `${primaryContact.firstName} ${primaryContact.lastName}`.trim() || '—'
          : '—';
      const peccEmail = linkedPecc?.email?.trim() || primaryContact?.email?.trim() || '—';
      const peccUserId = linkedPecc?.id || null;
      const peccLinkStatus: PeccLinkStatus = linkedPecc
        ? 'linked'
        : primaryContact
          ? 'contact_only'
          : 'none';
      const mentorRollup = mentorHoursByHospitalId.get(h.id);

      const hospitalActivities = (canonicalHospitalId ? hospitalActivitiesMap.get(canonicalHospitalId) : null) || [];
      const sortedByDate = [...hospitalActivities].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const lastActivityAt = sortedByDate[0]?.date || null;
      const totalHours = hospitalActivities.reduce((sum: number, a: StoredActivity) => sum + (Number(a.hours) || 0), 0);

      const displayName = nameByKey[h.id] ?? normalizeHospitalOrOrgName(h.name ?? 'Unknown');
      return {
        id: h.id,
        facilityId: h.facilityId,
        name: displayName,
        city: h.city,
        state: h.state,
        phone: h.phone,
        traumaLevel: h.traumaLevel,
        address: h.address,
        notes: h.notes,
        peccName,
        peccEmail,
        peccUserId,
        peccLinkStatus,
        mentorHours: mentorRollup?.totalHours ?? 0,
        mentorHoursThisMonth: mentorRollup?.hoursThisMonth ?? 0,
        mentorActivityCount: mentorRollup?.activityCount ?? 0,
        activityCount: hospitalActivities.length,
        totalHours,
        lastActivityAt,
        activities: sortedByDate
      };
    });

    const distinctPeccIds = new Set(
      summaries.map((s) => s.peccUserId).filter((id): id is string => Boolean(id))
    );
    const allHospitalActivities = summaries.flatMap((s) => s.activities);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthSiteActivities = allHospitalActivities.filter(
      (a: StoredActivity) => new Date(a.date) >= startOfMonth
    );
    const thisMonthMentorActivities = mentorActivities.filter(
      (a: { date?: string }) => a.date && new Date(a.date) >= startOfMonth
    );
    const simulationsThisMonth = thisMonthSiteActivities.filter((a: StoredActivity) =>
      isSimulationActivity(a)
    ).length;
    setStats({
      totalHospitals: workingHospitals.length,
      totalPeccs: distinctPeccIds.size > 0 ? distinctPeccIds.size : summaries.filter((s) => s.peccEmail !== '—').length,
      siteActivitiesThisMonth: thisMonthSiteActivities.length,
      siteHoursThisMonth: thisMonthSiteActivities.reduce(
        (sum: number, a: StoredActivity) => sum + (Number(a.hours) || 0),
        0
      ),
      mentorHoursThisMonth: thisMonthMentorActivities.reduce(
        (sum: number, a: { hours?: number }) => sum + (Number(a.hours) || 0),
        0
      ),
      simulationsThisMonth
    });
    setHospitalSummaries(summaries);
    setMentorHoursRollups(mentorHoursRollups);
    setUnlinkedMentorHours(sumUnlinkedMentorHours(mentorActivities));
    } catch (err) {
      console.error('Mentor dashboard load error:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load Support Tool. Try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (effectiveUserId ?? currentUser?.id) loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDashboardData defined below
  }, [currentUser, effectiveUserId]);

  const handleHospitalClick = (hospital: HospitalSummary) => {
    setSelectedHospital(hospital);
    setHospitalDrawerOpen(true);
  };

  const statItems = [
    {
      label: 'Assigned hospitals',
      value: String(stats.totalHospitals),
      caption: 'Active mentoring sites',
    },
    {
      label: 'Your hours (month)',
      value: stats.mentorHoursThisMonth.toFixed(1),
      caption: 'Mentoring log',
    },
    {
      label: 'Site activity (month)',
      value: String(stats.siteActivitiesThisMonth),
      caption: `${stats.siteHoursThisMonth.toFixed(1)} site hours`,
    },
    {
      label: 'Linked PECCs',
      value: String(stats.totalPeccs),
      caption:
        stats.simulationsThisMonth > 0
          ? `${stats.simulationsThisMonth} simulation${stats.simulationsThisMonth === 1 ? '' : 's'} this month`
          : 'Accounts matched to sites',
    },
  ];

  if (loading) {
    return (
      <AdminPageShell>
        <Paper elevation={0} sx={{ ...adminSectionShellSx, px: { xs: 2, md: 2.5 }, py: 4 }} role="status" aria-live="polite">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Loading your dashboard…
          </Typography>
          <LinearProgress color="secondary" aria-label="Loading dashboard" />
        </Paper>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      {loadError && (
        <Alert severity="error" onClose={() => setLoadError(null)}>
          {loadError}{' '}
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              setLoading(true);
              loadDashboardData();
            }}
          >
            Retry
          </Button>
        </Alert>
      )}

      <AdminHero
        overline="Mentoring"
        title={`Welcome back, ${userProfile?.first_name || 'Mentor'}`}
        description="Your home base for assigned hospitals, linked PECCs, site activity, and mentoring hours. Open a hospital for site details and activity history."
        actions={
          <>
            <Button size="small" variant="outlined" onClick={() => navigate('/mentor/snapshot')}>
              Snapshot
            </Button>
            <Button size="small" variant="outlined" onClick={() => navigate('/mentor/activities')}>
              Log activity
            </Button>
            <Button
              size="small"
              variant="contained"
              color="secondary"
              onClick={() => navigate('/mentor/milestones')}
            >
              Site milestones
            </Button>
          </>
        }
      />

      <Paper elevation={0} sx={adminSectionShellSx}>
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.secondary.main, 0.04),
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
          >
            At a glance
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            This month across your assigned sites
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            '& > *': {
              borderRight: { xs: 'none', sm: '1px solid' },
              borderBottom: { xs: '1px solid', md: 'none' },
              borderColor: 'divider',
            },
            '& > *:nth-of-type(2n)': { borderRight: { xs: 'none', sm: '1px solid' } },
            '& > *:last-child': { borderRight: 'none', borderBottom: 'none' },
          }}
        >
          {statItems.map((item) => (
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
        title="My hospitals"
        description={`${hospitalSummaries.length} hospital${hospitalSummaries.length === 1 ? '' : 's'} assigned to you`}
        actions={
          <Button size="small" variant="outlined" onClick={() => navigate('/mentor/hospitals')}>
            Manage hospitals
          </Button>
        }
        disableBodyPadding={hospitalSummaries.length > 0}
        bodySx={hospitalSummaries.length > 0 ? { px: { xs: 1.5, md: 2 }, py: { xs: 1.5, md: 2 } } : undefined}
      >
        {hospitalSummaries.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No hospitals assigned yet. Add hospitals from the Hospitals page.
            </Typography>
            <Button variant="contained" color="secondary" onClick={() => navigate('/mentor/hospitals')}>
              Go to Hospitals
            </Button>
          </Box>
        ) : (
          <Grid container spacing={{ xs: 1, md: 1.25 }}>
            {hospitalSummaries.map((hospital) => (
              <Grid item xs={12} md={6} key={hospital.id}>
                <Box
                  component="button"
                  type="button"
                  aria-label={`Open ${normalizeHospitalOrOrgName(hospital.name)} details`}
                  onClick={() => handleHospitalClick(hospital)}
                  sx={{
                    width: '100%',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    p: { xs: 1.5, md: 1.6 },
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
                    '&:hover': {
                      borderColor: 'secondary.light',
                      bgcolor: alpha(theme.palette.secondary.main, 0.04),
                      boxShadow: '0 2px 10px rgba(61, 85, 96, 0.08)',
                    },
                    '&:focus-visible': {
                      outline: `2px solid ${theme.palette.secondary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(theme.palette.secondary.main, 0.12),
                        color: 'secondary.dark',
                        flexShrink: 0,
                      }}
                    >
                      <HospitalIcon sx={{ fontSize: 18 }} aria-hidden />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 700, letterSpacing: -0.01, lineHeight: 1.3 }}
                        >
                          {normalizeHospitalOrOrgName(hospital.name)}
                        </Typography>
                        {hospital.peccLinkStatus === 'contact_only' && (
                          <Chip
                            label="Awaiting PECC account"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ flexShrink: 0, maxWidth: '55%', height: 22 }}
                          />
                        )}
                        {hospital.peccLinkStatus === 'none' && (
                          <Chip
                            label="No PECC linked"
                            size="small"
                            color="default"
                            variant="outlined"
                            sx={{ flexShrink: 0, height: 22 }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {hospital.peccLinkStatus === 'linked'
                            ? hospital.peccName
                            : hospital.peccName !== '—'
                              ? `${hospital.peccName} (contact)`
                              : '—'}
                        </Typography>
                        {hospital.peccEmail !== '—' && (
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: '0.8rem' }}>
                              {hospital.peccEmail}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        <Chip
                          size="small"
                          icon={<ActivityIcon sx={{ fontSize: 14 }} />}
                          label={`${hospital.activityCount} site activities`}
                          variant="outlined"
                          sx={{ height: 24 }}
                        />
                        <Chip
                          size="small"
                          icon={<HoursIcon sx={{ fontSize: 14 }} />}
                          label={`${hospital.totalHours.toFixed(1)} site h`}
                          variant="outlined"
                          sx={{ height: 24 }}
                        />
                        {hospital.mentorHours > 0 && (
                          <Chip
                            size="small"
                            label={`${hospital.mentorHours.toFixed(1)} your h`}
                            variant="outlined"
                            color="secondary"
                            sx={{ height: 24 }}
                          />
                        )}
                        {hospital.lastActivityAt && (
                          <Chip
                            size="small"
                            icon={<CalendarIcon sx={{ fontSize: 14 }} />}
                            label={`Last: ${format(new Date(hospital.lastActivityAt), 'MMM d, yyyy')}`}
                            variant="outlined"
                            sx={{ height: 24 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </AdminSection>

      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={hospitalDrawerOpen}
        onClose={() => setHospitalDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 420,
            maxHeight: isMobile ? '85%' : '100%',
            borderLeft: isMobile ? 0 : 1,
            borderColor: 'divider',
          },
        }}
      >
        {selectedHospital && (
          <>
            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: alpha(theme.palette.secondary.main, 0.04),
              }}
            >
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', lineHeight: 1.2 }}
                >
                  Hospital
                </Typography>
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
                  {normalizeHospitalOrOrgName(selectedHospital.name)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => setHospitalDrawerOpen(false)} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ overflow: 'auto', flex: 1, p: 2 }}>
              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.75 }}
              >
                Hospital details
              </Typography>
              <Box sx={{ mb: 3 }}>
                {(selectedHospital.city || selectedHospital.state) && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {[selectedHospital.city, selectedHospital.state].filter(Boolean).join(', ')}
                  </Typography>
                )}
                {selectedHospital.address && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {selectedHospital.address}
                  </Typography>
                )}
                {selectedHospital.phone && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {selectedHospital.phone}
                  </Typography>
                )}
                {selectedHospital.traumaLevel && (
                  <Chip label={selectedHospital.traumaLevel} size="small" sx={{ mt: 0.5 }} />
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.75 }}
              >
                PECC contact
              </Typography>
              <Box sx={{ mb: 2 }}>
                {selectedHospital.peccLinkStatus === 'contact_only' && (
                  <Alert severity="warning" sx={{ mb: 1.5 }} variant="outlined">
                    CRM contact on file, but no PECC app account is linked yet. Invite them or confirm hospital
                    assignment in the CRM.
                  </Alert>
                )}
                {selectedHospital.peccLinkStatus === 'none' && (
                  <Alert severity="info" sx={{ mb: 1.5 }} variant="outlined">
                    No PECC contact or account linked to this site yet.
                  </Alert>
                )}
                <Typography variant="body2">{selectedHospital.peccName}</Typography>
                {selectedHospital.peccEmail !== '—' && (
                  <Typography
                    variant="body2"
                    color="secondary.dark"
                    component="a"
                    href={`mailto:${selectedHospital.peccEmail}`}
                  >
                    {selectedHospital.peccEmail}
                  </Typography>
                )}
              </Box>

              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.75 }}
              >
                Your mentoring hours
              </Typography>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2">
                  {selectedHospital.mentorHours.toFixed(1)}h total
                  {selectedHospital.mentorHoursThisMonth > 0
                    ? ` · ${selectedHospital.mentorHoursThisMonth.toFixed(1)}h this month`
                    : ''}
                  {selectedHospital.mentorActivityCount > 0
                    ? ` · ${selectedHospital.mentorActivityCount} linked activit${selectedHospital.mentorActivityCount === 1 ? 'y' : 'ies'}`
                    : ''}
                </Typography>
                {selectedHospital.mentorHours === 0 && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Log an activity and assign this hospital to track your hours here.
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.75 }}
              >
                Site activities ({selectedHospital.activities.length})
              </Typography>
              {selectedHospital.activities.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No activities logged yet for this site.
                </Typography>
              ) : (
                <List disablePadding>
                  {selectedHospital.activities.map((activity) => (
                    <ListItem
                      key={activity.id}
                      disablePadding
                      sx={{ py: 1, flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="body2" fontWeight={500}>
                          {String(activity.activityName || activity.activity_type || 'Activity')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(activity.date), 'MMM d, yyyy')} · {(Number(activity.hours) || 0).toFixed(1)}h
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        <Chip
                          label={displayActivityCategories(activity)}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                      {String(
                        activity.enteredByName ||
                          activity.entered_by_name ||
                          activity.enteredBy ||
                          activity.userName ||
                          ''
                      ).trim() && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Logged by{' '}
                          {String(
                            activity.enteredByName ||
                              activity.entered_by_name ||
                              activity.enteredBy ||
                              activity.userName
                          ).trim()}
                        </Typography>
                      )}
                      {activity.description?.trim() && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {activity.description}
                        </Typography>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={() => {
                    setHospitalDrawerOpen(false);
                    navigate(`/mentor/milestones?hospital=${encodeURIComponent(selectedHospital.id)}`);
                  }}
                >
                  Site milestones
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setHospitalDrawerOpen(false);
                    navigate(`/mentor/hospitals?hospital=${encodeURIComponent(selectedHospital.id)}`);
                  }}
                >
                  Hospital & contacts
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setHospitalDrawerOpen(false);
                    navigate('/mentor/activities');
                  }}
                >
                  Log mentoring activity
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Drawer>

      {mentorHoursRollups.some((r) => r.totalHours > 0) && (
        <AdminSection
          overline="Your hours"
          title="Mentoring hours by hospital"
          description="Hours from your mentoring log linked to each hospital"
        >
          <MentorHoursByHospitalPanel rollups={mentorHoursRollups} unlinkedHours={unlinkedMentorHours} />
        </AdminSection>
      )}

      <DashboardResources key={effectiveUserId || currentUser?.uid || 'resources'} userId={effectiveUserId ?? currentUser?.uid} personalAccount />
    </AdminPageShell>
  );
};

export default MentorDashboardPage;
