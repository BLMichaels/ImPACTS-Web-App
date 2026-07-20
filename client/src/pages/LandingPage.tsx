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

const SLATE = '#455a64';
const SLATE_DARK = '#2f3e46';

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
    text: 'The PECC Support Tool is for pediatric emergency readiness improvement and coordination — not a clinical record or EHR.',
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
                bgcolor: 'rgba(255,255,255,0.85)',
                border: '1px solid',
                borderColor: alpha(tab.accent, 0.15),
              }}
            >
              <Chip label={row.type} size="small" sx={{ bgcolor: alpha(tab.accent, 0.12), color: tab.accent, fontWeight: 600 }} />
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
                borderColor: alpha(tab.accent, 0.15),
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
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(tab.accent, 0.08), border: '1px solid', borderColor: alpha(tab.accent, 0.2) }}>
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
                bgcolor: 'rgba(255,255,255,0.85)',
                border: '1px solid',
                borderColor: alpha(tab.accent, 0.15),
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
                  borderColor: alpha(tab.accent, 0.15),
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
  const [activeTab, setActiveTab] = useState<CoreTabId>('activities');

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
        overflow: 'hidden',
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
                fontWeight: 600,
                fontSize: '1rem',
                boxShadow: `0 4px 16px ${alpha(SLATE, 0.2)}`,
              }}
              aria-hidden
            >
              P
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
                PECC Support Tool
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                From the ImPACTS program
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
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.1rem', sm: '2.75rem', md: '3.25rem' },
                    lineHeight: { xs: 1.12, md: 1.08 },
                    maxWidth: 540,
                  }}
                >
                  Track work. Close gaps. Learn with peers. See your progress.
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ maxWidth: 520, fontSize: { xs: '1rem', md: '1.0625rem' }, lineHeight: 1.65 }}
                >
                  The PECC Support Tool is organized around Activities, Gap Closure, Cohorts, and Snapshot — the four
                  areas that support pediatric emergency care readiness work at your hospital.
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
                  boxShadow: `0 24px 64px ${alpha(SLATE, 0.12)}, inset 0 1px 0 ${alpha('#fff', 0.9)}`,
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    mb: 2,
                    p: 0.5,
                    borderRadius: 2,
                    bgcolor: alpha(SLATE, 0.06),
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
                          px: 1.5,
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
                          '&:focus-visible': {
                            boxShadow: `0 0 0 2px ${t.accent}`,
                          },
                        }}
                      >
                        {t.navLabel}
                      </Box>
                    );
                  })}
                </Stack>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: tab.accent }}>
                  {tab.headline}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.55 }}>
                  {tab.description}
                </Typography>
                <TabPreview tab={tab} />
              </Box>
            </Grid>
          </Grid>

          {/* Core tab cards */}
          <Box sx={{ mb: { xs: 5, md: 7 } }}>
            <Typography
              component="h2"
              variant="h3"
              sx={{
                mb: 0.75,
                textAlign: { xs: 'left', md: 'center' },
              }}
            >
              How the PECC Support Tool is organized
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 640, mx: { md: 'auto' }, mb: 3.5, textAlign: { xs: 'left', md: 'center' }, lineHeight: 1.6 }}
            >
              Select a tab in the preview{isMobile ? '' : ' on the right'} or choose a section below to learn what each area is for.
            </Typography>

            <Grid container spacing={2}>
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
                        textAlign: 'left',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selected ? alpha(t.accent, 0.45) : alpha(SLATE, 0.12),
                        borderRadius: 3,
                        p: 2.5,
                        bgcolor: selected ? alpha(t.accent, 0.06) : 'rgba(255,255,255,0.65)',
                        backdropFilter: 'blur(8px)',
                        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                        boxShadow: selected ? `0 12px 32px ${alpha(t.accent, 0.1)}` : 'none',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: `0 8px 24px ${alpha(SLATE, 0.08)}`,
                        },
                        '&:focus-visible': {
                          outline: `2px solid ${t.accent}`,
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: 1.5,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: alpha(t.accent, 0.12),
                              color: t.accent,
                            }}
                          >
                            {t.icon}
                          </Box>
                          <Box>
                            <Typography variant="overline" sx={{ color: t.accent, fontWeight: 600, letterSpacing: '0.04em' }}>
                              {t.navLabel}
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
                              {t.title}
                            </Typography>
                          </Box>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
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
          </Box>

          {/* Security & data use */}
          <Box
            sx={{
              mb: { xs: 5, md: 7 },
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(SLATE, 0.12),
              bgcolor: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <ShieldIcon sx={{ color: SLATE, fontSize: 22 }} />
              <Typography component="h2" variant="h5" sx={{ fontWeight: 600 }}>
                Security &amp; appropriate use
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 720, lineHeight: 1.6 }}>
              The PECC Support Tool is designed for quality-improvement and readiness work. Treat it like any other
              program tool: no real patient data, and only share what you would put in a de-identified QI report.
            </Typography>
            <Grid container spacing={2}>
              {SECURITY_NOTES.map((note) => (
                <Grid item xs={12} sm={6} key={note.title}>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        mt: 0.25,
                        color: SLATE,
                        flexShrink: 0,
                        width: 36,
                        height: 36,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: alpha(SLATE, 0.08),
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

          {/* CTA band */}
          <Box
            sx={{
              borderRadius: 3,
              px: { xs: 3, md: 5 },
              py: { xs: 4, md: 5 },
              textAlign: 'center',
              background: `linear-gradient(135deg, ${SLATE} 0%, ${SLATE_DARK} 100%)`,
              color: '#fff',
              boxShadow: `0 16px 48px ${alpha(SLATE, 0.22)}`,
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 600, mb: 1.5 }}>
              The PECC Support Tool is ready when you are
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
            sx={{ display: 'block', textAlign: 'center', mt: 3, maxWidth: 720, mx: 'auto', lineHeight: 1.55 }}
          >
            Screening is heuristic and does not guarantee detection of all PHI. You remain responsible for never
            entering real patient data. See Terms of Service after sign-in.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
