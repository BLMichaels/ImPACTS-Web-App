import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import {
  Insights as InsightsIcon,
  Checklist as ChecklistIcon,
  Forum as ForumIcon,
  Groups as GroupsIcon,
  Security as SecurityIcon,
  Bolt as BoltIcon
} from '@mui/icons-material';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

const getDefaultDashboard = (role: UserRole): string => {
  switch (role) {
    case UserRole.ADMIN:
      return '/admin/dashboard';
    case UserRole.MANAGER:
      return '/manager/overview';
    case UserRole.MENTOR:
      return '/mentor/dashboard';
    case UserRole.HOSPITAL_SYSTEM:
      return '/hospital-system/dashboard';
    case UserRole.HIRING_GROUP:
      return '/hiring-group/snapshot';
    default:
      return '/dashboard';
  }
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const { userProfile, isLoading: profileLoading } = useUserProfile();

  if (!authLoading && !profileLoading && currentUser) {
    return <Navigate to={getDefaultDashboard(userProfile?.role ?? UserRole.PECC)} replace />;
  }

  const featureCards = [
    {
      icon: <InsightsIcon color="primary" />,
      title: 'Real-time readiness visibility',
      text: 'Track gap closure, simulation activity, and progress indicators in one place.'
    },
    {
      icon: <ChecklistIcon color="primary" />,
      title: 'Structured implementation workflow',
      text: 'Use milestone checklists and role-based tools to keep hospital work moving forward.'
    },
    {
      icon: <ForumIcon color="primary" />,
      title: 'Built-in collaboration',
      text: 'Coordinate updates across PECCs, mentors, and managers with cohort discussions and shared context.'
    },
    {
      icon: <GroupsIcon color="primary" />,
      title: 'Hospital continuity first',
      text: 'Critical PECC work stays tied to hospitals, supporting clean handoffs during staff turnover.'
    },
    {
      icon: <SecurityIcon color="primary" />,
      title: 'Role-based access and governance',
      text: 'Granular permissions and scoped views keep the right data with the right teams.'
    },
    {
      icon: <BoltIcon color="primary" />,
      title: 'Operationally practical',
      text: 'Designed for busy clinical teams: fast workflows, fewer clicks, clear next actions.'
    }
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(1200px 500px at 10% -10%, rgba(69,90,100,0.22), transparent 60%), radial-gradient(1000px 400px at 90% 0%, rgba(21,101,192,0.2), transparent 65%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)'
      }}
    >
      <Container maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={4} sx={{ textAlign: { xs: 'left', md: 'center' }, mb: { xs: 6, md: 8 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent={{ md: 'center' }}>
            <Chip label="ImPACTS PECC Support Tool" color="primary" variant="outlined" />
            <Chip label="Hospital readiness and continuity platform" variant="outlined" />
          </Stack>
          <Typography
            variant="h2"
            sx={{
              fontSize: { xs: '2rem', sm: '2.7rem', md: '3.5rem' },
              lineHeight: 1.1,
              fontWeight: 800,
              maxWidth: 900,
              mx: { md: 'auto' }
            }}
          >
            Modern coordination for pediatric emergency care readiness
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: 900, mx: { md: 'auto' }, fontWeight: 400, lineHeight: 1.5 }}
          >
            Support PECCs, mentors, managers, and system leaders with a single operational workspace for milestones,
            simulation, activity tracking, and hospital-level continuity.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent={{ md: 'center' }}
            sx={{ pt: 1 }}
          >
            <Button size="large" variant="contained" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button size="large" variant="outlined" onClick={() => navigate('/register')}>
              Request access
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2.5}>
          {featureCards.map((card) => (
            <Grid item xs={12} sm={6} lg={4} key={card.title}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  backdropFilter: 'blur(3px)',
                  backgroundColor: 'rgba(255,255,255,0.75)'
                }}
              >
                <CardContent>
                  <Stack spacing={1.25}>
                    <Box aria-hidden>{card.icon}</Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.text}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default LandingPage;
