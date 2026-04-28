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
  Chip,
  Snackbar
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
  onTopicUpdated?: (topicId: string, updates: Partial<CohortDiscussionTopic>) => void;
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
  onTopicUpdated,
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const canDeleteTopic = (topic: CohortDiscussionTopic): boolean =>
    canManage || (topic.created_by === currentUser?.id && (topic.reply_count ?? 0) === 0);

  const handleTogglePin = async () => {
    const t = menuAnchor?.topic;
    if (!t || !onTopicUpdated) return;
    handleMenuClose();
    try {
      const { error: err } = await supabase
        .from('cohort_discussion_topics')
        .update({ is_pinned: !t.is_pinned })
        .eq('id', t.id);
      if (err) throw err;
      onTopicUpdated(t.id, { is_pinned: !t.is_pinned });
    } catch (e: any) {
      setDeleteError(e?.message || 'Failed to update pin.');
    }
  };

  const handleDeleteClick = () => {
    if (menuAnchor?.topic && canDeleteTopic(menuAnchor.topic)) {
      setDeletingId(menuAnchor.topic.id);
      setDeleteConfirmOpen(true);
    }
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    setDeleteError(null);
    try {
      const selectedTopic = topics.find((t) => t.id === deletingId);
      if (!selectedTopic) throw new Error('Topic not found.');
      if (!canDeleteTopic(selectedTopic)) {
        throw new Error('You can only delete your own topic when it has no replies.');
      }
      const { count: replyCount, error: countErr } = await supabase
        .from('cohort_discussion_replies')
        .select('id', { count: 'exact', head: true })
        .eq('topic_id', deletingId);
      if (countErr) throw countErr;
      if ((replyCount ?? 0) > 0) {
        throw new Error('This topic already has replies and cannot be deleted.');
      }
      const { error: err } = await supabase
        .from('cohort_discussion_topics')
        .delete()
        .eq('id', deletingId);
      if (err) throw err;
      onTopicDeleted(deletingId);
    } catch (err: any) {
      console.error('Error deleting topic:', err);
      setDeleteError(err?.message || 'Failed to delete discussion. Please try again.');
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4, gap: 2 }}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">Loading discussions…</Typography>
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
        <Paper sx={{ p: 5, textAlign: 'center' }}>
          <DiscussionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} aria-hidden />
          <Typography variant="h6" color="text.secondary">No discussions yet</Typography>
          {canCreateDiscussion && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1.5 }}>
              Start a discussion to engage with your cohort
            </Typography>
          )}
        </Paper>
      ) : (
        <Box component="ul" role="list" aria-label="Discussion topics" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {topics.map((topic) => (
            <Paper
              component="li"
              key={topic.id}
              sx={{
                p: 2,
                cursor: 'pointer',
                borderLeft: topic.is_pinned ? 4 : 0,
                borderColor: 'primary.main',
                transition: 'box-shadow 0.2s, background-color 0.2s',
                '&:hover': { boxShadow: 2, bgcolor: 'action.hover' }
              }}
              onClick={() => onTopicClick(topic)}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {topic.is_pinned && (
                      <PinIcon fontSize="small" color="primary" aria-hidden />
                    )}
                    <Typography variant="subtitle1" fontWeight={600}>{topic.title}</Typography>
                    {topic.reply_count > 0 && (
                      <Chip size="small" label={topic.reply_count === 1 ? '1 reply' : `${topic.reply_count} replies`} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {topic.author ? getUserDisplayName(topic.author as any) : 'Unknown'}
                    {' • '}
                    {format(new Date(topic.created_at), 'MMM d, yyyy')}
                    {topic.last_reply_at && ` • Last reply ${format(new Date(topic.last_reply_at), 'MMM d')}`}
                  </Typography>
                </Box>
                {(canManage || canDeleteTopic(topic)) && (
                  <IconButton size="small" onClick={(e) => handleMenuOpen(e, topic)} aria-label={`Actions for ${topic.title}`}>
                    <MoreIcon />
                  </IconButton>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        {canManage && onTopicUpdated && (
          <MenuItem onClick={handleTogglePin}>
            <ListItemIcon><PinIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{menuAnchor?.topic?.is_pinned ? 'Unpin' : 'Pin'}</ListItemText>
          </MenuItem>
        )}
        {menuAnchor?.topic && canDeleteTopic(menuAnchor.topic) && (
          <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
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

      <Snackbar
        open={Boolean(deleteError)}
        autoHideDuration={6000}
        onClose={() => setDeleteError(null)}
        message={deleteError}
      />
    </Box>
  );
};

export default DiscussionTopicList;
