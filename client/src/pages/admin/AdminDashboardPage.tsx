import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Avatar,
  Divider,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  TrendingUp as TrendingIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import DashboardResources from '../../components/DashboardResources';

interface SystemStats {
  totalUsers: number;
  totalAdmins: number;
  totalManagers: number;
  totalMentors: number;
  totalPeccs: number;
  totalHospitals: number;
  totalActivities: number;
  totalContacts: number;
}

const AdminDashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalAdmins: 0,
    totalManagers: 0,
    totalMentors: 0,
    totalPeccs: 0,
    totalHospitals: 0,
    totalActivities: 0,
    totalContacts: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stats loaded from Supabase when backend is connected; start at zero
    setStats({
      totalUsers: 0,
      totalAdmins: 0,
      totalManagers: 0,
      totalMentors: 0,
      totalPeccs: 0,
      totalHospitals: 0,
      totalActivities: 0,
      totalContacts: 0
    });
    setLoading(false);
  }, []);

  const StatCard = ({ title, value, icon, color }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
  }) => (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography color="textSecondary" variant="body2">{title}</Typography>
          <Typography variant="h4" sx={{ color }}>{value}</Typography>
        </Box>
        <Avatar sx={{ bgcolor: color, width: 48, height: 48 }}>{icon}</Avatar>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
      <Typography color="textSecondary" gutterBottom>
        System Overview - Welcome, {userProfile?.first_name || 'Admin'}
      </Typography>

      {/* User Stats */}
      <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Users Overview</Typography>
      <Grid container spacing={2}>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard title="Total Users" value={stats.totalUsers} icon={<PeopleIcon />} color="#1976d2" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard title="Admins" value={stats.totalAdmins} icon={<SecurityIcon />} color="#d32f2f" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard title="Managers" value={stats.totalManagers} icon={<PeopleIcon />} color="#7b1fa2" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard title="Mentors" value={stats.totalMentors} icon={<PeopleIcon />} color="#388e3c" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard title="PECCs" value={stats.totalPeccs} icon={<PeopleIcon />} color="#f57c00" />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard title="Hospitals" value={stats.totalHospitals} icon={<HospitalIcon />} color="#0288d1" />
        </Grid>
      </Grid>

      {/* System Stats */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>System Stats</Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#1976d2' }}><ActivityIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText primary="Total Activities" secondary={stats.totalActivities.toLocaleString()} />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#388e3c' }}><PeopleIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText primary="Total Contacts" secondary={stats.totalContacts.toLocaleString()} />
              </ListItem>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: '#7b1fa2' }}><StorageIcon /></Avatar>
                </ListItemAvatar>
                <ListItemText primary="Database Status" secondary="Healthy" />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Quick Actions</Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button variant="outlined" startIcon={<PeopleIcon />} onClick={() => navigate('/admin/users')}>
                Manage Users
              </Button>
              <Button variant="outlined" startIcon={<HospitalIcon />} onClick={() => navigate('/admin/crm')}>
                Manage CRM
              </Button>
              <Button variant="outlined" startIcon={<SecurityIcon />} onClick={() => navigate('/admin/permissions')}>
                Role Permissions
              </Button>
              <Button variant="outlined" startIcon={<SettingsIcon />}>
                System Settings
              </Button>
              <Button variant="outlined" startIcon={<TimelineIcon />}>
                View Reports
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Recent Activity</Typography>
            <Divider sx={{ mb: 2 }} />
            <List>
              <ListItem>
                <ListItemText 
                  primary="Recent activity" 
                  secondary="Activity will appear here as users register and log data." 
                />
              </ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>

      <DashboardResources userId={currentUser?.uid} />
    </Box>
  );
};

export default AdminDashboardPage;
