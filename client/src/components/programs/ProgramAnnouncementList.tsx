import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Menu,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  PushPin as PinIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { ProgramAnnouncement } from '../../types/database';
import { formatDistanceToNow } from 'date-fns';

interface ProgramAnnouncementListProps {
  programId: string;
  canAnnounce: boolean;
}

export const ProgramAnnouncementList: React.FC<ProgramAnnouncementListProps> = ({
  programId,
  canAnnounce
}) => {
  const { userProfile } = useUserProfile();
  const [announcements, setAnnouncements] = useState<ProgramAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<ProgramAnnouncement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    is_pinned: false
  });
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; announcement: ProgramAnnouncement | null }>({
    open: false,
    announcement: null
  });
  const [deleting, setDeleting] = useState(false);

  // Menu
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement | null; announcement: ProgramAnnouncement | null }>({
    el: null,
    announcement: null
  });

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('program_announcements')
        .select(`
          *,
          author:users!created_by(id, first_name, last_name, role)
        `)
        .eq('program_id', programId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error loading announcements:', err);
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleOpenCreate = () => {
    setEditingAnnouncement(null);
    setAnnouncementForm({ title: '', content: '', is_pinned: false });
    setDialogOpen(true);
  };

  const handleOpenEdit = (announcement: ProgramAnnouncement) => {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      content: announcement.content,
      is_pinned: announcement.is_pinned
    });
    setDialogOpen(true);
    setMenuAnchor({ el: null, announcement: null });
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) return;

    try {
      setSaving(true);

      if (editingAnnouncement) {
        // Update existing
        const { error } = await supabase
          .from('program_announcements')
          .update({
            title: announcementForm.title.trim(),
            content: announcementForm.content.trim(),
            is_pinned: announcementForm.is_pinned,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAnnouncement.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('program_announcements')
          .insert({
            program_id: programId,
            title: announcementForm.title.trim(),
            content: announcementForm.content.trim(),
            is_pinned: announcementForm.is_pinned,
            created_by: userProfile?.id
          });

        if (error) throw error;
      }

      setDialogOpen(false);
      loadAnnouncements();
    } catch (err) {
      console.error('Error saving announcement:', err);
      setError('Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deleteDialog.announcement) return;

    try {
      setDeleting(true);

      const { error } = await supabase
        .from('program_announcements')
        .delete()
        .eq('id', deleteDialog.announcement.id);

      if (error) throw error;

      setDeleteDialog({ open: false, announcement: null });
      loadAnnouncements();
    } catch (err) {
      console.error('Error deleting announcement:', err);
      setError('Failed to delete announcement');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {canAnnounce && (
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreate}>
            New Announcement
          </Button>
        </Box>
      )}

      {announcements.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No announcements yet
          </Typography>
          {canAnnounce && (
            <Button 
              startIcon={<AddIcon />} 
              variant="text" 
              onClick={handleOpenCreate}
              sx={{ mt: 2 }}
            >
              Create the first announcement
            </Button>
          )}
        </Paper>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {announcement.is_pinned && (
                        <Chip 
                          icon={<PinIcon />} 
                          label="Pinned" 
                          size="small" 
                          color="primary"
                        />
                      )}
                      <Typography variant="h6" component="h3">
                        {announcement.title}
                      </Typography>
                    </Box>
                    <Typography 
                      variant="body1" 
                      color="text.primary"
                      sx={{ whiteSpace: 'pre-wrap', mb: 2 }}
                    >
                      {announcement.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Posted by {announcement.author?.first_name} {announcement.author?.last_name} •{' '}
                      {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                    </Typography>
                  </Box>
                  {canAnnounce && (
                    <IconButton 
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, announcement })}
                    >
                      <MoreIcon />
                    </IconButton>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor.el}
        open={Boolean(menuAnchor.el)}
        onClose={() => setMenuAnchor({ el: null, announcement: null })}
      >
        <MenuItem onClick={() => menuAnchor.announcement && handleOpenEdit(menuAnchor.announcement)}>
          <EditIcon sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setDeleteDialog({ open: true, announcement: menuAnchor.announcement });
            setMenuAnchor({ el: null, announcement: null });
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="normal"
            label="Title"
            fullWidth
            value={announcementForm.title}
            onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
          />
          <TextField
            margin="normal"
            label="Content"
            fullWidth
            multiline
            rows={4}
            value={announcementForm.content}
            onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
          />
          <FormControlLabel
            control={
              <Switch
                checked={announcementForm.is_pinned}
                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, is_pinned: e.target.checked }))}
              />
            }
            label="Pin this announcement"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveAnnouncement}
            disabled={!announcementForm.title.trim() || !announcementForm.content.trim() || saving}
          >
            {saving ? 'Saving...' : (editingAnnouncement ? 'Save Changes' : 'Post Announcement')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, announcement: null })}
      >
        <DialogTitle>Delete Announcement</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.announcement?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, announcement: null })}>Cancel</Button>
          <Button 
            color="error" 
            onClick={handleDeleteAnnouncement}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProgramAnnouncementList;
