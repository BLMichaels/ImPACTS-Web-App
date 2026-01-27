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
    
    // Load hospitals from localStorage
    const savedHospitals = localStorage.getItem(`mentorHospitals_${currentUser?.id}`);
    const hospitals = savedHospitals ? JSON.parse(savedHospitals) : [
      { id: '1', name: 'Memorial General Hospital' },
      { id: '2', name: 'Children\'s Regional Medical Center' },
      { id: '3', name: 'St. Mary\'s Community Hospital' }
    ];

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

    // Create hospital summaries
    const summaries: HospitalSummary[] = hospitals.map((h: { id: string; name: string }) => ({
      id: h.id,
      name: h.name,
      peccName: 'PECC Contact', // Will come from database
      lastActivity: activities.find((a: RecentActivity & { hospitalIds: string[] }) => 
        a.hospitalIds?.includes(h.id)
      )?.date || null,
      milestonesCompleted: Math.floor(Math.random() * 5), // Mock data
      totalMilestones: 5
    }));
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
      <Typography color="textSecondary" gutterBottom>
        Here's an overview of your mentorship activities
      </Typography>

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
    </Box>
  );
};

export default MentorDashboardPage;
