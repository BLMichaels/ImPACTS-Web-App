import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Work as WorkIcon,
  Assessment as AssessmentIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useUserProfile } from '../context/UserProfileContext';
import { normalizeHospitalOrOrgName } from '../utils/displayName';

const PRISMDashboardPage: React.FC = () => {
  const { userProfile } = useUserProfile();

  // Show loading if userProfile is not loaded yet
  if (!userProfile) {
    return (
      <Box sx={{ mt: 4, p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Loading PRISM Support Tool...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please wait while we load your profile and data.
        </Typography>
      </Box>
    );
  }

  // Data loaded from Supabase/localStorage when connected; start empty
  const managedHospitals: { id: number; name: string; region: string; lastActive: string; status: string }[] = [];
  const recentActivities: { id: number; hospital: string; action: string; time: string }[] = [];
  const upcomingTasks: { id: number; task: string; dueDate: string }[] = [];

  const stats = {
    totalHospitals: managedHospitals.length,
    activeHospitals: managedHospitals.filter(h => h.status === 'Active').length,
    totalActivities: 0,
    completedAssessments: 0
  };

  return (
    <Box sx={{ mt: 4 }}>
      {/* Welcome Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome, {(userProfile as any)?.firstName || (userProfile as any)?.first_name || 'PRISM'} {(userProfile as any)?.lastName || (userProfile as any)?.last_name || ''}
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          PRISM Support Tool
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and support your assigned hospitals in their pediatric readiness journey.
        </Typography>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BusinessIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Hospitals</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {stats.totalHospitals}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Active Hospitals</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {stats.activeHospitals}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <WorkIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Activities</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {stats.totalActivities}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssessmentIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Assessments</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {stats.completedAssessments}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Managed Hospitals */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Managed Hospitals
              </Typography>
              <List>
                {managedHospitals.map((hospital, index) => (
                  <React.Fragment key={hospital.id}>
                    <ListItem>
                      <ListItemIcon>
                        <BusinessIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={normalizeHospitalOrOrgName(hospital.name)}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Region: {hospital.region}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Last Active: {hospital.lastActive}
                            </Typography>
                            <Chip 
                              label={hospital.status} 
                              color={hospital.status === 'Active' ? 'success' : 'default'}
                              size="small"
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < managedHospitals.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              <Button variant="outlined" fullWidth sx={{ mt: 2 }}>
                View All Hospitals
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activities */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Activities
              </Typography>
              <List>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemIcon>
                        <WorkIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={activity.action}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {activity.hospital}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {activity.time}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
              <Button variant="outlined" fullWidth sx={{ mt: 2 }}>
                View All Activities
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Tasks */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Upcoming Tasks
              </Typography>
              <List>
                {upcomingTasks.map((task, index) => (
                  <React.Fragment key={task.id}>
                    <ListItem>
                      <ListItemIcon>
                        <ScheduleIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.task}
                        secondary={`Due: ${task.dueDate}`}
                      />
                    </ListItem>
                    {index < upcomingTasks.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<WorkIcon />}
              sx={{ py: 2 }}
            >
              View Activities
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<PeopleIcon />}
              sx={{ py: 2 }}
            >
              Manage Hospitals
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<AssessmentIcon />}
              sx={{ py: 2 }}
            >
              Review Assessments
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<TrendingUpIcon />}
              sx={{ py: 2 }}
            >
              Generate Reports
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default PRISMDashboardPage;
