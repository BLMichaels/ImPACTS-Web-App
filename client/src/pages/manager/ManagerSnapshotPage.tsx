import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Container,
  Paper,
  Avatar,
  List,
  ListItem,
  Divider,
  IconButton,
  Collapse
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Timeline as TimelineIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Assignment as ActivityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';

interface AssignedHospital {
  id: string;
  name: string;
  peccCount: number;
}

interface MentorSnapshotRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedHospitals: AssignedHospital[];
  totalActivities: number;
  hoursThisMonth: number;
  hoursTotal: number;
  lastActivity: string | null;
  activitiesThisMonthCount?: number;
}

interface ManagerOwnMentoring {
  hasAssignments: boolean;
  hospitalNames: string[];
  activities: any[];
  totalActivities: number;
  hoursTotal: number;
  hoursThisMonth: number;
  lastMonthHours: number;
}

const ManagerSnapshotPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();

  const [mentors, setMentors] = useState<MentorSnapshotRow[]>([]);
  const [totalPeccs, setTotalPeccs] = useState(0);
  const [totalSites, setTotalSites] = useState(0);
  const [peccProgressSum, setPeccProgressSum] = useState(0);
  const [peccProgressCount, setPeccProgressCount] = useState(0);
  const [managerOwn, setManagerOwn] = useState<ManagerOwnMentoring>({
    hasAssignments: false,
    hospitalNames: [],
    activities: [],
    totalActivities: 0,
    hoursTotal: 0,
    hoursThisMonth: 0,
    lastMonthHours: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!userProfile?.id) return;

      try {
        if (!cancelled) {
          setIsLoading(true);
          setHasError(false);
        }

        // Load all mentors
        const { data: mentorUsers, error: mentorError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .eq('role', 'mentor')
          .eq('manager_id', userProfile.id);

        if (mentorError) throw mentorError;
        if (!mentorUsers || mentorUsers.length === 0) {
          if (!cancelled) {
            setMentors([]);
            setTotalPeccs(0);
            setTotalSites(0);
            setPeccProgressSum(0);
            setPeccProgressCount(0);
          }
          return;
        }

        const mentorIds = (mentorUsers || []).map(m => m.id);

        // Load mentor hospital assignments
        const { data: assignments, error: assignmentError } = await supabase
          .from('mentor_hospital_assignments')
          .select('mentor_id, hospital:hospital_id(id, name)')
          .in('mentor_id', mentorIds)
          .eq('is_active', true);

        if (assignmentError) throw assignmentError;

        const hospitalIds = (assignments || [])
          .map((a: any) => (Array.isArray(a.hospital) ? a.hospital[0]?.id : a.hospital?.id))
          .filter(Boolean);
        const uniqueHospitalIds = Array.from(new Set(hospitalIds));

        // Load PECCs for these hospitals
        const { data: peccs, error: peccsError } = uniqueHospitalIds.length > 0
          ? await supabase
            .from('users')
            .select('id, hospital_facility_id')
            .eq('role', 'pecc')
            .in('hospital_facility_id', uniqueHospitalIds)
          : { data: [], error: null };

        if (peccsError) throw peccsError;
        const peccCountByHospital = new Map<string, number>();
        (peccs || []).forEach((p: { hospital_facility_id: string }) => {
          const hid = p.hospital_facility_id;
          peccCountByHospital.set(hid, (peccCountByHospital.get(hid) || 0) + 1);
        });

        if (cancelled) return;
        setTotalPeccs((peccs || []).length);
        setTotalSites(new Set(hospitalIds).size);

        // Load hospitals for names
        const { data: hospitals } = uniqueHospitalIds.length > 0
          ? await supabase
            .from('hospitals')
            .select('id, name')
            .in('id', uniqueHospitalIds)
          : { data: [] };

        const hospitalMap = new Map<string, string>();
        (hospitals || []).forEach((h: any) => hospitalMap.set(h.id, h.name || 'Unknown'));

        // Checklist progress by hospital (avoid per-PECC N+1).
        const { data: checklistRows, error: checklistError } = uniqueHospitalIds.length > 0
          ? await supabase
            .from('site_checklist_progress')
            .select('hospital_id, completed')
            .in('hospital_id', uniqueHospitalIds)
          : { data: [], error: null };
        if (checklistError) throw checklistError;
        const checklistStatsByHospital = new Map<string, { total: number; completed: number }>();
        (checklistRows || []).forEach((row: { hospital_id: string; completed: boolean }) => {
          const prev = checklistStatsByHospital.get(row.hospital_id) || { total: 0, completed: 0 };
          prev.total += 1;
          if (row.completed) prev.completed += 1;
          checklistStatsByHospital.set(row.hospital_id, prev);
        });

        const checklistPctByHospital = new Map<string, number>();
        checklistStatsByHospital.forEach((stats, hid) => {
          checklistPctByHospital.set(hid, stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0);
        });

        // Checklist progress for PECCs (for average)
        let progressSum = 0;
        let progressCount = 0;
        for (const pecc of peccs || []) {
          const pct = checklistPctByHospital.get(pecc.hospital_facility_id) || 0;
          progressSum += pct;
          progressCount += 1;
        }
        if (cancelled) return;
        setPeccProgressSum(progressSum);
        setPeccProgressCount(progressCount);

        // Build mentor snapshot rows (load activities from Supabase per mentor)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const mentorRows: MentorSnapshotRow[] = await Promise.all(
          (mentorUsers || []).map(async (mentor: any) => {
            const mentorAssignments = (assignments || []).filter((a: any) => a.mentor_id === mentor.id);
            const assignedHospitals: AssignedHospital[] = mentorAssignments.map((a: any) => {
              const h = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
              const hid = h?.id;
              const peccCount = hid ? (peccCountByHospital.get(hid) || 0) : 0;
              return {
                id: hid || '',
                name: hospitalMap.get(hid) || h?.name || 'Unknown',
                peccCount
              };
            }).filter((h: AssignedHospital) => h.id);

            const activities = await getMentorActivitiesForUser(mentor.id);
            const totalActivities = activities.length;
            const hoursTotal = activities.reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
            const hoursThisMonth = activities
              .filter((a: any) => new Date(a.date) >= monthStart)
              .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
            const activitiesThisMonthCount = activities.filter((a: any) => new Date(a.date) >= monthStart).length;
            const lastActivity =
              activities.length > 0
                ? activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
                : null;

            return {
              id: mentor.id,
              firstName: mentor.first_name,
              lastName: mentor.last_name,
              email: mentor.email,
              assignedHospitals,
              totalActivities,
              hoursThisMonth,
              hoursTotal,
              lastActivity,
              activitiesThisMonthCount
            };
          })
        );

        if (cancelled) return;
        setMentors(mentorRows);

        // Check if manager also has hospital assignments (acting as mentor)
        const { data: managerAssignments } = await supabase
          .from('mentor_hospital_assignments')
          .select('hospital:hospital_id(id, name)')
          .eq('mentor_id', userProfile.id)
          .eq('is_active', true);

        const managerHasAssignments = (managerAssignments || []).length > 0;
        const managerHospitalNames = (managerAssignments || []).map((a: any) => {
          const h = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
          return h?.name || 'Unknown';
        });

        const ownActivities = await getMentorActivitiesForUser(userProfile.id);
        const ownMonthStart = startOfMonth(now);
        const ownMonthEnd = endOfMonth(now);
        const ownHoursThisMonth = ownActivities
          .filter((a: any) => {
            const d = new Date(a.date);
            return d >= ownMonthStart && d <= ownMonthEnd;
          })
          .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
        const lastMonth = subMonths(now, 1);
        const ownLastMonthHours = ownActivities
          .filter((a: any) => {
            const d = new Date(a.date);
            return d >= startOfMonth(lastMonth) && d <= endOfMonth(lastMonth);
          })
          .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);

        if (cancelled) return;
        setManagerOwn({
          hasAssignments: managerHasAssignments,
          hospitalNames: managerHospitalNames,
          activities: ownActivities,
          totalActivities: ownActivities.length,
          hoursTotal: ownActivities.reduce((s: number, a: any) => s + (a.hours || 0), 0),
          hoursThisMonth: ownHoursThisMonth,
          lastMonthHours: ownLastMonthHours
        });
      } catch (err) {
        console.error('Error loading manager snapshot:', err);
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [userProfile?.id, retryCount]);

  const teamHoursThisMonth = useMemo(
    () => mentors.reduce((sum, m) => sum + m.hoursThisMonth, 0),
    [mentors]
  );
  const teamActivitiesThisMonth = useMemo(
    () => mentors.reduce((sum, m) => sum + (m.activitiesThisMonthCount ?? 0), 0),
    [mentors]
  );
  const teamTotalHours = useMemo(() => mentors.reduce((sum, m) => sum + m.hoursTotal, 0), [mentors]);
  const avgPeccProgress = useMemo(
    () => (peccProgressCount > 0 ? Math.round(peccProgressSum / peccProgressCount) : 0),
    [peccProgressSum, peccProgressCount]
  );

  const exportToPDF = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Loading Snapshot...
        </Typography>
        <LinearProgress sx={{ width: '50%', mx: 'auto', mt: 2 }} />
      </Box>
    );
  }

  if (hasError) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom color="error">
          Error Loading Snapshot
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          There was an error loading snapshot data. Please try again.
        </Typography>
        <Button variant="contained" onClick={() => setRetryCount(c => c + 1)} sx={{ mr: 1 }}>
          Retry
        </Button>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h3" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
              Manager Snapshot
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Team-wide metrics and your mentoring at a glance
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track your team’s mentors, sites, PECCs, and hours. If you also mentor, your own activity is included below.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<PictureAsPdfIcon />}
            onClick={exportToPDF}
            sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
          >
            Export PDF
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                {mentors.length} Mentors • {totalSites} Sites • {totalPeccs} PECCs
              </Typography>
              <Typography variant="body2">
                Average PECC progress: {avgPeccProgress}% • Team hours this month: {teamHoursThisMonth.toFixed(1)}h
              </Typography>
            </Box>
            <Chip
              label={`${teamActivitiesThisMonth} activities this month`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        </Alert>
      </Box>

      {/* Team KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'primary.light', mb: 2 }}>
                <PeopleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {mentors.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Total Mentors
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Under your management
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'success.light', mb: 2 }}>
                <HospitalIcon sx={{ fontSize: 32, color: 'success.main' }} />
              </Box>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {totalSites}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Sites
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Hospitals being supported
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'info.light', mb: 2 }}>
                <GroupIcon sx={{ fontSize: 32, color: 'info.main' }} />
              </Box>
              <Typography variant="h3" color="info.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {totalPeccs}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                PECCs
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Avg progress {avgPeccProgress}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: 'warning.light', mb: 2 }}>
                <WorkIcon sx={{ fontSize: 32, color: 'warning.main' }} />
              </Box>
              <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {teamHoursThisMonth.toFixed(1)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Team Hours (Month)
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {teamActivitiesThisMonth} activities • {teamTotalHours.toFixed(1)}h total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Your Mentors and Their Sites (combined Snapshot + Overview) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Your Mentors and Their Sites
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click a mentor to expand their assigned sites and PECCs. Use &quot;View in CRM&quot; for hospital details and contacts.
              </Typography>
              {mentors.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No mentors found. Assign mentors to hospitals in the CRM.
                  </Typography>
                  <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/manager/crm')}>
                    Go to CRM
                  </Button>
                </Box>
              ) : (
                <List>
                  {mentors.map((mentor, index) => (
                    <React.Fragment key={mentor.id}>
                      {index > 0 && <Divider />}
                      <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
                          onClick={() => setExpandedMentor(expandedMentor === mentor.id ? null : mentor.id)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {mentor.firstName.charAt(0)}{mentor.lastName.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {mentor.firstName} {mentor.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {mentor.email}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip size="small" label={`${mentor.assignedHospitals.length} sites`} color="primary" variant="outlined" />
                            <Chip size="small" label={`${mentor.assignedHospitals.reduce((s, h) => s + h.peccCount, 0)} PECCs`} color="secondary" variant="outlined" />
                            <Chip size="small" label={`${mentor.hoursThisMonth.toFixed(1)}h this month`} color="success" variant="outlined" />
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMentor(expandedMentor === mentor.id ? null : mentor.id);
                              }}
                              aria-label={expandedMentor === mentor.id ? 'Collapse mentor details' : 'Expand mentor details'}
                              aria-expanded={expandedMentor === mentor.id}
                            >
                              {expandedMentor === mentor.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Box>
                        </Box>
                        <Collapse in={expandedMentor === mentor.id} timeout="auto" unmountOnExit>
                          <Box sx={{ mt: 2, ml: 7 }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                              Assigned Sites:
                            </Typography>
                            {mentor.assignedHospitals.length === 0 ? (
                              <Typography variant="body2" color="text.secondary">
                                No sites assigned yet
                              </Typography>
                            ) : (
                              <Grid container spacing={2} sx={{ mt: 1 }}>
                                {mentor.assignedHospitals.map((hospital) => (
                                  <Grid item xs={12} md={6} key={hospital.id}>
                                    <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.50' }}>
                                      <Box>
                                        <Typography variant="body1" fontWeight={600}>
                                          {hospital.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {hospital.peccCount} PECC{hospital.peccCount !== 1 ? 's' : ''}
                                        </Typography>
                                      </Box>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<ViewIcon />}
                                        onClick={(e) => { e.stopPropagation(); navigate(`/manager/crm?hospital=${hospital.id}`); }}
                                      >
                                        View in CRM
                                      </Button>
                                    </Paper>
                                  </Grid>
                                ))}
                              </Grid>
                            )}
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                              <Typography variant="body2" color="white">
                                <strong>Total Activities:</strong> {mentor.totalActivities} •{' '}
                                <strong>Hours this month:</strong> {mentor.hoursThisMonth.toFixed(1)} •{' '}
                                <strong>Last activity:</strong> {mentor.lastActivity ? format(new Date(mentor.lastActivity), 'MMM d, yyyy') : 'None'}
                              </Typography>
                            </Box>
                          </Box>
                        </Collapse>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* My mentoring (when manager also does mentor work) */}
      {managerOwn.hasAssignments && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card sx={{ borderLeft: 4, borderColor: 'secondary.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      My Mentoring
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Your own mentor-style activities when working directly with PECCs. Log and view details under My Activities.
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                      <Chip size="small" icon={<WorkIcon />} label={`${managerOwn.totalActivities} activities`} />
                      <Chip size="small" icon={<TimelineIcon />} label={`${managerOwn.hoursTotal.toFixed(1)}h total`} />
                      <Chip size="small" label={`${managerOwn.hoursThisMonth.toFixed(1)}h this month`} color="primary" variant="outlined" />
                      <Chip size="small" label={`${managerOwn.lastMonthHours.toFixed(1)}h last month`} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Sites: {managerOwn.hospitalNames.join(', ') || 'None'}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<ActivityIcon />}
                    onClick={() => navigate('/manager/activities')}
                  >
                    Log &amp; view my activities
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default ManagerSnapshotPage;
