import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  People as PeopleIcon,
  TrendingUp as TrendingIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { format, subDays, isAfter } from 'date-fns';
import DashboardResources from '../../components/DashboardResources';

interface DashboardStats {
  totalHospitals: number;
  totalPeccs: number;
  activitiesThisMonth: number;
  hoursThisMonth: number;
  simulationsThisMonth: number;
}

interface RecentActivity {
  id: string;
  date: string;
  activityName: string;
  category: string;
  hours: number;
}

interface HospitalSummary {
  id: string;
  name: string;
  peccName: string;
  lastActivity: string | null;
  milestonesCompleted: number;
  totalMilestones: number;
}

const MentorDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalHospitals: 0,
    totalPeccs: 0,
    activitiesThisMonth: 0,
    hoursThisMonth: 0,
    simulationsThisMonth: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [hospitalSummaries, setHospitalSummaries] = useState<HospitalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  const loadDashboardData = () => {
    // Load activities from localStorage
    const savedActivities = localStorage.getItem(`mentorActivities_${currentUser?.id}`);
    const activities = savedActivities ? JSON.parse(savedActivities) : [];
    
    // Load hospitals from localStorage; start empty when no saved data
    const savedHospitals = localStorage.getItem(`mentorHospitals_${currentUser?.id}`);
    const hospitals = savedHospitals ? JSON.parse(savedHospitals) : [];

    // Calculate stats for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const thisMonthActivities = activities.filter((a: RecentActivity) => 
      new Date(a.date) >= startOfMonth
    );
    
    const simulationsThisMonth = thisMonthActivities.filter((a: RecentActivity) => 
      a.category === 'SC'
    ).length;

    setStats({
      totalHospitals: hospitals.length,
      totalPeccs: hospitals.length, // Assuming 1 PECC per hospital for now
      activitiesThisMonth: thisMonthActivities.length,
      hoursThisMonth: thisMonthActivities.reduce((sum: number, a: RecentActivity) => sum + a.hours, 0),
      simulationsThisMonth
    });

    // Get recent activities (last 5)
    const sorted = [...activities].sort((a: RecentActivity, b: RecentActivity) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setRecentActivities(sorted.slice(0, 5));

    // Create hospital summaries from loaded data
    const summaries: HospitalSummary[] = hospitals.map((h: { id: string; name: string }) => {
      const lastAct = activities.find((a: RecentActivity & { hospitalIds?: string[] }) => 
        a.hospitalIds?.includes(h.id)
      );
      return {
        id: h.id,
        name: h.name,
        peccName: '',
        lastActivity: lastAct?.date || null,
        milestonesCompleted: 0,
        totalMilestones: 0
      };
    });
    setHospitalSummaries(summaries);
    
    setLoading(false);
  };

  const StatCard = ({ title, value, icon, color, subtitle }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }) => (
    <Card>
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
      <Box sx={{ py: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome, {userProfile?.first_name || 'Mentor'}!
      </Typography>
      <Typography color="textSecondary" gutterBottom sx={{ mb: 2 }}>
        Here's an overview of your mentorship activities
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Support your assigned hospitals and PECCs in their pediatric readiness journey. Guide them through milestones, track progress, and help them achieve their goals.
      </Typography>

      {/* How This Dashboard Works Section */}
      <Card sx={{ p: 2, mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary" sx={{ mb: 2 }}>
            How This Dashboard Works
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.4 }}>
            As a Mentor, you guide hospitals and PECCs through their pediatric readiness journey. Here's what you can do:
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  🏥 Hospital Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View and manage your assigned hospitals. Monitor PECC progress, review milestones, and provide guidance to help hospitals advance through readiness stages.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  👥 PECC Support
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Work directly with PECCs at your assigned hospitals. Review their activities, help with gap plans, and support their professional development.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  ✅ Milestone Tracking
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Update and track PECC milestones through the Establish, Implement, Lead, and Sustain stages. Help PECCs complete objectives and advance their journey.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📝 Activity Logging
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Log your mentorship activities, site visits, training sessions, and simulations. Track your time and document the support you provide to hospitals.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📊 Programs & Cohorts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Participate in programs and cohorts. Post announcements, facilitate discussions, and collaborate with other mentors and PECCs.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  💰 Wages & Expenses
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Submit expense reports for reimbursement. Track your wages, travel expenses, and other costs related to your mentorship activities.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="My Hospitals"
            value={stats.totalHospitals}
            icon={<HospitalIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="My PECCs"
            value={stats.totalPeccs}
            icon={<PeopleIcon />}
            color="#388e3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Activities This Month"
            value={stats.activitiesThisMonth}
            icon={<ActivityIcon />}
            color="#f57c00"
            subtitle={`${stats.hoursThisMonth.toFixed(1)} hours`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Simulations This Month"
            value={stats.simulationsThisMonth}
            icon={<TrendingIcon />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Recent Activities */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Recent Activities</Typography>
              <Button size="small" onClick={() => navigate('/mentor/activities')}>
                View All
              </Button>
            </Box>
            {recentActivities.length === 0 ? (
              <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
                No activities recorded yet
              </Typography>
            ) : (
              <List>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: activity.category === 'SC' ? '#7b1fa2' : '#1976d2' }}>
                          <ActivityIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.activityName}
                        secondary={
                          <>
                            {format(new Date(activity.date), 'MMM d, yyyy')} • {activity.hours}h
                            <Chip label={activity.category} size="small" sx={{ ml: 1 }} />
                          </>
                        }
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Hospital Overview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">My Hospitals</Typography>
              <Button size="small" onClick={() => navigate('/mentor/hospitals')}>
                View All
              </Button>
            </Box>
            {hospitalSummaries.length === 0 ? (
              <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
                No hospitals assigned yet
              </Typography>
            ) : (
              <List>
                {hospitalSummaries.map((hospital, index) => (
                  <React.Fragment key={hospital.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: '#388e3c' }}>
                          <HospitalIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={hospital.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              PECC: {hospital.peccName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                              <Typography variant="caption" sx={{ mr: 1 }}>
                                Milestones: {hospital.milestonesCompleted}/{hospital.totalMilestones}
                              </Typography>
                              <LinearProgress 
                                variant="determinate" 
                                value={(hospital.milestonesCompleted / hospital.totalMilestones) * 100}
                                sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                              />
                            </Box>
                          </Box>
                        }
                      />
                      {hospital.lastActivity && isAfter(subDays(new Date(), 14), new Date(hospital.lastActivity)) && (
                        <Chip 
                          icon={<WarningIcon />} 
                          label="Needs attention" 
                          size="small" 
                          color="warning"
                        />
                      )}
                    </ListItem>
                    {index < hospitalSummaries.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>Quick Actions</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<ActivityIcon />}
              onClick={() => navigate('/mentor/activities')}
            >
              Log Activity
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<PeopleIcon />}
              onClick={() => navigate('/mentor/hospitals')}
            >
              Invite PECC
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<CheckIcon />}
              onClick={() => navigate('/mentor/milestones')}
            >
              Update Milestones
            </Button>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button 
              variant="outlined" 
              fullWidth 
              startIcon={<TrendingIcon />}
              onClick={() => navigate('/mentor/snapshot')}
            >
              View Snapshot
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <DashboardResources userId={currentUser?.uid} />
    </Box>
  );
};

export default MentorDashboardPage;
