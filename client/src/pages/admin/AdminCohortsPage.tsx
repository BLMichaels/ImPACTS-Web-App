import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
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
  Autocomplete,
  Chip,
  Avatar,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Group as GroupIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreIcon,
  PersonAdd as AssignIcon,
  ViewList as ListIcon,
  GridView as GridIcon
} from '@mui/icons-material';
import { Cohort, CohortWithStats, CohortManager, User, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { CohortCard, CohortDetail, PendingInvitationsPanel } from '../../components/cohorts';
import { format } from 'date-fns';

const AdminCohortsPage: React.FC = () => {
  const { userProfile } = useUserProfile();
  const [cohorts, setCohorts] = useState<CohortWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showInactive, setShowInactive] = useState(false);
  
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

  // Assign managers dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningCohort, setAssigningCohort] = useState<Cohort | null>(null);
  const [managers, setManagers] = useState<User[]>([]);
  const [assignedManagers, setAssignedManagers] = useState<CohortManager[]>([]);
  const [selectedManager, setSelectedManager] = useState<User | null>(null);
  const [loadingManagers, setLoadingManagers] = useState(false);

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingCohort, setDeletingCohort] = useState<Cohort | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; cohort: Cohort } | null>(null);

  const loadCohorts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get all cohorts (admins can see everything)
      let query = supabase
        .from('cohorts')
        .select('*')
        .order('name');

      if (!showInactive) {
        query = query.eq('is_active', true);
      }

      const { data: cohortsData, error: cohortsError } = await query;
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

          // Get last activity
          const { data: lastAnnouncement } = await supabase
            .from('cohort_announcements')
            .select('created_at')
            .eq('cohort_id', cohort.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { data: lastTopic } = await supabase
            .from('cohort_discussion_topics')
            .select('last_reply_at, created_at')
            .eq('cohort_id', cohort.id)
            .order('last_reply_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .single();

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
            last_activity_at: lastActivityAt,
            is_manager: true // Admins have full access
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
  }, [showInactive]);

  useEffect(() => {
    loadCohorts();
  }, [loadCohorts]);

  const loadManagers = useCallback(async () => {
    if (!assigningCohort) return;

    setLoadingManagers(true);
    try {
      // Load all managers
      const { data: managersData, error: managersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .eq('role', 'manager')
        .eq('is_active', true)
        .order('first_name');

      if (managersError) throw managersError;
      setManagers(managersData || []);

      // Load assigned managers for this cohort
      const { data: assignedData, error: assignedError } = await supabase
        .from('cohort_managers')
        .select(`
          *,
          manager:manager_id(id, first_name, last_name, email)
        `)
        .eq('cohort_id', assigningCohort.id);

      if (assignedError) throw assignedError;
      setAssignedManagers(assignedData || []);
    } catch (err) {
      console.error('Error loading managers:', err);
    } finally {
      setLoadingManagers(false);
    }
  }, [assigningCohort]);

  useEffect(() => {
    if (assignDialogOpen) {
      loadManagers();
    }
  }, [assignDialogOpen, loadManagers]);

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

  const handleOpenEditDialog = (cohort: Cohort) => {
    setEditingCohort(cohort);
    setFormData({
      name: cohort.name,
      description: cohort.description || '',
      program_id: cohort.program_id || '',
      is_active: cohort.is_active
    });
    setFormError(null);
    setDialogOpen(true);
    setMenuAnchor(null);
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

        // Update selected cohort if viewing
        if (selectedCohort?.id === editingCohort.id) {
          setSelectedCohort(prev => prev ? {
            ...prev,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            program_id: formData.program_id.trim() || null,
            is_active: formData.is_active
          } : null);
        }
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

        // Add admin as a member
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

  const handleOpenAssignDialog = (cohort: Cohort) => {
    setAssigningCohort(cohort);
    setSelectedManager(null);
    setAssignDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleCloseAssignDialog = () => {
    setAssignDialogOpen(false);
    setAssigningCohort(null);
    setSelectedManager(null);
  };

  const handleAssignManager = async () => {
    if (!selectedManager || !assigningCohort) return;

    try {
      const { error } = await supabase
        .from('cohort_managers')
        .insert({
          cohort_id: assigningCohort.id,
          manager_id: selectedManager.id,
          assigned_by: userProfile?.id
        });

      if (error) {
        if (error.code === '23505') {
          // Already assigned
          return;
        }
        throw error;
      }

      // Also add as a member if not already
      await supabase
        .from('cohort_members')
        .upsert({
          cohort_id: assigningCohort.id,
          user_id: selectedManager.id,
          added_by: userProfile?.id,
          status: 'active'
        }, { onConflict: 'cohort_id,user_id' });

      setSelectedManager(null);
      loadManagers();
    } catch (err) {
      console.error('Error assigning manager:', err);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    if (!assigningCohort) return;

    try {
      const { error } = await supabase
        .from('cohort_managers')
        .delete()
        .eq('cohort_id', assigningCohort.id)
        .eq('manager_id', managerId);

      if (error) throw error;
      loadManagers();
    } catch (err) {
      console.error('Error removing manager:', err);
    }
  };

  const handleDeleteClick = (cohort: Cohort) => {
    setDeletingCohort(cohort);
    setDeleteConfirmOpen(true);
    setMenuAnchor(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCohort) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('cohorts')
        .delete()
        .eq('id', deletingCohort.id);

      if (error) throw error;
      loadCohorts();
    } catch (err) {
      console.error('Error deleting cohort:', err);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setDeletingCohort(null);
    }
  };

  const filteredCohorts = cohorts.filter(cohort =>
    cohort.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cohort.program_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get all cohort IDs for pending invitations
  const allCohortIds = cohorts.map(c => c.id);

  if (selectedCohort) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <CohortDetail
          cohort={selectedCohort}
          onBack={() => {
            setSelectedCohort(null);
            loadCohorts();
          }}
          onEdit={() => handleOpenEditDialog(selectedCohort)}
          canManage={true}
          canAnnounce={true}
          canInvite={true}
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
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Cohorts Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage cohorts, assign managers, and oversee all cohort activities
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreateDialog}
        >
          Create Cohort
        </Button>
      </Box>

      {/* Pending Invitations Panel */}
      {allCohortIds.length > 0 && (
        <PendingInvitationsPanel
          cohortIds={allCohortIds}
          onInvitationProcessed={() => loadCohorts()}
        />
      )}

      {/* Filters and View Toggle */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
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
          sx={{ minWidth: 300 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
          }
          label="Show inactive"
        />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Grid view">
            <IconButton 
              onClick={() => setViewMode('grid')}
              color={viewMode === 'grid' ? 'primary' : 'default'}
            >
              <GridIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="List view">
            <IconButton 
              onClick={() => setViewMode('list')}
              color={viewMode === 'list' ? 'primary' : 'default'}
            >
              <ListIcon />
            </IconButton>
          </Tooltip>
        </Box>
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
            {searchQuery ? 'No cohorts match your search' : 'No cohorts yet'}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Create your first cohort to start organizing users'
            }
          </Typography>
          {!searchQuery && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
              Create Cohort
            </Button>
          )}
        </Paper>
      ) : viewMode === 'grid' ? (
        /* Grid view */
        <Grid container spacing={3}>
          {filteredCohorts.map((cohort) => (
            <Grid item xs={12} sm={6} md={4} key={cohort.id}>
              <Box sx={{ position: 'relative' }}>
                <CohortCard
                  cohort={cohort}
                  onClick={() => setSelectedCohort(cohort)}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAnchor({ el: e.currentTarget, cohort });
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'background.paper' }}
                >
                  <MoreIcon />
                </IconButton>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        /* List view */
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Program</TableCell>
                <TableCell align="right">Members</TableCell>
                <TableCell align="right">Announcements</TableCell>
                <TableCell align="right">Topics</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCohorts.map((cohort) => (
                <TableRow 
                  key={cohort.id} 
                  hover 
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setSelectedCohort(cohort)}
                >
                  <TableCell>
                    <Typography variant="subtitle2">{cohort.name}</Typography>
                    {cohort.description && (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                        {cohort.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{cohort.program_id || '-'}</TableCell>
                  <TableCell align="right">{cohort.member_count}</TableCell>
                  <TableCell align="right">{cohort.announcement_count}</TableCell>
                  <TableCell align="right">{cohort.topic_count}</TableCell>
                  <TableCell>
                    <Chip 
                      label={cohort.is_active ? 'Active' : 'Inactive'} 
                      size="small"
                      color={cohort.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{format(new Date(cohort.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, cohort })}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => menuAnchor && handleOpenEditDialog(menuAnchor.cohort)}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && handleOpenAssignDialog(menuAnchor.cohort)}>
          <ListItemIcon><AssignIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Manage Managers</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => menuAnchor && handleDeleteClick(menuAnchor.cohort)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

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

      {/* Assign Managers Dialog */}
      <Dialog open={assignDialogOpen} onClose={handleCloseAssignDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Managers - {assigningCohort?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Assign managers who can manage this cohort, post announcements, and approve invitations.
          </Typography>

          {/* Add manager */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <Autocomplete
              options={managers.filter(m => !assignedManagers.some(am => am.manager_id === m.id))}
              value={selectedManager}
              onChange={(_, value) => setSelectedManager(value)}
              getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
              loading={loadingManagers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Manager"
                  placeholder="Search managers..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingManagers ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                      {option.first_name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body1">
                        {option.first_name} {option.last_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {option.email}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleAssignManager}
              disabled={!selectedManager}
            >
              Add
            </Button>
          </Box>

          {/* Assigned managers list */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Assigned Managers ({assignedManagers.length})
          </Typography>
          {assignedManagers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No managers assigned yet
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {assignedManagers.map((assignment) => (
                <Paper key={assignment.id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    {assignment.manager?.first_name?.charAt(0) || '?'}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1">
                      {assignment.manager?.first_name} {assignment.manager?.last_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {assignment.manager?.email}
                    </Typography>
                  </Box>
                  <Tooltip title="Remove manager">
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveManager(assignment.manager_id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Cohort</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deletingCohort?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            This will permanently delete all announcements, discussions, and member associations.
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminCohortsPage;
