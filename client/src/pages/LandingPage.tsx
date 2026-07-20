import React, { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  WorkOutline as ActivitiesIcon,
  FlagOutlined as GapsIcon,
  GroupsOutlined as CohortsIcon,
  TimelineOutlined as SnapshotIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircleOutline as CheckIcon,
} from '@mui/icons-material';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

const FONT_DISPLAY = '"Fraunces", Georgia, "Times New Roman", serif';
const FONT_BODY = '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const SLATE = '#455a64';
const SLATE_DARK = '#2f3e46';

type PillarId = 'activities' | 'gaps' | 'cohorts' | 'snapshot';

interface Pillar {
  id: PillarId;
  navLabel: string;
  title: string;
  headline: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  bullets: string[];
}

const PILLARS: Pillar[] = [
  {
    id: 'activities',
    navLabel: 'Activities',
    title: 'Activity tracking',
    headline: 'Document the work that moves readiness forward',
    description:
      'Log meetings, education sessions, outreach, and simulation prep in one place — so your PECC role is visible, measurable, and easy to hand off.',
    icon: <ActivitiesIcon sx={{ fontSize: 28 }} />,
    accent: '#0d9488',
    bullets: ['Category-based activity log', 'Ties to gaps and simulation', 'Export-ready for reports'],
  },
  {
    id: 'gaps',
    navLabel: 'Gap Closure',
    title: 'Gap closure',
    headline: 'Close gaps and institutionalize what you learn',
    description:
      'Turn readiness findings into owned action plans with priorities, due dates, and notes — so improvements stick after the consultant leaves.',
    icon: <GapsIcon sx={{ fontSize: 28 }} />,
    accent: '#c2410c',
    bullets: ['SMART action plans with owners', 'Education-linked gap questions', 'Progress from identified to done'],
  },
  {
    id: 'cohorts',
    navLabel: 'Cohorts',
    title: 'Cohort collaboration',
    headline: 'Learn from PECCs across your network',
    description:
      'Share wins, ask questions, and stay aligned with peers, mentors, and program leaders through discussions, announcements, and cohort resources.',
    icon: <CohortsIcon sx={{ fontSize: 28 }} />,
    accent: '#6d28d9',
    bullets: ['Discussion threads & replies', 'Program announcements', 'Shared learning resources'],
  },
  {
    id: 'snapshot',
    navLabel: 'Snapshot',
    title: 'Snapshot metrics',
    headline: 'See your readiness story at a glance',
    description:
      'Pull together checklist progress, activity volume, gap closure, simulation work, and readiness scores — one dashboard for you and your leadership.',
    icon: <SnapshotIcon sx={{ fontSize: 28 }} />,
    accent: '#1d4ed8',
    bullets: ['Readiness & gap metrics', 'Activity and simulation counts', 'Printable summary views'],
  },
];

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

function PillarPreview({ pillar }: { pillar: Pillar }) {
  switch (pillar.id) {
    case 'activities':
      return (
        <Stack spacing={1.25}>
          {[
            { type: 'Education', title: 'PEWS refresher for ED nurses', date: 'Mar 12' },
            { type: 'Meeting', title: 'Pharmacy director — pediatric dosing', date: 'Mar 8' },
            { type: 'Outreach', title: 'PICU handoff workflow review', date: 'Feb 28' },
          ].map((row) => (
            <Box
              key={row.title}
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.85)',
                border: '1px solid',
                borderColor: alpha(pillar.accent, 0.15),
              }}
            >
              <Chip label={row.type} size="small" sx={{ bgcolor: alpha(pillar.accent, 0.12), color: pillar.accent, fontWeight: 600 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                  {row.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.date}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      );
    case 'gaps':
      return (
        <Stack spacing={1.25}>
          {[
            { action: 'Standardize pediatric weight-based dosing cards', owner: 'J. Martinez', status: 'In progress' },
            { action: 'Update inter-facility transfer checklist', owner: 'Pharmacy + ED', status: 'Need to develop' },
          ].map((row) => (
            <Box
              key={row.action}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.85)',
                border: '1px solid',
                borderColor: alpha(pillar.accent, 0.15),
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75, lineHeight: 1.35 }}>
                {row.action}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Owner: ${row.owner}`} size="small" variant="outlined" />
                <Chip label={row.status} size="small" sx={{ bgcolor: alpha(pillar.accent, 0.1), color: pillar.accent }} />
              </Stack>
            </Box>
          ))}
        </Stack>
      );
    case 'cohorts':
      return (
        <Stack spacing={1.25}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(pillar.accent, 0.08), border: '1px solid', borderColor: alpha(pillar.accent, 0.2) }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: pillar.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Announcement
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
              March cohort call — simulation debrief tips
            </Typography>
          </Box>
          {['How did you roll out PEWS in a low-volume ED?', 'Sharing our pediatric transfer policy template'].map((topic) => (
            <Box
              key={topic}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.85)',
                border: '1px solid',
                borderColor: alpha(pillar.accent, 0.15),
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                {topic}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                4 replies · Cohort discussion
              </Typography>
            </Box>
          ))}
        </Stack>
      );
    case 'snapshot':
    default:
      return (
        <Grid container spacing={1.25}>
          {[
            { label: 'Checklist', value: '68%', sub: 'Stage 2' },
            { label: 'Activities YTD', value: '24', sub: 'Logged' },
            { label: 'Gaps closed', value: '11', sub: 'Of 19' },
            { label: 'Readiness', value: '82', sub: 'Latest score' },
          ].map((m) => (
            <Grid item xs={6} key={m.label}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.85)',
                  border: '1px solid',
                  borderColor: alpha(pillar.accent, 0.15),
                  textAlign: 'center',
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 800, color: pillar.accent, lineHeight: 1 }}>
                  {m.value}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mt: 0.5 }}>
                  {m.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {m.sub}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      );
  }
}

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { currentUser, loading: authLoading } = useAuth();
  const { userProfile, isLoading: profileLoading } = useUserProfile();
  const [activePillar, setActivePillar] = useState<PillarId>('activities');

  const pillar = PILLARS.find((p) => p.id === activePillar) ?? PILLARS[0];

  const handlePillarKeyDown = useCallback(
    (e: React.KeyboardEvent, id: PillarId) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActivePillar(id);
      }
    },
    []
  );

  if (!authLoading && !profileLoading && currentUser) {
    return <Navigate to={getDefaultDashboard(userProfile?.role ?? UserRole.PECC)} replace />;
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: FONT_BODY,
        color: SLATE_DARK,
      }}
    >
      {/* Full-viewport background — fixed so it always fills the browser */}
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 90% 60% at 8% -10%, ${alpha('#93c5fd', 0.55)} 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 95% 5%, ${alpha('#fda4af', 0.4)} 0%, transparent 50%),
            radial-gradient(ellipse 80% 55% at 50% 100%, ${alpha('#5eead4', 0.35)} 0%, transparent 55%),
            linear-gradient(165deg, #f8fafc 0%, #eef2ff 38%, #f0fdfa 72%, #f8fafc 100%)
          `,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.35,
          backgroundImage: `
            linear-gradient(${alpha(SLATE, 0.06)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(SLATE, 0.06)} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            px: { xs: 2, sm: 3, lg: 5 },
            py: { xs: 2, md: 2.5 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${SLATE} 0%, ${alpha(SLATE, 0.75)} 100%)`,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: '1.1rem',
                boxShadow: `0 8px 24px ${alpha(SLATE, 0.25)}`,
              }}
              aria-hidden
            >
              I
            </Box>
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}
              >
                ImPACTS
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                PECC Support Tool
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{
              borderColor: alpha(SLATE, 0.25),
              color: SLATE_DARK,
              fontWeight: 600,
              '&:hover': { borderColor: SLATE, bgcolor: alpha(SLATE, 0.04) },
            }}
          >
            Sign in
          </Button>
        </Box>

        {/* Hero */}
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, lg: 5 }, pb: { xs: 6, md: 8 } }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center" sx={{ pt: { xs: 2, md: 4 }, pb: { xs: 5, md: 7 } }}>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <Chip
                  label="Built for Pediatric Emergency Care Coordinators"
                  size="small"
                  sx={{
                    alignSelf: 'flex-start',
                    bgcolor: alpha(SLATE, 0.08),
                    color: SLATE,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: alpha(SLATE, 0.12),
                  }}
                />
                <Typography
                  component="h1"
                  sx={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: { xs: '2.35rem', sm: '3rem', md: '3.65rem' },
                    lineHeight: { xs: 1.08, md: 1.04 },
                    letterSpacing: '-0.03em',
                    maxWidth: 560,
                  }}
                >
                  Four pillars for{' '}
                  <Box component="span" sx={{ color: SLATE }}>
                    pediatric readiness
                  </Box>{' '}
                  work
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: 520, fontSize: { xs: '1.05rem', md: '1.125rem' }, lineHeight: 1.65 }}
                >
                  Track activities, close gaps, learn with your cohort, and review metrics — the core tabs PECCs use
                  every week to improve emergency care for children.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 0.5 }}>
                  <Button
                    size="large"
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate('/login')}
                    sx={{
                      px: 3.5,
                      py: 1.35,
                      fontWeight: 700,
                      bgcolor: SLATE,
                      boxShadow: `0 12px 32px ${alpha(SLATE, 0.28)}`,
                      '&:hover': { bgcolor: SLATE_DARK },
                    }}
                  >
                    Enter platform
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    onClick={() => navigate('/register')}
                    sx={{
                      px: 3.5,
                      py: 1.35,
                      fontWeight: 600,
                      borderColor: alpha(SLATE, 0.3),
                      color: SLATE_DARK,
                    }}
                  >
                    Request an invitation
                  </Button>
                </Stack>
              </Stack>
            </Grid>

            {/* Live preview panel */}
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  borderRadius: 4,
                  p: { xs: 2, sm: 2.5 },
                  background: 'rgba(255,255,255,0.72)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid',
                  borderColor: alpha('#fff', 0.8),
                  boxShadow: `0 32px 80px ${alpha(SLATE, 0.14)}, inset 0 1px 0 ${alpha('#fff', 0.9)}`,
                  '@media (prefers-reduced-motion: no-preference)': {
                    animation: 'landingFloat 8s ease-in-out infinite',
                  },
                  '@keyframes landingFloat': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-6px)' },
                  },
                }}
              >
                {/* Mock nav tabs */}
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    mb: 2,
                    p: 0.5,
                    borderRadius: 2.5,
                    bgcolor: alpha(SLATE, 0.06),
                    overflowX: 'auto',
                  }}
                  role="tablist"
                  aria-label="Platform core tabs"
                >
                  {PILLARS.map((p) => {
                    const selected = p.id === activePillar;
                    return (
                      <Box
                        key={p.id}
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setActivePillar(p.id)}
                        onKeyDown={(e) => handlePillarKeyDown(e, p.id)}
                        sx={{
                          px: 1.5,
                          py: 0.85,
                          borderRadius: 2,
                          cursor: 'pointer',
                          flexShrink: 0,
                          fontSize: '0.8rem',
                          fontWeight: selected ? 700 : 500,
                          color: selected ? '#fff' : SLATE,
                          bgcolor: selected ? p.accent : 'transparent',
                          transition: 'background-color 0.2s, color 0.2s',
                          outline: 'none',
                          '&:focus-visible': {
                            boxShadow: `0 0 0 2px ${p.accent}`,
                          },
                        }}
                      >
                        {p.navLabel}
                      </Box>
                    );
                  })}
                </Stack>

                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 0.5, color: pillar.accent, fontFamily: FONT_DISPLAY }}
                >
                  {pillar.headline}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                  {pillar.description}
                </Typography>
                <PillarPreview pillar={pillar} />
              </Box>
            </Grid>
          </Grid>

          {/* Four pillar cards */}
          <Box sx={{ mb: { xs: 5, md: 7 } }}>
            <Typography
              component="h2"
              sx={{
                fontFamily: FONT_DISPLAY,
                fontWeight: 700,
                fontSize: { xs: '1.65rem', md: '2rem' },
                letterSpacing: '-0.02em',
                mb: 0.75,
                textAlign: { xs: 'left', md: 'center' },
              }}
            >
              The core of your PECC workflow
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 640, mx: { md: 'auto' }, mb: 3.5, textAlign: { xs: 'left', md: 'center' }, lineHeight: 1.6 }}
            >
              Everything else supports these four areas. Click a pillar to preview it above{isMobile ? '' : ' on the right'}.
            </Typography>

            <Grid container spacing={2}>
              {PILLARS.map((p) => {
                const selected = p.id === activePillar;
                return (
                  <Grid item xs={12} sm={6} key={p.id}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setActivePillar(p.id)}
                      aria-pressed={selected}
                      sx={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selected ? alpha(p.accent, 0.45) : alpha(SLATE, 0.12),
                        borderRadius: 3,
                        p: 2.5,
                        bgcolor: selected ? alpha(p.accent, 0.06) : 'rgba(255,255,255,0.65)',
                        backdropFilter: 'blur(8px)',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        boxShadow: selected ? `0 16px 40px ${alpha(p.accent, 0.12)}` : 'none',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: `0 12px 32px ${alpha(SLATE, 0.1)}`,
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${p.accent}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 48,
                              height: 48,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: alpha(p.accent, 0.12),
                              color: p.accent,
                            }}
                          >
                            {p.icon}
                          </Box>
                          <Box>
                            <Typography variant="overline" sx={{ color: p.accent, fontWeight: 700, letterSpacing: '0.08em' }}>
                              {p.navLabel}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, fontFamily: FONT_DISPLAY }}>
                              {p.title}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                          {p.description}
                        </Typography>
                        <Stack spacing={0.75}>
                          {p.bullets.map((b) => (
                            <Stack key={b} direction="row" spacing={1} alignItems="flex-start">
                              <CheckIcon sx={{ fontSize: 18, color: p.accent, mt: 0.15 }} />
                              <Typography variant="body2">{b}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Stack>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* CTA band — full width within page */}
          <Box
            sx={{
              borderRadius: 4,
              px: { xs: 3, md: 5 },
              py: { xs: 4, md: 5 },
              textAlign: 'center',
              background: `linear-gradient(135deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`,
              color: '#fff',
              boxShadow: `0 24px 60px ${alpha(SLATE, 0.3)}`,
            }}
          >
            <Typography
              variant="h4"
              sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, mb: 1.5, letterSpacing: '-0.02em' }}
            >
              Ready to track, close gaps, and measure progress?
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.88, maxWidth: 560, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
              Sign in to continue your hospital&apos;s readiness work. New users need an invitation from an ImPACTS
              program administrator.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
              <Button
                size="large"
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{ bgcolor: '#fff', color: SLATE_DARK, fontWeight: 700, '&:hover': { bgcolor: alpha('#fff', 0.92) } }}
              >
                Sign in
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate('/register')}
                sx={{ borderColor: alpha('#fff', 0.5), color: '#fff', fontWeight: 600, '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}
              >
                Request an invitation
              </Button>
            </Stack>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', textAlign: 'center', mt: 4, maxWidth: 720, mx: 'auto', lineHeight: 1.55 }}
          >
            Do not enter Protected Health Information (PHI) or real patient data. Free-text fields are screened for
            common HIPAA identifiers. For educational and pediatric readiness purposes only.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
