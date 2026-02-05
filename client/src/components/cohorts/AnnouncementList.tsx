import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  PushPin as PinIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Campaign as AnnouncementIcon
} from '@mui/icons-material';
import { CohortAnnouncement } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface AnnouncementListProps {
  cohortId: string;
  announcements: CohortAnnouncement[];
  canPost: boolean;
  onAnnouncementCreated: (announcement: CohortAnnouncement) => void;
  onAnnouncementDeleted: (announcementId: string) => void;
  loading: boolean;
}

const AnnouncementList: React.FC<AnnouncementListProps> = ({
  cohortId,
  announcements,
  canPost,
  onAnnouncementCreated,
  onAnnouncementDeleted,
  loading
}) => {
  const { userProfile } = useUserProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CohortAnnouncement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; announcement: CohortAnnouncement } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenDialog = (announcement?: CohortAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setTitle(announcement.title);
      setContent(announcement.content);
      setIsPinned(announcement.is_pinned);
    } else {
      setEditingAnnouncement(null);
      setTitle('');
      setContent('');
      setIsPinned(false);
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAnnouncement(null);
    setTitle('');
    setContent('');
    setIsPinned(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingAnnouncement) {
        // Update existing
        const { data, error: updateError } = await supabase
          .from('cohort_announcements')
          .update({
            title: title.trim(),
            content: content.trim(),
            is_pinned: isPinned,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingAnnouncement.id)
          .select(`
            *,
            author:created_by(id, first_name, last_name)
          `)
          .single();

        if (updateError) throw updateError;
        
        // Update in list
        onAnnouncementCreated(data);
      } else {
        // Create new
        const { data, error: insertError } = await supabase
          .from('cohort_announcements')
          .insert({
            cohort_id: cohortId,
            title: title.trim(),
            content: content.trim(),
            is_pinned: isPinned,
            created_by: userProfile?.id
          })
          .select(`
            *,
            author:created_by(id, first_name, last_name)
          `)
          .single();

        if (insertError) throw insertError;
        onAnnouncementCreated(data);
      }

      handleCloseDialog();
    } catch (err: any) {
      console.error('Error saving announcement:', err);
      setError(err.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, announcement: CohortAnnouncement) => {
    setMenuAnchor({ el: event.currentTarget, announcement });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEdit = () => {
    if (menuAnchor) {
      handleOpenDialog(menuAnchor.announcement);
      handleMenuClose();
    }
  };

  const handleDeleteClick = () => {
    if (menuAnchor) {
      setDeletingId(menuAnchor.announcement.id);
      setDeleteConfirmOpen(true);
      handleMenuClose();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      const { error } = await supabase
        .from('cohort_announcements')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;
      onAnnouncementDeleted(deletingId);
    } catch (err: any) {
      console.error('Error deleting announcement:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with create button */}
      {canPost && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Post Announcement
          </Button>
        </Box>
      )}

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <AnnouncementIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No announcements yet
          </Typography>
          {canPost && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Post the first announcement to keep your cohort informed
            </Typography>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {announcements.map((announcement) => (
            <Paper 
              key={announcement.id} 
              sx={{ 
                p: 3,
                borderLeft: announcement.is_pinned ? 4 : 0,
                borderColor: 'primary.main'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {announcement.is_pinned && (
                      <Chip 
                        icon={<PinIcon />} 
                        label="Pinned" 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    )}
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {announcement.title}
                    </Typography>
                  </Box>
                  
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      whiteSpace: 'pre-wrap',
                      mb: 2
                    }}
                  >
                    {announcement.content}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    Posted by {announcement.author?.first_name} {announcement.author?.last_name}
                    {' • '}
                    {format(new Date(announcement.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                    {announcement.updated_at !== announcement.created_at && ' (edited)'}
                  </Typography>
                </Box>

                {canPost && (
                  <IconButton 
                    size="small"
                    onClick={(e) => handleMenuOpen(e, announcement)}
                  >
                    <MoreIcon />
                  </IconButton>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAnnouncement ? 'Edit Announcement' : 'Post Announcement'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Content"
            fullWidth
            multiline
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
            }
            label="Pin this announcement"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? <CircularProgress size={24} /> : editingAnnouncement ? 'Save' : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Announcement</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this announcement? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnouncementList;
