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
      <Typography variant="h4" gutterBottom>Admin Tool</Typography>
      <Typography color="textSecondary" gutterBottom sx={{ mb: 2 }}>
        Welcome back, {userProfile?.first_name || 'Admin'}! Manage the entire ImPACTS system, users, and configurations.
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 4 }}>
        Oversee all users, hospitals, programs, cohorts, and system settings. Monitor system-wide activity and ensure smooth operation of the platform.
      </Typography>

      {/* How This Tool Works Section */}
      <Card sx={{ p: 2, mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary" sx={{ mb: 2 }}>
            How This Tool Works
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.4 }}>
            As an Administrator, you have full access to manage the ImPACTS platform. Here's what you can do:
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  👥 CRM & Team Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage all contacts, organizations, hospitals, and user accounts. Create invitations, assign roles, and maintain comprehensive relationship data.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  ⚙️ Settings & Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure programs, cohorts, registration questions, email templates, and system-wide settings. Customize the platform to meet your organization's needs.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  🔐 Permissions & Access Control
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Set granular permissions for users, cohorts, and programs. Control tab visibility, feature access, and manage role-based permissions across the platform.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📊 Project Pipeline
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track SimBox cases and project development status. Monitor progress, filter by status, and manage project workflows.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  📈 Analytics & Reporting
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View system-wide statistics, user activity, and platform usage metrics. Monitor overall platform health and engagement.
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ p: 1 }}>
                <Typography variant="h6" gutterBottom color="primary">
                  🎓 Resources Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Upload and manage educational resources, SCORM packages, and materials available to users across the platform.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

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
        <Grid item xs={12}>
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

      </Grid>

      <DashboardResources userId={currentUser?.uid} />
    </Box>
  );
};

export default AdminDashboardPage;
