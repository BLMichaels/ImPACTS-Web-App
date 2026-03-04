import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Chat as DiscussionIcon,
  PushPin as PinIcon
} from '@mui/icons-material';
import { CohortDiscussionTopic } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { getUserDisplayName } from '../../utils/displayName';
import RichTextEditor, { sanitizeHtml } from './RichTextEditor';

interface DiscussionTopicListProps {
  cohortId: string;
  topics: CohortDiscussionTopic[];
  onTopicClick: (topic: CohortDiscussionTopic) => void;
  onTopicCreated: (topic: CohortDiscussionTopic) => void;
  onTopicDeleted: (topicId: string) => void;
  loading: boolean;
  canManage: boolean;
  canPost?: boolean; // Allow creating new discussions (for Mentors)
}

const DiscussionTopicList: React.FC<DiscussionTopicListProps> = ({
  cohortId,
  topics,
  onTopicClick,
  onTopicCreated,
  onTopicDeleted,
  loading,
  canManage,
  canPost = false
}) => {
  const canCreateDiscussion = canManage || canPost;
  const { currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; topic: CohortDiscussionTopic } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenDialog = () => {
    setTitle('');
    setContent('');
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setTitle('');
    setContent('');
    setError(null);
  };

  const handleCreateTopic = async () => {
    if (!title.trim() || !currentUser?.id) return;
    setSaving(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('cohort_discussion_topics')
        .insert({
          cohort_id: cohortId,
          title: title.trim(),
          content: sanitizeHtml(content).trim() || null,
          created_by: currentUser.id,
          is_pinned: false,
          is_locked: false,
          reply_count: 0
        })
        .select(`
          *,
          author:created_by(id, first_name, last_name, role),
          last_replier:last_reply_by(id, first_name, last_name)
        `)
        .single();

      if (insertError) throw insertError;
      if (data) {
        onTopicCreated(data as CohortDiscussionTopic);
        handleCloseDialog();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create topic');
    } finally {
      setSaving(false);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, topic: CohortDiscussionTopic) => {
    e.stopPropagation();
    setMenuAnchor({ el: e.currentTarget, topic });
  };

  const handleMenuClose = () => setMenuAnchor(null);

  const handleDeleteClick = () => {
    if (menuAnchor?.topic) {
      setDeletingId(menuAnchor.topic.id);
      setDeleteConfirmOpen(true);
    }
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      const { error: deleteError } = await supabase
        .from('cohort_discussion_topics')
        .delete()
        .eq('id', deletingId);
      if (deleteError) throw deleteError;
      onTopicDeleted(deletingId);
    } catch (err) {
      console.error('Error deleting topic:', err);
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
      {canCreateDiscussion && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenDialog}>
            New discussion
          </Button>
        </Box>
      )}

      {topics.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <DiscussionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No discussions yet</Typography>
          {canCreateDiscussion && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Start a discussion to engage with your cohort
            </Typography>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {topics.map((topic) => (
            <Paper
              key={topic.id}
              sx={{
                p: 2,
                cursor: 'pointer',
                borderLeft: topic.is_pinned ? 4 : 0,
                borderColor: 'primary.main'
              }}
              onClick={() => onTopicClick(topic)}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {topic.is_pinned && (
                      <PinIcon fontSize="small" color="primary" />
                    )}
                    <Typography variant="subtitle1" fontWeight={600}>{topic.title}</Typography>
                    {topic.reply_count > 0 && (
                      <Chip size="small" label={`${topic.reply_count} reply`} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {topic.author ? getUserDisplayName(topic.author as any) : 'Unknown'}
                    {' • '}
                    {format(new Date(topic.created_at), 'MMM d, yyyy')}
                    {topic.last_reply_at && ` • Last reply ${format(new Date(topic.last_reply_at), 'MMM d')}`}
                  </Typography>
                </Box>
                {canManage && (
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, topic)}>
                    <MoreIcon />
                  </IconButton>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete discussion?</DialogTitle>
        <DialogContent>This will remove the topic and all replies. This cannot be undone.</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>New discussion</DialogTitle>
        <DialogContent>
          {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
          <TextField
            autoFocus
            margin="dense"
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Content (optional) — use toolbar for bold, italic, link
          </Typography>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Add details..."
            minRows={3}
            disabled={saving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleCreateTopic} variant="contained" disabled={!title.trim() || saving}>
            {saving ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscussionTopicList;
