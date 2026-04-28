import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  CircularProgress,
  Button,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import { 
  ArrowBack as BackIcon,
  Send as SendIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  PushPin as PinIcon
} from '@mui/icons-material';
import { CohortDiscussionTopic, CohortDiscussionReply } from '../../types/database';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { getUserDisplayName } from '../../utils/displayName';
import { useUserProfile } from '../../context/UserProfileContext';
import RichTextEditor, { sanitizeHtml, stripHtmlToText } from './RichTextEditor';

const COHORT_ATTACHMENT_BUCKETS = ['cohort-discussion-attachments', 'cohort-attachments'] as const;

interface DiscussionTopicViewProps {
  topic: CohortDiscussionTopic;
  cohortId: string;
  onBack: () => void;
  canModerate: boolean;
  canReply?: boolean;
  onMarkAsRead?: () => void;
  onTopicUpdated?: (topicId: string, updates: Partial<CohortDiscussionTopic>) => void;
}

const DiscussionTopicView: React.FC<DiscussionTopicViewProps> = ({
  topic,
  cohortId,
  onBack,
  canModerate,
  canReply = false,
  onMarkAsRead,
  onTopicUpdated
}) => {
  const { userProfile } = useUserProfile();
  const [replies, setReplies] = useState<CohortDiscussionReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyHtml, setReplyHtml] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<Array<{ name: string; url: string; type: string; size?: number }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; reply: CohortDiscussionReply } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);

  const loadReplies = useCallback(async () => {
    const { data } = await supabase
      .from('cohort_discussion_replies')
      .select(`
        *,
        author:created_by(id, first_name, last_name, role)
      `)
      .eq('topic_id', topic.id)
      .order('created_at', { ascending: true });
    setReplies(data || []);
  }, [topic.id]);

  useEffect(() => {
    onMarkAsRead?.();
    loadReplies().finally(() => setLoading(false));
  }, [topic.id, onMarkAsRead, loadReplies]);

  const authorName = topic.author ? getUserDisplayName(topic.author as any) : 'Unknown';

  const uploadFiles = async (files: File[]): Promise<Array<{ name: string; url: string; type: string; size?: number }>> => {
    const results: Array<{ name: string; url: string; type: string; size?: number }> = [];
    let lastUploadError: Error | null = null;

    for (const file of files) {
      const path = `${cohortId}/${topic.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      let fileUploaded = false;

      for (const bucket of COHORT_ATTACHMENT_BUCKETS) {
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
        if (error) {
          lastUploadError = error;
          continue;
        }
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
        results.push({ name: file.name, url: urlData.publicUrl, type: file.type, size: file.size });
        fileUploaded = true;
        break;
      }

      if (!fileUploaded) {
        console.warn('Upload failed for all buckets:', lastUploadError);
      }
    }

    if (results.length === 0 && lastUploadError) {
      throw lastUploadError;
    }

    return results;
  };

  const handleAttachReply = async (files: File[]) => {
    setUploading(true);
    try {
      const uploaded = await uploadFiles(files);
      setReplyAttachments((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitReply = async () => {
    const trimmed = sanitizeHtml(replyHtml).trim();
    if (!stripHtmlToText(trimmed) || !userProfile?.id) return;
    
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('cohort_discussion_replies')
        .insert({
          topic_id: topic.id,
          content: trimmed,
          created_by: userProfile.id,
          ...(replyAttachments.length > 0 && { attachments: replyAttachments })
        })
        .select(`
          *,
          author:created_by(id, first_name, last_name, role)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setReplies(prev => [...prev, data]);
        setReplyHtml('');
        setReplyAttachments([]);
        const newCount = (topic.reply_count || 0) + 1;
        const now = new Date().toISOString();
        await supabase
          .from('cohort_discussion_topics')
          .update({
            reply_count: newCount,
            last_reply_at: now,
            last_reply_by: userProfile.id
          })
          .eq('id', topic.id);
        onTopicUpdated?.(topic.id, { reply_count: newCount, last_reply_at: now, last_reply_by: userProfile.id });
      }
    } catch (err) {
      console.error('Error posting reply:', err);
      setSnackMessage('Failed to post reply. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, reply: CohortDiscussionReply) => {
    e.stopPropagation();
    setMenuAnchor({ el: e.currentTarget, reply });
  };

  const handleMenuClose = () => setMenuAnchor(null);

  const handleDeleteClick = () => {
    if (menuAnchor?.reply) {
      setDeletingId(menuAnchor.reply.id);
      setDeleteConfirmOpen(true);
    }
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    
    try {
      // Check if deleting the topic itself or a reply
      if (deletingId === topic.id) {
        if (!canDeleteTopic) {
          throw new Error('You can only delete your own topic when it has no replies.');
        }
        const { count: replyCount, error: countErr } = await supabase
          .from('cohort_discussion_replies')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', topic.id);
        if (countErr) throw countErr;
        if ((replyCount ?? 0) > 0) {
          throw new Error('This topic already has replies and cannot be deleted.');
        }
        // Delete the entire topic (cascades to replies)
        const { error } = await supabase
          .from('cohort_discussion_topics')
          .delete()
          .eq('id', deletingId);

        if (error) throw error;
        
        // Navigate back to topic list
        onBack();
      } else {
        // Delete a reply
        const { error } = await supabase
          .from('cohort_discussion_replies')
          .delete()
          .eq('id', deletingId);

        if (error) throw error;

        const remaining = replies.filter(r => r.id !== deletingId);
        setReplies(remaining);

        const lastReply = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        await supabase
          .from('cohort_discussion_topics')
          .update({
            reply_count: remaining.length,
            last_reply_at: lastReply ? lastReply.created_at : null,
            last_reply_by: lastReply?.created_by ?? null
          })
          .eq('id', topic.id);

        onTopicUpdated?.(topic.id, {
          reply_count: remaining.length,
          last_reply_at: lastReply?.created_at ?? null,
          last_reply_by: lastReply?.created_by ?? null
        });
      }
    } catch (err) {
      console.error('Error deleting:', err);
      setSnackMessage('Failed to delete. Please try again.');
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    }
  };

  const canDeleteReply = (reply: CohortDiscussionReply) => {
    // Can delete own replies or if canModerate (admins/managers)
    return reply.created_by === userProfile?.id || canModerate;
  };
  const canDeleteTopic = canModerate || (topic.created_by === userProfile?.id && (topic.reply_count ?? 0) === 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={onBack} aria-label="Back">
          <BackIcon />
        </IconButton>
        <Typography variant="h6">Discussion</Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>{topic.title}</Typography>
              {topic.is_pinned && (
                <PinIcon fontSize="small" color="primary" sx={{ mt: 0.5 }} aria-label="Pinned" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {authorName} • {format(new Date(topic.created_at), 'MMM d, yyyy \'at\' h:mm a')}
            </Typography>
            {(topic.content || '').trim() && (() => {
              const text = topic.content || '';
              return (
                <>
                  <Divider sx={{ my: 2 }} />
                  {/<[a-z][\s\S]*>/i.test(text) ? (
                    <Box component="div" sx={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />
                  ) : (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{text}</Typography>
                  )}
                </>
              );
            })()}
          </Box>
          {canDeleteTopic && (
            <IconButton 
              size="small" 
              onClick={(e) => {
                e.stopPropagation();
                setDeletingId(topic.id);
                setDeleteConfirmOpen(true);
              }}
              sx={{ color: 'error.main' }}
              aria-label="Delete discussion topic"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Paper>

      {topic.reply_count > 0 && (
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          {topic.reply_count} repl{topic.reply_count === 1 ? 'y' : 'ies'}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, gap: 1 }}>
          <CircularProgress size={32} />
          <Typography variant="caption" color="text.secondary">Loading replies…</Typography>
        </Box>
      ) : replies.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {replies.map((reply) => {
            const replyAuthor = reply.author ? getUserDisplayName(reply.author as any) : 'Unknown';
            const replyAuthorInitial = reply.author
              ? (reply.author as any).first_name?.charAt(0) || '?'
              : '?';
            
            return (
              <Paper key={reply.id} sx={{ p: 2, pl: 3, borderLeft: 2, borderColor: 'divider', transition: 'background-color 0.2s', '&:hover': { bgcolor: 'action.hover' } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                    {replyAuthorInitial}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {replyAuthor}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        • {format(new Date(reply.created_at), 'MMM d, yyyy h:mm a')}
                      </Typography>
                    </Box>
                    {reply.attachments && reply.attachments.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {reply.attachments.map((att, i) => (
                          <Typography
                            key={i}
                            component="a"
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="caption"
                            sx={{ color: 'primary.main', textDecoration: 'underline', mr: 1 }}
                          >
                            {att.name}
                          </Typography>
                        ))}
                      </Box>
                    )}
                    {reply.content && /<[a-z][\s\S]*>/i.test(reply.content) ? (
                      <Box component="div" sx={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(reply.content) }} />
                    ) : (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{reply.content}</Typography>
                    )}
                  </Box>
                  {canDeleteReply(reply) && (
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, reply)}>
                      <MoreIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, mb: 3 }}>
          No replies yet. Be the first to reply!
        </Typography>
      )}

      {/* Reply input – hidden when topic is locked */}
      {topic.is_locked && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, mt: 2, fontStyle: 'italic' }}>
          This discussion is locked. No new replies can be added.
        </Typography>
      )}
      {canReply && !topic.is_locked && (
        <Paper component="section" aria-label="Add a reply" sx={{ p: 2, mt: 3, borderTop: 1, borderColor: 'divider', pt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Add a reply</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Use toolbar for bold, italic, link, or attach files
          </Typography>
          <RichTextEditor
            value={replyHtml}
            onChange={setReplyHtml}
            placeholder="Type your reply..."
            minRows={3}
            disabled={submitting || uploading}
            onAttach={handleAttachReply}
            attachments={replyAttachments}
            onRemoveAttachment={(i) => setReplyAttachments((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              aria-label="Post reply"
              onClick={handleSubmitReply}
              disabled={!stripHtmlToText(replyHtml).trim() || submitting}
            >
              {submitting ? 'Posting...' : 'Post reply'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Delete menu */}
      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
        <DialogTitle id="delete-dialog-title">
          {deletingId === topic.id ? 'Delete discussion topic?' : 'Delete reply?'}
        </DialogTitle>
        <DialogContent id="delete-dialog-description">
          {deletingId === topic.id 
            ? 'This will permanently remove this discussion topic and all its replies. This cannot be undone.'
            : 'This will permanently remove this reply. This cannot be undone.'
          }
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackMessage)}
        autoHideDuration={6000}
        onClose={() => setSnackMessage(null)}
        message={snackMessage}
      />
    </Box>
  );
};

export default DiscussionTopicView;
