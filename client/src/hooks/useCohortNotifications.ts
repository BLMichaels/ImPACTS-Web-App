import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useUserProfile } from '../context/UserProfileContext';

export const useCohortNotifications = () => {
  const { userProfile } = useUserProfile();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.id) {
      setUnreadCount(0);
      return;
    }

    const loadUnreadCount = async () => {
      try {
        // Get all cohorts user is a member of
        const { data: memberships } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .eq('user_id', userProfile.id)
          .eq('status', 'active');

        if (!memberships || memberships.length === 0) {
          setUnreadCount(0);
          return;
        }

        const cohortIds = memberships.map(m => m.cohort_id);
        let totalUnread = 0;

        // For each cohort, count unread announcements and discussions
        for (const cohortId of cohortIds) {
          // Get read status
          const { data: readStatus } = await supabase
            .from('cohort_read_status')
            .select('last_read_announcements, last_read_discussions')
            .eq('cohort_id', cohortId)
            .eq('user_id', userProfile.id)
            .single();

          // Count unread announcements
          let unreadAnns = 0;
          if (readStatus?.last_read_announcements) {
            const { count } = await supabase
              .from('cohort_announcements')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', cohortId)
              .gt('created_at', readStatus.last_read_announcements);
            unreadAnns = count || 0;
          } else {
            const { count } = await supabase
              .from('cohort_announcements')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', cohortId);
            unreadAnns = count || 0;
          }

          // Count unread discussions
          let unreadDiscs = 0;
          if (readStatus?.last_read_discussions) {
            const { data: topics } = await supabase
              .from('cohort_discussion_topics')
              .select('created_at, last_reply_at')
              .eq('cohort_id', cohortId);
            
            unreadDiscs = (topics || []).filter(t => {
              const topicTime = t.last_reply_at || t.created_at;
              return new Date(topicTime) > new Date(readStatus.last_read_discussions);
            }).length;
          } else {
            const { count } = await supabase
              .from('cohort_discussion_topics')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', cohortId);
            unreadDiscs = count || 0;
          }

          totalUnread += unreadAnns + unreadDiscs;
        }

        setUnreadCount(totalUnread);
      } catch (err) {
        console.error('Error loading unread count:', err);
      }
    };

    loadUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [userProfile?.id]);

  return unreadCount;
};
