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
import { usePhiGuard } from '../PhiGuard';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { getUserDisplayName } from '../../utils/displayName';
import { AnnouncementRichTextEditor } from '../common/AnnouncementRichTextEditor';
import { AnnouncementHtmlContent } from '../common/AnnouncementHtmlContent';
import {
  announcementHtmlIsEffectivelyEmpty,
  isLikelyAnnouncementHtml,
  plainTextToQuillHtml,
  sanitizeAnnouncementHtml
} from '../../utils/sanitizeAnnouncementHtml';

interface AnnouncementListProps {
  cohortId: string;
  announcements: CohortAnnouncement[];
  canPost: boolean;
  canModerate?: boolean; // Admins/Managers can delete any announcement
  onAnnouncementCreated: (announcement: CohortAnnouncement) => void;
  onAnnouncementDeleted: (announcementId: string) => void;
  loading: boolean;
}

const AnnouncementList: React.FC<AnnouncementListProps> = ({
  cohortId,
  announcements,
  canPost,
  canModerate = false,
  onAnnouncementCreated,
  onAnnouncementDeleted,
  loading
}) => {
  const { userProfile } = useUserProfile();
  const { runWithPhiGuard } = usePhiGuard();
  
  const canEditAnnouncement = (announcement: CohortAnnouncement) => {
    // Only the author can edit
    return announcement.created_by === userProfile?.id;
  };
  
  const canDeleteAnnouncement = (announcement: CohortAnnouncement) => {
    // Author or moderators (admin/manager) can delete
    return announcement.created_by === userProfile?.id || canModerate;
  };
  
  const showMenuForAnnouncement = (announcement: CohortAnnouncement) => {
    return canEditAnnouncement(announcement) || canDeleteAnnouncement(announcement);
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CohortAnnouncement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [visibleUntil, setVisibleUntil] = useState<string>(''); // YYYY-MM-DD or empty = no end date
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; announcement: CohortAnnouncement } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenDialog = (announcement?: CohortAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setTitle(announcement.title);
      const body = announcement.content;
      setContent(isLikelyAnnouncementHtml(body) ? body : plainTextToQuillHtml(body));
      setIsPinned(announcement.is_pinned);
      setVisibleUntil(announcement.visible_until ? announcement.visible_until.slice(0, 10) : '');
    } else {
      setEditingAnnouncement(null);
      setTitle('');
      setContent('');
      setIsPinned(false);
      setVisibleUntil('');
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
    setVisibleUntil('');
    setError(null);
  };

  const handleSave = async () => {
    const safeContent = sanitizeAnnouncementHtml(content);
    if (!title.trim() || announcementHtmlIsEffectivelyEmpty(safeContent)) {
      setError('Title and content are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const plain = safeContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const ok = await runWithPhiGuard({
        surface: 'cohort_announcement',
        texts: [title, plain],
        onSave: async () => {
          if (editingAnnouncement) {
            const { data, error: updateError } = await supabase
              .from('cohort_announcements')
              .update({
                title: title.trim(),
                content: safeContent,
                is_pinned: isPinned,
                visible_until: visibleUntil.trim() ? visibleUntil.trim().slice(0, 10) : null,
                updated_at: new Date().toISOString()
              })
              .eq('id', editingAnnouncement.id)
              .select(`
            *,
            author:created_by(id, first_name, last_name)
          `)
              .single();

            if (updateError) throw updateError;
            onAnnouncementCreated(data);
          } else {
            const { data, error: insertError } = await supabase
              .from('cohort_announcements')
              .insert({
                cohort_id: cohortId,
                title: title.trim(),
                content: safeContent,
                is_pinned: isPinned,
                visible_until: visibleUntil.trim() ? visibleUntil.trim().slice(0, 10) : null,
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
        },
      });
      if (!ok) setError('Possible PHI detected. Remove patient identifiers and try again.');
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
                  
                  <AnnouncementHtmlContent html={announcement.content} />
                  
                  <Typography variant="caption" color="text.secondary">
                    Posted by {getUserDisplayName(announcement.author)}
                    {' • '}
                    {format(new Date(announcement.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                    {announcement.updated_at !== announcement.created_at && ' (edited)'}
                  </Typography>
                </Box>

                {showMenuForAnnouncement(announcement) && (
                  <IconButton 
                    size="small"
                    onClick={(e: React.MouseEvent<HTMLElement>) => handleMenuOpen(e, announcement)}
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
        {menuAnchor?.announcement && canEditAnnouncement(menuAnchor.announcement) && (
          <MenuItem onClick={handleEdit}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {menuAnchor?.announcement && canDeleteAnnouncement(menuAnchor.announcement) && (
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          {dialogOpen && (
            <AnnouncementRichTextEditor value={content} onChange={setContent} />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={isPinned}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPinned(e.target.checked)}
              />
            }
            label="Pin this announcement"
          />
          <TextField
            label="Visible until (optional)"
            type="date"
            fullWidth
            value={visibleUntil}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVisibleUntil(e.target.value)}
            helperText="Leave empty to show until you remove it. Set a date to hide automatically after that day."
            sx={{ mt: 2 }}
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={
              saving ||
              !title.trim() ||
              announcementHtmlIsEffectivelyEmpty(sanitizeAnnouncementHtml(content))
            }
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
