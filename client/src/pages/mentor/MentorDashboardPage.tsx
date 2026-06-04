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
  TrendingUp as TrendingIcon,
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
import DashboardResources from '../../components/DashboardResources';

interface DashboardStats {
  totalHospitals: number;
  totalPeccs: number;
  activitiesThisMonth: number;
  hoursThisMonth: number;
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
  name: string;
  city?: string;
  state?: string;
  phone?: string;
  traumaLevel?: string;
  address?: string;
  notes?: string;
  peccName: string;
  peccEmail: string;
  activityCount: number;
  totalHours: number;
  lastActivityAt: string | null;
  activities: StoredActivity[];
}

const getActivityCategories = (activity: { categories?: unknown; category?: unknown }): string[] => {
  if (Array.isArray(activity.categories)) {
    const normalized = activity.categories
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  const fallback = String(activity.category || '').trim();
  return fallback ? [fallback] : [];
};

const hasActivityCategory = (activity: { categories?: unknown; category?: unknown }, category: string): boolean => {
  return getActivityCategories(activity).includes(category);
};

const displayActivityCategories = (activity: { categories?: unknown; category?: unknown }): string => {
  const normalized = getActivityCategories(activity);
  return normalized.length > 0 ? normalized.join(', ') : 'Uncategorized';
};

const MentorDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile, effectiveUserId } = useUserProfile();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [stats, setStats] = useState<DashboardStats>({
    totalHospitals: 0,
    totalPeccs: 0,
    activitiesThisMonth: 0,
    hoursThisMonth: 0,
    simulationsThisMonth: 0
  });
  const [hospitalSummaries, setHospitalSummaries] = useState<HospitalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<HospitalSummary | null>(null);
  const [hospitalDrawerOpen, setHospitalDrawerOpen] = useState(false);

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
      const ids = workingHospitals.map((h: StoredHospital) => h.id);
      const orParts = ids.flatMap((id: string) => [`id.eq.${id}`, `facility_id.eq.${id}`]);
      const { data: rows } = await supabase.from('hospitals').select('id, facility_id, name').or(orParts.join(','));
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

    const summaries: HospitalSummary[] = workingHospitals.map((h: StoredHospital) => {
      const hContacts = contacts.filter((c: StoredContact) => c.hospitalId === h.id);
      const primary = hContacts.find((c: StoredContact) => c.isPrimaryContact) || hContacts[0];
      const peccName = primary ? `${primary.firstName} ${primary.lastName}`.trim() || '—' : '—';
      const peccEmail = primary?.email?.trim() || '—';

      const canonicalHospitalId =
        hospitalRefToUuid.get(h.id) ||
        (h.facilityId ? hospitalRefToUuid.get(h.facilityId) : undefined) ||
        null;
      const hospitalActivities = (canonicalHospitalId ? hospitalActivitiesMap.get(canonicalHospitalId) : null) || [];
      const sortedByDate = [...hospitalActivities].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const lastActivityAt = sortedByDate[0]?.date || null;
      const totalHours = hospitalActivities.reduce((sum: number, a: StoredActivity) => sum + (Number(a.hours) || 0), 0);

      const displayName = nameByKey[h.id] ?? normalizeHospitalOrOrgName(h.name ?? 'Unknown');
      return {
        id: h.id,
        name: displayName,
        city: h.city,
        state: h.state,
        phone: h.phone,
        traumaLevel: h.traumaLevel,
        address: h.address,
        notes: h.notes,
        peccName,
        peccEmail,
        activityCount: hospitalActivities.length,
        totalHours,
        lastActivityAt,
        activities: sortedByDate
      };
    });

    const distinctPeccEmails = new Set(
      summaries.map(s => s.peccEmail).filter(e => e && e !== '—')
    );
    const allHospitalActivities = summaries.flatMap((s) => s.activities);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthActivities = allHospitalActivities.filter((a: StoredActivity) => new Date(a.date) >= startOfMonth);
    const simulationsThisMonth = thisMonthActivities.filter((a: StoredActivity) => hasActivityCategory(a, 'SC')).length;
    setStats({
      totalHospitals: workingHospitals.length,
      totalPeccs: distinctPeccEmails.size,
      activitiesThisMonth: thisMonthActivities.length,
      hoursThisMonth: thisMonthActivities.reduce((sum: number, a: StoredActivity) => sum + (Number(a.hours) || 0), 0),
      simulationsThisMonth
    });
    setHospitalSummaries(summaries);
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
      <Box sx={{ py: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3 }}>
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError} <Button size="small" onClick={() => loadDashboardData()}>Retry</Button>
        </Alert>
      )}
      <Typography variant="h4" gutterBottom>
        Welcome, {userProfile?.first_name || 'Mentor'}!
      </Typography>
      <Typography color="text.secondary" gutterBottom sx={{ mb: 2 }}>
        Here's an overview of your mentorship activities
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Support your assigned hospitals and PECCs. Click a hospital to see details and your activity history there.
      </Typography>

      {/* How This Tool Works - compact */}
      <Card elevation={0} sx={{ p: 2, mb: 4, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <CardContent sx={{ '&:last-child': { pb: 2 } }}>
          <Typography variant="h6" gutterBottom color="primary">
            How This Tool Works
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            Manage hospitals and contacts, log activities and simulations, track site milestones, and participate in programs and cohorts. Use the menu to navigate.
          </Typography>
        </CardContent>
      </Card>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <StatCard title="My Hospitals" value={stats.totalHospitals} icon={<HospitalIcon />} color="#1976d2" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title="Activities This Month" value={stats.activitiesThisMonth} icon={<ActivityIcon />} color="#f57c00" subtitle={`${stats.hoursThisMonth.toFixed(1)} hours`} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title="Simulations This Month" value={stats.simulationsThisMonth} icon={<TrendingIcon />} color="#7b1fa2" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title="PECC Contacts" value={stats.totalPeccs} icon={<PeopleIcon />} color="#388e3c" />
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
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'action.hover'
                  }
                }}
                onClick={() => handleHospitalClick(hospital)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
                      <HospitalIcon />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        {normalizeHospitalOrOrgName(hospital.name)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {hospital.peccName}
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
                        <Chip size="small" icon={<ActivityIcon sx={{ fontSize: 14 }} />} label={`${hospital.activityCount} activities`} variant="outlined" />
                        <Chip size="small" icon={<HoursIcon sx={{ fontSize: 14 }} />} label={`${hospital.totalHours.toFixed(1)} h`} variant="outlined" />
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
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2">{selectedHospital.peccName}</Typography>
                {selectedHospital.peccEmail !== '—' && (
                  <Typography variant="body2" color="primary" component="a" href={`mailto:${selectedHospital.peccEmail}`}>
                    {selectedHospital.peccEmail}
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
              <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => { setHospitalDrawerOpen(false); navigate('/mentor/activities'); }}>
                Log activity
              </Button>
            </Box>
          </>
        )}
      </Drawer>

      <DashboardResources userId={effectiveUserId ?? currentUser?.uid} />
    </Box>
  );
};

export default MentorDashboardPage;
