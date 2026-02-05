import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Forum as ForumIcon,
  PushPin as PinIcon,
  Lock as LockIcon,
  ChatBubbleOutline as ReplyIcon
} from '@mui/icons-material';
import { CohortDiscussionTopic, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface DiscussionTopicListProps {
  cohortId: string;
  topics: CohortDiscussionTopic[];
  onTopicClick: (topic: CohortDiscussionTopic) => void;
  onTopicCreated: (topic: CohortDiscussionTopic) => void;
  loading: boolean;
}

const DiscussionTopicList: React.FC<DiscussionTopicListProps> = ({
  cohortId,
  topics,
  onTopicClick,
  onTopicCreated,
  loading
}) => {
  const { userProfile } = useUserProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('cohort_discussion_topics')
        .insert({
          cohort_id: cohortId,
          title: title.trim(),
          content: content.trim() || null,
          created_by: userProfile?.id
        })
        .select(`
          *,
          author:created_by(id, first_name, last_name, role)
        `)
        .single();

      if (insertError) throw insertError;
      onTopicCreated(data);
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error creating topic:', err);
      setError(err.message || 'Failed to create topic');
    } finally {
      setSaving(false);
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

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          New Topic
        </Button>
      </Box>

      {/* Topics list */}
      {topics.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ForumIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No discussions yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            Start a new topic to begin the conversation
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <List disablePadding>
            {topics.map((topic, index) => (
              <React.Fragment key={topic.id}>
                {index > 0 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton onClick={() => onTopicClick(topic)}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getRoleBadgeColor(topic.author?.role) + '.main' }}>
                        {topic.author?.first_name?.charAt(0) || '?'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          {topic.is_pinned && (
                            <PinIcon fontSize="small" color="primary" />
                          )}
                          {topic.is_locked && (
                            <LockIcon fontSize="small" color="action" />
                          )}
                          <Typography 
                            variant="subtitle1" 
                            sx={{ 
                              fontWeight: 500,
                              wordBreak: 'break-word'
                            }}
                          >
                            {topic.title}
                          </Typography>
                          <Chip
                            label={getRoleLabel(topic.author?.role)}
                            size="small"
                            color={getRoleBadgeColor(topic.author?.role) as any}
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary" component="span">
                            Started by {topic.author?.first_name} {topic.author?.last_name}
                            {' • '}
                            {getTimeAgo(topic.created_at)}
                          </Typography>
                          {topic.reply_count > 0 && (
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5, 
                                mt: 0.5,
                                color: 'text.secondary'
                              }}
                            >
                              <ReplyIcon fontSize="small" />
                              <Typography variant="body2">
                                {topic.reply_count} repl{topic.reply_count === 1 ? 'y' : 'ies'}
                                {topic.last_replier && (
                                  <>
                                    {' • Last reply by '}
                                    {topic.last_replier.first_name} {topic.last_replier.last_name}
                                    {' '}
                                    {getTimeAgo(topic.last_reply_at)}
                                  </>
                                )}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Create Topic Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Discussion</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            label="Topic Title"
            fullWidth
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What would you like to discuss?"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            label="Initial Message (optional)"
            fullWidth
            multiline
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add some context to start the conversation..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            variant="contained" 
            disabled={saving || !title.trim()}
          >
            {saving ? <CircularProgress size={24} /> : 'Create Topic'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscussionTopicList;
