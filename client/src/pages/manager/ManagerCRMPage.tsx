import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
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
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Tooltip,
  alpha,
  useTheme,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Sort as SortIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Download as DownloadIcon,
  ViewModule as GridIcon,
  ViewList as TableIcon,
  ViewColumn as ViewColumnIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Contacts as ContactsIcon
} from '@mui/icons-material';

type ManagerContactType = 'hospital' | 'mentor' | 'pecc';

interface Contact {
  id: string;
  type: ManagerContactType;
  name: string;
  organization: string;
  email: string;
  phone: string;
  status: string;
  lastContact: string;
  assignedTo: string;
  notes?: string;
}

type SortField = 'name' | 'organization' | 'status' | 'lastContact' | 'assignedTo' | 'type';
type SortOrder = 'asc' | 'desc';

const TYPE_LABELS: Record<ManagerContactType, string> = {
  hospital: 'Hospital',
  mentor: 'Mentor',
  pecc: 'PECC'
};

const TYPE_COLORS: Record<ManagerContactType, string> = {
  hospital: '#1976d2',
  mentor: '#388e3c',
  pecc: '#7b1fa2'
};

const COLUMNS: { id: string; label: string; sortable?: boolean; defaultVisible?: boolean }[] = [
  { id: 'type', label: 'Type', sortable: true, defaultVisible: true },
  { id: 'name', label: 'Name', sortable: true, defaultVisible: true },
  { id: 'organization', label: 'Organization', sortable: true, defaultVisible: true },
  { id: 'email', label: 'Email', sortable: false, defaultVisible: true },
  { id: 'phone', label: 'Phone', sortable: false, defaultVisible: true },
  { id: 'status', label: 'Status', sortable: true, defaultVisible: true },
  { id: 'assignedTo', label: 'Assigned To', sortable: true, defaultVisible: true },
  { id: 'lastContact', label: 'Last Contact', sortable: true, defaultVisible: true },
  { id: 'actions', label: '', sortable: false, defaultVisible: true }
];

const CRM_PREFS_KEY = 'managerCrm_prefs';
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 1000, 'all'] as const;
type PageSize = number | 'all';

const ManagerCRMPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        const v = p.pageSize as unknown;
        if (v === 'all') return 'all';
        if (typeof v === 'number' && [25, 50, 100, 250, 1000].includes(v)) return v as PageSize;
      }
    } catch {}
    return 25;
  });
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) { const p = JSON.parse(s); if (p.viewMode === 'grid' || p.viewMode === 'table') return p.viewMode; }
    } catch {}
    return 'table';
  });
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    try {
      const s = localStorage.getItem(CRM_PREFS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.visibleColumns && Array.isArray(p.visibleColumns)) {
          const valid = new Set((p.visibleColumns as string[]).filter((id: string) => COLUMNS.some(c => c.id === id)));
          if (valid.size > 0) return valid;
        }
      }
    } catch {}
    return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    type: 'hospital' as ManagerContactType,
    name: '',
    organization: '',
    email: '',
    phone: '',
    status: 'Active',
    assignedTo: '',
    lastContact: '',
    notes: ''
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ single?: string; bulk?: Set<string> } | null>(null);
  const [bulkStatusAnchor, setBulkStatusAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const list: Contact[] = [];
      try {
        const { data: hospitalsData, error: hospitalsError } = await supabase.from('hospitals').select('id, facility_id, name, company_name, phone, region, created_at');
        if (mounted && !hospitalsError && hospitalsData?.length) {
          for (const row of hospitalsData as { id: string; facility_id?: string; name: string; company_name?: string; phone?: string; region?: string; created_at?: string }[]) {
            const id = String(row.facility_id ?? row.id ?? '');
            list.push({
              id,
              type: 'hospital',
              name: String(row.name ?? 'Unknown'),
              organization: String(row.company_name ?? ''),
              email: '',
              phone: String(row.phone ?? ''),
              status: 'Active',
              lastContact: '',
              assignedTo: 'Unassigned',
              notes: ''
            });
          }
        }
        if (mounted) {
          const { data: usersData, error: usersError } = await supabase.from('users').select('id, email, first_name, last_name, phone, role, is_active, created_at');
          if (!usersError && usersData?.length) {
            const userRows = usersData as { id: string; email: string; first_name?: string; last_name?: string; phone?: string; role: string; is_active: boolean; created_at?: string }[];
            const crmRoles = ['mentor', 'pecc'];
            for (const u of userRows) {
              const role = (u.role && typeof u.role === 'string' ? u.role.toLowerCase() : '') as string;
              if (!crmRoles.includes(role)) continue;
              const roleType = role as 'mentor' | 'pecc';
              const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || '—';
              list.push({
                id: u.id,
                type: roleType,
                name: displayName,
                organization: '',
                email: u.email ?? '',
                phone: u.phone ?? '',
                status: u.is_active ? 'Active' : 'Inactive',
                lastContact: '',
                assignedTo: 'Unassigned',
                notes: ''
              });
            }
          }
        }
      } catch (_) {
        if (mounted) list.length = 0;
      }
      if (mounted) {
        setContacts(list);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CRM_PREFS_KEY, JSON.stringify({ viewMode, visibleColumns: Array.from(visibleColumns), pageSize }));
    } catch {}
  }, [viewMode, visibleColumns, pageSize]);

  const filteredAndSortedContacts = useMemo(() => {
    let list = contacts.filter(contact => {
      const matchesSearch =
        !searchQuery ||
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.assignedTo || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (tabValue === 4) return contact.status === 'Pending';
      if (tabValue === 1 && contact.type !== 'hospital') return false;
      if (tabValue === 2 && contact.type !== 'mentor') return false;
      if (tabValue === 3 && contact.type !== 'pecc') return false;
      if (statusFilter.length && !statusFilter.includes(contact.status)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      let av: string | number = (a[sortField as keyof Contact] ?? '') as string;
      let bv: string | number = (b[sortField as keyof Contact] ?? '') as string;
      if (sortField === 'lastContact') {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [contacts, searchQuery, tabValue, sortField, sortOrder, statusFilter]);

  const displayedContacts = useMemo(() => {
    if (pageSize === 'all') return filteredAndSortedContacts;
    return filteredAndSortedContacts.slice(0, pageSize);
  }, [filteredAndSortedContacts, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else setSortField(field);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(displayedContacts.map(c => c.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => { const n = new Set(prev); if (checked) n.add(id); else n.delete(id); return n; });
  };

  const openDetail = (c: Contact) => {
    setDetailContact(c);
    setDrawerOpen(true);
  };

  const handleSaveContact = () => {
    const payload: Contact = {
      id: editingContact?.id ?? `contact_${Date.now()}`,
      type: formData.type,
      name: formData.name,
      organization: formData.organization,
      email: formData.email,
      phone: formData.phone,
      status: formData.status,
      assignedTo: formData.assignedTo || 'Unassigned',
      lastContact: formData.lastContact || '',
      notes: formData.notes
    };
    if (editingContact) {
      setContacts(prev => prev.map(c => (c.id === payload.id ? { ...c, ...payload } : c)));
    } else {
      setContacts(prev => [...prev, payload]);
    }
    setDialogOpen(false);
    setEditingContact(null);
    setFormData({ type: 'hospital', name: '', organization: '', email: '', phone: '', status: 'Active', assignedTo: '', lastContact: '', notes: '' });
  };

  const handleExport = () => {
    const headers = ['Type', 'Name', 'Organization', 'Email', 'Phone', 'Status', 'Assigned To', 'Last Contact'];
    const rows = (selectedIds.size ? filteredAndSortedContacts.filter(c => selectedIds.has(c.id)) : filteredAndSortedContacts)
      .map(c => [TYPE_LABELS[c.type], c.name, c.organization || '', c.email, c.phone || '', c.status, c.assignedTo || '', c.lastContact || '']);
    const csv = [headers.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `manager-crm-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

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

  const hasActiveFilters = searchQuery || statusFilter.length > 0;
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter([]);
    setFilterMenuAnchor(null);
  };

  const summaryCounts = useMemo(() => ({
    all: contacts.length,
    hospital: contacts.filter(c => c.type === 'hospital').length,
    mentor: contacts.filter(c => c.type === 'mentor').length,
    pecc: contacts.filter(c => c.type === 'pecc').length,
    pending: contacts.filter(c => c.status === 'Pending').length
  }), [contacts]);

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>CRM</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage hospitals, mentors, and PECCs for your team
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button startIcon={<DownloadIcon />} onClick={handleExport} size="medium">Export</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingContact(null); setFormData({ type: 'hospital', name: '', organization: '', email: '', phone: '', status: 'Active', assignedTo: '', lastContact: '', notes: '' }); setDialogOpen(true); }}>
            Add Contact
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { key: 'all', label: 'All', count: summaryCounts.all },
          { key: 'hospital', label: 'Hospitals', count: summaryCounts.hospital },
          { key: 'mentor', label: 'Mentors', count: summaryCounts.mentor },
          { key: 'pecc', label: 'PECCs', count: summaryCounts.pecc },
          { key: 'pending', label: 'Pending', count: summaryCounts.pending }
        ].map(({ key, label, count }) => {
          const isPending = key === 'pending';
          const isAll = key === 'all';
          const tabForKey = isAll ? 0 : isPending ? 4 : ['hospital', 'mentor', 'pecc'].indexOf(key) + 1;
          const isActive = tabValue === tabForKey;
          const borderColor = isPending ? theme.palette.warning.main : isAll ? theme.palette.primary.main : TYPE_COLORS[key as ManagerContactType];
          return (
            <Grid item xs={6} sm={4} md={2} key={key}>
              <Paper
                onClick={() => setTabValue(tabForKey)}
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
                  <Typography variant="h5" fontWeight={700} sx={{ color: isPending ? 'warning.main' : isAll ? 'primary.main' : TYPE_COLORS[key as ManagerContactType] }}>
                    {count}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">{label}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      <Paper sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
            <Tab label="All" />
            <Tab label="Hospitals" />
            <Tab label="Mentors" />
            <Tab label="PECCs" />
            <Tab label="Pending" />
          </Tabs>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: 2 }}>
          <TextField
            size="small"
            placeholder="Search name, email, organization..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            sx={{ minWidth: 260 }}
          />
          <Button
            size="small"
            startIcon={<FilterIcon />}
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
            variant={hasActiveFilters ? 'contained' : 'outlined'}
          >
            Filters {hasActiveFilters ? `(${statusFilter.length})` : ''}
          </Button>
          <Menu anchorEl={filterMenuAnchor} open={Boolean(filterMenuAnchor)} onClose={() => setFilterMenuAnchor(null)}>
            <ListItem dense><ListItemText primary="Status" secondary={statusFilter.join(', ') || 'Any'} /></ListItem>
            {['Active', 'Pending', 'Inactive'].map(s => (
              <MenuItem key={s} onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}>
                <Checkbox checked={statusFilter.includes(s)} size="small" />
                <ListItemText primary={s} />
              </MenuItem>
            ))}
            <MenuItem onClick={clearFilters}><ClearIcon fontSize="small" sx={{ mr: 1 }} /> Clear filters</MenuItem>
          </Menu>
          <Button size="small" startIcon={<ViewColumnIcon />} onClick={(e) => setColumnMenuAnchor(e.currentTarget)} variant="outlined">Columns</Button>
          <Menu anchorEl={columnMenuAnchor} open={Boolean(columnMenuAnchor)} onClose={() => setColumnMenuAnchor(null)}>
            {COLUMNS.filter(c => c.id !== 'actions').map((col) => (
              <MenuItem key={col.id} onClick={() => setVisibleColumns(prev => { const n = new Set(prev); if (n.has(col.id)) n.delete(col.id); else n.add(col.id); return n; })}>
                <Checkbox checked={visibleColumns.has(col.id)} size="small" />
                <ListItemText primary={col.label} />
              </MenuItem>
            ))}
          </Menu>
          <Button size="small" startIcon={<TableIcon />} onClick={() => setViewMode('table')} variant={viewMode === 'table' ? 'contained' : 'outlined'}>Table</Button>
          <Button size="small" startIcon={<GridIcon />} onClick={() => setViewMode('grid')} variant={viewMode === 'grid' ? 'contained' : 'outlined'}>Cards</Button>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select value={pageSize} onChange={(e) => setPageSize(e.target.value as PageSize)} displayEmpty variant="outlined">
              {PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={String(n)} value={n}>{n === 'all' ? 'All' : n}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flexGrow: 1 }} />
          {selectedIds.size > 0 && <Chip label={`${selectedIds.size} selected`} onDelete={() => setSelectedIds(new Set())} sx={{ mr: 1 }} />}
          <Typography variant="body2" color="text.secondary">
            {filteredAndSortedContacts.length === 0 ? '0 contacts' : pageSize === 'all' ? `${filteredAndSortedContacts.length} contact${filteredAndSortedContacts.length !== 1 ? 's' : ''}` : `Showing 1–${displayedContacts.length} of ${filteredAndSortedContacts.length}`}
          </Typography>
        </Box>
      </Paper>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Paper sx={{ mb: 2, py: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: alpha(theme.palette.primary.main, 0.06), border: '1px solid', borderColor: 'primary.main' }}>
          <Chip label={`${selectedIds.size} selected`} color="primary" onDelete={() => setSelectedIds(new Set())} />
          <Button size="small" variant="outlined" startIcon={<FilterIcon />} onClick={(e) => setBulkStatusAnchor(e.currentTarget)}>Change status</Button>
          <Menu anchorEl={bulkStatusAnchor} open={Boolean(bulkStatusAnchor)} onClose={() => setBulkStatusAnchor(null)}>
            {['Active', 'Pending', 'Inactive'].map(s => <MenuItem key={s} onClick={() => handleBulkStatusChange(s)}>{s}</MenuItem>)}
          </Menu>
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => { setDeleteTarget({ bulk: new Set(selectedIds) }); setDeleteConfirmOpen(true); }}>Delete selected</Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>Clear selection</Button>
        </Paper>
      )}

      {loading ? (
        <Paper sx={{ p: 4 }}>
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5].map(i => <Grid item xs={12} key={i}><Skeleton variant="rectangular" height={52} /></Grid>)}
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
                  {hasActiveFilters ? 'Try clearing filters or search, or add a new contact.' : 'Add hospitals, mentors, and PECCs to manage your team.'}
                </Typography>
                <Button startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setEditingContact(null); setFormData({ type: 'hospital', name: '', organization: '', email: '', phone: '', status: 'Active', assignedTo: '', lastContact: '', notes: '' }); }} variant="contained" size="large">
                  {hasActiveFilters ? 'Add contact' : 'Add your first contact'}
                </Button>
              </Paper>
            </Grid>
          ) : (
            displayedContacts.map((contact) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={contact.id}>
                <Paper
                  sx={{ p: 2, cursor: 'pointer', '&:hover': { boxShadow: 2 }, borderLeft: 4, borderColor: TYPE_COLORS[contact.type] }}
                  onClick={() => openDetail(contact)}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Avatar sx={{ bgcolor: TYPE_COLORS[contact.type], width: 40, height: 40 }}>
                      {contact.type === 'hospital' ? <HospitalIcon fontSize="small" /> : (contact.name || '?')[0].toUpperCase()}
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
                    checked={displayedContacts.length > 0 && selectedIds.size === displayedContacts.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < displayedContacts.length}
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
                    ) : col.label}
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
                    <Button startIcon={<AddIcon />} onClick={() => { setDialogOpen(true); setEditingContact(null); setFormData({ type: 'hospital', name: '', organization: '', email: '', phone: '', status: 'Active', assignedTo: '', lastContact: '', notes: '' }); }} variant="contained" sx={{ mt: 2 }}>
                      {hasActiveFilters ? 'Add contact' : 'Add your first contact'}
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                displayedContacts.map((contact) => (
                  <TableRow key={contact.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(contact)}>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(contact.id)} onChange={(e) => handleSelectOne(contact.id, e.target.checked)} />
                    </TableCell>
                    {visibleColumns.has('type') && (
                      <TableCell>
                        <Chip label={TYPE_LABELS[contact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[contact.type], color: 'white' }} />
                      </TableCell>
                    )}
                    {visibleColumns.has('name') && <TableCell><Typography fontWeight={500}>{contact.name}</Typography></TableCell>}
                    {visibleColumns.has('organization') && <TableCell>{contact.organization || '—'}</TableCell>}
                    {visibleColumns.has('email') && <TableCell>{contact.email}</TableCell>}
                    {visibleColumns.has('phone') && <TableCell>{contact.phone || '—'}</TableCell>}
                    {visibleColumns.has('status') && (
                      <TableCell>
                        <Chip label={contact.status} size="small" color={contact.status === 'Active' ? 'success' : contact.status === 'Pending' ? 'warning' : 'default'} variant="outlined" />
                      </TableCell>
                    )}
                    {visibleColumns.has('assignedTo') && (
                      <TableCell>
                        <Typography variant="body2" color={contact.assignedTo === 'Unassigned' ? 'error.main' : 'text.primary'}>{contact.assignedTo || '—'}</Typography>
                      </TableCell>
                    )}
                    {visibleColumns.has('lastContact') && <TableCell>{contact.lastContact || '—'}</TableCell>}
                    {visibleColumns.has('actions') && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); setDetailContact(contact); }}><MoreIcon /></IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { if (detailContact) openDetail(detailContact); setAnchorEl(null); }}>View details</MenuItem>
        <MenuItem onClick={() => { if (detailContact) { setEditingContact(detailContact); setFormData({ type: detailContact.type, name: detailContact.name, organization: detailContact.organization, email: detailContact.email, phone: detailContact.phone, status: detailContact.status, assignedTo: detailContact.assignedTo || '', lastContact: detailContact.lastContact || '', notes: detailContact.notes || '' }); setDialogOpen(true); } setAnchorEl(null); }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><EmailIcon fontSize="small" sx={{ mr: 1 }} /> Send email</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Assign to mentor</MenuItem>
        <MenuItem onClick={() => { if (detailContact) { setDeleteTarget({ single: detailContact.id }); setDeleteConfirmOpen(true); } setAnchorEl(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}>
        {detailContact && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Contact</Typography>
              <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Avatar sx={{ width: 64, height: 64, bgcolor: TYPE_COLORS[detailContact.type], fontSize: '1.5rem', mb: 2 }}>
              {detailContact.type === 'hospital' ? <HospitalIcon /> : (detailContact.name || '?')[0].toUpperCase()}
            </Avatar>
            <Typography variant="h6">{detailContact.name}</Typography>
            <Chip label={TYPE_LABELS[detailContact.type]} size="small" sx={{ bgcolor: TYPE_COLORS[detailContact.type], color: 'white', my: 1 }} />
            <List dense>
              <ListItem><ListItemIcon><BusinessIcon fontSize="small" /></ListItemIcon><ListItemText primary="Organization" secondary={detailContact.organization || '—'} /></ListItem>
              <ListItem><ListItemIcon><EmailIcon fontSize="small" /></ListItemIcon><ListItemText primary="Email" secondary={detailContact.email} /></ListItem>
              <ListItem><ListItemIcon><PhoneIcon fontSize="small" /></ListItemIcon><ListItemText primary="Phone" secondary={detailContact.phone || '—'} /></ListItem>
              <ListItem><ListItemText primary="Status" secondary={detailContact.status} /></ListItem>
              <ListItem><ListItemText primary="Assigned to" secondary={detailContact.assignedTo || '—'} /></ListItem>
              <ListItem><ListItemText primary="Last contact" secondary={detailContact.lastContact || '—'} /></ListItem>
            </List>
            {detailContact.notes && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{detailContact.notes}</Typography>
              </>
            )}
            <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
              <Button fullWidth variant="outlined" startIcon={<EditIcon />} onClick={() => { setEditingContact(detailContact); setFormData({ type: detailContact.type, name: detailContact.name, organization: detailContact.organization, email: detailContact.email, phone: detailContact.phone, status: detailContact.status, assignedTo: detailContact.assignedTo || '', lastContact: detailContact.lastContact || '', notes: detailContact.notes || '' }); setDrawerOpen(false); setDialogOpen(true); }}>Edit</Button>
              <Button fullWidth variant="contained" startIcon={<EmailIcon />}>Email</Button>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditingContact(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <strong>No PHI:</strong> Do not include any Protected Health Information (PHI) or real patient data in contact details or notes.
          </Alert>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select value={formData.type} onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as ManagerContactType }))} label="Type">
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
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))} label="Status">
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField label="Assigned to" value={formData.assignedTo} onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))} fullWidth size="small" placeholder="Mentor name" />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Last contact" value={formData.lastContact} onChange={(e) => setFormData(prev => ({ ...prev, lastContact: e.target.value }))} fullWidth size="small" placeholder="YYYY-MM-DD" />
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

      <Dialog open={deleteConfirmOpen} onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>
        <DialogTitle>{deleteTarget?.bulk ? `Delete ${deleteTarget.bulk.size} contacts?` : 'Delete contact?'}</DialogTitle>
        <DialogContent>
          <Typography>
            {deleteTarget?.bulk ? 'These contacts will be removed. This cannot be undone.' : 'This contact will be removed. This cannot be undone.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => deleteTarget?.single ? handleDeleteContact(deleteTarget.single) : handleBulkDelete()}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManagerCRMPage;
