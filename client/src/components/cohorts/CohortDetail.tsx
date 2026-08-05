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
  MenuBook as ResourcesIcon,
  Settings as SettingsIcon,
  Timeline as SnapshotIcon
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
import CohortResourcesSection from './CohortResourcesSection';
import ScormPackagesSection from '../ScormPackagesSection';
import CohortSnapshotTab from './CohortSnapshotTab';
import { getUserData, setUserData } from '../../utils/userData';

interface CohortDetailProps {
  cohort: Cohort;
  onBack: () => void;
  onEdit?: () => void;
  canManage: boolean;
  canAnnounce: boolean;
  canInvite: boolean;
  canManageResources?: boolean;
}

const CohortDetail: React.FC<CohortDetailProps> = ({
  cohort,
  onBack,
  onEdit,
  canManage,
  canAnnounce,
  canInvite,
  canManageResources
}) => {
  const resourcesCanManage = canManageResources ?? canManage;
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
  const showSnapshotTab = userRole === UserRole.ADMIN;
  const [announcements, setAnnouncements] = useState<CohortAnnouncement[]>([]);
  const [topics, setTopics] = useState<CohortDiscussionTopic[]>([]);
  const [members, setMembers] = useState<CohortMember[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<CohortDiscussionTopic | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [unreadDiscussions, setUnreadDiscussions] = useState(0);
  const [unreadResources, setUnreadResources] = useState(0);

  const visibleTabs = useMemo(() => [
    showAnnouncementsTab ? 'announcements' : null,
    showDiscussionsTab ? 'discussions' : null,
    showMembersTab ? 'members' : null,
    showSnapshotTab ? 'snapshot' : null
  ].filter(Boolean) as string[], [showAnnouncementsTab, showDiscussionsTab, showMembersTab, showSnapshotTab]);

  // Only show announcements that are still visible (no visible_until or visible_until >= today)
  const visibleAnnouncements = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return announcements.filter(a => !a.visible_until || a.visible_until >= today);
  }, [announcements]);

  const markAnnouncementsAsRead = useCallback(async () => {
    if (!userProfile?.id || unreadAnnouncements === 0) return;
    try {
      await supabase
        .from('cohort_read_status')
        .upsert({
          user_id: userProfile.id,
          cohort_id: cohort.id,
          last_read_announcements: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,cohort_id' });
      setUnreadAnnouncements(0);
    } catch (error) {
      console.error('Error updating announcement read status:', error);
    }
  }, [cohort.id, unreadAnnouncements, userProfile?.id]);

  const markDiscussionsAsRead = useCallback(async () => {
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
      console.error('Error updating discussion read status:', error);
    }
  }, [cohort.id, unreadDiscussions, userProfile?.id]);

  const markResourcesAsRead = useCallback(async () => {
    if (!userProfile?.id) return;
    try {
      const map = (await getUserData<Record<string, string>>(userProfile.id, 'cohort_resources_last_read')) || {};
      map[cohort.id] = new Date().toISOString();
      await setUserData(userProfile.id, 'cohort_resources_last_read', map);
      setUnreadResources(0);
    } catch (error) {
      console.error('Error updating resource read status:', error);
    }
  }, [cohort.id, userProfile?.id]);

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
      // Include cohort_members (active), cohort_managers, AND pending invitations (no account yet) so CRM-assigned people all show
      let membersData: CohortMember[] | null = null;
      if (userProfile?.role !== UserRole.PECC && userProfile?.role !== UserRole.MENTOR) {
        const [membersRes, managersRes, pendingInvRes] = await Promise.all([
          supabase
            .from('cohort_members')
            .select(`
              *,
              user:user_id(id, first_name, last_name, email, role, manager_id, mentor_id, manager_id_for_pecc)
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
            .eq('cohort_id', cohort.id),
          supabase
            .from('invitations')
            .select('id, email')
            .eq('status', 'pending')
            .filter('cohort_ids', 'cs', `{${cohort.id}}`)
        ]);
        const fromMembers = (membersRes.data || []) as CohortMember[];
        const memberUserIds = new Set(fromMembers.map(m => m.user_id));
        const memberEmails = new Set(fromMembers.map(m => (m.user?.email || '').toLowerCase()).filter(Boolean));
        const fromManagers = (managersRes.data || []).map((cm: any) => {
          const manager = Array.isArray(cm.manager) ? cm.manager[0] : cm.manager;
          if (!manager || memberUserIds.has(manager.id)) return null;
          memberUserIds.add(manager.id);
          if (manager.email) memberEmails.add((manager.email as string).toLowerCase());
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
        const fromPending = (pendingInvRes.data || [])
          .filter((inv: { email?: string | null }) => inv.email && !memberEmails.has((inv.email as string).toLowerCase()))
          .map((inv: { id: string; email?: string | null }) => ({
            id: `pending-${inv.id}`,
            cohort_id: cohort.id,
            user_id: '',
            added_by: null,
            status: 'active' as const,
            added_at: new Date().toISOString(),
            user: {
              id: '',
              first_name: 'Pending',
              last_name: '',
              email: (inv.email || '').trim(),
              role: UserRole.PECC
            }
          })) as CohortMember[];
        membersData = [...fromMembers, ...fromManagers, ...fromPending];
      }

      // Load read status
      if (userProfile?.id) {
        const resourcesReadMap =
          (await getUserData<Record<string, string>>(userProfile.id, 'cohort_resources_last_read')) || {};
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
                 (new Date(a.created_at) > new Date(readStatus.last_read_announcements) &&
                  (!a.visible_until || a.visible_until >= new Date().toISOString().slice(0, 10)))
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
          setUnreadAnnouncements((announcementsData || []).filter(
            a => !a.visible_until || a.visible_until >= new Date().toISOString().slice(0, 10)
          ).length);
          setUnreadDiscussions(topicsData?.length || 0);
        }

        const { count: resourceCount } = await supabase
          .from('cohort_resources')
          .select('*', { count: 'exact', head: true })
          .eq('cohort_id', cohort.id);
        const lastReadResources = resourcesReadMap?.[cohort.id] || null;
        if (lastReadResources) {
          const { count } = await supabase
            .from('cohort_resources')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id)
            .gt('created_at', lastReadResources);
          setUnreadResources(count || 0);
        } else {
          setUnreadResources(resourceCount || 0);
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

  // Mark notifications as read when viewing their section.
  const handleTabChange = async (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (!userProfile?.id) return;

    if (useManagerStackedTabs) {
      if (newValue === 0) {
        await markAnnouncementsAsRead();
        await markDiscussionsAsRead();
        await markResourcesAsRead();
      } else {
        // Members/Snapshot tab
        if (showMembersTab && newValue === 1) loadData();
      }
      return;
    }

    const activeTab = visibleTabs[newValue];
    if (activeTab === 'members') loadData();
    if (activeTab === 'announcements') await markAnnouncementsAsRead();
    if (activeTab === 'discussions') await markDiscussionsAsRead();
    if (activeTab === 'snapshot') await markResourcesAsRead();
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

  const handleTopicUpdated = (topicId: string, updates: Partial<CohortDiscussionTopic>) => {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, ...updates } : t));
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleMarkDiscussionAsRead = async () => {
    await markDiscussionsAsRead();
  };

  useEffect(() => {
    if (!userProfile?.id || loading) return;
    void markResourcesAsRead();
    if (useStackedLayout) {
      void markAnnouncementsAsRead();
      void markDiscussionsAsRead();
      return;
    }
    if (useManagerStackedTabs && tabValue === 0) {
      void markAnnouncementsAsRead();
      void markDiscussionsAsRead();
    }
  }, [
    loading,
    tabValue,
    useStackedLayout,
    useManagerStackedTabs,
    userProfile?.id,
    markAnnouncementsAsRead,
    markDiscussionsAsRead,
    markResourcesAsRead
  ]);

  const handleMemberAdded = (member: CohortMember) => {
    setMembers(prev => [member, ...prev]);
    // Rely on optimistic update so new member stays visible (refetch can overwrite before insert is visible)
  };

  const handleMemberRemoved = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    loadData();
  };

  const handleMemberUpdated = (memberId: string, updates: Partial<CohortMember>) => {
    setMembers(prev => prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m)));
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
        onTopicUpdated={handleTopicUpdated}
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
            onTopicUpdated={handleTopicUpdated}
            loading={loading}
            canManage={canManage}
            canPost={true}
          />
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ResourcesIcon fontSize="small" /> Cohort Resources &amp; Education
          </Typography>
          <CohortResourcesSection cohortId={cohort.id} canManage={resourcesCanManage} loading={loading} />
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
                  <Badge badgeContent={(unreadAnnouncements || 0) + (unreadDiscussions || 0) + (unreadResources || 0)} color="error" max={99}>
                    <AnnouncementIcon />
                  </Badge>
                }
                iconPosition="start"
                label="Announcements & Discussions"
              />
              {showMembersTab && (
                <Tab icon={<GroupIcon />} iconPosition="start" label="Members" />
              )}
              {showSnapshotTab && (
                <Tab icon={<SnapshotIcon />} iconPosition="start" label="Snapshot" />
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
                onTopicUpdated={handleTopicUpdated}
                loading={loading}
                canManage={canManage}
                canPost={true}
              />
              <Divider sx={{ my: 4 }} />
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ResourcesIcon fontSize="small" /> Cohort Resources &amp; Education
              </Typography>
              <CohortResourcesSection cohortId={cohort.id} canManage={resourcesCanManage} loading={loading} />
            </Box>
          ) : (tabValue === 1 && showMembersTab) ? (
            <MemberList
              cohortId={cohort.id}
              members={members}
              canManage={canManage}
              canInvite={canInvite}
              onMemberAdded={handleMemberAdded}
              onMemberRemoved={handleMemberRemoved}
              onMemberUpdated={handleMemberUpdated}
              loading={loading}
            />
          ) : (tabValue === 1 && !showMembersTab && showSnapshotTab) || (tabValue === 2 && showSnapshotTab) ? (
            <CohortSnapshotTab cohortId={cohort.id} cohortName={cohort.name} />
          ) : null}
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
                {showSnapshotTab && (
                  <Tab icon={<SnapshotIcon />} iconPosition="start" label="Snapshot" />
                )}
              </Tabs>
            </Box>
          )}

          {/* Tab Content */}
          {(() => {
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
                  onTopicUpdated={handleTopicUpdated}
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
                  onMemberUpdated={handleMemberUpdated}
                  loading={loading}
                />
              );
            }
            if (activeTab === 'snapshot') {
              return (
                <CohortSnapshotTab cohortId={cohort.id} cohortName={cohort.name} />
              );
            }
            return null;
          })()}
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ResourcesIcon fontSize="small" /> Cohort Resources &amp; Education
          </Typography>
          <CohortResourcesSection cohortId={cohort.id} canManage={resourcesCanManage} loading={loading} />
          <Divider sx={{ my: 4 }} />
          <ScormPackagesSection title="Cohort learning modules" placement="cohort" cohortId={cohort.id} />
        </>
      )}
    </Box>
  );
};

export default CohortDetail;
