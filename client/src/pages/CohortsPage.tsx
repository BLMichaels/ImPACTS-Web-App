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
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { Cohort, CohortWithStats, UserRole } from '../types/database';
import { useUserProfile } from '../context/UserProfileContext';
import { supabase } from '../supabase';
import { CohortCard, CohortDetail } from '../components/cohorts';

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

          // Get read status for unread counts
          const { data: readStatus } = await supabase
            .from('cohort_read_status')
            .select('*')
            .eq('cohort_id', cohort.id)
            .eq('user_id', userProfile.id)
            .maybeSingle();

          // Get unread announcements
          let unreadAnnouncements = 0;
          if (readStatus?.last_read_announcements) {
            const { count } = await supabase
              .from('cohort_announcements')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', cohort.id)
              .gt('created_at', readStatus.last_read_announcements);
            unreadAnnouncements = count || 0;
          } else {
            unreadAnnouncements = announcementCount || 0;
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

          const lastActivityDates = [
            lastAnnouncement?.created_at,
            lastTopic?.last_reply_at || lastTopic?.created_at
          ].filter(Boolean) as string[];

          const lastActivityAt = lastActivityDates.length > 0
            ? new Date(Math.max(...lastActivityDates.map(d => new Date(d).getTime()))).toISOString()
            : undefined;

          return {
            ...cohort,
            member_count: memberCount || 0,
            announcement_count: announcementCount || 0,
            topic_count: topicCount || 0,
            unread_announcements: unreadAnnouncements,
            unread_discussions: unreadDiscussions,
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
      <Container maxWidth="lg" sx={{ py: 4 }}>
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
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          My Cohorts
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Connect with your peers, view announcements, and participate in discussions
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
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
          sx={{ maxWidth: 400 }}
        />
      </Box>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading state */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredCohorts.length === 0 ? (
        /* Empty state */
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            {searchQuery ? 'No cohorts match your search' : 'You\'re not part of any cohorts yet'}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'You\'ll be added to cohorts by a manager or admin'
            }
          </Typography>
        </Paper>
      ) : (
        /* Cohorts grid */
        <Grid container spacing={3}>
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
    </Container>
  );
};

export default CohortsPage;
