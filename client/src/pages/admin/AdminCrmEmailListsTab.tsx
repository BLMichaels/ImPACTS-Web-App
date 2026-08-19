import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Edit as EditIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { CRM_CONTACT_TYPE_LABELS } from '../../utils/crmLabels';
import {
  addManualEmailsToCrmEmailList,
  buildEmailListCsv,
  createCrmEmailList,
  deleteCrmEmailList,
  emailsForMailto,
  fetchCrmEmailListMembers,
  fetchCrmEmailLists,
  removeCrmEmailListMember,
  renameCrmEmailList,
  type CrmEmailList,
  type CrmEmailListMember,
} from '../../utils/crmEmailLists';
import { adminSectionShellSx } from '../../components/admin/AdminPageChrome';

interface AdminCrmEmailListsTabProps {
  onAddFromDirectory: () => void;
}

const AdminCrmEmailListsTab: React.FC<AdminCrmEmailListsTabProps> = ({ onAddFromDirectory }) => {
  const [lists, setLists] = useState<CrmEmailList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [members, setMembers] = useState<CrmEmailListMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [pasteDraft, setPasteDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedList = useMemo(
    () => lists.find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  );

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLists(await fetchCrmEmailLists());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load email lists.';
      if (/crm_email_lists|schema cache|does not exist/i.test(message)) {
        setError(
          'Email lists are not available yet. An admin needs to run CRM_EMAIL_LISTS.sql in the Supabase SQL Editor.'
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (listId: string) => {
    setMembersLoading(true);
    setError(null);
    try {
      setMembers(await fetchCrmEmailListMembers(listId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load list members.');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (selectedListId) void loadMembers(selectedListId);
    else setMembers([]);
  }, [selectedListId, loadMembers]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await createCrmEmailList(nameDraft, descriptionDraft);
      setLists((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedListId(created.id);
      setCreateOpen(false);
      setNameDraft('');
      setDescriptionDraft('');
      setNotice(`Created list “${created.name}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create list.');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!selectedList) return;
    setSaving(true);
    setError(null);
    try {
      await renameCrmEmailList(selectedList.id, nameDraft, descriptionDraft);
      setLists((prev) =>
        prev
          .map((l) =>
            l.id === selectedList.id
              ? { ...l, name: nameDraft.trim(), description: descriptionDraft.trim() || null }
              : l
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditOpen(false);
      setNotice('List updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update list.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async () => {
    if (!selectedList) return;
    if (!window.confirm(`Delete list “${selectedList.name}”? Members are removed from the list only — CRM contacts stay.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteCrmEmailList(selectedList.id);
      setLists((prev) => prev.filter((l) => l.id !== selectedList.id));
      setSelectedListId(null);
      setNotice('List deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete list.');
    } finally {
      setSaving(false);
    }
  };

  const handlePaste = async () => {
    if (!selectedList) return;
    setSaving(true);
    setError(null);
    try {
      const result = await addManualEmailsToCrmEmailList(selectedList.id, pasteDraft);
      await loadMembers(selectedList.id);
      await loadLists();
      setPasteOpen(false);
      setPasteDraft('');
      setNotice(`Added ${result.added} address${result.added === 1 ? '' : 'es'}${result.skipped ? ` (${result.skipped} skipped)` : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add addresses.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEmails = async () => {
    const text = members.map((m) => m.email).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied ${members.length} email${members.length === 1 ? '' : 's'}.`);
    } catch {
      setError('Could not copy to clipboard.');
    }
  };

  const handleExport = () => {
    if (!selectedList) return;
    const blob = new Blob([buildEmailListCsv(members)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList.name.replace(/[^\w-]+/g, '_')}_emails.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMail = () => {
    const { href, truncated } = emailsForMailto(members.map((m) => m.email));
    window.location.href = href;
    if (truncated) {
      setNotice('Opened your email app with as many BCC addresses as it can hold. Copy the full list for large sends.');
    }
  };

  if (selectedList) {
    return (
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {notice && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => setSelectedListId(null)} size="small">
            All lists
          </Button>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.05rem' }}>
              {selectedList.name}
            </Typography>
            {selectedList.description ? (
              <Typography variant="body2" color="text.secondary">
                {selectedList.description}
              </Typography>
            ) : null}
          </Box>
          <Button size="small" startIcon={<EditIcon />} onClick={() => {
            setNameDraft(selectedList.name);
            setDescriptionDraft(selectedList.description || '');
            setEditOpen(true);
          }}>
            Rename
          </Button>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setPasteOpen(true)}>
            Paste emails
          </Button>
          <Button size="small" onClick={onAddFromDirectory}>
            Add from CRM
          </Button>
          <Button size="small" startIcon={<CopyIcon />} onClick={() => void handleCopyEmails()} disabled={members.length === 0}>
            Copy emails
          </Button>
          <Button size="small" startIcon={<EmailIcon />} onClick={handleMail} disabled={members.length === 0}>
            Email (BCC)
          </Button>
          <Button size="small" startIcon={<DownloadIcon />} onClick={handleExport} disabled={members.length === 0}>
            Export CSV
          </Button>
          <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => void handleDeleteList()} disabled={saving}>
            Delete list
          </Button>
        </Stack>
        <Paper elevation={0} sx={adminSectionShellSx}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {membersLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">Loading members…</Typography>
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">
                        This list is empty. Select contacts in CRM and use Add to list, or paste addresses here.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell>{m.display_name || '—'}</TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.organization || '—'}</TableCell>
                      <TableCell>
                        {m.contact_type
                          ? CRM_CONTACT_TYPE_LABELS[m.contact_type as keyof typeof CRM_CONTACT_TYPE_LABELS] || m.contact_type
                          : '—'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove from list">
                          <IconButton
                            size="small"
                            onClick={async () => {
                              await removeCrmEmailListMember(m.id);
                              setMembers((prev) => prev.filter((x) => x.id !== m.id));
                              setLists((prev) =>
                                prev.map((l) =>
                                  l.id === selectedList.id
                                    ? { ...l, member_count: Math.max(0, (l.member_count || 1) - 1) }
                                    : l
                                )
                              );
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Rename list</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="normal" fullWidth label="List name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            <TextField margin="normal" fullWidth label="Description (optional)" value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving || !nameDraft.trim()} onClick={() => void handleRename()}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>Paste email addresses</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Separate addresses with commas, spaces, or new lines. Duplicates are skipped.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={6}
              value={pasteDraft}
              onChange={(e) => setPasteDraft(e.target.value)}
              placeholder="name@hospital.org, other@example.com"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasteOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving || !pasteDraft.trim()} onClick={() => void handlePaste()}>
              Add addresses
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Named mailing lists for Admin and Staff CRM work. Use them for newsletters and outreach — they do not change
          programs, cohorts, or portal access.
        </Typography>
        <Button variant="contained" color="secondary" size="small" startIcon={<AddIcon />} onClick={() => {
          setNameDraft('');
          setDescriptionDraft('');
          setCreateOpen(true);
        }}>
          New list
        </Button>
      </Stack>
      <Paper elevation={0} sx={adminSectionShellSx}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>List</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Addresses</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">Loading lists…</Typography>
                  </TableCell>
                </TableRow>
              ) : lists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">
                      No lists yet. Create one, then add Staff, PECCs, or any other CRM contacts from the directory.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                lists.map((list) => (
                  <TableRow
                    key={list.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <TableCell>
                      <Typography fontWeight={600}>{list.name}</Typography>
                    </TableCell>
                    <TableCell>{list.description || '—'}</TableCell>
                    <TableCell align="right">{list.member_count ?? 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New email list</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="normal" fullWidth label="List name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="e.g. Q3 PECC newsletter" />
          <TextField margin="normal" fullWidth label="Description (optional)" value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" disabled={saving || !nameDraft.trim()} onClick={() => void handleCreate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCrmEmailListsTab;
