import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Paper,
  Alert,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { Cohort, CohortWithStats, UserRole } from '../types/database';
import { useUserProfile } from '../context/UserProfileContext';
import { supabase } from '../supabase';
import { CohortCard, CohortDetail } from '../components/cohorts';
import { getUserData } from '../utils/userData';

const sectionShellSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  overflow: 'hidden',
} as const;

const CohortsPage: React.FC = () => {
  const { userProfile, userRole } = useUserProfile();
  const [cohorts, setCohorts] = useState<CohortWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);

  const loadCohorts = useCallback(async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    setError(null);

    try {
      const resourcesReadMap =
        (await getUserData<Record<string, string>>(userProfile.id, 'cohort_resources_last_read')) || {};

      // Get cohorts the user is a member of
      const { data: memberships, error: memberError } = await supabase
        .from('cohort_members')
        .select('cohort_id')
        .eq('user_id', userProfile.id)
        .eq('status', 'active');

      if (memberError) throw memberError;

      if (!memberships || memberships.length === 0) {
        setCohorts([]);
        setLoading(false);
        return;
      }

      const cohortIds = memberships.map(m => m.cohort_id);

      // Get cohort details
      const { data: cohortsData, error: cohortsError } = await supabase
        .from('cohorts')
        .select('*')
        .in('id', cohortIds)
        .eq('is_active', true)
        .order('name');

      if (cohortsError) throw cohortsError;

      // Get stats for each cohort
      const cohortsWithStats: CohortWithStats[] = await Promise.all(
        (cohortsData || []).map(async (cohort) => {
          // Member count
          const { count: memberCount } = await supabase
            .from('cohort_members')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id)
            .eq('status', 'active');

          // Announcement count
          const { count: announcementCount } = await supabase
            .from('cohort_announcements')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id);

          // Topic count
          const { count: topicCount } = await supabase
            .from('cohort_discussion_topics')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id);

          // Resources count
          const { count: resourceCount } = await supabase
            .from('cohort_resources')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id);

          // Get read status for unread counts
          const { data: readStatus } = await supabase
            .from('cohort_read_status')
            .select('*')
            .eq('cohort_id', cohort.id)
            .eq('user_id', userProfile.id)
            .maybeSingle();

          // Get unread announcements (filter active window in JS to avoid noisy HEAD/or 400s).
          let unreadAnnouncements = 0;
          const { data: announcementRows } = await supabase
            .from('cohort_announcements')
            .select('created_at')
            .eq('cohort_id', cohort.id);
          const activeAnnouncements = announcementRows || [];
          if (readStatus?.last_read_announcements) {
            unreadAnnouncements = activeAnnouncements.filter(
              (row) => new Date(row.created_at) > new Date(readStatus.last_read_announcements)
            ).length;
          } else {
            unreadAnnouncements = activeAnnouncements.length;
          }

          // Get unread discussions
          let unreadDiscussions = 0;
          if (readStatus?.last_read_discussions) {
            const { count } = await supabase
              .from('cohort_discussion_topics')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', cohort.id)
              .or(`created_at.gt.${readStatus.last_read_discussions},last_reply_at.gt.${readStatus.last_read_discussions}`);
            unreadDiscussions = count || 0;
          } else {
            unreadDiscussions = topicCount || 0;
          }

          // Get unread resources
          let unreadResources = 0;
          const lastReadResources = resourcesReadMap?.[cohort.id] || null;
          if (lastReadResources) {
            const { count } = await supabase
              .from('cohort_resources')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', cohort.id)
              .gt('created_at', lastReadResources);
            unreadResources = count || 0;
          } else {
            unreadResources = resourceCount || 0;
          }

          // Get last activity
          const { data: lastAnnouncement } = await supabase
            .from('cohort_announcements')
            .select('created_at')
            .eq('cohort_id', cohort.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: lastTopic } = await supabase
            .from('cohort_discussion_topics')
            .select('last_reply_at, created_at')
            .eq('cohort_id', cohort.id)
            .order('last_reply_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

          const { data: lastResource } = await supabase
            .from('cohort_resources')
            .select('created_at')
            .eq('cohort_id', cohort.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastActivityDates = [
            lastAnnouncement?.created_at,
            lastTopic?.last_reply_at || lastTopic?.created_at,
            lastResource?.created_at
          ].filter(Boolean) as string[];

          const lastActivityAt = lastActivityDates.length > 0
            ? new Date(Math.max(...lastActivityDates.map(d => new Date(d).getTime()))).toISOString()
            : undefined;

          return {
            ...cohort,
            member_count: memberCount || 0,
            announcement_count: announcementCount || 0,
            topic_count: topicCount || 0,
            resource_count: resourceCount || 0,
            unread_announcements: unreadAnnouncements,
            unread_discussions: unreadDiscussions,
            unread_resources: unreadResources,
            last_activity_at: lastActivityAt
          };
        })
      );

      // Sort by last activity
      cohortsWithStats.sort((a, b) => {
        if (!a.last_activity_at && !b.last_activity_at) return 0;
        if (!a.last_activity_at) return 1;
        if (!b.last_activity_at) return -1;
        return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
      });

      setCohorts(cohortsWithStats);
    } catch (err: any) {
      console.error('Error loading cohorts:', err);
      setError(err.message || 'Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    loadCohorts();
  }, [loadCohorts]);

  const filteredCohorts = cohorts.filter(cohort =>
    cohort.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.program_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Determine permissions based on role
  const canInvite = userRole === UserRole.MENTOR;
  const canManage = false; // PECCs and Mentors cannot manage cohorts from this page
  const canAnnounce = userRole === UserRole.MANAGER; // Managers can post announcements

  if (selectedCohort) {
    return (
      <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 4, md: 5 } }}>
        <Container
          maxWidth={false}
          sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4, lg: 5 }, width: '100%' }}
        >
          <CohortDetail
            cohort={selectedCohort}
            onBack={() => {
              setSelectedCohort(null);
              loadCohorts(); // Refresh stats when returning to list
            }}
            canManage={canManage}
            canAnnounce={canAnnounce}
            canInvite={canInvite}
          />
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 4, md: 5 } }}>
      <Container
        maxWidth={false}
        sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4, lg: 5 }, width: '100%' }}
      >
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          {/* Hero */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.75 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: (t) =>
                `linear-gradient(120deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, ${t.palette.background.paper} 42%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
            }}
          >
            <Box sx={{ maxWidth: { md: 720 } }}>
              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
              >
                Peer learning
              </Typography>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  letterSpacing: -0.02,
                  mb: 0.75,
                  fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
                }}
              >
                Cohorts
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: { xs: '0.925rem', sm: '0.975rem' } }}>
                Connect with your peers, view announcements, and participate in discussions.
              </Typography>
            </Box>
          </Paper>

          {/* Search */}
          <Paper elevation={0} sx={sectionShellSx}>
            <Box
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: (t) => alpha(t.palette.secondary.main, 0.04),
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
              >
                Find a cohort
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'} you belong to
              </Typography>
            </Box>
            <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search cohorts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ maxWidth: 420 }}
              />
            </Box>
          </Paper>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress color="secondary" />
            </Box>
          ) : filteredCohorts.length === 0 ? (
            <Paper elevation={0} sx={{ ...sectionShellSx, px: { xs: 2, md: 2.5 }, py: 5, textAlign: 'center' }}>
              <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                {searchQuery ? 'No cohorts match your search' : "You're not part of any cohorts yet"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : "You'll be added to cohorts by a manager or admin"}
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {filteredCohorts.map((cohort) => (
                <Grid item xs={12} sm={6} md={4} key={cohort.id}>
                  <CohortCard
                    cohort={cohort}
                    onClick={() => setSelectedCohort(cohort)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default CohortsPage;
