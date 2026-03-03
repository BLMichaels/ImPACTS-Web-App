import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  Divider,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Collapse
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  TrendingUp as TrendingIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';

interface MentorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedHospitals: Array<{
    id: string;
    name: string;
    peccCount: number;
  }>;
  totalActivities: number;
  hoursThisMonth: number;
  lastActivity: string | null;
}

interface DashboardStats {
  totalMentors: number;
  totalSites: number;
  totalPeccs: number;
  activitiesThisMonth: number;
  hoursThisMonth: number;
}

const ManagerOverviewPage: React.FC = () => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  
  const [mentors, setMentors] = useState<MentorData[]>([]);
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userProfile?.id]);

  const loadData = async () => {
    if (!userProfile?.id) return;
    
    try {
      setLoading(true);

      // Load all mentors managed by this manager
      const { data: mentorUsers, error: mentorError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('role', 'mentor');

      if (mentorError) throw mentorError;

      // Load mentor hospital assignments
      const mentorIds = (mentorUsers || []).map(m => m.id);
      const { data: assignments, error: assignmentError } = await supabase
        .from('mentor_hospital_assignments')
        .select(`
          mentor_id,
          hospital:hospital_id(id, name)
        `)
        .in('mentor_id', mentorIds)
        .eq('is_active', true);

      if (assignmentError) throw assignmentError;

      // Get all hospital IDs to count PECCs
      const hospitalIds = (assignments || [])
        .map((a: any) => Array.isArray(a.hospital) ? a.hospital[0]?.id : a.hospital?.id)
        .filter(Boolean);

      // Load PECCs for these hospitals
      const { data: peccs, error: peccsError } = await supabase
        .from('users')
        .select('id, hospital_facility_id')
        .eq('role', 'pecc')
        .in('hospital_facility_id', hospitalIds);

      if (peccsError) throw peccsError;

      // Build mentor data (load activities from Supabase per mentor)
      const mentorData: MentorData[] = await Promise.all(
        (mentorUsers || []).map(async (mentor) => {
          const mentorAssignments = (assignments || []).filter((a: any) => a.mentor_id === mentor.id);
          const hospitals = mentorAssignments.map((a: any) => {
            const hospital = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
            const peccCount = (peccs || []).filter(p => p.hospital_facility_id === hospital?.id).length;
            return {
              id: hospital?.id || '',
              name: hospital?.name || 'Unknown',
              peccCount
            };
          });

          const activities = await getMentorActivitiesForUser(mentor.id);
          const totalActivities = activities.length;

        // Calculate hours this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const hoursThisMonth = activities
          .filter((a: any) => new Date(a.date) >= monthStart)
          .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);

        // Get last activity date
        const lastActivity = activities.length > 0
          ? activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
          : null;

        return {
            id: mentor.id,
            firstName: mentor.first_name,
            lastName: mentor.last_name,
            email: mentor.email,
            assignedHospitals: hospitals,
            totalActivities,
            hoursThisMonth,
            lastActivity
          };
        })
      );

      setMentors(mentorData);
    } catch (err) {
      console.error('Error loading manager overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats: DashboardStats = useMemo(() => {
    return {
      totalMentors: mentors.length,
      totalSites: Array.from(new Set(mentors.flatMap(m => m.assignedHospitals.map(h => h.id)))).length,
      totalPeccs: mentors.reduce((sum, m) => sum + m.assignedHospitals.reduce((s, h) => s + h.peccCount, 0), 0),
      activitiesThisMonth: mentors.reduce((sum, m) => sum + m.totalActivities, 0),
      hoursThisMonth: mentors.reduce((sum, m) => sum + m.hoursThisMonth, 0)
    };
  }, [mentors]);

  const handleExpandMentor = (mentorId: string) => {
    setExpandedMentor(expandedMentor === mentorId ? null : mentorId);
  };

  const handleViewInCRM = (hospitalId: string) => {
    navigate(`/manager/crm?hospital=${hospitalId}`);
  };

  const StatCard = ({ title, value, icon, color, subtitle }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" variant="body2" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: color, width: 56, height: 56 }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Manager Overview
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom color="primary" sx={{ fontWeight: 600, mb: 3 }}>
        Manager Overview
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Mentors"
            value={stats.totalMentors}
            icon={<PeopleIcon />}
            color="#1976d2"
            subtitle="Under your management"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Sites"
            value={stats.totalSites}
            icon={<HospitalIcon />}
            color="#2e7d32"
            subtitle="Hospitals being supported"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total PECCs"
            value={stats.totalPeccs}
            icon={<TrendingIcon />}
            color="#ed6c02"
            subtitle="Across all sites"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Team Hours (Month)"
            value={stats.hoursThisMonth.toFixed(1)}
            icon={<ActivityIcon />}
            color="#9c27b0"
            subtitle={`${stats.activitiesThisMonth} activities`}
          />
        </Grid>
      </Grid>

      {/* Mentors and Sites Overview */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Your Mentors and Their Sites
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                Click on a mentor to view their assigned sites and PECCs. Click "View in CRM" to see detailed hospital information.
              </Typography>

              {mentors.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="textSecondary">
                    No mentors found. Assign mentors to hospitals in the CRM.
                  </Typography>
                  <Button
                    variant="contained"
                    sx={{ mt: 2 }}
                    onClick={() => navigate('/manager/crm')}
                  >
                    Go to CRM
                  </Button>
                </Box>
              ) : (
                <List>
                  {mentors.map((mentor, index) => (
                    <React.Fragment key={mentor.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          py: 2
                        }}
                      >
                        {/* Mentor Header */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleExpandMentor(mentor.id)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {mentor.firstName.charAt(0)}{mentor.lastName.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle1" fontWeight={600}>
                                {mentor.firstName} {mentor.lastName}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {mentor.email}
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Chip
                              size="small"
                              label={`${mentor.assignedHospitals.length} sites`}
                              color="primary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={`${mentor.assignedHospitals.reduce((sum, h) => sum + h.peccCount, 0)} PECCs`}
                              color="secondary"
                              variant="outlined"
                            />
                            <Chip
                              size="small"
                              label={`${mentor.hoursThisMonth.toFixed(1)}h this month`}
                              color="success"
                              variant="outlined"
                            />
                            <IconButton size="small">
                              {expandedMentor === mentor.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Box>
                        </Box>

                        {/* Expanded Content */}
                        <Collapse in={expandedMentor === mentor.id} timeout="auto" unmountOnExit>
                          <Box sx={{ mt: 2, ml: 7 }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                              Assigned Sites:
                            </Typography>
                            {mentor.assignedHospitals.length === 0 ? (
                              <Typography variant="body2" color="textSecondary">
                                No sites assigned yet
                              </Typography>
                            ) : (
                              <Grid container spacing={2} sx={{ mt: 1 }}>
                                {mentor.assignedHospitals.map(hospital => (
                                  <Grid item xs={12} md={6} key={hospital.id}>
                                    <Paper
                                      sx={{
                                        p: 2,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        bgcolor: 'grey.50'
                                      }}
                                    >
                                      <Box>
                                        <Typography variant="body1" fontWeight={600}>
                                          {hospital.name}
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                          {hospital.peccCount} PECC{hospital.peccCount !== 1 ? 's' : ''}
                                        </Typography>
                                      </Box>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<ViewIcon />}
                                        onClick={() => handleViewInCRM(hospital.id)}
                                      >
                                        View in CRM
                                      </Button>
                                    </Paper>
                                  </Grid>
                                ))}
                              </Grid>
                            )}

                            {/* Activity Summary */}
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                              <Typography variant="body2" color="white">
                                <strong>Total Activities:</strong> {mentor.totalActivities} | 
                                <strong> Hours this Month:</strong> {mentor.hoursThisMonth.toFixed(1)} | 
                                <strong> Last Activity:</strong> {mentor.lastActivity ? format(new Date(mentor.lastActivity), 'MMM d, yyyy') : 'None'}
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
    </Box>
  );
};

export default ManagerOverviewPage;
