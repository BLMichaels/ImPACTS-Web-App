import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Avatar,
  Paper,
  Tooltip,
  Badge,
  Divider
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Campaign as AnnouncementIcon,
  Forum as DiscussionIcon,
  Group as GroupIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { 
  Cohort, 
  CohortAnnouncement, 
  CohortDiscussionTopic, 
  CohortMember,
  UserRole 
} from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { useTabVisibility } from '../../hooks/usePermissions';
import AnnouncementList from './AnnouncementList';
import DiscussionTopicList from './DiscussionTopicList';
import DiscussionTopicView from './DiscussionTopicView';
import MemberList from './MemberList';
import ScormPackagesSection from '../ScormPackagesSection';

interface CohortDetailProps {
  cohort: Cohort;
  onBack: () => void;
  onEdit?: () => void;
  canManage: boolean;
  canAnnounce: boolean;
  canInvite: boolean;
}

const CohortDetail: React.FC<CohortDetailProps> = ({
  cohort,
  onBack,
  onEdit,
  canManage,
  canAnnounce,
  canInvite
}) => {
  const { userProfile, userRole } = useUserProfile();
  const isPECC = userRole === UserRole.PECC;
  const isMentor = userRole === UserRole.MENTOR;
  const isManager = userRole === UserRole.MANAGER;
  const useStackedLayout = isPECC || isMentor; // PECC and Mentor: single page stacked (no Members tab)
  const useManagerStackedTabs = isManager; // Manager: Announcements + Discussions stacked on one tab, Members on second tab
  const [tabValue, setTabValue] = useState(0);
  
  // Check tab visibility permissions
  const showAnnouncementsTab = useTabVisibility('announcements', cohort.id);
  const showDiscussionsTab = useTabVisibility('discussions', cohort.id);
  const showMembersTab = useTabVisibility('members', cohort.id);
  const [announcements, setAnnouncements] = useState<CohortAnnouncement[]>([]);
  const [topics, setTopics] = useState<CohortDiscussionTopic[]>([]);
  const [members, setMembers] = useState<CohortMember[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<CohortDiscussionTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [unreadDiscussions, setUnreadDiscussions] = useState(0);

  // Only show announcements that are still visible (no visible_until or visible_until >= today)
  const visibleAnnouncements = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return announcements.filter(a => !a.visible_until || a.visible_until >= today);
  }, [announcements]);

  // Load cohort data
  const loadData = useCallback(async () => {
    if (!cohort.id) return;
    setLoading(true);

    try {
      // Load announcements with author info
      const { data: announcementsData } = await supabase
        .from('cohort_announcements')
        .select(`
          *,
          author:created_by(id, first_name, last_name)
        `)
        .eq('cohort_id', cohort.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      // Load discussion topics with author and last replier info
      const { data: topicsData } = await supabase
        .from('cohort_discussion_topics')
        .select(`
          *,
          author:created_by(id, first_name, last_name, role),
          last_replier:last_reply_by(id, first_name, last_name)
        `)
        .eq('cohort_id', cohort.id)
        .order('is_pinned', { ascending: false })
        .order('last_reply_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      // Load members with user info (skip for PECC & Mentor - they don't see the Members list)
      // Include both cohort_members (active) and cohort_managers so Managers, Mentors, PECCs, and Admins all show
      let membersData: CohortMember[] | null = null;
      if (userProfile?.role !== UserRole.PECC && userProfile?.role !== UserRole.MENTOR) {
        const [membersRes, managersRes] = await Promise.all([
          supabase
            .from('cohort_members')
            .select(`
              *,
              user:user_id(id, first_name, last_name, email, role)
            `)
            .eq('cohort_id', cohort.id)
            .eq('status', 'active')
            .order('added_at', { ascending: false }),
          supabase
            .from('cohort_managers')
            .select(`
              manager_id,
              assigned_at,
              manager:manager_id(id, first_name, last_name, email, role)
            `)
            .eq('cohort_id', cohort.id)
        ]);
        const fromMembers = (membersRes.data || []) as CohortMember[];
        const memberUserIds = new Set(fromMembers.map(m => m.user_id));
        const fromManagers = (managersRes.data || []).map((cm: any) => {
          const manager = Array.isArray(cm.manager) ? cm.manager[0] : cm.manager;
          if (!manager || memberUserIds.has(manager.id)) return null;
          memberUserIds.add(manager.id);
          return {
            id: `manager-${cm.manager_id}`,
            cohort_id: cohort.id,
            user_id: cm.manager_id,
            added_by: null,
            status: 'active' as const,
            added_at: cm.assigned_at || new Date().toISOString(),
            user: { id: manager.id, first_name: manager.first_name, last_name: manager.last_name, email: manager.email, role: manager.role }
          } as CohortMember;
        }).filter(Boolean) as CohortMember[];
        membersData = [...fromMembers, ...fromManagers];
      }

      // Load read status
      if (userProfile?.id) {
        const { data: readStatus } = await supabase
          .from('cohort_read_status')
          .select('*')
          .eq('cohort_id', cohort.id)
          .eq('user_id', userProfile.id)
          .maybeSingle();

        if (readStatus) {
          // Count unread announcements
          const unreadAnns = (announcementsData || []).filter(
            a => !readStatus.last_read_announcements || 
                 new Date(a.created_at) > new Date(readStatus.last_read_announcements)
          ).length;
          setUnreadAnnouncements(unreadAnns);

          // Count unread discussions
          const unreadDiscs = (topicsData || []).filter(
            t => {
              const topicTime = t.last_reply_at || t.created_at;
              return !readStatus.last_read_discussions || 
                     new Date(topicTime) > new Date(readStatus.last_read_discussions);
            }
          ).length;
          setUnreadDiscussions(unreadDiscs);
        } else {
          setUnreadAnnouncements(announcementsData?.length || 0);
          setUnreadDiscussions(topicsData?.length || 0);
        }
      }

      setAnnouncements(announcementsData || []);
      setTopics(topicsData || []);
      setMembers(membersData || []);
    } catch (error) {
      console.error('Error loading cohort data:', error);
    } finally {
      setLoading(false);
    }
  }, [cohort.id, userProfile?.id, userProfile?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mark announcements as read when viewing that tab
  const handleTabChange = async (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    
    if (!userProfile?.id) return;

    try {
      if (newValue === 0 && unreadAnnouncements > 0) {
        // Mark announcements as read
        await supabase
          .from('cohort_read_status')
          .upsert({
            user_id: userProfile.id,
            cohort_id: cohort.id,
            last_read_announcements: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,cohort_id' });
        setUnreadAnnouncements(0);
      } else if (newValue === 1 && unreadDiscussions > 0) {
        // Mark discussions as read
        await supabase
          .from('cohort_read_status')
          .upsert({
            user_id: userProfile.id,
            cohort_id: cohort.id,
            last_read_discussions: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,cohort_id' });
        setUnreadDiscussions(0);
      }
    } catch (error) {
      console.error('Error updating read status:', error);
    }
  };

  const handleAnnouncementCreated = (announcement: CohortAnnouncement) => {
    setAnnouncements(prev => [announcement, ...prev]);
  };

  const handleAnnouncementDeleted = (announcementId: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  const handleTopicCreated = (topic: CohortDiscussionTopic) => {
    setTopics(prev => [topic, ...prev]);
  };

  const handleTopicDeleted = (topicId: string) => {
    setTopics(prev => prev.filter(t => t.id !== topicId));
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(null);
    }
  };

  const handleTopicClick = (topic: CohortDiscussionTopic) => {
    setSelectedTopic(topic);
  };

  const handleMarkDiscussionAsRead = async () => {
    if (!userProfile?.id || unreadDiscussions === 0) return;
    
    try {
      await supabase
        .from('cohort_read_status')
        .upsert({
          user_id: userProfile.id,
          cohort_id: cohort.id,
          last_read_discussions: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,cohort_id' });
      setUnreadDiscussions(0);
    } catch (error) {
      console.error('Error marking discussion as read:', error);
    }
  };

  const handleMemberAdded = (member: CohortMember) => {
    setMembers(prev => [member, ...prev]);
  };

  const handleMemberRemoved = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  // If viewing a specific topic
  if (selectedTopic) {
    return (
      <DiscussionTopicView
        topic={selectedTopic}
        cohortId={cohort.id}
        onBack={() => setSelectedTopic(null)}
        canModerate={canManage}
        canReply={true}
        onMarkAsRead={handleMarkDiscussionAsRead}
      />
    );
  }

  return (
    <Box>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <IconButton onClick={onBack} sx={{ mt: -0.5 }}>
            <BackIcon />
          </IconButton>
          
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main', 
              width: 56, 
              height: 56,
              fontSize: '1.5rem'
            }}
          >
            {cohort.name.charAt(0).toUpperCase()}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {cohort.name}
              </Typography>
              {cohort.program_id && (
                <Chip label={cohort.program_id} size="small" variant="outlined" />
              )}
              {!cohort.is_active && (
                <Chip label="Inactive" size="small" color="error" />
              )}
            </Box>
            {cohort.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {cohort.description}
              </Typography>
            )}
            {!useStackedLayout && (
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>

          {canManage && onEdit && (
            <Tooltip title="Edit Cohort">
              <IconButton onClick={onEdit}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>

      {/* PECC & Mentor: stacked Announcements + Discussions (no tabs, no Members) */}
      {useStackedLayout ? (
        <Box>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AnnouncementIcon fontSize="small" /> Announcements
          </Typography>
          <AnnouncementList
            cohortId={cohort.id}
            announcements={visibleAnnouncements}
            canPost={canAnnounce}
            canModerate={canManage}
            onAnnouncementCreated={handleAnnouncementCreated}
            onAnnouncementDeleted={handleAnnouncementDeleted}
            loading={loading}
          />
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <DiscussionIcon fontSize="small" /> Discussions
          </Typography>
          <DiscussionTopicList
            cohortId={cohort.id}
            topics={topics}
            onTopicClick={handleTopicClick}
            onTopicCreated={handleTopicCreated}
            onTopicDeleted={handleTopicDeleted}
            loading={loading}
            canManage={canManage}
            canPost={true}
          />
          <Divider sx={{ my: 4 }} />
          <ScormPackagesSection title="Cohort learning modules" placement="cohort" cohortId={cohort.id} />
        </Box>
      ) : useManagerStackedTabs ? (
        <>
          {/* Manager: Announcements & Discussions stacked on one tab, Members on second */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab
                icon={
                  <Badge badgeContent={(unreadAnnouncements || 0) + (unreadDiscussions || 0)} color="error" max={99}>
                    <AnnouncementIcon />
                  </Badge>
                }
                iconPosition="start"
                label="Announcements & Discussions"
              />
              {showMembersTab && (
                <Tab icon={<GroupIcon />} iconPosition="start" label="Members" />
              )}
            </Tabs>
          </Box>
          {tabValue === 0 ? (
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AnnouncementIcon fontSize="small" /> Announcements
              </Typography>
              <AnnouncementList
                cohortId={cohort.id}
                announcements={visibleAnnouncements}
                canPost={canAnnounce}
                canModerate={canManage}
                onAnnouncementCreated={handleAnnouncementCreated}
                onAnnouncementDeleted={handleAnnouncementDeleted}
                loading={loading}
              />
              <Divider sx={{ my: 4 }} />
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DiscussionIcon fontSize="small" /> Discussions
              </Typography>
              <DiscussionTopicList
                cohortId={cohort.id}
                topics={topics}
                onTopicClick={handleTopicClick}
                onTopicCreated={handleTopicCreated}
                onTopicDeleted={handleTopicDeleted}
                loading={loading}
                canManage={canManage}
                canPost={true}
              />
            </Box>
          ) : (
            <MemberList
              cohortId={cohort.id}
              members={members}
              canManage={canManage}
              canInvite={canInvite}
              onMemberAdded={handleMemberAdded}
              onMemberRemoved={handleMemberRemoved}
              loading={loading}
            />
          )}
        </>
      ) : (
        <>
          {/* Admin: separate tabs for Announcements, Discussions, Members */}
          {(showAnnouncementsTab || showDiscussionsTab || showMembersTab) && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                {showAnnouncementsTab && (
                  <Tab
                    icon={
                      <Badge badgeContent={unreadAnnouncements} color="error" max={99}>
                        <AnnouncementIcon />
                      </Badge>
                    }
                    iconPosition="start"
                    label="Announcements"
                  />
                )}
                {showDiscussionsTab && (
                  <Tab
                    icon={
                      <Badge badgeContent={unreadDiscussions} color="error" max={99}>
                        <DiscussionIcon />
                      </Badge>
                    }
                    iconPosition="start"
                    label="Discussions"
                  />
                )}
                {showMembersTab && (
                  <Tab icon={<GroupIcon />} iconPosition="start" label="Members" />
                )}
              </Tabs>
            </Box>
          )}

          {/* Tab Content */}
          {(() => {
            const visibleTabs = [
              showAnnouncementsTab ? 'announcements' : null,
              showDiscussionsTab ? 'discussions' : null,
              showMembersTab ? 'members' : null
            ].filter(Boolean);
            const activeTab = visibleTabs[tabValue];
            if (activeTab === 'announcements') {
              return (
                <AnnouncementList
                  cohortId={cohort.id}
                  announcements={visibleAnnouncements}
                  canPost={canAnnounce}
                  canModerate={canManage}
                  onAnnouncementCreated={handleAnnouncementCreated}
                  onAnnouncementDeleted={handleAnnouncementDeleted}
                  loading={loading}
                />
              );
            }
            if (activeTab === 'discussions') {
              return (
                <DiscussionTopicList
                  cohortId={cohort.id}
                  topics={topics}
                  onTopicClick={handleTopicClick}
                  onTopicCreated={handleTopicCreated}
                  onTopicDeleted={handleTopicDeleted}
                  loading={loading}
                  canManage={canManage}
                  canPost={true}
                />
              );
            }
            if (activeTab === 'members') {
              return (
                <MemberList
                  cohortId={cohort.id}
                  members={members}
                  canManage={canManage}
                  canInvite={canInvite}
                  onMemberAdded={handleMemberAdded}
                  onMemberRemoved={handleMemberRemoved}
                  loading={loading}
                />
              );
            }
            return null;
          })()}
          <Divider sx={{ my: 4 }} />
          <ScormPackagesSection title="Cohort learning modules" placement="cohort" cohortId={cohort.id} />
        </>
      )}
    </Box>
  );
};

export default CohortDetail;
