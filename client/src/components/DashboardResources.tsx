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
  Tooltip,
  Stack,
  Paper,
  alpha,
  useTheme,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
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
const VIEW_MODE_KEY_PREFIX = 'dashboard_resources_view_';

type ResourceViewMode = 'cards' | 'list';

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
  const theme = useTheme();
  const [resources, setResources] = useState<DashboardResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ResourceViewMode>('cards');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentResource, setCurrentResource] = useState<DashboardResource | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [, setNewCategory] = useState('');
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
    try {
      const saved = localStorage.getItem(`${VIEW_MODE_KEY_PREFIX}${userId}`);
      if (saved === 'list' || saved === 'cards') setViewMode(saved);
    } catch {
      /* ignore */
    }
  }, [userId]);

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, next: ResourceViewMode | null) => {
    if (!next) return;
    setViewMode(next);
    if (userId) {
      try {
        localStorage.setItem(`${VIEW_MODE_KEY_PREFIX}${userId}`, next);
      } catch {
        /* ignore */
      }
    }
  };
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
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
          >
            Library
          </Typography>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: { xs: '1.15rem', md: '1.25rem' } }}>
            Resources & tools
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.55 }}>
            Quick access to the web links you use most
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
            aria-label="Resource view mode"
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '& .MuiToggleButton-root': {
                border: 0,
                px: 1.25,
                py: 0.75,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: 'text.secondary',
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.secondary.main, 0.12),
                  color: 'secondary.dark',
                  '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.18) },
                },
              },
            }}
          >
            <ToggleButton value="cards" aria-label="Card view">
              <ViewModuleIcon sx={{ fontSize: 18, mr: 0.75 }} />
              Cards
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <ViewListIcon sx={{ fontSize: 18, mr: 0.75 }} />
              List
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
            size="small"
            sx={{ flex: { xs: 1, sm: 'none' } }}
          >
            Add resource
          </Button>
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          mb: 2,
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.secondary.main, 0.03),
        }}
      >
        <Grid container spacing={isMobile ? 1.5 : 2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search resources…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} label="Category">
                {getCategories().map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={selectedTags}
                onChange={(e) =>
                  setSelectedTags(
                    typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[])
                  )
                }
                label="Tags"
                renderValue={(sel) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(Array.isArray(sel) ? sel : []).map((v) => (
                      <Chip key={v} label={v} size="small" />
                    ))}
                  </Box>
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
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedTags([]);
              }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {isLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Loading resources…
        </Typography>
      ) : filtered.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            py: 5,
            px: 2,
            textAlign: 'center',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            No resources yet. Add a web link to build your personal toolkit.
          </Typography>
        </Paper>
      ) : viewMode === 'list' ? (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Table size="small" aria-label="Resources list">
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    letterSpacing: 0.04,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    borderBottomColor: 'divider',
                    py: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                  },
                }}
              >
                <TableCell>Title</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Category</TableCell>
                <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Tags</TableCell>
                <TableCell align="right" sx={{ width: 140 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  hover
                  sx={{
                    '& td': { borderBottomColor: 'divider', py: 1.1, verticalAlign: 'middle' },
                  }}
                >
                  <TableCell>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, letterSpacing: -0.01, lineHeight: 1.3 }}>
                      {r.title}
                    </Typography>
                    {r.description ? (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.25,
                          lineHeight: 1.45,
                          fontSize: '0.8125rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {r.description}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    {r.category ? (
                      <Chip label={r.category} size="small" variant="outlined" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                    {r.tags?.length ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {r.tags.slice(0, 3).map((t) => (
                          <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        ))}
                        {r.tags.length > 3 ? (
                          <Chip label={`+${r.tags.length - 3}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        ) : null}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Open in a new tab">
                      <IconButton size="small" onClick={() => handleResourceClick(r.url)} aria-label={`Open ${r.title}`}>
                        <LinkIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => handleEdit(r)} aria-label={`Edit ${r.title}`}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(r.id)} aria-label={`Delete ${r.title}`}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Grid container spacing={isMobile ? 1.5 : 2}>
          {filtered.map((r) => (
            <Grid item xs={12} sm={6} md={4} key={r.id}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': {
                    borderColor: alpha(theme.palette.secondary.main, 0.35),
                    boxShadow: `0 6px 20px ${alpha(theme.palette.secondary.main, 0.08)}`,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.25, gap: 0.75 }}>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
                      <Chip
                        icon={<LinkIcon />}
                        label="Link"
                        size="small"
                        sx={{
                          bgcolor: alpha(theme.palette.secondary.main, 0.1),
                          color: 'secondary.dark',
                          fontWeight: 600,
                          '& .MuiChip-icon': { color: 'secondary.dark' },
                        }}
                      />
                      {r.category ? <Chip label={r.category} size="small" variant="outlined" /> : null}
                    </Stack>
                    <Box sx={{ flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => handleEdit(r)} aria-label={`Edit ${r.title}`}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(r.id)} aria-label={`Delete ${r.title}`}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: -0.01, mb: 0.75, lineHeight: 1.35 }}>
                    {r.title}
                  </Typography>
                  {r.description ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flexGrow: 1, lineHeight: 1.55 }}>
                      {r.description}
                    </Typography>
                  ) : (
                    <Box sx={{ flexGrow: 1 }} />
                  )}
                  {r.tags?.length > 0 && (
                    <Box sx={{ mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {r.tags.map((t) => (
                        <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ))}
                    </Box>
                  )}
                  <Box sx={{ mt: 'auto' }}>
                    <Tooltip title="Open in a new tab" arrow placement="top">
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        onClick={() => handleResourceClick(r.url)}
                        sx={{ px: 0, minWidth: 0, fontWeight: 600 }}
                      >
                        Open link
                      </Button>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Resource</DialogTitle>
        <DialogContent>{renderFormFields(false)}</DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} variant="contained" disabled={!form.title.trim() || !form.url.trim()}>
            Add Resource
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Resource</DialogTitle>
        <DialogContent>{renderFormFields(true)}</DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained" disabled={!form.title.trim() || !form.url.trim()}>
            Update Resource
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardResources;
