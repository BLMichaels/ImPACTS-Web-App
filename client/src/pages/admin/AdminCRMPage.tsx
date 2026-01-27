import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Chip,
  Avatar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Drawer,
  Checkbox,
  Tooltip,
  alpha,
  useTheme,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  MoreVert as MoreIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
  ViewModule as GridIcon,
  ViewList as TableIcon,
  ViewColumn as ViewColumnIcon,
  Clear as ClearIcon,
  Edit as EditIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Sort as SortIcon,
  Delete as DeleteIcon,
  Contacts as ContactsIcon
} from '@mui/icons-material';

export type ContactType = 'organization' | 'hospital' | 'manager' | 'mentor' | 'pecc' | 'other';

interface Contact {
  id: string;
  type: ContactType;
  name: string;
  organization: string;
  email: string;
  phone: string;
  status: string;
  region: string;
  createdAt: string;
  updatedAt?: string;
  lastContactAt?: string;
  notes: string;
  tags?: string[];
}

type SortField = 'name' | 'email' | 'type' | 'status' | 'region' | 'organization' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const TYPE_LABELS: Record<ContactType, string> = {
  organization: 'Organization',
  hospital: 'Hospital',
  manager: 'Manager',
  mentor: 'Mentor',
  pecc: 'PECC',
  other: 'Other'
};

const TYPE_COLORS: Record<ContactType, string> = {
  organization: '#2196f3',
  hospital: '#4caf50',
  manager: '#9c27b0',
  mentor: '#ff9800',
  pecc: '#e91e63',
  other: '#607d8b'
};

const COLUMNS: { id: SortField | 'phone' | 'actions'; label: string; sortable?: boolean; defaultVisible?: boolean }[] = [
  { id: 'name', label: 'Name', sortable: true, defaultVisible: true },
  { id: 'type', label: 'Type', sortable: true, defaultVisible: true },
  { id: 'organization', label: 'Organization', sortable: true, defaultVisible: true },
  { id: 'email', label: 'Email', sortable: true, defaultVisible: true },
  { id: 'phone', label: 'Phone', sortable: false, defaultVisible: true },
  { id: 'region', label: 'Region', sortable: true, defaultVisible: true },
  { id: 'status', label: 'Status', sortable: true, defaultVisible: true },
  { id: 'createdAt', label: 'Added', sortable: true, defaultVisible: true },
  { id: 'actions', label: '', sortable: false, defaultVisible: true }
];

const CRM_PREFS_KEY = 'adminCrm_prefs';

const AdminCRMPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.viewMode === 'grid' || p.viewMode === 'table') return p.viewMode;
      }
    } catch {}
    return 'table';
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.visibleColumns && Array.isArray(p.visibleColumns)) {
          const valid = new Set((p.visibleColumns as string[]).filter(id => COLUMNS.some(c => c.id === id)));
          if (valid.size > 0) return valid;
        }
      }
    } catch {}
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ single?: string; bulk?: Set<string> } | null>(null);
  const [bulkStatusAnchor, setBulkStatusAnchor] = useState<null | HTMLElement>(null);

  const [formData, setFormData] = useState({
    type: 'other' as ContactType,
    name: '',
    organization: '',
    email: '',
    phone: '',
    status: 'Active',
    region: '',
    notes: ''
  });

  useEffect(() => {
    setLoading(true);
    // TODO: load from Supabase; for now start empty
    setContacts([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CRM_PREFS_KEY, JSON.stringify({
        viewMode,
        visibleColumns: Array.from(visibleColumns)
      }));
    } catch {}
  }, [viewMode, visibleColumns]);

  const regions = useMemo(() => [...new Set(contacts.map(c => c.region).filter(Boolean))] as string[], [contacts]);

  const filteredAndSortedContacts = useMemo(() => {
    let list = contacts.filter(contact => {
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.region || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (tabValue === 0) {}
      else if (tabValue === 1 && contact.type !== 'organization') return false;
      else if (tabValue === 2 && contact.type !== 'hospital') return false;
      else if (tabValue === 3 && contact.type !== 'manager') return false;
      else if (tabValue === 4 && contact.type !== 'mentor') return false;
      else if (tabValue === 5 && contact.type !== 'pecc') return false;
      else if (tabValue === 6 && contact.type !== 'other') return false;

      if (statusFilter.length && !statusFilter.includes(contact.status)) return false;
      if (regionFilter.length && !regionFilter.includes(contact.region)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let av: string | number = a[sortField] ?? '';
      let bv: string | number = b[sortField] ?? '';
      if (sortField === 'createdAt') {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [contacts, searchQuery, tabValue, sortField, sortOrder, statusFilter, regionFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else setSortField(field);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filteredAndSortedContacts.map(c => c.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSaveContact = () => {
    const payload = {
      id: editingContact?.id ?? `contact_${Date.now()}`,
      ...formData,
      type: formData.type,
      createdAt: editingContact?.createdAt ?? new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0]
    };
    if (editingContact) {
      setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
    } else {
      setContacts(prev => [...prev, payload as Contact]);
    }
    setDialogOpen(false);
    setEditingContact(null);
    setFormData({ type: 'other', name: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '' });
  };

  const openDetail = (c: Contact) => {
    setDetailContact(c);
    setDrawerOpen(true);
  };

  const handleExport = () => {
    const headers = ['Name', 'Type', 'Organization', 'Email', 'Phone', 'Region', 'Status', 'Added'];
    const rows = (selectedIds.size ? filteredAndSortedContacts.filter(c => selectedIds.has(c.id)) : filteredAndSortedContacts)
      .map(c => [c.name, TYPE_LABELS[c.type], c.organization || '', c.email, c.phone || '', c.region || '', c.status, c.createdAt]);
    const csv = [headers.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `crm-contacts-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter([]);
    setRegionFilter([]);
    setFilterMenuAnchor(null);
  };

  const hasActiveFilters = searchQuery || statusFilter.length > 0 || regionFilter.length > 0;

  const summaryCounts = useMemo(() => ({
    all: contacts.length,
    organization: contacts.filter(c => c.type === 'organization').length,
    hospital: contacts.filter(c => c.type === 'hospital').length,
    manager: contacts.filter(c => c.type === 'manager').length,
    mentor: contacts.filter(c => c.type === 'mentor').length,
    pecc: contacts.filter(c => c.type === 'pecc').length,
    other: contacts.filter(c => c.type === 'other').length,
    pending: contacts.filter(c => c.status === 'Pending').length
  }), [contacts]);

  const activePendingFilter = statusFilter.includes('Pending') && statusFilter.length === 1 && !searchQuery && regionFilter.length === 0;

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    if (detailContact?.id === id) { setDrawerOpen(false); setDetailContact(null); }
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const handleBulkDelete = () => {
    if (!deleteTarget?.bulk) return;
    setContacts(prev => prev.filter(c => !deleteTarget.bulk!.has(c.id)));
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setSelectedIds(new Set());
    if (detailContact && deleteTarget.bulk.has(detailContact.id)) { setDrawerOpen(false); setDetailContact(null); }
  };

  const handleBulkStatusChange = (status: string) => {
    setContacts(prev => prev.map(c => selectedIds.has(c.id) ? { ...c, status } : c));
    setBulkStatusAnchor(null);
  };

  return (
    <Box sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>CRM</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage organizations, hospitals, and contacts
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="Export filtered contacts as CSV">
            <Button startIcon={<DownloadIcon />} onClick={handleExport} size="medium">
              Export
            </Button>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingContact(null); setFormData({ type: 'other', name: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '' }); setDialogOpen(true); }}>
            Add Contact
          </Button>
        </Box>
      </Box>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'all', label: 'All', count: summaryCounts.all },
          { key: 'organization', label: 'Organizations', count: summaryCounts.organization },
          { key: 'hospital', label: 'Hospitals', count: summaryCounts.hospital },
          { key: 'manager', label: 'Managers', count: summaryCounts.manager },
          { key: 'mentor', label: 'Mentors', count: summaryCounts.mentor },
          { key: 'pecc', label: 'PECCs', count: summaryCounts.pecc },
          { key: 'other', label: 'Other', count: summaryCounts.other },
          { key: 'pending', label: 'Pending', count: summaryCounts.pending }
        ].map(({ key, label, count }) => {
          const isPending = key === 'pending';
          const isAll = key === 'all';
          const isActive = isPending ? activePendingFilter : isAll ? tabValue === 0 && !activePendingFilter : tabValue > 0 && ['organization', 'hospital', 'manager', 'mentor', 'pecc', 'other'][tabValue - 1] === key;
          const borderColor = isPending ? theme.palette.warning.main : isAll ? theme.palette.primary.main : TYPE_COLORS[key as ContactType] || theme.palette.grey[400];
          return (
            <Grid item xs={6} sm={4} md={2} key={key}>
              <Paper
                onClick={() => {
                  if (isPending) { setTabValue(0); setStatusFilter(['Pending']); }
                  else if (isAll) { setTabValue(0); setStatusFilter([]); }
                  else { setTabValue(['organization', 'hospital', 'manager', 'mentor', 'pecc', 'other'].indexOf(key) + 1); setStatusFilter([]); }
                }}
                sx={{
                  p: 2,
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderTop: 3,
                  borderColor,
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
                }}
              >
                {loading ? (
                  <Skeleton variant="text" width={40} height={36} sx={{ mx: 'auto' }} />
                ) : (
                  <Typography variant="h5" fontWeight={700} sx={{ color: isPending ? 'warning.main' : isAll ? 'primary.main' : TYPE_COLORS[key as ContactType] || 'text.primary' }}>
                    {count}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">{label}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Toolbar: tabs, view mode, search, filters */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="All" />
            <Tab label="Organizations" />
            <Tab label="Hospitals" />
            <Tab label="Managers" />
            <Tab label="Mentors" />
            <Tab label="PECCs" />
            <Tab label="Other" />
          </Tabs>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: 2 }}>
          <TextField
            size="small"
            placeholder="Search name, email, organization, region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>
            }}
            sx={{ minWidth: 280 }}
          />
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
            variant={hasActiveFilters ? 'contained' : 'outlined'}
          >
            Filters {hasActiveFilters ? `(${statusFilter.length + regionFilter.length})` : ''}
          </Button>
          <Menu anchorEl={filterMenuAnchor} open={Boolean(filterMenuAnchor)} onClose={() => setFilterMenuAnchor(null)}>
            <ListItem dense>
              <ListItemText primary="Status" secondary={statusFilter.join(', ') || 'Any'} />
            </ListItem>
            {['Active', 'Inactive', 'Pending'].map(s => (
              <MenuItem key={s} onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>
                <Checkbox checked={statusFilter.includes(s)} size="small" />
                <ListItemText primary={s} />
              </MenuItem>
            ))}
            <Divider />
            <ListItem dense>
              <ListItemText primary="Region" secondary={regionFilter.join(', ') || 'Any'} />
            </ListItem>
            {regions.slice(0, 12).map(r => (
              <MenuItem key={r} onClick={() => setRegionFilter(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}>
                <Checkbox checked={regionFilter.includes(r)} size="small" />
                <ListItemText primary={r || '(blank)'} />
              </MenuItem>
            ))}
            <MenuItem onClick={clearFilters}><ClearIcon fontSize="small" sx={{ mr: 1 }} /> Clear filters</MenuItem>
          </Menu>
          <Button size="small" startIcon={<ViewColumnIcon />} onClick={(e) => setColumnMenuAnchor(e.currentTarget)} variant="outlined">
            Columns
          </Button>
          <Menu anchorEl={columnMenuAnchor} open={Boolean(columnMenuAnchor)} onClose={() => setColumnMenuAnchor(null)}>
            {COLUMNS.filter(c => c.id !== 'actions').map((col) => (
              <MenuItem
                key={col.id}
                onClick={() => setVisibleColumns(prev => { const n = new Set(prev); if (n.has(col.id)) n.delete(col.id); else n.add(col.id); return n; })}
              >
                <Checkbox checked={visibleColumns.has(col.id)} size="small" />
                <ListItemText primary={col.label} />
              </MenuItem>
            ))}
          </Menu>
          <Button size="small" startIcon={<TableIcon />} onClick={() => setViewMode('table')} variant={viewMode === 'table' ? 'contained' : 'outlined'}>
            Table
          </Button>
          <Button size="small" startIcon={<GridIcon />} onClick={() => setViewMode('grid')} variant={viewMode === 'grid' ? 'contained' : 'outlined'}>
            Cards
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {selectedIds.size > 0 && (
            <Chip
              label={`${selectedIds.size} selected`}
              onDelete={() => setSelectedIds(new Set())}
              sx={{ mr: 1 }}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            {filteredAndSortedContacts.length} contact{filteredAndSortedContacts.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Paper>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Paper sx={{ mb: 2, py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: alpha(theme.palette.primary.main, 0.06), border: '1px solid', borderColor: 'primary.main' }}>
          <Chip label={`${selectedIds.size} selected`} color="primary" onDelete={() => setSelectedIds(new Set())} />
          <Button size="small" variant="outlined" startIcon={<FilterIcon />} onClick={(e) => setBulkStatusAnchor(e.currentTarget)}>
            Change status
          </Button>
          <Menu anchorEl={bulkStatusAnchor} open={Boolean(bulkStatusAnchor)} onClose={() => setBulkStatusAnchor(null)}>
            {['Active', 'Inactive', 'Pending'].map(s => (
              <MenuItem key={s} onClick={() => handleBulkStatusChange(s)}>{s}</MenuItem>
            ))}
          </Menu>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => { setDeleteTarget({ bulk: new Set(selectedIds) }); setDeleteConfirmOpen(true); }}>
            Delete selected
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
        </Paper>
      )}

      {/* Content */}
      {loading ? (
        <Paper sx={{ p: 4 }}>
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5].map(i => (
              <Grid item xs={12} key={i}><Skeleton variant="rectangular" height={52} /></Grid>
            ))}
          </Grid>
        </Paper>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {filteredAndSortedContacts.length === 0 ? (
            <Grid item xs={12}>
              <Paper sx={{ py: 10, px: 3, textAlign: 'center' }}>
                <ContactsIcon sx={{ fontSize: 80, color: 'action.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto', mb: 3 }}>
                  {hasActiveFilters ? 'Try clearing filters or search, or add a new contact.' : 'Add organizations, hospitals, and people to build your CRM.'}
                </Typography>
                <Button startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setEditingContact(null); setFormData({ type: 'other', name: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '' }); }} variant="contained" size="large">
                  {hasActiveFilters ? 'Add contact' : 'Add your first contact'}
                </Button>
              </Paper>
            </Grid>
          ) : (
            filteredAndSortedContacts.map((contact) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={contact.id}>
                <Paper
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 2 },
                    borderLeft: 4,
                    borderColor: TYPE_COLORS[contact.type]
                  }}
                  onClick={() => openDetail(contact)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Avatar sx={{ bgcolor: TYPE_COLORS[contact.type], width: 40, height: 40 }}>
                      {(contact.name || '?')[0].toUpperCase()}
                    </Avatar>
                    <Chip label={TYPE_LABELS[contact.type]} size="small" sx={{ bgcolor: alpha(TYPE_COLORS[contact.type], 0.2), color: TYPE_COLORS[contact.type] }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={600} noWrap>{contact.name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{contact.organization || '—'}</Typography>
                  <Typography variant="body2" noWrap sx={{ mt: 0.5 }}>{contact.email}</Typography>
                  <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : 'default'} sx={{ mt: 1 }} />
                </Paper>
              </Grid>
            ))
          )}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={filteredAndSortedContacts.length > 0 && selectedIds.size === filteredAndSortedContacts.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAndSortedContacts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                {COLUMNS.filter(c => c.id !== 'actions' && visibleColumns.has(c.id)).map((col) => (
                  <TableCell key={col.id}>
                    {col.sortable ? (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSort(col.id as SortField)}>
                        {col.label}
                        <SortIcon sx={{ fontSize: 16, ml: 0.5, opacity: sortField === col.id ? 1 : 0.4 }} />
                        {sortField === col.id && <Typography component="span" variant="caption" sx={{ ml: 0.25 }}>({sortOrder})</Typography>}
                      </Box>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
                {visibleColumns.has('actions') && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAndSortedContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 10 }}>
                    <ContactsIcon sx={{ fontSize: 64, color: 'action.disabled', display: 'block', mx: 'auto', mb: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      {hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
                    </Typography>
                    <Button startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setEditingContact(null); setFormData({ type: 'other', name: '', organization: '', email: '', phone: '', status: 'Active', region: '', notes: '' }); }} variant="contained" sx={{ mt: 2 }}>
                      {hasActiveFilters ? 'Add contact' : 'Add your first contact'}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedContacts.map((contact) => (
                  <TableRow
                    key={contact.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openDetail(contact)}
                  >
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(contact.id)}
                        onChange={(e) => handleSelectOne(contact.id, e.target.checked)}
                      />
                    </TableCell>
                    {visibleColumns.has('name') && (
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: TYPE_COLORS[contact.type], fontSize: '0.875rem' }}>
                            {(contact.name || '?')[0].toUpperCase()}
                          </Avatar>
                          <Typography fontWeight={500}>{contact.name}</Typography>
                        </Box>
                      </TableCell>
                    )}
                    {visibleColumns.has('type') && (
                      <TableCell>
                        <Chip label={TYPE_LABELS[contact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[contact.type], color: 'white' }} />
                      </TableCell>
                    )}
                    {visibleColumns.has('organization') && <TableCell>{contact.organization || '—'}</TableCell>}
                    {visibleColumns.has('email') && <TableCell>{contact.email}</TableCell>}
                    {visibleColumns.has('phone') && <TableCell>{contact.phone || '—'}</TableCell>}
                    {visibleColumns.has('region') && <TableCell>{contact.region || '—'}</TableCell>}
                    {visibleColumns.has('status') && (
                      <TableCell>
                        <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                    )}
                    {visibleColumns.has('createdAt') && <TableCell>{contact.createdAt}</TableCell>}
                    {visibleColumns.has('actions') && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); setDetailContact(contact); }}>
                          <MoreIcon />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Row actions menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { if (detailContact) openDetail(detailContact); setAnchorEl(null); }}>View details</MenuItem>
        <MenuItem onClick={() => { if (detailContact) { setEditingContact(detailContact); setFormData({ type: detailContact.type, name: detailContact.name, organization: detailContact.organization, email: detailContact.email, phone: detailContact.phone, status: detailContact.status, region: detailContact.region, notes: detailContact.notes }); setDialogOpen(true); } setAnchorEl(null); }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><EmailIcon fontSize="small" sx={{ mr: 1 }} /> Email</MenuItem>
        <MenuItem onClick={() => { if (detailContact) { setDeleteTarget({ single: detailContact.id }); setDeleteConfirmOpen(true); } setAnchorEl(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
        <DialogTitle>
          {deleteTarget?.bulk ? `Delete ${deleteTarget.bulk.size} contacts?` : 'Delete contact?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {deleteTarget?.bulk
              ? 'These contacts will be removed. This cannot be undone.'
              : 'This contact will be removed. This cannot be undone.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteTarget?.single ? handleDeleteContact(deleteTarget.single) : handleBulkDelete()}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}>
        {detailContact && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Contact</Typography>
              <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Avatar sx={{ width: 64, height: 64, bgcolor: TYPE_COLORS[detailContact.type], fontSize: '1.5rem', mb: 2 }}>
              {(detailContact.name || '?')[0].toUpperCase()}
            </Avatar>
            <Typography variant="h6">{detailContact.name}</Typography>
            <Chip label={TYPE_LABELS[detailContact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[detailContact.type], color: 'white', my: 1 }} />
            <List dense>
              <ListItem><ListItemIcon><BusinessIcon fontSize="small" /></ListItemIcon><ListItemText primary="Organization" secondary={detailContact.organization || '—'} /></ListItem>
              <ListItem><ListItemIcon><EmailIcon fontSize="small" /></ListItemIcon><ListItemText primary="Email" secondary={detailContact.email} /></ListItem>
              <ListItem><ListItemIcon><PhoneIcon fontSize="small" /></ListItemIcon><ListItemText primary="Phone" secondary={detailContact.phone || '—'} /></ListItem>
              <ListItem><ListItemText primary="Region" secondary={detailContact.region || '—'} /></ListItem>
              <ListItem><ListItemText primary="Status" secondary={detailContact.status} /></ListItem>
              <ListItem><ListItemText primary="Added" secondary={detailContact.createdAt} /></ListItem>
            </List>
            {detailContact.notes && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{detailContact.notes}</Typography>
              </>
            )}
            <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
              <Button fullWidth variant="outlined" startIcon={<EditIcon />} onClick={() => { setEditingContact(detailContact); setFormData({ type: detailContact.type, name: detailContact.name, organization: detailContact.organization, email: detailContact.email, phone: detailContact.phone, status: detailContact.status, region: detailContact.region, notes: detailContact.notes }); setDrawerOpen(false); setDialogOpen(true); }}>
                Edit
              </Button>
              <Button fullWidth variant="contained" startIcon={<EmailIcon />}>Email</Button>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingContact(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as ContactType }))} label="Type">
                  {Object.entries(TYPE_LABELS).map(([val, label]) => <MenuItem key={val} value={val}>{label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Name" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} fullWidth size="small" required />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Organization" value={formData.organization} onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Phone" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Region" value={formData.region} onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))} fullWidth size="small" />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} label="Status">
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Notes" value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} fullWidth size="small" multiline rows={3} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); setEditingContact(null); }}>Cancel</Button>
          <Button onClick={handleSaveContact} variant="contained">{editingContact ? 'Save changes' : 'Save contact'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCRMPage;
