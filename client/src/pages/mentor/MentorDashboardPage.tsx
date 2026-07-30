import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  List,
  ListItem,
  Avatar,
  Chip,
  LinearProgress,
  Drawer,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  People as PeopleIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  CalendarToday as CalendarIcon,
  AccessTime as HoursIcon
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

  const StatCard = ({
    title,
    value,
    icon,
    color,
    subtitle
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }) => (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{icon}</Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ py: 3 }} role="status" aria-live="polite">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Loading your dashboard…
        </Typography>
        <LinearProgress aria-label="Loading dashboard" />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3 }}>
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError} <Button size="small" onClick={() => { setLoading(true); loadDashboardData(); }}>Retry</Button>
        </Alert>
      )}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom component="h1">
          Welcome, {userProfile?.first_name || 'Mentor'}!
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 640 }}>
          Your home base for assigned hospitals, linked PECCs, site activity, and your mentoring hours. Open a hospital card for site details and activity history.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
          <Button size="small" variant="outlined" onClick={() => navigate('/mentor/snapshot')}>
            Snapshot
          </Button>
          <Button size="small" variant="outlined" onClick={() => navigate('/mentor/activities')}>
            Log activity
          </Button>
          <Button size="small" variant="outlined" onClick={() => navigate('/mentor/milestones')}>
            Site milestones
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Assigned Hospitals"
            value={stats.totalHospitals}
            icon={<HospitalIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Your Hours (Month)"
            value={stats.mentorHoursThisMonth.toFixed(1)}
            icon={<HoursIcon />}
            color="#1565c0"
            subtitle="Mentoring log"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Site Activity (Month)"
            value={stats.siteActivitiesThisMonth}
            icon={<ActivityIcon />}
            color="#f57c00"
            subtitle={`${stats.siteHoursThisMonth.toFixed(1)} site hours`}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            title="Linked PECCs"
            value={stats.totalPeccs}
            icon={<PeopleIcon />}
            color="#388e3c"
            subtitle={
              stats.simulationsThisMonth > 0
                ? `${stats.simulationsThisMonth} simulation${stats.simulationsThisMonth === 1 ? '' : 's'} this month`
                : 'Accounts matched to sites'
            }
          />
        </Grid>
      </Grid>

      {/* My Hospitals - clean cards */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          My Hospitals
        </Typography>
        <Button size="small" variant="outlined" onClick={() => navigate('/mentor/hospitals')}>
          Manage hospitals
        </Button>
      </Box>

      {hospitalSummaries.length === 0 ? (
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No hospitals assigned yet. Add hospitals from the Hospitals page.</Typography>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/mentor/hospitals')}>
            Go to Hospitals
          </Button>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {hospitalSummaries.map((hospital) => (
            <Grid item xs={12} md={6} key={hospital.id}>
              <Card
                elevation={0}
                role="button"
                tabIndex={0}
                aria-label={`Open ${normalizeHospitalOrOrgName(hospital.name)} details`}
                onClick={() => handleHospitalClick(hospital)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHospitalClick(hospital);
                  }
                }}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background-color 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
                      <HospitalIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {normalizeHospitalOrOrgName(hospital.name)}
                        </Typography>
                        {hospital.peccLinkStatus === 'contact_only' && (
                          <Chip
                            label="Awaiting PECC account"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ flexShrink: 0, maxWidth: '55%' }}
                          />
                        )}
                        {hospital.peccLinkStatus === 'none' && (
                          <Chip
                            label="No PECC linked"
                            size="small"
                            color="default"
                            variant="outlined"
                            sx={{ flexShrink: 0 }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {hospital.peccLinkStatus === 'linked' ? hospital.peccName : hospital.peccName !== '—' ? `${hospital.peccName} (contact)` : '—'}
                        </Typography>
                        {hospital.peccEmail !== '—' && (
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {hospital.peccEmail}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
                        <Chip size="small" icon={<ActivityIcon sx={{ fontSize: 14 }} />} label={`${hospital.activityCount} site activities`} variant="outlined" />
                        <Chip size="small" icon={<HoursIcon sx={{ fontSize: 14 }} />} label={`${hospital.totalHours.toFixed(1)} site h`} variant="outlined" />
                        {hospital.mentorHours > 0 && (
                          <Chip
                            size="small"
                            label={`${hospital.mentorHours.toFixed(1)} your h`}
                            variant="outlined"
                            color="primary"
                          />
                        )}
                        {hospital.lastActivityAt && (
                          <Chip size="small" icon={<CalendarIcon sx={{ fontSize: 14 }} />} label={`Last: ${format(new Date(hospital.lastActivityAt), 'MMM d, yyyy')}`} variant="outlined" />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Hospital detail drawer */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={hospitalDrawerOpen}
        onClose={() => setHospitalDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : 420,
            maxHeight: isMobile ? '85%' : '100%',
            borderLeft: isMobile ? 0 : 1,
            borderColor: 'divider'
          }
        }}
      >
        {selectedHospital && (
          <>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={600}>
                {normalizeHospitalOrOrgName(selectedHospital.name)}
              </Typography>
              <IconButton size="small" onClick={() => setHospitalDrawerOpen(false)} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Box>
            <Box sx={{ overflow: 'auto', flex: 1, p: 2 }}>
              {/* Hospital info */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
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

              {/* PECC contact */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                PECC contact
              </Typography>
              <Box sx={{ mb: 2 }}>
                {selectedHospital.peccLinkStatus === 'contact_only' && (
                  <Alert severity="warning" sx={{ mb: 1.5 }} variant="outlined">
                    CRM contact on file, but no PECC app account is linked yet. Invite them or confirm hospital assignment in the CRM.
                  </Alert>
                )}
                {selectedHospital.peccLinkStatus === 'none' && (
                  <Alert severity="info" sx={{ mb: 1.5 }} variant="outlined">
                    No PECC contact or account linked to this site yet.
                  </Alert>
                )}
                <Typography variant="body2">{selectedHospital.peccName}</Typography>
                {selectedHospital.peccEmail !== '—' && (
                  <Typography variant="body2" color="primary" component="a" href={`mailto:${selectedHospital.peccEmail}`}>
                    {selectedHospital.peccEmail}
                  </Typography>
                )}
              </Box>

              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Your mentoring hours at this site
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

              {/* Activities at this hospital */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Activities logged for this site ({selectedHospital.activities.length})
              </Typography>
              {selectedHospital.activities.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No activities logged yet for this site.
                </Typography>
              ) : (
                <List disablePadding>
                  {selectedHospital.activities.map((activity) => (
                    <ListItem key={activity.id} disablePadding sx={{ py: 1, flexDirection: 'column', alignItems: 'stretch' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {String(activity.activityName || activity.activity_type || 'Activity')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(activity.date), 'MMM d, yyyy')} · {(Number(activity.hours) || 0).toFixed(1)}h
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                        <Chip label={displayActivityCategories(activity)} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      </Box>
                      {String(activity.enteredByName || activity.entered_by_name || activity.enteredBy || activity.userName || '').trim() && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Logged by {String(activity.enteredByName || activity.entered_by_name || activity.enteredBy || activity.userName).trim()}
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
        <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, mt: 4 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Your mentoring hours by hospital
            </Typography>
            <MentorHoursByHospitalPanel rollups={mentorHoursRollups} unlinkedHours={unlinkedMentorHours} />
          </CardContent>
        </Card>
      )}

      <DashboardResources userId={effectiveUserId ?? currentUser?.uid} />
    </Box>
  );
};

export default MentorDashboardPage;
