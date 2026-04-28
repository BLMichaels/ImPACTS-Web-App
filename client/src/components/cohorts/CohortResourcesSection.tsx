import React, { useState, useEffect, useCallback } from 'react';
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
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MenuBook as ResourcesIcon
} from '@mui/icons-material';
import { CohortResource } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { getUserDisplayName } from '../../utils/displayName';
import RichTextEditor, { sanitizeHtml } from './RichTextEditor';

interface CohortResourcesSectionProps {
  cohortId: string;
  canManage: boolean; // Managers and Admins can add/edit/delete
  loading?: boolean;
}

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/gi;

const linkifyResourceHtml = (html: string): string => {
  const safeHtml = sanitizeHtml(html);
  if (!safeHtml) return '';

  const doc = new DOMParser().parseFromString(safeHtml, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.tagName.toLowerCase() !== 'a' && /https?:\/\/[^\s<>"']+/i.test(node.textContent || '')) {
      textNodes.push(node);
    }
  }

  textNodes.forEach((textNode) => {
    const originalText = textNode.textContent || '';
    const frag = doc.createDocumentFragment();
    let lastIndex = 0;
    const matches = originalText.matchAll(URL_PATTERN);

    for (const match of matches) {
      const fullUrl = match[0];
      const start = match.index ?? 0;
      const end = start + fullUrl.length;

      if (start > lastIndex) {
        frag.appendChild(doc.createTextNode(originalText.slice(lastIndex, start)));
      }

      const link = doc.createElement('a');
      link.href = fullUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = fullUrl;
      frag.appendChild(link);

      lastIndex = end;
    }

    if (lastIndex < originalText.length) {
      frag.appendChild(doc.createTextNode(originalText.slice(lastIndex)));
    }

    textNode.replaceWith(frag);
  });

  return doc.body.innerHTML.trim();
};

const CohortResourcesSection: React.FC<CohortResourcesSectionProps> = ({
  cohortId,
  canManage,
  loading: parentLoading
}) => {
  const { userProfile } = useUserProfile();
  const [resources, setResources] = useState<CohortResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<CohortResource | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; resource: CohortResource } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadResources = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    const { data } = await supabase
      .from('cohort_resources')
      .select(`
        *,
        author:created_by(id, first_name, last_name)
      `)
      .eq('cohort_id', cohortId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setResources((data as CohortResource[]) || []);
    setLoading(false);
  }, [cohortId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const handleOpenDialog = (resource?: CohortResource) => {
    if (resource) {
      setEditingResource(resource);
      setTitle(resource.title);
      setContent(resource.content || '');
    } else {
      setEditingResource(null);
      setTitle('');
      setContent('');
    }
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingResource(null);
    setTitle('');
    setContent('');
    setError(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingResource) {
        const { data, error: updateError } = await supabase
          .from('cohort_resources')
          .update({
            title: title.trim(),
            content: content.trim() || '',
            updated_at: new Date().toISOString()
          })
          .eq('id', editingResource.id)
          .select(`
            *,
            author:created_by(id, first_name, last_name)
          `)
          .single();
        if (updateError) throw updateError;
        setResources(prev => prev.map(r => r.id === editingResource.id ? (data as CohortResource) : r));
      } else {
        const { data, error: insertError } = await supabase
          .from('cohort_resources')
          .insert({
            cohort_id: cohortId,
            title: title.trim(),
            content: content.trim() || '',
            sort_order: resources.length,
            created_by: userProfile?.id
          })
          .select(`
            *,
            author:created_by(id, first_name, last_name)
          `)
          .single();
        if (insertError) throw insertError;
        setResources(prev => [...prev, data as CohortResource].sort((a, b) => a.sort_order - b.sort_order));
      }
      handleCloseDialog();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, resource: CohortResource) => {
    setMenuAnchor({ el: e.currentTarget, resource });
  };

  const handleMenuClose = () => setMenuAnchor(null);

  const handleEdit = () => {
    if (menuAnchor) {
      handleOpenDialog(menuAnchor.resource);
      handleMenuClose();
    }
  };

  const handleDeleteClick = () => {
    if (menuAnchor) {
      setDeletingId(menuAnchor.resource.id);
      setDeleteConfirmOpen(true);
      handleMenuClose();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      await supabase.from('cohort_resources').delete().eq('id', deletingId);
      setResources(prev => prev.filter(r => r.id !== deletingId));
    } catch (err) {
      console.error('Error deleting resource:', err);
    } finally {
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    }
  };

  const isLoading = loading || parentLoading;

  if (isLoading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {canManage && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Add resource
          </Button>
        </Box>
      )}

      {resources.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ResourcesIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No resources yet
          </Typography>
          {canManage && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Add links, documents, or education content for your cohort
            </Typography>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {resources.map(resource => (
            <Paper key={resource.id} sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {resource.title}
                  </Typography>
                  {resource.content ? (
                    <Typography
                      component="div"
                      variant="body1"
                      sx={{ whiteSpace: 'pre-wrap', '& a': { color: 'primary.main' } }}
                      dangerouslySetInnerHTML={{ __html: linkifyResourceHtml(resource.content) }}
                    />
                  ) : null}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Added by {getUserDisplayName(resource.author)}
                    {' • '}
                    {format(new Date(resource.created_at), 'MMM d, yyyy')}
                    {resource.updated_at !== resource.created_at && ' (edited)'}
                  </Typography>
                </Box>
                {canManage && (
                  <IconButton size="small" onClick={e => handleMenuOpen(e, resource)}>
                    <MoreIcon />
                  </IconButton>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Menu anchorEl={menuAnchor?.el} open={Boolean(menuAnchor)} onClose={handleMenuClose}>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingResource ? 'Edit resource' : 'Add resource'}</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
          )}
          <TextField
            autoFocus
            label="Title"
            fullWidth
            value={title}
            onChange={e => setTitle(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Content (optional)</Typography>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Links, instructions, or description..."
            minRows={4}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !title.trim()}>
            {saving ? <CircularProgress size={24} /> : editingResource ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Delete resource</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to remove this resource? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CohortResourcesSection;
