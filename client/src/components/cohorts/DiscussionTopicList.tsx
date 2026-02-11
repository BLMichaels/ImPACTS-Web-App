import React, { useState, useEffect } from 'react';
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
  Divider,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText as MuiListItemText,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Chip as MuiChip
} from '@mui/material';
import {
  Add as AddIcon,
  Forum as ForumIcon,
  PushPin as PinIcon,
  Lock as LockIcon,
  ChatBubbleOutline as ReplyIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  AttachFile as AttachFileIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon
} from '@mui/icons-material';
import { CohortDiscussionTopic, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { formatDistanceToNow } from 'date-fns';
import RichTextEditor from './RichTextEditor';

interface DiscussionTopicListProps {
  cohortId: string;
  topics: CohortDiscussionTopic[];
  onTopicClick: (topic: CohortDiscussionTopic) => void;
  onTopicCreated: (topic: CohortDiscussionTopic) => void;
  onTopicDeleted?: (topicId: string) => void;
  loading: boolean;
  canManage?: boolean;
}

const DiscussionTopicList: React.FC<DiscussionTopicListProps> = ({
  cohortId,
  topics,
  onTopicClick,
  onTopicCreated,
  onTopicDeleted,
  loading,
  canManage = false
}) => {
  const { userProfile } = useUserProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string; type: string; size?: number }>>([]);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; topic: CohortDiscussionTopic } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_replies' | 'recent_activity'>('recent_activity');
  const [filterPinned, setFilterPinned] = useState<boolean | null>(null);
  const [filterLocked, setFilterLocked] = useState<boolean | null>(null);

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!userProfile?.id) return;
      try {
        const { data } = await supabase
          .from('cohort_discussion_topics')
          .select('draft_content, attachments')
          .eq('cohort_id', cohortId)
          .eq('created_by', userProfile.id)
          .is('content', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data?.draft_content) {
          setDraftContent(data.draft_content);
          setAttachments((data.attachments as any) || []);
        }
      } catch (err) {
        console.error('Error loading draft:', err);
      }
    };
    if (dialogOpen) {
      loadDraft();
    }
  }, [dialogOpen, cohortId, userProfile?.id]);

  const handleOpenDialog = () => {
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setTitle('');
    setContent('');
    setDraftContent('');
    setAttachments([]);
    setError(null);
  };

  const handleSaveDraft = async () => {
    if (!title.trim() && !content.trim()) return;
    
    setSavingDraft(true);
    try {
      // Check if draft exists
      const { data: existing } = await supabase
        .from('cohort_discussion_topics')
        .select('id')
        .eq('cohort_id', cohortId)
        .eq('created_by', userProfile?.id)
        .is('content', null)
        .limit(1)
        .maybeSingle();

      const draftData = {
        cohort_id: cohortId,
        title: title.trim() || 'Untitled Draft',
        draft_content: content.trim() || null,
        attachments: attachments.length > 0 ? attachments : null,
        created_by: userProfile?.id
      };

      if (existing) {
        await supabase
          .from('cohort_discussion_topics')
          .update(draftData)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('cohort_discussion_topics')
          .insert(draftData);
      }
    } catch (err) {
      console.error('Error saving draft:', err);
    } finally {
      setSavingDraft(false);
    }
  };

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

      setAttachments(prev => [...prev, attachment]);
      return publicUrl;
    } catch (err) {
      console.error('Error uploading file:', err);
      return null;
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Check if draft exists and delete it
      const { data: existing } = await supabase
        .from('cohort_discussion_topics')
        .select('id')
        .eq('cohort_id', cohortId)
        .eq('created_by', userProfile?.id)
        .is('content', null)
        .limit(1)
        .maybeSingle();

      const { data, error: insertError } = await supabase
        .from('cohort_discussion_topics')
        .insert({
          cohort_id: cohortId,
          title: title.trim(),
          content: content.trim() || null,
          attachments: attachments.length > 0 ? attachments : null,
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
          .from('cohort_discussion_topics')
          .delete()
          .eq('id', existing.id);
      }

      onTopicCreated(data);
      handleCloseDialog();
    } catch (err: any) {
      console.error('Error creating topic:', err);
      setError(err.message || 'Failed to create topic');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    setDeletingTopicId(topicId);
    setDeleteConfirmOpen(true);
    setMenuAnchor(null);
  };

  const confirmDeleteTopic = async () => {
    if (!deletingTopicId) return;

    try {
      const { error } = await supabase
        .from('cohort_discussion_topics')
        .delete()
        .eq('id', deletingTopicId);

      if (error) throw error;
      
      if (onTopicDeleted) {
        onTopicDeleted(deletingTopicId);
      }
    } catch (err) {
      console.error('Error deleting topic:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingTopicId(null);
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

  // Filter and sort topics
  const filteredAndSortedTopics = React.useMemo(() => {
    let filtered = [...topics];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(topic => 
        topic.title.toLowerCase().includes(query) ||
        topic.content?.toLowerCase().includes(query) ||
        topic.author?.first_name?.toLowerCase().includes(query) ||
        topic.author?.last_name?.toLowerCase().includes(query)
      );
    }

    // Pinned filter
    if (filterPinned !== null) {
      filtered = filtered.filter(topic => topic.is_pinned === filterPinned);
    }

    // Locked filter
    if (filterLocked !== null) {
      filtered = filtered.filter(topic => topic.is_locked === filterLocked);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_replies':
          return b.reply_count - a.reply_count;
        case 'recent_activity':
          const aTime = a.last_reply_at ? new Date(a.last_reply_at).getTime() : new Date(a.created_at).getTime();
          const bTime = b.last_reply_at ? new Date(b.last_reply_at).getTime() : new Date(b.created_at).getTime();
          return bTime - aTime;
        default:
          return 0;
      }
    });

    // Always show pinned topics first
    return filtered.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });
  }, [topics, searchQuery, sortBy, filterPinned, filterLocked]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with search, filters, and create button */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
          {/* Search */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: { md: 400 } }}
          />
          
          {/* Sort */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              label="Sort By"
            >
              <MenuItem value="recent_activity">Recent Activity</MenuItem>
              <MenuItem value="newest">Newest First</MenuItem>
              <MenuItem value="oldest">Oldest First</MenuItem>
              <MenuItem value="most_replies">Most Replies</MenuItem>
            </Select>
          </FormControl>

          {/* Filters */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <MuiChip
              label={filterPinned === true ? 'Pinned Only' : filterPinned === false ? 'Not Pinned' : 'All'}
              onClick={() => {
                if (filterPinned === null) setFilterPinned(true);
                else if (filterPinned === true) setFilterPinned(false);
                else setFilterPinned(null);
              }}
              color={filterPinned !== null ? 'primary' : 'default'}
              variant={filterPinned !== null ? 'filled' : 'outlined'}
              size="small"
              icon={<PinIcon />}
            />
            <MuiChip
              label={filterLocked === true ? 'Locked Only' : filterLocked === false ? 'Unlocked' : 'All'}
              onClick={() => {
                if (filterLocked === null) setFilterLocked(true);
                else if (filterLocked === true) setFilterLocked(false);
                else setFilterLocked(null);
              }}
              color={filterLocked !== null ? 'primary' : 'default'}
              variant={filterLocked !== null ? 'filled' : 'outlined'}
              size="small"
              icon={<LockIcon />}
            />
          </Box>

          <Box sx={{ flex: 1 }} />
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            sx={{ minWidth: { xs: '100%', md: 'auto' } }}
          >
            New Topic
          </Button>
        </Box>

        {/* Results count */}
        {(searchQuery || filterPinned !== null || filterLocked !== null) && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Showing {filteredAndSortedTopics.length} of {topics.length} discussion{topics.length !== 1 ? 's' : ''}
          </Typography>
        )}
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
      ) : filteredAndSortedTopics.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ForumIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No discussions match your filters
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
            Try adjusting your search or filters
          </Typography>
        </Paper>
      ) : (
        <Paper>
          <List disablePadding>
            {filteredAndSortedTopics.map((topic, index) => (
              <React.Fragment key={topic.id}>
                {index > 0 && <Divider />}
                <ListItem 
                  disablePadding
                  secondaryAction={
                    canManage && (
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuAnchor({ el: e.currentTarget, topic });
                        }}
                      >
                        <MoreIcon />
                      </IconButton>
                    )
                  }
                >
                  <ListItemButton 
                    onClick={() => onTopicClick(topic)}
                    sx={{
                      py: 2,
                      borderLeft: topic.is_pinned ? '3px solid' : 'none',
                      borderColor: topic.is_pinned ? 'primary.main' : 'transparent',
                      bgcolor: topic.is_pinned ? 'action.hover' : 'transparent',
                      '&:hover': {
                        bgcolor: 'action.hover'
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        bgcolor: getRoleBadgeColor(topic.author?.role) + '.main',
                        width: 48,
                        height: 48,
                        fontWeight: 600
                      }}>
                        {topic.author?.first_name?.charAt(0) || '?'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                          {topic.is_pinned && (
                            <Chip 
                              icon={<PinIcon />} 
                              label="Pinned" 
                              size="small" 
                              color="primary" 
                              variant="filled"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          )}
                          {topic.is_locked && (
                            <Chip 
                              icon={<LockIcon />} 
                              label="Locked" 
                              size="small" 
                              color="default" 
                              variant="outlined"
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          )}
                          <Typography 
                            variant="subtitle1" 
                            sx={{ 
                              fontWeight: topic.is_pinned ? 600 : 500,
                              wordBreak: 'break-word',
                              flex: 1,
                              minWidth: 0
                            }}
                          >
                            {topic.title}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                            <Chip
                              label={getRoleLabel(topic.author?.role)}
                              size="small"
                              color={getRoleBadgeColor(topic.author?.role) as any}
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            <Typography variant="body2" color="text.secondary" component="span">
                              {topic.author?.first_name} {topic.author?.last_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" component="span">
                              • {getTimeAgo(topic.created_at)}
                            </Typography>
                            {topic.attachments && topic.attachments.length > 0 && (
                              <Chip
                                icon={<AttachFileIcon fontSize="small" />}
                                label={`${topic.attachments.length} file${topic.attachments.length > 1 ? 's' : ''}`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Box>
                          {topic.reply_count > 0 && (
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5,
                                color: 'text.secondary'
                              }}
                            >
                              <ReplyIcon fontSize="small" />
                              <Typography variant="body2">
                                {topic.reply_count} repl{topic.reply_count === 1 ? 'y' : 'ies'}
                                {topic.last_replier && topic.last_reply_at && (
                                  <>
                                    {' • Last by '}
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
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
          <RichTextEditor
            value={content}
            onChange={setContent}
            onSaveDraft={handleSaveDraft}
            onFileUpload={handleFileUpload}
            placeholder="Add some context to start the conversation..."
            minHeight={200}
            showSaveDraft={true}
          />
          {attachments.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Attachments:
              </Typography>
              {attachments.map((att, idx) => (
                <Chip
                  key={idx}
                  label={att.name}
                  size="small"
                  onDelete={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving || savingDraft}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveDraft} 
            variant="outlined"
            disabled={saving || savingDraft || (!title.trim() && !content.trim())}
          >
            {savingDraft ? <CircularProgress size={24} /> : 'Save Draft'}
          </Button>
          <Button 
            onClick={handleCreate} 
            variant="contained" 
            disabled={saving || savingDraft || !title.trim()}
          >
            {saving ? <CircularProgress size={24} /> : 'Create Topic'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Menu */}
      <Menu
        anchorEl={menuAnchor?.el}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem 
          onClick={() => menuAnchor?.topic && handleDeleteTopic(menuAnchor.topic.id)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <MuiListItemText>Delete Topic</MuiListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete Topic</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this topic? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteTopic} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscussionTopicList;
