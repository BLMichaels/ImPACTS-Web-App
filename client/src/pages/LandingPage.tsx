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
  ShieldOutlined as ShieldIcon,
  NoPhotographyOutlined as NoPhiIcon,
  VerifiedUserOutlined as ScreeningIcon,
  MailOutline as InviteIcon,
} from '@mui/icons-material';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

const INK = '#141414';
const SLATE = '#455a64';
const SLATE_DARK = '#2f3e46';
const TEAL = '#0e7490';
const TEAL_DARK = '#3d5560';

type CoreTabId = 'activities' | 'gaps' | 'cohorts' | 'snapshot';

interface CoreTab {
  id: CoreTabId;
  navLabel: string;
  title: string;
  headline: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  bullets: string[];
}

const CORE_TABS: CoreTab[] = [
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
    navLabel: 'Gap Closures',
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
];

const HERO_STATS = [
  { value: '4', label: 'Core areas' },
  { value: '1', label: 'Unified dashboard' },
  { value: 'QI', label: 'Purpose-built' },
];

const SECURITY_NOTES = [
  {
    icon: <NoPhiIcon sx={{ fontSize: 22 }} />,
    title: 'No patient PHI',
    text: 'Do not enter real patient names, MRNs, dates of birth, or other protected health information. Staff and colleague names are allowed.',
  },
  {
    icon: <ScreeningIcon sx={{ fontSize: 22 }} />,
    title: 'Free-text screening',
    text: 'Notes and narrative fields are checked for common HIPAA Safe Harbor identifiers. High-risk matches are blocked before save.',
  },
  {
    icon: <InviteIcon sx={{ fontSize: 22 }} />,
    title: 'Invitation-only access',
    text: 'Accounts are created through ImPACTS program administrators — not open public registration.',
  },
  {
    icon: <ShieldIcon sx={{ fontSize: 22 }} />,
    title: 'Readiness & QI purpose',
    text: 'The PECC Support Tool is for pediatric emergency care readiness improvement and coordination — not a clinical record or EHR.',
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

function TabPreview({ tab }: { tab: CoreTab }) {
  switch (tab.id) {
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
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: alpha(tab.accent, 0.12),
              }}
            >
              <Chip label={row.type} size="small" sx={{ bgcolor: alpha(tab.accent, 0.1), color: tab.accent, fontWeight: 600 }} />
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
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: alpha(tab.accent, 0.12),
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75, lineHeight: 1.35 }}>
                {row.action}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Owner: ${row.owner}`} size="small" variant="outlined" />
                <Chip label={row.status} size="small" sx={{ bgcolor: alpha(tab.accent, 0.1), color: tab.accent }} />
              </Stack>
            </Box>
          ))}
        </Stack>
      );
    case 'cohorts':
      return (
        <Stack spacing={1.25}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(tab.accent, 0.06), border: '1px solid', borderColor: alpha(tab.accent, 0.15) }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: tab.accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: alpha(tab.accent, 0.12),
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
                  bgcolor: '#fff',
                  border: '1px solid',
                  borderColor: alpha(tab.accent, 0.12),
                  textAlign: 'center',
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700, color: tab.accent, lineHeight: 1 }}>
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
  const [activeTab, setActiveTab] = useState<CoreTabId>('snapshot');

  const tab = CORE_TABS.find((t) => t.id === activeTab) ?? CORE_TABS[0];

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, id: CoreTabId) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveTab(id);
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
        bgcolor: '#fafbfc',
        color: INK,
      }}
    >
      {/* Subtle ambient gradient */}
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 60% 40% at 50% -5%, ${alpha(TEAL, 0.08)} 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 90% 20%, ${alpha('#93c5fd', 0.06)} 0%, transparent 50%)
          `,
        }}
      />

      <Box sx={{ position: 'relative', zIndex: 1 }}>
        {/* Floating nav */}
        <Box
          component="header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            px: { xs: 2, sm: 3, lg: 5 },
            py: { xs: 1.5, md: 2 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: alpha('#fafbfc', 0.85),
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid',
            borderColor: alpha(SLATE, 0.08),
          }}
        >
          <Box
            component="img"
            src="/impacts-logo.png"
            alt="ImPACTS"
            sx={{ height: { xs: 38, sm: 44 }, width: 'auto', display: 'block' }}
          />
          <Button
            variant="contained"
            onClick={() => navigate('/login')}
            sx={{
              borderRadius: 999,
              px: 2.5,
              py: 0.85,
              fontWeight: 600,
              fontSize: '0.875rem',
              bgcolor: INK,
              boxShadow: 'none',
              '&:hover': { bgcolor: SLATE_DARK, boxShadow: 'none' },
            }}
          >
            Sign in
          </Button>
        </Box>

        {/* Hero — Mobbin-style centered display */}
        <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 6, md: 10 }, pb: { xs: 4, md: 6 }, textAlign: 'center' }}>
          <Stack spacing={{ xs: 2.5, md: 3 }} alignItems="center">
            {/* Product specimen badge */}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1.25,
                px: 2,
                py: 1,
                borderRadius: 3,
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: alpha(SLATE, 0.1),
                boxShadow: `0 2px 12px ${alpha(SLATE, 0.06)}`,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  background: `linear-gradient(135deg, ${TEAL_DARK} 0%, ${TEAL} 100%)`,
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                P
              </Box>
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2, color: INK }}>
                  PECC Support Tool
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                  From the ImPACTS program
                </Typography>
              </Box>
            </Box>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '2.5rem', sm: '3.25rem', md: '4rem' },
                fontWeight: 650,
                lineHeight: { xs: 1.08, md: 1.02 },
                letterSpacing: { xs: '-0.02em', md: '-0.03em' },
                maxWidth: 720,
                color: INK,
              }}
            >
              Pediatric emergency readiness, organized.
            </Typography>

            <Typography
              variant="body1"
              sx={{
                maxWidth: 560,
                fontSize: { xs: '1.0625rem', md: '1.25rem' },
                lineHeight: 1.55,
                color: alpha(INK, 0.62),
                fontWeight: 400,
              }}
            >
              Track your work, close assessment gaps, collaborate with peers, and show leadership the progress you&apos;re making — all in one place.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 0.5 }}>
              <Button
                size="large"
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/login')}
                sx={{
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.35,
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  bgcolor: INK,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: SLATE_DARK, boxShadow: 'none' },
                }}
              >
                Enter platform
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate('/register')}
                sx={{
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.35,
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  borderColor: alpha(INK, 0.2),
                  color: INK,
                  '&:hover': { borderColor: INK, bgcolor: alpha(INK, 0.03) },
                }}
              >
                Request an invitation
              </Button>
            </Stack>

            {/* Trust stats */}
            <Stack
              direction="row"
              spacing={{ xs: 3, md: 5 }}
              sx={{ pt: { xs: 2, md: 3 } }}
              divider={
                <Box sx={{ width: '1px', bgcolor: alpha(SLATE, 0.15), alignSelf: 'stretch', my: 0.5 }} />
              }
            >
              {HERO_STATS.map((stat) => (
                <Box key={stat.label} sx={{ textAlign: 'center' }}>
                  <Typography
                    sx={{
                      fontSize: { xs: '1.75rem', md: '2rem' },
                      fontWeight: 650,
                      letterSpacing: '-0.02em',
                      lineHeight: 1,
                      color: INK,
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, mt: 0.5, display: 'block' }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Container>

        {/* Product preview specimen — hero centerpiece */}
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, lg: 5 }, pb: { xs: 8, md: 12 } }}>
          <Box
            sx={{
              borderRadius: { xs: 3, md: 4 },
              p: { xs: 2, sm: 2.5, md: 3 },
              bgcolor: '#fff',
              border: '1px solid',
              borderColor: alpha(SLATE, 0.1),
              boxShadow: `
                0 0 0 1px ${alpha('#fff', 0.5)},
                0 24px 80px ${alpha(SLATE, 0.1)},
                0 8px 24px ${alpha(SLATE, 0.06)}
              `,
            }}
          >
            {/* Browser chrome */}
            <Stack direction="row" spacing={0.75} sx={{ mb: 2, px: 0.5 }}>
              {[alpha('#ef4444', 0.7), alpha('#eab308', 0.7), alpha('#22c55e', 0.7)].map((c, i) => (
                <Box key={i} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
              ))}
              <Box
                sx={{
                  flex: 1,
                  mx: 2,
                  height: 10,
                  borderRadius: 999,
                  bgcolor: alpha(SLATE, 0.06),
                  maxWidth: 280,
                  alignSelf: 'center',
                }}
              />
            </Stack>

            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                mb: 2.5,
                p: 0.5,
                borderRadius: 2,
                bgcolor: alpha(SLATE, 0.04),
                overflowX: 'auto',
              }}
              role="tablist"
              aria-label="Platform tabs"
            >
              {CORE_TABS.map((t) => {
                const selected = t.id === activeTab;
                return (
                  <Box
                    key={t.id}
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveTab(t.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, t.id)}
                    sx={{
                      px: 2,
                      py: 0.85,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontSize: '0.8125rem',
                      fontWeight: selected ? 600 : 500,
                      color: selected ? '#fff' : SLATE,
                      bgcolor: selected ? t.accent : 'transparent',
                      transition: 'background-color 0.15s, color 0.15s',
                      outline: 'none',
                      '&:focus-visible': { boxShadow: `0 0 0 2px ${t.accent}` },
                    }}
                  >
                    {t.navLabel}
                  </Box>
                );
              })}
            </Stack>

            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid item xs={12} md={5}>
                <Typography variant="overline" sx={{ color: tab.accent, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {tab.navLabel}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 650, mb: 1, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                  {tab.headline}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {tab.description}
                </Typography>
              </Grid>
              <Grid item xs={12} md={7}>
                <TabPreview tab={tab} />
              </Grid>
            </Grid>
          </Box>
        </Container>

        {/* Features section */}
        <Box sx={{ bgcolor: '#fff', borderTop: '1px solid', borderColor: alpha(SLATE, 0.08) }}>
          <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 8, md: 10 } }}>
            <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '1.75rem', md: '2.25rem' },
                  fontWeight: 650,
                  letterSpacing: '-0.02em',
                  mb: 1.5,
                  color: INK,
                }}
              >
                Four areas. One readiness workflow.
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 560, mx: 'auto', lineHeight: 1.6, fontSize: '1.0625rem' }}
              >
                {isMobile
                  ? 'Tap a section below to preview it above.'
                  : 'Select a tab in the preview or explore each area below.'}
              </Typography>
            </Box>

            <Grid container spacing={2.5}>
              {CORE_TABS.map((t) => {
                const selected = t.id === activeTab;
                return (
                  <Grid item xs={12} sm={6} key={t.id}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setActiveTab(t.id)}
                      aria-pressed={selected}
                      sx={{
                        width: '100%',
                        height: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selected ? alpha(t.accent, 0.35) : alpha(SLATE, 0.1),
                        borderRadius: 3,
                        p: 3,
                        bgcolor: selected ? alpha(t.accent, 0.03) : '#fff',
                        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                        boxShadow: selected ? `0 8px 32px ${alpha(t.accent, 0.08)}` : 'none',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: `0 12px 40px ${alpha(SLATE, 0.08)}`,
                          borderColor: alpha(t.accent, 0.25),
                        },
                        '&:focus-visible': { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
                      }}
                    >
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: alpha(t.accent, 0.1),
                              color: t.accent,
                            }}
                          >
                            {t.icon}
                          </Box>
                          <Box>
                            <Typography variant="overline" sx={{ color: t.accent, fontWeight: 700, letterSpacing: '0.05em' }}>
                              {t.navLabel}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 650, lineHeight: 1.25 }}>
                              {t.title}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          {t.description}
                        </Typography>
                        <Stack spacing={0.75}>
                          {t.bullets.map((b) => (
                            <Stack key={b} direction="row" spacing={1} alignItems="flex-start">
                              <CheckIcon sx={{ fontSize: 18, color: t.accent, mt: 0.15 }} />
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
          </Container>
        </Box>

        {/* Security */}
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 8, md: 10 } }}>
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(SLATE, 0.1),
              bgcolor: '#fff',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(TEAL, 0.1),
                  color: TEAL_DARK,
                }}
              >
                <ShieldIcon sx={{ fontSize: 22 }} />
              </Box>
              <Box>
                <Typography component="h2" variant="h5" sx={{ fontWeight: 650, letterSpacing: '-0.01em' }}>
                  Security &amp; appropriate use
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Built for quality improvement — not clinical documentation.
                </Typography>
              </Box>
            </Stack>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {SECURITY_NOTES.map((note) => (
                <Grid item xs={12} sm={6} key={note.title}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        mt: 0.25,
                        color: TEAL_DARK,
                        flexShrink: 0,
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(SLATE, 0.06),
                      }}
                      aria-hidden
                    >
                      {note.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.25 }}>
                        {note.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                        {note.text}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>

        {/* CTA */}
        <Box sx={{ bgcolor: '#fff', borderTop: '1px solid', borderColor: alpha(SLATE, 0.08) }}>
          <Container maxWidth="md" sx={{ px: { xs: 2, sm: 3 }, py: { xs: 8, md: 10 }, textAlign: 'center' }}>
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                fontWeight: 650,
                letterSpacing: '-0.02em',
                mb: 1.5,
                color: INK,
              }}
            >
              Ready to get started?
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 480, mx: 'auto', mb: 3.5, lineHeight: 1.6, fontSize: '1.0625rem' }}
            >
              Sign in to continue your hospital&apos;s readiness work. New users need an invitation from an ImPACTS program administrator.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
              <Button
                size="large"
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.35,
                  fontWeight: 600,
                  bgcolor: INK,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: SLATE_DARK, boxShadow: 'none' },
                }}
              >
                Sign in
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate('/register')}
                sx={{
                  borderRadius: 999,
                  px: 3.5,
                  py: 1.35,
                  fontWeight: 600,
                  borderColor: alpha(INK, 0.2),
                  color: INK,
                  '&:hover': { borderColor: INK, bgcolor: alpha(INK, 0.03) },
                }}
              >
                Request an invitation
              </Button>
            </Stack>
          </Container>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center', py: 4, px: 2, maxWidth: 720, mx: 'auto', lineHeight: 1.55 }}
        >
          Screening is heuristic and does not guarantee detection of all PHI. You remain responsible for never
          entering real patient data. See Terms of Service after sign-in.
        </Typography>
      </Box>
    </Box>
  );
};

export default LandingPage;
