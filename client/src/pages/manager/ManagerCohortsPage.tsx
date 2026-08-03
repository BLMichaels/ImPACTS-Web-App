import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Paper,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { Cohort, CohortWithStats } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { CohortCard, CohortDetail, PendingInvitationsPanel } from '../../components/cohorts';
import { getUserData } from '../../utils/userData';
import { useNavigate } from 'react-router-dom';
import {
  AdminPageShell,
  AdminHero,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';

const ManagerCohortsPage: React.FC = () => {
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState<CohortWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  
  // Create/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_id: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCohorts = useCallback(async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    setError(null);

    try {
      const resourcesReadMap =
        (await getUserData<Record<string, string>>(userProfile.id, 'cohort_resources_last_read')) || {};

      // Get cohorts the manager manages
      const { data: managedCohorts, error: managerError } = await supabase
        .from('cohort_managers')
        .select('cohort_id')
        .eq('manager_id', userProfile.id);

      if (managerError) throw managerError;

      // Also get cohorts the manager is a member of
      const { data: memberCohorts, error: memberError } = await supabase
        .from('cohort_members')
        .select('cohort_id')
        .eq('user_id', userProfile.id)
        .eq('status', 'active');

      if (memberError) throw memberError;

      // Combine and deduplicate
      const managedIds = managedCohorts?.map(m => m.cohort_id) || [];
      const memberIds = memberCohorts?.map(m => m.cohort_id) || [];
      const allCohortIds = [...new Set([...managedIds, ...memberIds])];

      if (allCohortIds.length === 0) {
        setCohorts([]);
        setLoading(false);
        return;
      }

      // Get cohort details
      const { data: cohortsData, error: cohortsError } = await supabase
        .from('cohorts')
        .select('*')
        .in('id', allCohortIds)
        .order('name');

      if (cohortsError) throw cohortsError;

      // Get stats for each cohort
      const cohortsWithStats: CohortWithStats[] = await Promise.all(
        (cohortsData || []).map(async (cohort) => {
          const isManager = managedIds.includes(cohort.id);

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

          const { count: resourceCount } = await supabase
            .from('cohort_resources')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id);

          const { data: readStatus } = await supabase
            .from('cohort_read_status')
            .select('last_read_announcements,last_read_discussions')
            .eq('cohort_id', cohort.id)
            .eq('user_id', userProfile.id)
            .maybeSingle();

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

          const { data: lastResource } = await supabase
            .from('cohort_resources')
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
            last_activity_at: lastActivityAt,
            is_manager: isManager
          };
        })
      );

      // Sort by manager status first, then by last activity
      cohortsWithStats.sort((a, b) => {
        if (a.is_manager !== b.is_manager) {
          return a.is_manager ? -1 : 1;
        }
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

  const handleOpenCreateDialog = () => {
    setEditingCohort(null);
    setFormData({
      name: '',
      description: '',
      program_id: '',
      is_active: true
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleOpenEditDialog = () => {
    if (!selectedCohort) return;
    setEditingCohort(selectedCohort);
    setFormData({
      name: selectedCohort.name,
      description: selectedCohort.description || '',
      program_id: selectedCohort.program_id || '',
      is_active: selectedCohort.is_active
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCohort(null);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('Cohort name is required');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingCohort) {
        // Update existing cohort
        const { error: updateError } = await supabase
          .from('cohorts')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            program_id: formData.program_id.trim() || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCohort.id);

        if (updateError) throw updateError;

        // Update selected cohort
        setSelectedCohort(prev => prev ? {
          ...prev,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          program_id: formData.program_id.trim() || null,
          is_active: formData.is_active
        } : null);
      } else {
        // Create new cohort
        const { data: newCohort, error: insertError } = await supabase
          .from('cohorts')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            program_id: formData.program_id.trim() || null,
            is_active: formData.is_active,
            created_by: userProfile?.id
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Assign current manager to the cohort
        await supabase
          .from('cohort_managers')
          .insert({
            cohort_id: newCohort.id,
            manager_id: userProfile?.id,
            assigned_by: userProfile?.id
          });

        // Also add manager as a member
        await supabase
          .from('cohort_members')
          .insert({
            cohort_id: newCohort.id,
            user_id: userProfile?.id,
            added_by: userProfile?.id,
            status: 'active'
          });
      }

      handleCloseDialog();
      loadCohorts();
    } catch (err: any) {
      console.error('Error saving cohort:', err);
      setFormError(err.message || 'Failed to save cohort');
    } finally {
      setSaving(false);
    }
  };

  const filteredCohorts = cohorts.filter(cohort =>
    cohort.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.program_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get cohort IDs that this manager manages for invitation filtering
  const managedCohortIds = cohorts.filter(c => c.is_manager).map(c => c.id);

  if (selectedCohort) {
    // Assigned in cohort_managers — edit cohort, invite, moderate, etc.
    const isCohortManager = cohorts.find(c => c.id === selectedCohort.id)?.is_manager ?? false;
    // This page is Manager-role only; list includes cohorts they manage or are a member of.
    // Posting announcements should not require cohort_managers row (members-only managers still need to communicate).
    const canPostAnnouncements = true;

    return (
      <AdminPageShell>
        <CohortDetail
          cohort={selectedCohort}
          onBack={() => {
            setSelectedCohort(null);
            loadCohorts();
          }}
          onEdit={isCohortManager ? handleOpenEditDialog : undefined}
          canManage={isCohortManager}
          canAnnounce={canPostAnnouncements}
          canInvite={isCohortManager}
          canManageResources={true}
        />

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Cohort</DialogTitle>
          <DialogContent>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            <TextField
              autoFocus
              label="Cohort Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              sx={{ mt: 1, mb: 2 }}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Program (optional)"
              fullWidth
              value={formData.program_id}
              onChange={(e) => setFormData(prev => ({ ...prev, program_id: e.target.value }))}
              placeholder="e.g., 2025 Spring Cohort"
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={saving || !formData.name.trim()}>
              {saving ? <CircularProgress size={24} /> : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <AdminHero
        overline="Manager"
        title="Cohorts"
        description="Manage cohorts you lead, post announcements, and moderate discussions. Reports can filter to these cohorts only."
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" onClick={() => navigate('/manager/reports')}>
              Reports
            </Button>
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
              Create Cohort
            </Button>
          </Stack>
        }
      />

      {/* Pending Invitations Panel */}
      {managedCohortIds.length > 0 && (
        <PendingInvitationsPanel
          cohortIds={managedCohortIds}
          onInvitationProcessed={() => loadCohorts()}
        />
      )}

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
        <Paper elevation={0} sx={{ ...adminSectionShellSx, p: 6, textAlign: 'center' }}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
            {searchQuery ? 'No cohorts match your search' : 'No cohorts yet'}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Create your first cohort to start organizing your team'
            }
          </Typography>
          {!searchQuery && (
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
              Create Cohort
            </Button>
          )}
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen && !editingCohort} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create Cohort</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Cohort Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Midwest PECC Cohort 2025"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="What is this cohort for?"
            sx={{ mb: 2 }}
          />
          <TextField
            label="Program (optional)"
            fullWidth
            value={formData.program_id}
            onChange={(e) => setFormData(prev => ({ ...prev, program_id: e.target.value }))}
            placeholder="Link to a specific program"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !formData.name.trim()}>
            {saving ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </AdminPageShell>
  );
};

export default ManagerCohortsPage;
