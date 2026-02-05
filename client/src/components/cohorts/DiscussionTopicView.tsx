import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Avatar,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  PushPin as PinIcon
} from '@mui/icons-material';
import { CohortDiscussionTopic, CohortDiscussionReply, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format, formatDistanceToNow } from 'date-fns';

interface DiscussionTopicViewProps {
  topic: CohortDiscussionTopic;
  cohortId: string;
  onBack: () => void;
  canModerate: boolean;
}

const DiscussionTopicView: React.FC<DiscussionTopicViewProps> = ({
  topic: initialTopic,
  cohortId,
  onBack,
  canModerate
}) => {
  const { userProfile } = useUserProfile();
  const [topic, setTopic] = useState(initialTopic);
  const [replies, setReplies] = useState<CohortDiscussionReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; reply?: CohortDiscussionReply } | null>(null);
  const [editingReply, setEditingReply] = useState<CohortDiscussionReply | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);

  const loadReplies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('cohort_discussion_replies')
        .select(`
          *,
          author:created_by(id, first_name, last_name, role)
        `)
        .eq('topic_id', topic.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReplies(data || []);
    } catch (err) {
      console.error('Error loading replies:', err);
    } finally {
      setLoading(false);
    }
  }, [topic.id]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || topic.is_locked) return;

    setSubmitting(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('cohort_discussion_replies')
        .insert({
          topic_id: topic.id,
          content: replyContent.trim(),
          created_by: userProfile?.id
        })
        .select(`
          *,
          author:created_by(id, first_name, last_name, role)
        `)
        .single();

      if (insertError) throw insertError;
      
      setReplies(prev => [...prev, data]);
      setReplyContent('');
      
      // Update topic reply count locally
      setTopic(prev => ({
        ...prev,
        reply_count: prev.reply_count + 1,
        last_reply_at: data.created_at,
        last_reply_by: data.created_by
      }));
    } catch (err: any) {
      console.error('Error submitting reply:', err);
      setError(err.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLock = async () => {
    try {
      const { error } = await supabase
        .from('cohort_discussion_topics')
        .update({ is_locked: !topic.is_locked })
        .eq('id', topic.id);

      if (error) throw error;
      setTopic(prev => ({ ...prev, is_locked: !prev.is_locked }));
    } catch (err) {
      console.error('Error toggling lock:', err);
    }
    setMenuAnchor(null);
  };

  const handleTogglePin = async () => {
    try {
      const { error } = await supabase
        .from('cohort_discussion_topics')
        .update({ is_pinned: !topic.is_pinned })
        .eq('id', topic.id);

      if (error) throw error;
      setTopic(prev => ({ ...prev, is_pinned: !prev.is_pinned }));
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
    setMenuAnchor(null);
  };

  const handleEditReply = (reply: CohortDiscussionReply) => {
    setEditingReply(reply);
    setEditContent(reply.content);
    setMenuAnchor(null);
  };

  const handleSaveEdit = async () => {
    if (!editingReply || !editContent.trim()) return;

    try {
      const { error } = await supabase
        .from('cohort_discussion_replies')
        .update({
          content: editContent.trim(),
          edited_at: new Date().toISOString()
        })
        .eq('id', editingReply.id);

      if (error) throw error;
      
      setReplies(prev => prev.map(r => 
        r.id === editingReply.id 
          ? { ...r, content: editContent.trim(), edited_at: new Date().toISOString() }
          : r
      ));
      setEditingReply(null);
      setEditContent('');
    } catch (err) {
      console.error('Error editing reply:', err);
    }
  };

  const handleDeleteReply = (replyId: string) => {
    setDeletingReplyId(replyId);
    setDeleteConfirmOpen(true);
    setMenuAnchor(null);
  };

  const confirmDeleteReply = async () => {
    if (!deletingReplyId) return;

    try {
      const { error } = await supabase
        .from('cohort_discussion_replies')
        .delete()
        .eq('id', deletingReplyId);

      if (error) throw error;
      
      setReplies(prev => prev.filter(r => r.id !== deletingReplyId));
      setTopic(prev => ({ ...prev, reply_count: Math.max(0, prev.reply_count - 1) }));
    } catch (err) {
      console.error('Error deleting reply:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingReplyId(null);
    }
  };

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'error';
      case UserRole.MANAGER: return 'secondary';
      case UserRole.MENTOR: return 'warning';
      default: return 'primary';
    }
  };

  const getRoleLabel = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'Admin';
      case UserRole.MANAGER: return 'Manager';
      case UserRole.MENTOR: return 'Mentor';
      default: return 'PECC';
    }
  };

  return (
    <Box>
      {/* Topic Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <IconButton onClick={onBack} sx={{ mt: -0.5 }}>
            <BackIcon />
          </IconButton>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {topic.is_pinned && (
                <Chip icon={<PinIcon />} label="Pinned" size="small" color="primary" variant="outlined" />
              )}
              {topic.is_locked && (
                <Chip icon={<LockIcon />} label="Locked" size="small" color="default" variant="outlined" />
              )}
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {topic.title}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar 
                sx={{ 
                  width: 24, 
                  height: 24, 
                  fontSize: '0.75rem',
                  bgcolor: getRoleBadgeColor(topic.author?.role) + '.main'
                }}
              >
                {topic.author?.first_name?.charAt(0) || '?'}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {topic.author?.first_name} {topic.author?.last_name}
              </Typography>
              <Chip
                label={getRoleLabel(topic.author?.role)}
                size="small"
                color={getRoleBadgeColor(topic.author?.role) as any}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
              <Typography variant="body2" color="text.secondary">
                • {format(new Date(topic.created_at), 'MMM d, yyyy \'at\' h:mm a')}
              </Typography>
            </Box>
            
            {topic.content && (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {topic.content}
              </Typography>
            )}
          </Box>

          {canModerate && (
            <IconButton onClick={(e) => setMenuAnchor({ el: e.currentTarget })}>
              <MoreIcon />
            </IconButton>
          )}
        </Box>
      </Paper>

      {/* Replies */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        {replies.length} Repl{replies.length === 1 ? 'y' : 'ies'}
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {replies.map((reply) => (
            <Paper key={reply.id} sx={{ p: 2 }}>
              {editingReply?.id === reply.id ? (
                // Edit mode
                <Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={() => setEditingReply(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveEdit}>Save</Button>
                  </Box>
                </Box>
              ) : (
                // View mode
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: getRoleBadgeColor(reply.author?.role) + '.main'
                    }}
                  >
                    {reply.author?.first_name?.charAt(0) || '?'}
                  </Avatar>
                  
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2">
                        {reply.author?.first_name} {reply.author?.last_name}
                      </Typography>
                      <Chip
                        label={getRoleLabel(reply.author?.role)}
                        size="small"
                        color={getRoleBadgeColor(reply.author?.role) as any}
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                        {reply.edited_at && ' (edited)'}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {reply.content}
                    </Typography>
                  </Box>

                  {(canModerate || reply.created_by === userProfile?.id) && (
                    <IconButton 
                      size="small"
                      onClick={(e) => setMenuAnchor({ el: e.currentTarget, reply })}
                    >
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )}
            </Paper>
          ))}
        </Box>
      )}

      {/* Reply Input */}
      {!topic.is_locked ? (
        <Paper sx={{ p: 2, mt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleSubmitReply}
              disabled={submitting || !replyContent.trim()}
            >
              {submitting ? <CircularProgress size={24} /> : 'Post Reply'}
            </Button>
          </Box>
        </Paper>
      ) : (
        <Alert severity="info" sx={{ mt: 3 }}>
          This topic has been locked. No new replies can be added.
        </Alert>
      )}

      {/* Topic Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor) && !menuAnchor?.reply}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleTogglePin}>
          <ListItemIcon><PinIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{topic.is_pinned ? 'Unpin Topic' : 'Pin Topic'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleToggleLock}>
          <ListItemIcon>
            {topic.is_locked ? <UnlockIcon fontSize="small" /> : <LockIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{topic.is_locked ? 'Unlock Topic' : 'Lock Topic'}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Reply Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor?.reply)}
        onClose={() => setMenuAnchor(null)}
      >
        {menuAnchor?.reply?.created_by === userProfile?.id && (
          <MenuItem onClick={() => menuAnchor?.reply && handleEditReply(menuAnchor.reply)}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        <MenuItem 
          onClick={() => handleDeleteReply(menuAnchor?.reply?.id || '')}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Reply</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this reply?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteReply} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscussionTopicView;
