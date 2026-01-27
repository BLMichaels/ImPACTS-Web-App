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
import { useUserProfile } from '../../context/UserProfileContext';

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
    // Mock data for now
    setStats({
      totalMentors: 5,
      totalHospitals: 15,
      totalPeccs: 12,
      activitiesThisMonth: 45,
      hoursThisMonth: 120.5,
      pendingExpenses: 3
    });

    setMentorSummaries([
      { id: '1', name: 'Sarah Johnson', hospitals: 3, peccs: 3, hoursThisMonth: 25.5, lastActivity: '2026-01-26' },
      { id: '2', name: 'Michael Chen', hospitals: 4, peccs: 2, hoursThisMonth: 32.0, lastActivity: '2026-01-25' },
      { id: '3', name: 'Emily Davis', hospitals: 2, peccs: 2, hoursThisMonth: 18.25, lastActivity: '2026-01-20' },
      { id: '4', name: 'James Wilson', hospitals: 3, peccs: 3, hoursThisMonth: 28.0, lastActivity: '2026-01-27' },
      { id: '5', name: 'Lisa Martinez', hospitals: 3, peccs: 2, hoursThisMonth: 16.75, lastActivity: '2026-01-15' }
    ]);

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
      <Typography color="textSecondary" gutterBottom>
        Welcome back, {userProfile?.first_name || 'Manager'}! Here's your team overview.
      </Typography>

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

          {/* Alerts */}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>Alerts</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ p: 1, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>2 mentors</strong> haven't logged activities in 7+ days
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>3 expenses</strong> pending approval
                </Typography>
              </Box>
              <Box sx={{ p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>5 simulations</strong> completed this week
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ManagerDashboardPage;
