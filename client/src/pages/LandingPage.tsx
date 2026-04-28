import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  Insights as InsightsIcon,
  Checklist as ChecklistIcon,
  Forum as ForumIcon,
  Groups as GroupsIcon,
  Security as SecurityIcon,
  Bolt as BoltIcon,
  AutoGraph as AutoGraphIcon,
  PeopleAlt as PeopleAltIcon,
  LocalHospital as LocalHospitalIcon
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
        background: 'linear-gradient(180deg, #fcfdff 0%, #f3f5ff 48%, #eef7ff 100%)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(900px 380px at 0% 0%, rgba(192, 214, 255, 0.7), transparent 65%), radial-gradient(700px 320px at 95% 8%, rgba(255, 212, 230, 0.55), transparent 68%), radial-gradient(600px 300px at 50% 85%, rgba(205, 241, 231, 0.7), transparent 70%)'
        }}
      />

      <Container maxWidth="xl" sx={{ py: { xs: 5, md: 9 }, position: 'relative', zIndex: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: { xs: 5, md: 8 } }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar src="/impacts-logo.png" alt="ImPACTS logo" sx={{ width: 38, height: 38 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
              ImPACTS PECC Support Tool
            </Typography>
          </Stack>
          <Button variant="outlined" onClick={() => navigate('/login')}>
            Sign in
          </Button>
        </Stack>

        <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center" sx={{ mb: { xs: 7, md: 10 } }}>
          <Grid item xs={12} md={6}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label="Hospital continuity first" color="primary" variant="outlined" />
                <Chip label="PECC + Mentor + Manager aligned" variant="outlined" />
              </Stack>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.45rem', sm: '3.35rem', md: '4.6rem' },
                  lineHeight: { xs: 1.08, md: 1.03 },
                  fontWeight: 850,
                  letterSpacing: '-0.02em',
                  maxWidth: 760
                }}
              >
                A modern command center for pediatric emergency readiness
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{ maxWidth: 660, fontWeight: 400, lineHeight: 1.5, fontSize: { xs: '1rem', md: '1.15rem' } }}
              >
                Bring milestones, simulation, activities, and cross-role coordination into one clean workflow so
                hospitals can sustain progress through staffing changes and leadership transitions.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
                <Button size="large" variant="contained" onClick={() => navigate('/login')} sx={{ px: 3.5 }}>
                  Enter platform
                </Button>
                <Button size="large" variant="outlined" onClick={() => navigate('/register')} sx={{ px: 3.5 }}>
                  Request access
                </Button>
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ pt: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <AutoGraphIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">Actionable readiness insights</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <PeopleAltIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">Role-based collaboration</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <LocalHospitalIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="text.secondary">Hospital-owned continuity data</Typography>
                </Stack>
              </Stack>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                borderRadius: 5,
                p: { xs: 2, sm: 2.5 },
                border: '1px solid',
                borderColor: 'rgba(69,90,100,0.15)',
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(244,246,255,0.9) 45%, rgba(237,248,255,0.95) 100%)',
                boxShadow: '0 28px 70px rgba(71, 86, 122, 0.18)'
              }}
            >
              <Box
                sx={{
                  borderRadius: 4,
                  p: 2,
                  background:
                    'linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(248,251,255,0.95) 100%)',
                  border: '1px solid',
                  borderColor: 'rgba(69,90,100,0.12)'
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Readiness overview
                  </Typography>
                  <Chip label="Live" size="small" color="success" variant="outlined" />
                </Stack>
                <Grid container spacing={1.2} sx={{ mb: 1.5 }}>
                  {[
                    { label: 'Hospitals', value: '5,400+' },
                    { label: 'PECCs', value: 'Growing' },
                    { label: 'Cohorts', value: 'Active' }
                  ].map((m) => (
                    <Grid item xs={4} key={m.label}>
                      <Card
                        elevation={0}
                        sx={{
                          borderRadius: 2.5,
                          border: '1px solid',
                          borderColor: 'rgba(69,90,100,0.12)',
                          backgroundColor: 'rgba(255,255,255,0.8)'
                        }}
                      >
                        <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                          <Typography variant="h6" sx={{ fontWeight: 750, lineHeight: 1 }}>
                            {m.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {m.label}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
                <Box
                  sx={{
                    height: 150,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'rgba(69,90,100,0.1)',
                    background:
                      'linear-gradient(180deg, rgba(223,236,255,0.55) 0%, rgba(255,255,255,0.9) 100%), repeating-linear-gradient(90deg, rgba(89,110,160,0.12) 0, rgba(89,110,160,0.12) 1px, transparent 1px, transparent 52px)'
                  }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Stack spacing={4} sx={{ textAlign: { xs: 'left', md: 'center' }, mb: { xs: 5, md: 6 } }}>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.8rem', sm: '2.2rem', md: '2.65rem' },
              lineHeight: 1.1,
              fontWeight: 800,
              maxWidth: 860,
              mx: { md: 'auto' }
            }}
          >
            Minimal interface, high clarity, and stronger execution at every hospital
          </Typography>
        </Stack>

        <Grid container spacing={2.2} sx={{ mb: { xs: 5, md: 7 } }}>
          {featureCards.map((card) => (
            <Grid item xs={12} sm={6} lg={4} key={card.title}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'rgba(69,90,100,0.12)',
                  backdropFilter: 'blur(5px)',
                  backgroundColor: 'rgba(255,255,255,0.82)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 30px rgba(76, 102, 139, 0.13)'
                  }
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

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'rgba(69,90,100,0.12)',
            backgroundColor: 'rgba(255,255,255,0.78)',
            textAlign: { xs: 'left', md: 'center' }
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 760, mb: 1 }}>
            Ready to streamline PECC implementation and continuity?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760, mx: { md: 'auto' }, mb: 2 }}>
            Sign in to continue your program work or request access for your team.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent={{ md: 'center' }}>
            <Button variant="contained" onClick={() => navigate('/login')}>Sign in</Button>
            <Button variant="outlined" onClick={() => navigate('/register')}>Request access</Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default LandingPage;
