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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Work as WorkIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Group as GroupIcon,
  LocalHospital as HospitalIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';
import { getUserData } from '../../utils/userData';
interface MentorActivity {
  id: string;
  date: string;
  category: string;
  hours: number;
  notes: string;
  hospital?: string;
  simulation?: string;
}

interface PECCData {
  id: string;
  name: string;
  email: string;
  hospital: string;
  hospitalId: string;
  checklistProgress: number;
  activityCount: number;
  lastActivity: string | null;
  gapPlanCount: number;
  readinessScores: Array<{ id: string; score: number; date: string }>;
}

interface HospitalMetrics {
  hospitalId: string;
  hospitalName: string;
  mentorActivities: number;
  mentorHours: number;
  simulations: number;
  peccCount: number;
}

interface MentorStoredHospital {
  id: string;
  name?: string;
  city?: string;
  state?: string;
}

const MentorSnapshotPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  
  const [activities, setActivities] = useState<MentorActivity[]>([]);
  const [peccData, setPeccData] = useState<PECCData[]>([]);
  const [assignedHospitals, setAssignedHospitals] = useState<any[]>([]);
  const [hospitalMetrics, setHospitalMetrics] = useState<HospitalMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedHospitals, setSelectedHospitals] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  // Load all data for mentor snapshot
  useEffect(() => {
    const loadData = async () => {
      if (!userProfile?.id) return;
      
      try {
        setIsLoading(true);
        setHasError(false);

        // Load mentor's own activities from Supabase (user_data)
        const parsedMentorActivities = await getMentorActivitiesForUser(userProfile.id);
        setActivities(parsedMentorActivities);

        // Load hospitals from both assignment rows and the mentor Hospitals page source of truth.
        const [assignmentRes, storedMentorHospitals] = await Promise.all([
          supabase
            .from('mentor_hospital_assignments')
            .select(`
              *,
              hospital:hospital_id(id, name, facility_id)
            `)
            .eq('mentor_id', userProfile.id)
            .eq('is_active', true),
          getUserData<MentorStoredHospital[]>(userProfile.id, 'mentorHospitals')
        ]);

        if (assignmentRes.error) throw assignmentRes.error;

        const normalizedHospitals = (assignmentRes.data || []).map(row => ({
          ...row,
          hospital: Array.isArray(row.hospital) ? row.hospital[0] : row.hospital
        }));

        const mergedHospitals = [...normalizedHospitals];
        const seenHospitalIds = new Set(
          normalizedHospitals
            .map((h) => String(h.hospital?.id || '').trim())
            .filter(Boolean)
        );

        (Array.isArray(storedMentorHospitals) ? storedMentorHospitals : []).forEach((h) => {
          const hid = String(h?.id || '').trim();
          if (!hid || seenHospitalIds.has(hid)) return;
          seenHospitalIds.add(hid);
          mergedHospitals.push({
            id: `stored-${hid}`,
            hospital_id: hid,
            mentor_id: userProfile.id,
            is_active: true,
            hospital: {
              id: hid,
              facility_id: hid,
              name: h?.name || 'Assigned Hospital',
            },
            storedHospital: {
              city: h?.city || '',
              state: h?.state || '',
            },
          });
        });
        
        setAssignedHospitals(mergedHospitals);

        if (mergedHospitals.length > 0) {
          const hospitalIds = mergedHospitals
            .map(h => h.hospital?.id)
            .filter(Boolean);

          // Load PECCs assigned to these hospitals
          const { data: peccs, error: peccsError } = await supabase
            .from('users')
            .select('id, first_name, last_name, email, hospital_facility_id')
            .eq('role', 'pecc')
            .in('hospital_facility_id', hospitalIds);

          if (peccsError) throw peccsError;

          // Load checklist progress for each PECC
          const peccDataPromises = (peccs || []).map(async (pecc) => {
            const peccHospitalId = pecc.hospital_facility_id;
            const hospital = mergedHospitals.find(h => h.hospital?.id === peccHospitalId);

            // Get checklist progress from site_checklist_progress
            const { data: checklistData } = await supabase
              .from('site_checklist_progress')
              .select('completed')
              .eq('hospital_id', peccHospitalId);

            const totalTasks = 100; // Approximate total from DEFAULT_STAGES
            const completedTasks = (checklistData || []).filter(t => t.completed).length;
            const checklistProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            // Get PECC data from Supabase (user_data)
            const [peccActivitiesVal, peccGapPlansVal, prsScoresVal, readinessVal] = await Promise.all([
              getUserData<any[]>(pecc.id, 'activities'),
              getUserData<any[]>(pecc.id, 'gapPlans'),
              getUserData<any[]>(pecc.id, 'prsReadinessScores'),
              getUserData<any[]>(pecc.id, 'readinessScores')
            ]);
            const activities = Array.isArray(peccActivitiesVal) ? peccActivitiesVal : [];
            const activityCount = activities.length;
            const lastActivity = activities.length > 0
              ? activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
              : null;
            const gapPlanCount = Array.isArray(peccGapPlansVal) ? peccGapPlansVal.length : 0;
            let readinessScores: Array<{ id: string; score: number; date: string }> = [];
            const scoresRaw = Array.isArray(prsScoresVal) ? prsScoresVal : (Array.isArray(readinessVal) ? readinessVal : []);
            if (scoresRaw.length > 0) readinessScores = scoresRaw as Array<{ id: string; score: number; date: string }>;

            return {
              id: pecc.id,
              name: `${pecc.first_name} ${pecc.last_name}`,
              email: pecc.email,
              hospital: hospital?.hospital?.name || 'Unknown Hospital',
              hospitalId: peccHospitalId,
              checklistProgress,
              activityCount,
              lastActivity,
              gapPlanCount,
              readinessScores
            };
          });

          const resolvedPeccData = await Promise.all(peccDataPromises);
          setPeccData(resolvedPeccData);
          
          // Calculate per-hospital metrics
          const metrics: HospitalMetrics[] = mergedHospitals.map(h => {
            const hospitalId = h.hospital?.id;
            const hospitalName = h.hospital?.name || 'Unknown Hospital';
            
            // Count mentor activities and hours for this hospital (support hospital or hospitalIds)
            const hospitalActivities = parsedMentorActivities.filter((a: any) =>
              a.hospital === hospitalId || (Array.isArray(a.hospitalIds) && a.hospitalIds.includes(hospitalId))
            );
            const mentorHours = hospitalActivities.reduce((sum: number, a: any) => sum + (a.hours || 0), 0);
            
            // Count simulations
            const simulations = hospitalActivities.filter((a: any) => a.category === 'SC' || a.category === 'Simulation Case Facilitation').length;
            
            // Count PECCs at this hospital
            const peccCount = resolvedPeccData.filter(p => p.hospitalId === hospitalId).length;
            
            return {
              hospitalId,
              hospitalName,
              mentorActivities: hospitalActivities.length,
              mentorHours,
              simulations,
              peccCount
            };
          });
          
          setHospitalMetrics(metrics);
          
          // Initialize selected hospitals to all hospitals
          setSelectedHospitals(metrics.map(m => m.hospitalId));
        }
        
      } catch (err) {
        console.error('Error loading mentor snapshot data:', err);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser?.uid, userProfile?.id, retryCount]);

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
      if (!breakdown[a.category]) {
        breakdown[a.category] = { count: 0, hours: 0 };
      }
      breakdown[a.category].count += 1;
      breakdown[a.category].hours += a.hours || 0;
    });
    return breakdown;
  }, [activities]);

  // Calculate simulation breakdown across all activities
  const simulationBreakdown = useMemo(() => {
    const simActivities = activities.filter(a => a.category === 'SC' || a.category === 'Simulation Case Facilitation' || a.simulation);
    const breakdown: Record<string, number> = {};
    simActivities.forEach(a => {
      const simType = a.simulation || 'Other';
      breakdown[simType] = (breakdown[simType] || 0) + 1;
    });
    return breakdown;
  }, [activities]);

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

  // Prepare PRS chart data
  const prsChartData = useMemo(() => {
    const selectedPeccs = peccData.filter(p => selectedHospitals.includes(p.hospitalId));
    return selectedPeccs.map(pecc => ({
      peccName: pecc.name,
      hospitalName: pecc.hospital,
      scores: pecc.readinessScores.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }));
  }, [peccData, selectedHospitals]);

  // Determine chart x-axis mode
  const useDateAxis = prsChartData.length === 1;
  const maxAssessments = Math.max(...prsChartData.map(p => p.scores.length), 0);

  // Generate colors for each PECC/hospital in the chart
  const chartColors = ['#2196f3', '#f50057', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#ff5722', '#795548'];

  const exportToPDF = () => {
    window.print();
  };

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Loading Overview...
        </Typography>
        <LinearProgress sx={{ width: '50%', mx: 'auto', mt: 2 }} />
      </Box>
    );
  }

  // Error state
  if (hasError) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom color="error">
          Error Loading Overview
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          There was an error loading your snapshot data. Please try again.
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

  // No hospitals: overview explains how to assign sites
  if (assignedHospitals.length === 0) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
            Overview
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            Mentoring metrics (advanced data reports are in Admin → Reports)
          </Typography>
        </Box>
        <Box sx={{ py: 4, textAlign: 'center', maxWidth: 'md', mx: 'auto' }}>
          <Typography variant="h5" gutterBottom>No assigned hospitals</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Your overview shows data for hospitals assigned to you. Add or link hospitals from the <strong>Hospitals</strong> page, or ask your manager to assign you in the CRM.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/mentor/hospitals')}>
            Go to Hospitals
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h3" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
              Overview
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Mentoring metrics (advanced data reports are in Admin → Reports)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Track your activities, monitor PECC progress, and measure engagement across all assigned hospitals
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
      </Box>

        <Box sx={{ mb: 4 }}>
          <Alert
            severity="info"
            sx={{
              mb: 3,
              '& .MuiAlert-message': { width: '100%' }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  {peccData.length} PECCs • {assignedHospitals.length} Hospitals
                </Typography>
                <Typography variant="body2">
                  Average PECC progress: {avgPECCProgress}% • {activePECCs} active this month
                </Typography>
                {hospitalsAwaitingPeccSetup.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {hospitalsAwaitingPeccSetup.length} assigned hospital{hospitalsAwaitingPeccSetup.length === 1 ? '' : 's'} awaiting PECC setup or account creation
                  </Typography>
                )}
              </Box>
              <Chip
                label={`${thisMonthHours.toFixed(1)} hours this month`}
                color="primary"
                variant="outlined"
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          </Alert>
        </Box>

      {/* Key Performance Indicators */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                p: 1.5, 
                borderRadius: '50%', 
                bgcolor: 'primary.light', 
                mb: 2 
              }}>
                <WorkIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              </Box>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {activities.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Total Activities
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {totalHours.toFixed(1)} hours logged
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                p: 1.5, 
                borderRadius: '50%', 
                bgcolor: 'success.light', 
                mb: 2 
              }}>
                <GroupIcon sx={{ fontSize: 32, color: 'success.main' }} />
              </Box>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {peccData.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Assigned PECCs
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {activePECCs} active in last 30 days
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                p: 1.5, 
                borderRadius: '50%', 
                bgcolor: 'info.light', 
                mb: 2 
              }}>
                <CheckCircleIcon sx={{ fontSize: 32, color: 'info.main' }} />
              </Box>
              <Typography variant="h3" color="info.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {avgPECCProgress}%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Avg PECC Progress
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Across all assigned PECCs
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ 
                display: 'inline-flex', 
                p: 1.5, 
                borderRadius: '50%', 
                bgcolor: 'warning.light', 
                mb: 2 
              }}>
                <HospitalIcon sx={{ fontSize: 32, color: 'warning.main' }} />
              </Box>
              <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {assignedHospitals.length}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Assigned Hospitals
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Active mentoring sites
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Mentor Activity Insights */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mentor Activity Breakdown
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Hours logged by activity category from mentor_activities table
              </Typography>
              <Box sx={{ mt: 2 }}>
                {Object.keys(categoryBreakdown).length > 0 ? (
                  <>
                    {Object.entries(categoryBreakdown)
                      .sort(([, a], [, b]) => b.hours - a.hours)
                      .map(([category, data]) => {
                        const percentage = totalHours > 0 ? (data.hours / totalHours) * 100 : 0;
                        return (
                          <Box key={category} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">
                                {category}
                              </Typography>
                              <Typography variant="body2">
                                {data.hours.toFixed(1)}h ({Math.round(percentage)}%)
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={percentage}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        );
                      })}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No activity data available. Start logging your mentoring activities!
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Mentoring Hours Overview
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Time investment in PECC mentoring and support activities
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                      <Typography variant="h4" color="white">
                        {thisMonthHours.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" color="white">
                        This Month
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'secondary.light', borderRadius: 1 }}>
                      <Typography variant="h4" color="white">
                        {lastMonthHours.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" color="white">
                        Last Month
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                      <Typography variant="h4" color="white">
                        {totalHours.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" color="white">
                        Total Hours
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                      <Typography variant="h4" color="white">
                        {activities.length > 0 ? (totalHours / activities.length).toFixed(1) : '0.0'}
                      </Typography>
                      <Typography variant="body2" color="white">
                        Avg per Activity
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* PECC Development & Engagement */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                PECC Development Progress
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                Checklist completion rates for assigned PECCs, plus assigned hospitals that are still waiting for kickoff or account creation
              </Typography>
              <Box sx={{ mt: 2 }}>
                {peccData.length > 0 ? (
                  <Grid container spacing={2}>
                    {peccData.map((pecc) => (
                      <Grid item xs={12} md={6} key={pecc.id}>
                        <Paper sx={{ p: 2, borderLeft: 4, borderColor: pecc.checklistProgress >= 75 ? 'success.main' : pecc.checklistProgress >= 50 ? 'warning.main' : 'error.main' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {pecc.name.charAt(0)}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {pecc.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {pecc.hospital}
                              </Typography>
                            </Box>
                            <Chip 
                              label={`${pecc.checklistProgress}%`}
                              size="small"
                              color={pecc.checklistProgress >= 75 ? 'success' : pecc.checklistProgress >= 50 ? 'warning' : 'error'}
                            />
                          </Box>
                          <LinearProgress 
                            variant="determinate" 
                            value={pecc.checklistProgress}
                            sx={{ height: 6, borderRadius: 3, mb: 1 }}
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              {pecc.activityCount} activities
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {pecc.gapPlanCount} gap plans
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {pecc.lastActivity ? `Active ${format(new Date(pecc.lastActivity), 'MMM d')}` : 'No recent activity'}
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : hospitalMetrics.length > 0 ? (
                  <Grid container spacing={2}>
                    {hospitalMetrics.map((metric) => (
                      <Grid item xs={12} md={6} key={metric.hospitalId}>
                        <Paper sx={{ p: 2, borderLeft: 4, borderColor: 'info.main' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Avatar sx={{ bgcolor: 'info.main' }}>
                              <HospitalIcon />
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {metric.hospitalName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Assigned hospital
                              </Typography>
                            </Box>
                            <Chip label="Awaiting PECC setup" size="small" color="info" variant="outlined" />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={0}
                            sx={{ height: 6, borderRadius: 3, mb: 1 }}
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">
                              0 PECC accounts
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              0 gap plans
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Ready to begin once site work starts
                            </Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No PECCs assigned yet
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* PECC Engagement Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                PECC Activity Engagement
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Total activities logged by PECCs across all sites
              </Typography>
              <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'primary.light', borderRadius: 2, mt: 2 }}>
                <Typography variant="h2" color="white" sx={{ fontWeight: 'bold' }}>
                  {peccData.reduce((sum, p) => sum + p.activityCount, 0)}
                </Typography>
                <Typography variant="body2" color="white">
                  Total PECC Activities
                </Typography>
                <Typography variant="caption" color="white" sx={{ mt: 1, display: 'block' }}>
                  {peccData.length > 0 ? Math.round(peccData.reduce((sum, p) => sum + p.activityCount, 0) / peccData.length) : 0} avg per PECC
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Gap Plan Development
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Action plans created by PECCs to address readiness gaps
              </Typography>
              <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'success.light', borderRadius: 2, mt: 2 }}>
                <Typography variant="h2" color="white" sx={{ fontWeight: 'bold' }}>
                  {peccData.reduce((sum, p) => sum + p.gapPlanCount, 0)}
                </Typography>
                <Typography variant="body2" color="white">
                  Total Gap Plans
                </Typography>
                <Typography variant="caption" color="white" sx={{ mt: 1, display: 'block' }}>
                  {peccData.length > 0 ? (peccData.reduce((sum, p) => sum + p.gapPlanCount, 0) / peccData.length).toFixed(1) : 0} avg per PECC
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active PECC Participation
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                PECCs with activity in the last 30 days
              </Typography>
              <Box sx={{ textAlign: 'center', p: 3, bgcolor: 'info.light', borderRadius: 2, mt: 2 }}>
                <Typography variant="h2" color="white" sx={{ fontWeight: 'bold' }}>
                  {activePECCs}/{peccData.length}
                </Typography>
                <Typography variant="body2" color="white">
                  Active PECCs
                </Typography>
                <Typography variant="caption" color="white" sx={{ mt: 1, display: 'block' }}>
                  {peccData.length > 0 ? Math.round((activePECCs / peccData.length) * 100) : 0}% engagement rate
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Per-Hospital Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Hospital-Level Mentoring Metrics
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                Activities, hours, and simulations breakdown by hospital from mentor_activities
              </Typography>
              <Box sx={{ mt: 2 }}>
                {hospitalMetrics.length > 0 ? (
                  <Grid container spacing={2}>
                    {hospitalMetrics.map((metric) => (
                      <Grid item xs={12} md={6} key={metric.hospitalId}>
                        <Paper sx={{ p: 2, borderLeft: 4, borderColor: 'primary.main' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            {metric.hospitalName}
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                                <Typography variant="h6" color="primary.main">
                                  {metric.mentorActivities}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Activities
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                                <Typography variant="h6" color="primary.main">
                                  {metric.mentorHours.toFixed(1)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Hours
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                                <Typography variant="h6" color="secondary.main">
                                  {metric.simulations}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Simulations
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1, textAlign: 'center' }}>
                                <Typography variant="h6" color="success.main">
                                  {metric.peccCount}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  PECCs
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No hospital metrics available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Simulation Analytics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Simulation Types Completed
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Breakdown of simulation cases facilitated across all hospitals
              </Typography>
              <Box sx={{ mt: 2 }}>
                {Object.keys(simulationBreakdown).length > 0 ? (
                  <>
                    {Object.entries(simulationBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([simType, count]) => {
                        const total = Object.values(simulationBreakdown).reduce((sum, c) => sum + c, 0);
                        const percentage = total > 0 ? (count / total) * 100 : 0;
                        return (
                          <Box key={simType} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">
                                {simType}
                              </Typography>
                              <Typography variant="body2">
                                {count} ({Math.round(percentage)}%)
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={percentage}
                              sx={{ height: 6, borderRadius: 3 }}
                              color="secondary"
                            />
                          </Box>
                        );
                      })}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No simulation data available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Simulations by Hospital
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Number of simulation cases completed at each hospital
              </Typography>
              <Box sx={{ mt: 2 }}>
                {hospitalMetrics.some(h => h.simulations > 0) ? (
                  <>
                    {hospitalMetrics
                      .filter(h => h.simulations > 0)
                      .sort((a, b) => b.simulations - a.simulations)
                      .map(metric => {
                        const maxSims = Math.max(...hospitalMetrics.map(h => h.simulations));
                        const percentage = maxSims > 0 ? (metric.simulations / maxSims) * 100 : 0;
                        return (
                          <Box key={metric.hospitalId} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">
                                {metric.hospitalName.length > 30 ? metric.hospitalName.substring(0, 30) + '...' : metric.hospitalName}
                              </Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {metric.simulations}
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={percentage}
                              sx={{ height: 6, borderRadius: 3 }}
                              color="secondary"
                            />
                          </Box>
                        );
                      })}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No simulation data available
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Hospital PRS Score Trends */}
      {peccData.some(p => p.readinessScores.length > 0) && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Hospital Pediatric Readiness Score Trends
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  PRS assessment progression from prsReadinessScores stored per PECC
                </Typography>

                {/* Hospital Toggles */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Select Hospitals to Display
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" onClick={handleSelectAllHospitals}>
                        Select All
                      </Button>
                      <Button size="small" onClick={handleDeselectAllHospitals}>
                        Clear All
                      </Button>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {peccData
                      .filter(p => p.readinessScores.length > 0)
                      .map((pecc, index) => (
                        <FormControlLabel
                          key={pecc.id}
                          control={
                            <Checkbox
                              checked={selectedHospitals.includes(pecc.hospitalId)}
                              onChange={() => handleToggleHospital(pecc.hospitalId)}
                              size="small"
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box 
                                sx={{ 
                                  width: 12, 
                                  height: 12, 
                                  borderRadius: '50%', 
                                  bgcolor: chartColors[index % chartColors.length] 
                                }} 
                              />
                              <Typography variant="body2">
                                {pecc.hospital.length > 25 ? pecc.hospital.substring(0, 25) + '...' : pecc.hospital}
                              </Typography>
                            </Box>
                          }
                        />
                      ))}
                  </Box>
                </Box>

                {/* PRS Chart */}
                {prsChartData.length > 0 && selectedHospitals.length > 0 ? (
                  <Box sx={{ mt: 3, position: 'relative', height: 400 }}>
                    <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                      {/* Define coordinate system */}
                      {(() => {
                        const padding = { top: 20, right: 60, bottom: 60, left: 60 };
                        const chartWidth = 900;
                        const chartHeight = 400;
                        const innerWidth = chartWidth - padding.left - padding.right;
                        const innerHeight = chartHeight - padding.top - padding.bottom;

                        // Y-axis: 0-100 (PRS scores)
                        const yScale = (score: number) => 
                          padding.top + innerHeight - (score / 100) * innerHeight;

                        // X-axis logic
                        let xScale: (index: number) => number;
                        let xLabels: string[];

                        if (useDateAxis && prsChartData[0].scores.length > 0) {
                          // Single hospital: use dates
                          const dates = prsChartData[0].scores.map(s => new Date(s.date).getTime());
                          const minDate = Math.min(...dates);
                          const maxDate = Math.max(...dates);
                          const dateRange = maxDate - minDate || 1;
                          
                          xScale = (index: number) => {
                            const date = new Date(prsChartData[0].scores[index].date).getTime();
                            return padding.left + ((date - minDate) / dateRange) * innerWidth;
                          };
                          
                          xLabels = prsChartData[0].scores.map(s => format(new Date(s.date), 'MMM d, yyyy'));
                        } else {
                          // Multiple hospitals: use PRS 1, PRS 2, PRS 3
                          xScale = (index: number) => 
                            padding.left + (index / Math.max(1, maxAssessments - 1)) * innerWidth;
                          
                          xLabels = Array.from({ length: maxAssessments }, (_, i) => `PRS ${i + 1}`);
                        }

                        return (
                          <>
                            {/* Y-axis */}
                            <line 
                              x1={padding.left} 
                              y1={padding.top} 
                              x2={padding.left} 
                              y2={chartHeight - padding.bottom} 
                              stroke="#ccc" 
                              strokeWidth="2"
                            />
                            {/* X-axis */}
                            <line 
                              x1={padding.left} 
                              y1={chartHeight - padding.bottom} 
                              x2={chartWidth - padding.right} 
                              y2={chartHeight - padding.bottom} 
                              stroke="#ccc" 
                              strokeWidth="2"
                            />

                            {/* Y-axis labels (0, 25, 50, 75, 100) */}
                            {[0, 25, 50, 75, 100].map(score => (
                              <g key={score}>
                                <text
                                  x={padding.left - 10}
                                  y={yScale(score) + 4}
                                  textAnchor="end"
                                  fontSize="12"
                                  fill="#666"
                                >
                                  {score}
                                </text>
                                <line
                                  x1={padding.left}
                                  y1={yScale(score)}
                                  x2={chartWidth - padding.right}
                                  y2={yScale(score)}
                                  stroke="#eee"
                                  strokeWidth="1"
                                  strokeDasharray="4,4"
                                />
                              </g>
                            ))}

                            {/* X-axis labels */}
                            {xLabels.map((label, index) => (
                              <text
                                key={index}
                                x={xScale(index)}
                                y={chartHeight - padding.bottom + 20}
                                textAnchor="middle"
                                fontSize="11"
                                fill="#666"
                              >
                                {label}
                              </text>
                            ))}

                            {/* Plot data for each hospital/PECC */}
                            {prsChartData.map((data, peccIndex) => {
                              const color = chartColors[peccIndex % chartColors.length];
                              
                              return (
                                <g key={peccIndex}>
                                  {/* Line connecting dots */}
                                  {data.scores.length > 1 && (
                                    <polyline
                                      points={data.scores
                                        .map((score, index) => {
                                          if (useDateAxis) {
                                            return `${xScale(index)},${yScale(score.score)}`;
                                          } else {
                                            return `${xScale(index)},${yScale(score.score)}`;
                                          }
                                        })
                                        .join(' ')}
                                      fill="none"
                                      stroke={color}
                                      strokeWidth="2"
                                    />
                                  )}

                                  {/* Dots for each data point */}
                                  {data.scores.map((score, index) => (
                                    <g key={index}>
                                      <circle
                                        cx={xScale(index)}
                                        cy={yScale(score.score)}
                                        r="5"
                                        fill={color}
                                      />
                                      {/* Score label */}
                                      <text
                                        x={xScale(index)}
                                        y={yScale(score.score) - 12}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fontWeight="bold"
                                        fill={color}
                                      >
                                        {score.score}
                                      </text>
                                    </g>
                                  ))}
                                </g>
                              );
                            })}

                            {/* Legend */}
                            {prsChartData.length > 1 && (
                              <g>
                                {prsChartData.map((data, index) => (
                                  <g key={index}>
                                    <circle
                                      cx={chartWidth - padding.right + 20}
                                      cy={padding.top + index * 25}
                                      r="5"
                                      fill={chartColors[index % chartColors.length]}
                                    />
                                    <text
                                      x={chartWidth - padding.right + 30}
                                      y={padding.top + index * 25 + 4}
                                      fontSize="11"
                                      fill="#666"
                                    >
                                      {data.hospitalName.length > 15 ? data.hospitalName.substring(0, 15) + '...' : data.hospitalName}
                                    </text>
                                  </g>
                                ))}
                              </g>
                            )}
                          </>
                        );
                      })()}
                    </svg>
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
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Container>
  );
};

export default MentorSnapshotPage;
