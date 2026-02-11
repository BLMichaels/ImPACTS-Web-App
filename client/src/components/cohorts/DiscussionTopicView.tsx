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
  DialogActions,
  Link as MuiLink
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  PushPin as PinIcon,
  AttachFile as AttachFileIcon,
  GetApp as DownloadIcon
} from '@mui/icons-material';
import { CohortDiscussionTopic, CohortDiscussionReply, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format, formatDistanceToNow } from 'date-fns';
import RichTextEditor from './RichTextEditor';

interface DiscussionTopicViewProps {
  topic: CohortDiscussionTopic;
  cohortId: string;
  onBack: () => void;
  canModerate: boolean;
  onMarkAsRead?: () => void;
}

const DiscussionTopicView: React.FC<DiscussionTopicViewProps> = ({
  topic: initialTopic,
  cohortId,
  onBack,
  canModerate,
  onMarkAsRead
}) => {
  const { userProfile } = useUserProfile();
  const [topic, setTopic] = useState(initialTopic);
  const [replies, setReplies] = useState<CohortDiscussionReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<Array<{ name: string; url: string; type: string; size?: number }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; reply?: CohortDiscussionReply } | null>(null);
  const [editingReply, setEditingReply] = useState<CohortDiscussionReply | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTopicTitle, setEditTopicTitle] = useState('');
  const [editTopicContent, setEditTopicContent] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [deleteTopicConfirmOpen, setDeleteTopicConfirmOpen] = useState(false);

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
    
    // Mark discussion as read when viewing
    if (onMarkAsRead) {
      onMarkAsRead();
    }
  }, [loadReplies, onMarkAsRead]);

  const handleFileUpload = async (file: File): Promise<string | null> => {
    if (!userProfile?.id) return null;
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfile.id}/${Date.now()}.${fileExt}`;
      const filePath = `cohort-discussion-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cohort-discussion-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('cohort-discussion-attachments')
        .getPublicUrl(filePath);

      const attachment = {
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size
      };

      setReplyAttachments(prev => [...prev, attachment]);
      return publicUrl;
    } catch (err) {
      console.error('Error uploading file:', err);
      return null;
    }
  };

  const handleSaveDraftReply = async () => {
    if (!replyContent.trim()) return;
    
    setSavingDraft(true);
    try {
      const { data: existing } = await supabase
        .from('cohort_discussion_replies')
        .select('id')
        .eq('topic_id', topic.id)
        .eq('created_by', userProfile?.id)
        .is('content', null)
        .limit(1)
        .maybeSingle();

      const draftData = {
        topic_id: topic.id,
        draft_content: replyContent.trim(),
        attachments: replyAttachments.length > 0 ? replyAttachments : null,
        created_by: userProfile?.id
      };

      if (existing) {
        await supabase
          .from('cohort_discussion_replies')
          .update(draftData)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cohort_discussion_replies')
          .insert(draftData);
      }
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || topic.is_locked) return;

    setSubmitting(true);
    setError(null);

    try {
      // Check if draft exists and delete it
      const { data: existing } = await supabase
        .from('cohort_discussion_replies')
        .select('id')
        .eq('topic_id', topic.id)
        .eq('created_by', userProfile?.id)
        .is('content', null)
        .limit(1)
        .maybeSingle();

      const { data, error: insertError } = await supabase
        .from('cohort_discussion_replies')
        .insert({
          topic_id: topic.id,
          content: replyContent.trim(),
          attachments: replyAttachments.length > 0 ? replyAttachments : null,
          created_by: userProfile?.id
        })
        .select(`
          *,
          author:created_by(id, first_name, last_name, role)
        `)
        .single();

      if (insertError) throw insertError;

      // Delete draft if it exists
      if (existing) {
        await supabase
          .from('cohort_discussion_replies')
          .delete()
          .eq('id', existing.id);
      }
      
      setReplies(prev => [...prev, data]);
      setReplyContent('');
      setReplyAttachments([]);
      
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

  const handleEditTopic = () => {
    setEditingTopic(true);
    setEditTopicTitle(topic.title);
    setEditTopicContent(topic.content || '');
    setMenuAnchor(null);
  };

  const handleSaveTopicEdit = async () => {
    if (!editTopicTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('cohort_discussion_topics')
        .update({
          title: editTopicTitle.trim(),
          content: editTopicContent.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', topic.id);

      if (error) throw error;
      
      setTopic(prev => ({
        ...prev,
        title: editTopicTitle.trim(),
        content: editTopicContent.trim() || null,
        updated_at: new Date().toISOString()
      }));
      setEditingTopic(false);
      setEditTopicTitle('');
      setEditTopicContent('');
    } catch (err) {
      console.error('Error editing topic:', err);
    }
  };

  const handleDeleteTopic = () => {
    setDeleteTopicConfirmOpen(true);
    setMenuAnchor(null);
  };

  const confirmDeleteTopic = async () => {
    try {
      const { error } = await supabase
        .from('cohort_discussion_topics')
        .delete()
        .eq('id', topic.id);

      if (error) throw error;
      
      // Navigate back after deletion
      onBack();
    } catch (err) {
      console.error('Error deleting topic:', err);
    } finally {
      setDeleteTopicConfirmOpen(false);
    }
  };

  // Load draft reply on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!userProfile?.id || !topic.id) return;
      try {
        const { data } = await supabase
          .from('cohort_discussion_replies')
          .select('draft_content, attachments')
          .eq('topic_id', topic.id)
          .eq('created_by', userProfile.id)
          .is('content', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data?.draft_content) {
          setReplyContent(data.draft_content);
          setReplyAttachments((data.attachments as any) || []);
        }
      } catch (err) {
        console.error('Error loading draft reply:', err);
      }
    };
    loadDraft();
  }, [topic.id, userProfile?.id]);

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
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1, sm: 2 } }}>
          <IconButton onClick={onBack} sx={{ mt: -0.5, display: { xs: 'none', sm: 'flex' } }}>
            <BackIcon />
          </IconButton>
          <Button
            startIcon={<BackIcon />}
            onClick={onBack}
            sx={{ mt: -0.5, display: { xs: 'flex', sm: 'none' }, minWidth: 'auto' }}
          >
            Back
          </Button>
          
          <Box sx={{ flex: 1 }}>
            {editingTopic ? (
              // Edit mode for topic
              <Box>
                <TextField
                  fullWidth
                  label="Topic Title"
                  value={editTopicTitle}
                  onChange={(e) => setEditTopicTitle(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                />
                <RichTextEditor
                  value={editTopicContent}
                  onChange={setEditTopicContent}
                  placeholder="Edit topic content..."
                  minHeight={200}
                  showSaveDraft={false}
                />
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                  <Button onClick={() => {
                    setEditingTopic(false);
                    setEditTopicTitle('');
                    setEditTopicContent('');
                  }}>
                    Cancel
                  </Button>
                  <Button variant="contained" onClick={handleSaveTopicEdit} disabled={!editTopicTitle.trim()}>
                    Save Changes
                  </Button>
                </Box>
              </Box>
            ) : (
              // View mode for topic
              <>
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
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                  <Avatar 
                    sx={{ 
                      width: { xs: 40, sm: 48 }, 
                      height: { xs: 40, sm: 48 }, 
                      fontSize: { xs: '1rem', sm: '1.25rem' },
                      bgcolor: getRoleBadgeColor(topic.author?.role) + '.main',
                      fontWeight: 600
                    }}
                  >
                    {topic.author?.first_name?.charAt(0) || '?'}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      {topic.author?.first_name} {topic.author?.last_name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={getRoleLabel(topic.author?.role)}
                        size="small"
                        color={getRoleBadgeColor(topic.author?.role) as any}
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(topic.created_at), 'MMM d, yyyy \'at\' h:mm a')}
                      </Typography>
                      {topic.updated_at && topic.updated_at !== topic.created_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          • Edited {formatDistanceToNow(new Date(topic.updated_at), { addSuffix: true })}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
                
                {topic.content && (
                  <Box 
                    sx={{ 
                      mb: 2,
                      p: 2,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1, margin: '8px 0' },
                      '& a': { color: 'primary.main', textDecoration: 'underline' },
                      '& ul, & ol': { pl: 3, mb: 1 },
                      '& p': { mb: 1 }
                    }}
                    dangerouslySetInnerHTML={{ __html: topic.content }}
                  />
                )}
              </>
            )}
            {topic.attachments && topic.attachments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Attachments:
                </Typography>
                {topic.attachments.map((att, idx) => (
                  <Chip
                    key={idx}
                    icon={<AttachFileIcon />}
                    label={att.name}
                    size="small"
                    component="a"
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {(canModerate || topic.created_by === userProfile?.id) && (
            <IconButton onClick={(e) => setMenuAnchor({ el: e.currentTarget })}>
              <MoreIcon />
            </IconButton>
          )}
        </Box>
      </Paper>

      {/* Replies Section */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {replies.length} Repl{replies.length === 1 ? 'y' : 'ies'}
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : replies.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
            <Typography variant="body1" color="text.secondary">
              No replies yet. Be the first to reply!
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {replies.map((reply, index) => (
              <Paper 
                key={reply.id} 
                sx={{ 
                  p: 2.5, 
                  borderLeft: '3px solid',
                  borderColor: getRoleBadgeColor(reply.author?.role) + '.main',
                  bgcolor: index % 2 === 0 ? 'background.paper' : 'grey.50',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: 2
                  }
                }}
              >
                {editingReply?.id === reply.id ? (
                  // Edit mode
                  <Box>
                    <RichTextEditor
                      value={editContent}
                      onChange={setEditContent}
                      placeholder="Edit your reply..."
                      minHeight={150}
                      showSaveDraft={false}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
                      <Button onClick={() => {
                        setEditingReply(null);
                        setEditContent('');
                      }}>
                        Cancel
                      </Button>
                      <Button variant="contained" onClick={handleSaveEdit} disabled={!editContent.trim()}>
                        Save Changes
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  // View mode
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Avatar 
                      sx={{ 
                        width: 40,
                        height: 40,
                        bgcolor: getRoleBadgeColor(reply.author?.role) + '.main',
                        fontWeight: 600
                      }}
                    >
                      {reply.author?.first_name?.charAt(0) || '?'}
                    </Avatar>
                    
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {reply.author?.first_name} {reply.author?.last_name}
                        </Typography>
                        <Chip
                          label={getRoleLabel(reply.author?.role)}
                          size="small"
                          color={getRoleBadgeColor(reply.author?.role) as any}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                      </Typography>
                      {reply.edited_at && reply.edited_at !== reply.created_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          • Edited {formatDistanceToNow(new Date(reply.edited_at), { addSuffix: true })}
                        </Typography>
                      )}
                      </Box>
                      
                      <Box 
                        sx={{ 
                          mt: 1,
                          p: 1.5,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1, margin: '8px 0' },
                          '& a': { color: 'primary.main', textDecoration: 'underline' },
                          '& ul, & ol': { pl: 3, mb: 1 },
                          '& p': { mb: 1, lineHeight: 1.6 }
                        }}
                        dangerouslySetInnerHTML={{ __html: reply.content }}
                      />
                      {reply.attachments && reply.attachments.length > 0 && (
                        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 500 }}>
                            Attachments:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {reply.attachments.map((att, idx) => (
                              <Chip
                                key={idx}
                                icon={<AttachFileIcon />}
                                label={att.name}
                                size="small"
                                component="a"
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                clickable
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'action.hover'
                                  }
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>

                    {(canModerate || reply.created_by === userProfile?.id) && (
                      <IconButton 
                        size="small"
                        onClick={(e) => setMenuAnchor({ el: e.currentTarget, reply })}
                        sx={{ mt: 0.5 }}
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
      </Box>

      {/* Reply Input */}
      {!topic.is_locked ? (
        <Paper sx={{ p: { xs: 1.5, sm: 2 }, mt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Write a Reply
          </Typography>
          <RichTextEditor
            value={replyContent}
            onChange={setReplyContent}
            onSaveDraft={handleSaveDraftReply}
            onFileUpload={handleFileUpload}
            placeholder="Write a reply..."
            minHeight={150}
            showSaveDraft={true}
          />
          {replyAttachments.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 500 }}>
                Attachments:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {replyAttachments.map((att, idx) => (
                  <Chip
                    key={idx}
                    label={att.name}
                    size="small"
                    onDelete={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </Box>
            </Box>
          )}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            mt: 2, 
            gap: 1,
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <Button
              variant="outlined"
              onClick={handleSaveDraftReply}
              disabled={savingDraft || !replyContent.trim()}
              fullWidth={window.innerWidth < 600}
            >
              {savingDraft ? <CircularProgress size={24} /> : 'Save Draft'}
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmitReply}
              disabled={submitting || savingDraft || !replyContent.trim()}
              fullWidth={window.innerWidth < 600}
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
        {topic.created_by === userProfile?.id && (
          <MenuItem onClick={handleEditTopic}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit Topic</ListItemText>
          </MenuItem>
        )}
        {canModerate && (
          <>
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
          </>
        )}
        {(canModerate || topic.created_by === userProfile?.id) && (
          <MenuItem onClick={handleDeleteTopic} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete Topic</ListItemText>
          </MenuItem>
        )}
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

      {/* Delete Reply Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Reply</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this reply? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteReply} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Topic Confirmation */}
      <Dialog open={deleteTopicConfirmOpen} onClose={() => setDeleteTopicConfirmOpen(false)}>
        <DialogTitle>Delete Topic</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this topic and all its replies? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTopicConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteTopic} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscussionTopicView;
