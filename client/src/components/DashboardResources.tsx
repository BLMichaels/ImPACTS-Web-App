import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import { getUserData, setUserData } from '../utils/userData';

export interface DashboardResource {
  id: string;
  title: string;
  url: string;
  type: 'link';
  description?: string;
  addedAt: Date;
  tags: string[];
  category: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY_PREFIX = 'dashboard_resources_';

const formatResourceUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('www.')) return `https://${url}`;
  return `https://${url}`;
};

interface DashboardResourcesProps {
  userId: string | undefined;
  isMobile?: boolean;
}

const DashboardResources: React.FC<DashboardResourcesProps> = ({ userId, isMobile = false }) => {
  const [resources, setResources] = useState<DashboardResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentResource, setCurrentResource] = useState<DashboardResource | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    title: '',
    url: '',
    description: '',
    tags: [] as string[],
    category: ''
  });

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      let list: DashboardResource[] = (await getUserData<DashboardResource[]>(userId, 'dashboard_resources')) ?? [];
      if (list.length === 0) {
        try {
          const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
          if (raw) {
            list = JSON.parse(raw);
            if (Array.isArray(list)) { await setUserData(userId, 'dashboard_resources', list); localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`); }
          }
        } catch {}
      }
      if (!mounted) return;
      list = (Array.isArray(list) ? list : []).filter((r) => r.type === 'link' || !r.type).map((r) => ({
        ...r,
        type: 'link' as const,
        addedAt: r.addedAt ? new Date(r.addedAt) : new Date()
      }));
      setResources(list);
      setIsLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) setShowCategoryDropdown(false);
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setShowTagDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const persist = (list: DashboardResource[]) => {
    if (userId) setUserData(userId, 'dashboard_resources', list);
  };

  const getCategories = () => {
    const cats = resources.map((r) => r.category).filter(Boolean).filter(c => c.trim() !== '');
    const uniqueCats = Array.from(new Set(cats));
    return ['All', ...uniqueCats.sort()];
  };

  const getTags = () => Array.from(new Set(resources.flatMap((r) => r.tags || [])));

  const getCategorySuggestions = (input: string) =>
    getCategories().filter((c) => c !== 'All' && c.toLowerCase().includes((input || '').toLowerCase()));

  const getTagSuggestions = (input: string) =>
    getTags().filter((t) => t.toLowerCase().includes((input || '').toLowerCase()));

  const getFiltered = () =>
    resources.filter((r) => {
      const matchSearch =
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (r.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())) ?? false) ||
        (r.category?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchCat = selectedCategory === 'All' || (r.category && r.category.trim() === selectedCategory.trim());
      const matchTags = selectedTags.length === 0 || selectedTags.some((t) => r.tags?.includes(t));
      return matchSearch && matchCat && matchTags;
    });

  const handleAdd = () => {
    if (!form.title.trim() || !form.url.trim()) return;
    const now = new Date().toISOString();
    const newR: DashboardResource = {
      id: Date.now().toString(),
      title: form.title.trim(),
      url: formatResourceUrl(form.url.trim()),
      type: 'link',
      description: form.description.trim() || undefined,
      addedAt: new Date(),
      tags: form.tags,
      category: form.category.trim() || '',
      createdAt: now,
      updatedAt: now
    };
    const next = [...resources, newR];
    setResources(next);
    persist(next);
    setForm({ title: '', url: '', description: '', tags: [], category: '' });
    setNewCategory('');
    setAddDialogOpen(false);
  };

  const handleEdit = (r: DashboardResource) => {
    setCurrentResource(r);
    setForm({
      title: r.title,
      url: r.url,
      description: r.description || '',
      tags: r.tags || [],
      category: r.category || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!currentResource || !form.title.trim() || !form.url.trim()) return;
    const now = new Date().toISOString();
    const updated: DashboardResource = {
      ...currentResource,
      title: form.title.trim(),
      url: formatResourceUrl(form.url.trim()),
      description: form.description.trim() || undefined,
      tags: form.tags,
      category: form.category.trim() || '',
      updatedAt: now
    };
    const next = resources.map((r) => (r.id === currentResource.id ? updated : r));
    setResources(next);
    persist(next);
    setForm({ title: '', url: '', description: '', tags: [], category: '' });
    setNewCategory('');
    setCurrentResource(null);
    setEditDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    const next = resources.filter((r) => r.id !== id);
    setResources(next);
    persist(next);
  };

  const handleCategorySelect = (c: string) => setForm((f) => ({ ...f, category: c }));
  const handleTagSelect = (tag: string) => {
    if (!form.tags.includes(tag)) setForm((f) => ({ ...f, tags: [...f.tags, tag] }));
  };
  const handleRemoveTag = (tag: string) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

  const handleResourceClick = (url: string) => {
    window.open(formatResourceUrl(url), '_blank', 'noopener,noreferrer');
  };

  const filtered = getFiltered();

  const renderFormFields = (isEdit: boolean) => (
    <>
      <TextField
        fullWidth
        label="Resource Title"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        margin="normal"
        required
      />
      <TextField
        fullWidth
        label="Web link (URL)"
        value={form.url}
        onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
        margin="normal"
        placeholder="https://..."
        required
      />
      <TextField
        fullWidth
        label="Description (Optional)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        margin="normal"
        multiline
        rows={3}
      />
      <Box sx={{ mt: 2 }}>
        <Box sx={{ position: 'relative', mb: 2 }} ref={categoryDropdownRef}>
          <TextField
            fullWidth
            label="Category"
            value={form.category}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({ ...f, category: v }));
              setCategorySuggestions(getCategorySuggestions(v));
              setShowCategoryDropdown(!!v.trim());
            }}
            onFocus={() => {
              setCategorySuggestions(getCategorySuggestions(form.category));
              setShowCategoryDropdown(!!form.category.trim());
            }}
            margin="normal"
            placeholder="e.g., Guidelines, Tools, Training"
          />
          {showCategoryDropdown && categorySuggestions.length > 0 && (
            <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, bgcolor: 'white', border: 1, borderColor: 'grey.300', borderRadius: 1, boxShadow: 2, maxHeight: 200, overflow: 'auto' }}>
              {categorySuggestions.map((c) => (
                <Box key={c} sx={{ p: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' }, borderBottom: 1, borderColor: 'grey.200' }} onClick={() => { handleCategorySelect(c); setShowCategoryDropdown(false); }}>
                  <Typography variant="body2">{c}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ position: 'relative', mb: 2 }} ref={tagDropdownRef}>
          <TextField
            fullWidth
            label="Tags"
            value={newTag}
            onChange={(e) => {
              const v = e.target.value;
              setNewTag(v);
              setTagSuggestions(getTagSuggestions(v));
              setShowTagDropdown(!!v.trim());
            }}
            onFocus={() => { setTagSuggestions(getTagSuggestions(newTag)); setShowTagDropdown(!!newTag.trim()); }}
            margin="normal"
            placeholder="Type to add tags..."
            helperText="Type and press Enter to add a new tag"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTag.trim()) {
                if (!form.tags.includes(newTag.trim())) setForm((f) => ({ ...f, tags: [...f.tags, newTag.trim()] }));
                setNewTag('');
                setShowTagDropdown(false);
              }
            }}
          />
          {showTagDropdown && tagSuggestions.length > 0 && (
            <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, bgcolor: 'white', border: 1, borderColor: 'grey.300', borderRadius: 1, boxShadow: 2, maxHeight: 200, overflow: 'auto' }}>
              {tagSuggestions.map((t) => (
                <Box key={t} sx={{ p: 1, cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' }, borderBottom: 1, borderColor: 'grey.200' }} onClick={() => { handleTagSelect(t); setNewTag(''); setShowTagDropdown(false); }}>
                  <Typography variant="body2">{t}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        {form.tags.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Selected Tags:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {form.tags.map((t) => (
                <Chip key={t} label={t} size="small" onDelete={() => handleRemoveTag(t)} sx={{ fontSize: '0.8rem' }} />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </>
  );

  if (!userId) return null;

  return (
    <Box sx={{ mt: 10, mb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" color="primary">Resources & Tools</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)} sx={{ fontSize: '0.875rem' }}>
          Add Resource
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quick access to frequently used web links
      </Typography>

      <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} label="Category">
                {getCategories().map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={selectedTags}
                onChange={(e) => setSelectedTags(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}
                label="Tags"
                renderValue={(sel) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{(Array.isArray(sel) ? sel : []).map((v) => <Chip key={v} label={v} size="small" />)}</Box>
                )}
              >
                {getTags().map((t) => (
                  <MenuItem key={t} value={t}>
                    <Checkbox checked={selectedTags.indexOf(t) > -1} />
                    <ListItemText primary={t} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button variant="outlined" size="small" onClick={() => { setSearchTerm(''); setSelectedCategory('All'); setSelectedTags([]); }}>
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={isMobile ? 1 : 2}>
        {isLoading ? (
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Loading resources...</Typography>
          </Grid>
        ) : filtered.length === 0 ? (
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No resources found. Add your first web link to get started!</Typography>
          </Grid>
        ) : (
          filtered.map((r) => (
            <Grid item xs={12} sm={6} md={4} key={r.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Chip icon={<LinkIcon />} label="LINK" color="primary" size="small" sx={{ mr: 1 }} />
                    {r.category && <Chip label={r.category} size="small" variant="outlined" sx={{ mr: 1 }} />}
                    <Box sx={{ ml: 'auto' }}>
                      <IconButton size="small" onClick={() => handleEdit(r)} sx={{ mr: 0.5 }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ flexGrow: 1 }}>{r.title}</Typography>
                  {r.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flexGrow: 1 }}>{r.description}</Typography>}
                  {r.tags?.length > 0 && (
                    <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {r.tags.map((t) => <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />)}
                    </Box>
                  )}
                  <Box sx={{ mt: 'auto' }}>
                    <Tooltip title="Click to open webpage" arrow placement="top">
                      <Box onClick={() => handleResourceClick(r.url)} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}>
                        <LinkIcon sx={{ mr: 0.5, fontSize: '1rem' }} /> Access Resource
                      </Box>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Resource</DialogTitle>
        <DialogContent>{renderFormFields(false)}</DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" disabled={!form.title.trim() || !form.url.trim()}>Add Resource</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Resource</DialogTitle>
        <DialogContent>{renderFormFields(true)}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={!form.title.trim() || !form.url.trim()}>Update Resource</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardResources;
