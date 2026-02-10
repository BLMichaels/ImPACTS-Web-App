import React, { useState, useEffect } from 'react';
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
  ListItemText,
  ListItemAvatar,
  Divider,
  Button,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  TrendingUp as TrendingIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import DashboardResources from '../../components/DashboardResources';

interface DashboardStats {
  totalMentors: number;
  totalHospitals: number;
  totalPeccs: number;
  activitiesThisMonth: number;
  hoursThisMonth: number;
  pendingExpenses: number;
}

interface MentorSummary {
  id: string;
  name: string;
  hospitals: number;
  peccs: number;
  hoursThisMonth: number;
  lastActivity: string | null;
}

const ManagerDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalMentors: 0,
    totalHospitals: 0,
    totalPeccs: 0,
    activitiesThisMonth: 0,
    hoursThisMonth: 0,
    pendingExpenses: 0
  });
  const [mentorSummaries, setMentorSummaries] = useState<MentorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stats and mentor summaries loaded from Supabase when backend is connected; start empty
    setStats({
      totalMentors: 0,
      totalHospitals: 0,
      totalPeccs: 0,
      activitiesThisMonth: 0,
      hoursThisMonth: 0,
      pendingExpenses: 0
    });
    setMentorSummaries([]);
    setLoading(false);
  }, []);

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
        Manager Dashboard
      </Typography>
      <Typography color="textSecondary" gutterBottom sx={{ mb: 2 }}>
        Welcome back, {userProfile?.first_name || 'Manager'}! Here's your team overview.
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Oversee your mentors, hospitals, and PECCs. Monitor team activity, manage assignments, and track progress across your region.
      </Typography>

      {/* How This Dashboard Works Section */}
      <Card sx={{ p: 2, mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary" sx={{ mb: 2 }}>
            How This Dashboard Works
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.4 }}>
            As a Manager, you coordinate regional pediatric readiness efforts. Here's what you can do:
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  👥 Mentor Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Assign and manage mentors in your region. Monitor mentor activity, assign hospitals and PECCs, and track mentorship effectiveness.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  🏥 Hospital & PECC Oversight
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View all hospitals and PECCs in your region. Monitor progress, track activities, and ensure hospitals are advancing through readiness stages.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📊 Programs & Cohorts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create and manage programs and cohorts. Assign members, post announcements, facilitate discussions, and coordinate regional initiatives.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  🔐 Permissions Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Set permissions and tab visibility for mentors, PECCs, programs, and cohorts. Control what features and information each user can access.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  💰 Wages & Expenses
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Review and approve expense reports from mentors. Track wages, reimbursements, and manage financial aspects of regional operations.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📈 Activity Monitoring
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitor team activities, hours logged, and simulation exercises. Track regional progress and identify areas needing attention.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Mentors"
            value={stats.totalMentors}
            icon={<PeopleIcon />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Hospitals"
            value={stats.totalHospitals}
            icon={<HospitalIcon />}
            color="#388e3c"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="PECCs"
            value={stats.totalPeccs}
            icon={<PeopleIcon />}
            color="#7b1fa2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Activities"
            value={stats.activitiesThisMonth}
            icon={<ActivityIcon />}
            color="#f57c00"
            subtitle="This month"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Hours"
            value={stats.hoursThisMonth.toFixed(1)}
            icon={<TrendingIcon />}
            color="#0288d1"
            subtitle="This month"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <StatCard
            title="Pending"
            value={stats.pendingExpenses}
            icon={<MoneyIcon />}
            color="#d32f2f"
            subtitle="Expenses"
          />
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Mentor Overview */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">My Mentors</Typography>
              <Button size="small" onClick={() => navigate('/manager/mentors')}>
                View All
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            <List>
              {mentorSummaries.map((mentor, index) => {
                const daysSinceActivity = mentor.lastActivity 
                  ? Math.floor((Date.now() - new Date(mentor.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const needsAttention = daysSinceActivity && daysSinceActivity > 7;
                
                return (
                  <React.Fragment key={mentor.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: needsAttention ? '#f57c00' : '#1976d2' }}>
                          {mentor.name.split(' ').map(n => n[0]).join('')}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {mentor.name}
                            {needsAttention && (
                              <Chip 
                                icon={<WarningIcon />} 
                                label="Inactive" 
                                size="small" 
                                color="warning"
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <>
                            {mentor.hospitals} hospitals • {mentor.peccs} PECCs • {mentor.hoursThisMonth}h this month
                          </>
                        }
                      />
                      <Button size="small" variant="outlined">
                        View Details
                      </Button>
                    </ListItem>
                    {index < mentorSummaries.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Quick Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<PeopleIcon />}
                onClick={() => navigate('/manager/mentors')}
              >
                Add New Mentor
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<HospitalIcon />}
                onClick={() => navigate('/manager/crm')}
              >
                Manage Hospitals
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<PeopleIcon />}
              >
                Assign PECC to Mentor
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<MoneyIcon />}
              >
                Review Expenses
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                startIcon={<TrendingIcon />}
              >
                Generate Reports
              </Button>
            </Box>
          </Paper>

        </Grid>
      </Grid>

      <DashboardResources userId={currentUser?.uid} />
    </Box>
  );
};

export default ManagerDashboardPage;
