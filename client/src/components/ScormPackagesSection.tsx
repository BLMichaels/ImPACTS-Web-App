import React, { useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Autocomplete,
  Chip,
  Paper
} from '@mui/material';
import { Add as AddIcon, PlayArrow as PlayIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { normalizeHospitalOrOrgName } from '../utils/displayName';
import { UserRole } from '../types/database';

export type ScormPlacement = 'education' | 'cohort' | 'simulation' | 'checklist';

const PLACEMENT_LABELS: Record<ScormPlacement, string> = {
  education: 'Education tab',
  cohort: 'Cohort page',
  simulation: 'Simulation page',
  checklist: 'Checklist page'
};

type ScormPackage = {
  id: string;
  site_id: string | null;
  title: string;
  description: string | null;
  storage_prefix: string;
  entry_path: string;
  manifest_path: string | null;
  applies_to_all?: boolean;
  applies_to_site_ids?: string[] | null;
  applies_to_programs?: string[] | null;
  applies_to_cohort_ids?: string[] | null;
  applies_to_user_ids?: string[] | null;
  applies_to_states?: string[] | null;
  placement?: ScormPlacement | null;
  display_order?: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export interface ScormPackagesSectionProps {
  title?: string;
  /** When set, only packages with this placement are shown (viewer mode). */
  placement?: ScormPlacement;
  /** When placement is "cohort", only show packages that apply to this cohort. */
  cohortId?: string;
}

const SCORM_BUCKET = 'scorm';

const guessContentType = (path: string): string => {
  const p = path.toLowerCase();
  if (p.endsWith('.html') || p.endsWith('.htm')) return 'text/html';
  if (p.endsWith('.js')) return 'application/javascript';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.xml')) return 'application/xml';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.gif')) return 'image/gif';
  if (p.endsWith('.webp')) return 'image/webp';
  if (p.endsWith('.mp4')) return 'video/mp4';
  if (p.endsWith('.webm')) return 'video/webm';
  if (p.endsWith('.woff')) return 'font/woff';
  if (p.endsWith('.woff2')) return 'font/woff2';
  if (p.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
};

export default function ScormPackagesSection(props: ScormPackagesSectionProps) {
  const { title = 'Learning Modules', placement: placementProp, cohortId } = props;
  const { currentUser } = useAuth();
  const { userRole, siteId } = useUserProfile();

  const canManage = userRole === UserRole.ADMIN;
  const isAdminMode = canManage && !placementProp;

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ScormPackage[]>([]);
  const [error, setError] = useState<string>('');

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(() => packages.find(p => p.id === selectedId) ?? null, [packages, selectedId]);

  const [playerUrl, setPlayerUrl] = useState<string>('');

  // Upload/Edit dialog
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPlacement, setUploadPlacement] = useState<ScormPlacement>('education');
  const [uploadDisplayOrder, setUploadDisplayOrder] = useState(0);

  // Visibility: "all" or "restrict" with multi-selects
  const [visibilityMode, setVisibilityMode] = useState<'all' | 'restrict'>('all');
  const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [hospitalOptions, setHospitalOptions] = useState<{ id: string; label: string; state: string; city: string; name: string }[]>([]);
  const [programOptions, setProgramOptions] = useState<string[]>([]);
  const [cohortOptions, setCohortOptions] = useState<{ id: string; name: string }[]>([]);
  const [userOptions, setUserOptions] = useState<{ id: string; label: string }[]>([]);
  const [stateOptions, setStateOptions] = useState<string[]>([]);

  // Viewer context
  const [sitePrograms, setSitePrograms] = useState<string[]>([]);
  const [userCohortIds, setUserCohortIds] = useState<string[]>([]);
  const [userState, setUserState] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('scorm_packages').select('*');
      if (placementProp) {
        query = query.eq('placement', placementProp);
      }
      // Order by updated_at only (display_order may not exist if placement migration not run)
      const { data, error: err } = await query.order('updated_at', { ascending: false });
      if (err) throw err;
      let list = (data as unknown as ScormPackage[]) ?? [];
      // Client-side sort by display_order then updated_at when available
      list = [...list].sort((a, b) => {
        const orderA = a.display_order ?? 0;
        const orderB = b.display_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const tA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return tB - tA;
      });
      if (placementProp === 'cohort' && cohortId) {
        list = list.filter(
          (p) =>
            p.applies_to_all === true ||
            (Array.isArray(p.applies_to_cohort_ids) && p.applies_to_cohort_ids.length > 0 && p.applies_to_cohort_ids.includes(cohortId))
        );
      }
      setPackages(list);
    } catch (e: unknown) {
      setPackages([]);
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to load SCORM packages.');
    } finally {
      setLoading(false);
    }
  }, [placementProp, cohortId]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!siteId) { setSitePrograms([]); setUserState(null); return; }
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteId);
        const filterClause = isUuid ? `facility_id.eq.${siteId},id.eq.${siteId}` : `facility_id.eq.${siteId}`;
        const { data } = await supabase
          .from('hospitals')
          .select('programs, state')
          .or(filterClause)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const row = data as { programs?: unknown; state?: string } | null;
        const raw = row?.programs;
        const list = Array.isArray(raw) ? (raw as unknown[]).map((x) => String(x)).filter(Boolean) : [];
        setSitePrograms(list);
        setUserState(row?.state ?? null);
      } catch {
        if (!cancelled) { setSitePrograms([]); setUserState(null); }
      }
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  useEffect(() => {
    if (!currentUser?.id) { setUserCohortIds([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('cohort_members').select('cohort_id').eq('user_id', currentUser.id).eq('status', 'active');
        if (cancelled) return;
        const ids = (data ?? []).map((r: { cohort_id: string }) => r.cohort_id);
        setUserCohortIds(ids);
      } catch {
        if (!cancelled) setUserCohortIds([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Only show packages that apply to the viewer's context (unless admin in full list mode)
  const visiblePackages = useMemo(() => {
    if (isAdminMode) return packages;
    const userId = currentUser?.id ?? null;
    return packages.filter((p) => {
      const appliesAll = p.applies_to_all !== false;
      if (appliesAll) return true;
      if (siteId && Array.isArray(p.applies_to_site_ids) && p.applies_to_site_ids.includes(siteId)) return true;
      if (sitePrograms.length > 0 && Array.isArray(p.applies_to_programs) && p.applies_to_programs.some((x) => sitePrograms.includes(x))) return true;
      if (userId && Array.isArray(p.applies_to_user_ids) && p.applies_to_user_ids.includes(userId)) return true;
      if (userCohortIds.length > 0 && Array.isArray(p.applies_to_cohort_ids) && p.applies_to_cohort_ids.some((c) => userCohortIds.includes(c))) return true;
      if (userState && Array.isArray(p.applies_to_states) && p.applies_to_states.includes(userState)) return true;
      return false;
    });
  }, [packages, isAdminMode, siteId, sitePrograms, currentUser?.id, userCohortIds, userState]);

  const launchSelected = async () => {
    if (!selected) return;
    // Public bucket recommended; fallback to signed URL if private
    const path = `${selected.storage_prefix.replace(/^\/+/, '').replace(/\/+$/, '')}/${selected.entry_path.replace(/^\/+/, '')}`;

    // Try public URL first
    const publicRes = supabase.storage.from(SCORM_BUCKET).getPublicUrl(path);
    const publicUrl = publicRes?.data?.publicUrl || '';
    if (publicUrl) {
      setPlayerUrl(publicUrl);
      return;
    }

    // Signed URL fallback
    const { data, error: err } = await supabase.storage.from(SCORM_BUCKET).createSignedUrl(path, 60 * 60);
    if (err || !data?.signedUrl) {
      setError('Unable to generate a launch URL. Ensure the Storage bucket exists and access policies allow reads.');
      return;
    }
    setPlayerUrl(data.signedUrl);
  };

  const visibilityPayload = useMemo(
    () => ({
      applies_to_all: visibilityMode === 'all',
      applies_to_site_ids: visibilityMode === 'restrict' && selectedHospitalIds.length > 0 ? selectedHospitalIds : null,
      applies_to_programs: visibilityMode === 'restrict' && selectedPrograms.length > 0 ? selectedPrograms : null,
      applies_to_cohort_ids: visibilityMode === 'restrict' && selectedCohortIds.length > 0 ? selectedCohortIds : null,
      applies_to_user_ids: visibilityMode === 'restrict' && selectedUserIds.length > 0 ? selectedUserIds : null,
      applies_to_states: visibilityMode === 'restrict' && selectedStates.length > 0 ? selectedStates : null
    }),
    [visibilityMode, selectedHospitalIds, selectedPrograms, selectedCohortIds, selectedUserIds, selectedStates]
  );

  const openAdd = () => {
    setEditingId(null);
    setUploadTitle('');
    setUploadDescription('');
    setUploadFile(null);
    setUploadPlacement('education');
    setUploadDisplayOrder(0);
    setVisibilityMode('all');
    setSelectedHospitalIds([]);
    setSelectedPrograms([]);
    setSelectedCohortIds([]);
    setSelectedUserIds([]);
    setSelectedStates([]);
    setOpen(true);
  };

  const openEdit = (pkg: ScormPackage) => {
    setEditingId(pkg.id);
    setUploadTitle(pkg.title);
    setUploadDescription(pkg.description ?? '');
    setUploadFile(null);
    setUploadPlacement((pkg.placement as ScormPlacement) || 'education');
    setUploadDisplayOrder(pkg.display_order ?? 0);
    setVisibilityMode(pkg.applies_to_all !== false ? 'all' : 'restrict');
    setSelectedHospitalIds(Array.isArray(pkg.applies_to_site_ids) ? pkg.applies_to_site_ids : []);
    setSelectedPrograms(Array.isArray(pkg.applies_to_programs) ? pkg.applies_to_programs : []);
    setSelectedCohortIds(Array.isArray(pkg.applies_to_cohort_ids) ? pkg.applies_to_cohort_ids : []);
    setSelectedUserIds(Array.isArray(pkg.applies_to_user_ids) ? pkg.applies_to_user_ids : []);
    setSelectedStates(Array.isArray(pkg.applies_to_states) ? pkg.applies_to_states : []);
    setOpen(true);
  };

  const handleSaveMetadata = async () => {
    if (!editingId) return;
    setUploading(true);
    setError('');
    try {
      const { error: updErr } = await supabase
        .from('scorm_packages')
        .update({
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || null,
          placement: uploadPlacement,
          display_order: uploadDisplayOrder,
          ...visibilityPayload
        })
        .eq('id', editingId);
      if (updErr) throw updErr;
      setOpen(false);
      await loadPackages();
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Update failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this learning module? This cannot be undone.')) return;
    setError('');
    try {
      const { error: delErr } = await supabase.from('scorm_packages').delete().eq('id', id);
      if (delErr) throw delErr;
      await loadPackages();
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Delete failed.');
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      setError('Please provide a title.');
      return;
    }
    if (!editingId && (!uploadFile || !uploadFile.name.toLowerCase().endsWith('.zip'))) {
      setError('Please choose a SCORM .zip file.');
      return;
    }
    if (editingId) {
      await handleSaveMetadata();
      return;
    }

    setUploading(true);
    setError('');
    try {
      const { data: created, error: createErr } = await supabase
        .from('scorm_packages')
        .insert({
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || null,
          site_id: null,
          placement: uploadPlacement,
          display_order: uploadDisplayOrder,
          ...visibilityPayload,
          storage_prefix: 'packages/pending',
          entry_path: 'index.html',
          manifest_path: null,
          created_by: currentUser?.id ?? null
        })
        .select('id')
        .limit(1)
        .maybeSingle();
      if (createErr) throw createErr;
      const id = created && typeof (created as { id?: string }).id === 'string' ? (created as { id: string }).id : '';
      if (!id) throw new Error('Failed to create SCORM record.');

      const prefix = `packages/${id}`;
      const arrayBuffer = await uploadFile!.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const files = Object.keys(zip.files)
        .filter((k) => !zip.files[k].dir)
        .filter((k) => k && !k.endsWith('/'));

      const manifestPath = files.find((p) => p.toLowerCase().endsWith('imsmanifest.xml')) ?? null;
      const entryCandidates = [
        files.find((p) => p.toLowerCase().endsWith('index.html')),
        files.find((p) => p.toLowerCase().endsWith('index.htm')),
        files.find((p) => p.toLowerCase().includes('story.html')),
        files.find((p) => p.toLowerCase().includes('launch.html'))
      ].filter(Boolean) as string[];
      const entryPath = entryCandidates[0] ?? 'index.html';

      for (const relPath of files) {
        const fileData = await zip.files[relPath].async('uint8array');
        const objectPath = `${prefix}/${relPath}`;
        const contentType = guessContentType(relPath);
        const { error: upErr } = await supabase.storage.from(SCORM_BUCKET).upload(objectPath, fileData, { upsert: true, contentType });
        if (upErr) throw upErr;
      }

      const { error: updErr } = await supabase
        .from('scorm_packages')
        .update({ storage_prefix: prefix, entry_path: entryPath, manifest_path: manifestPath })
        .eq('id', id);
      if (updErr) throw updErr;

      setOpen(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      setVisibilityMode('all');
      setSelectedHospitalIds([]);
      setSelectedPrograms([]);
      setSelectedCohortIds([]);
      setSelectedUserIds([]);
      setSelectedStates([]);
      await loadPackages();
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Load options for Admin: hospitals, programs, cohorts, users, states (when dialog opens)
  useEffect(() => {
    if (!open || !canManage) return;
    let mounted = true;
    (async () => {
      try {
        const list: { id: string; label: string; state: string; city: string; name: string }[] = [];
        const statesSet = new Set<string>();
        const chunk = 1000;
        let offset = 0;
        let hasMore = true;
        while (mounted && hasMore) {
          const { data, error: err } = await supabase
            .from('hospitals')
            .select('facility_id, id, name, state, city, programs')
            .range(offset, offset + chunk - 1);
          if (!mounted) return;
          if (err || !data || data.length === 0) break;
          for (const row of data as Record<string, unknown>[]) {
            const id = String(row.facility_id ?? row.id ?? '');
            const name = normalizeHospitalOrOrgName(String(row.name ?? 'Unknown'));
            const state = String(row.state ?? '');
            const city = String(row.city ?? '');
            if (state) statesSet.add(state);
            list.push({ id, name, state, city, label: [state, city, name].filter(Boolean).join(' – ') || name });
          }
          hasMore = data.length >= chunk;
          offset += chunk;
        }
        list.sort((a, b) => {
          if ((a.state || '') !== (b.state || '')) return (a.state || '').localeCompare(b.state || '');
          if ((a.city || '') !== (b.city || '')) return (a.city || '').localeCompare(b.city || '');
          return (a.name || '').localeCompare(b.name || '');
        });
        const programsSet = new Set<string>();
        const { data: progData } = await supabase.from('hospitals').select('programs').limit(2000);
        if (Array.isArray(progData)) {
          for (const row of progData as Record<string, unknown>[]) {
            const raw = row.programs;
            if (Array.isArray(raw)) raw.map((x) => String(x)).filter(Boolean).forEach((p) => programsSet.add(p));
          }
        }
        const { data: cohortData } = await supabase.from('cohorts').select('id, name').eq('is_active', true).order('name');
        const cohorts = (cohortData ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));
        const { data: userData } = await supabase.from('users').select('id, first_name, last_name, email').eq('is_active', true).order('last_name');
        const users = (userData ?? []).map((u: { id: string; first_name?: string; last_name?: string; email?: string }) => ({
          id: u.id,
          label: [u.last_name, u.first_name].filter(Boolean).join(', ') || u.email || u.id
        }));
        if (mounted) {
          setHospitalOptions(list);
          setProgramOptions(Array.from(programsSet).sort());
          setStateOptions(Array.from(statesSet).sort());
          setCohortOptions(cohorts);
          setUserOptions(users);
        }
      } catch {
        if (mounted) {
          setHospitalOptions([]);
          setProgramOptions([]);
          setStateOptions([]);
          setCohortOptions([]);
          setUserOptions([]);
        }
      }
    })();
    return () => { mounted = false; };
  }, [open, canManage]);

  // Hide section entirely for non-admin users unless there is at least one visible package
  if (!canManage && !loading && visiblePackages.length === 0) {
    return null;
  }

  const visibilitySummary = (p: ScormPackage) => {
    if (p.applies_to_all !== false) return 'All users';
    const parts: string[] = [];
    if (Array.isArray(p.applies_to_site_ids) && p.applies_to_site_ids.length) parts.push(`${p.applies_to_site_ids.length} hospital(s)`);
    if (Array.isArray(p.applies_to_programs) && p.applies_to_programs.length) parts.push(`${p.applies_to_programs.length} program(s)`);
    if (Array.isArray(p.applies_to_cohort_ids) && p.applies_to_cohort_ids.length) parts.push(`${p.applies_to_cohort_ids.length} cohort(s)`);
    if (Array.isArray(p.applies_to_user_ids) && p.applies_to_user_ids.length) parts.push(`${p.applies_to_user_ids.length} user(s)`);
    if (Array.isArray(p.applies_to_states) && p.applies_to_states.length) parts.push(`${p.applies_to_states.length} state(s)`);
    return parts.length ? parts.join(', ') : 'Restricted';
  };

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {isAdminMode
                ? 'Full control: set placement (Education, Cohort, Simulation, Checklist) and exactly who can see each module.'
                : 'Launch learning modules (SCORM) that apply to you in this section.'}
            </Typography>
          </Box>
          {canManage && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openAdd}>
              Add Learning Module
            </Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : isAdminMode && !placementProp ? (
          <>
            {packages.length === 0 ? (
              <Typography color="text.secondary">No learning modules yet. Add one to get started.</Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Title</TableCell>
                      <TableCell>Placement</TableCell>
                      <TableCell>Visible to</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {packages.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.title}</TableCell>
                        <TableCell>
                          <Chip size="small" label={PLACEMENT_LABELS[(p.placement as ScormPlacement) || 'education']} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {visibilitySummary(p)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openEdit(p)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => handleDelete(p.id)} color="error" title="Delete"><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        ) : visiblePackages.length === 0 ? (
          <Typography color="text.secondary">No learning modules in this section.</Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
              <FormControl fullWidth>
                <InputLabel>Package</InputLabel>
                <Select
                  label="Package"
                  value={selectedId}
                  onChange={(e) => { setSelectedId(String(e.target.value)); setPlayerUrl(''); }}
                >
                  <MenuItem value="">—</MenuItem>
                  {visiblePackages.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                startIcon={<PlayIcon />}
                variant="outlined"
                disabled={!selected}
                onClick={launchSelected}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Launch
              </Button>
            </Box>
            {selected?.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selected.description}
              </Typography>
            )}
          </>
        )}

        {playerUrl && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="subtitle2">Player</Typography>
              <Button size="small" onClick={() => setPlayerUrl('')}>Close</Button>
            </Box>
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <iframe
                title="SCORM Player"
                src={playerUrl}
                style={{ width: '100%', height: '70vh', border: 0 }}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
              />
            </Box>
          </Box>
        )}
      </CardContent>

      <Dialog open={open} onClose={() => (!uploading ? setOpen(false) : null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Learning Module' : 'Add Learning Module (SCORM)'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'grid', gap: 2 }}>
            <TextField
              label="Title"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              required
              fullWidth
              disabled={uploading}
            />
            <TextField
              label="Description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              disabled={uploading}
            />

            <FormControl fullWidth disabled={uploading}>
              <InputLabel>Show this module in</InputLabel>
              <Select
                label="Show this module in"
                value={uploadPlacement}
                onChange={(e) => setUploadPlacement(e.target.value as ScormPlacement)}
              >
                {(Object.keys(PLACEMENT_LABELS) as ScormPlacement[]).map((pl) => (
                  <MenuItem key={pl} value={pl}>{PLACEMENT_LABELS[pl]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Display order"
              type="number"
              value={uploadDisplayOrder}
              onChange={(e) => setUploadDisplayOrder(parseInt(e.target.value, 10) || 0)}
              fullWidth
              disabled={uploading}
              helperText="Lower numbers appear first within the same section."
            />

            <FormControl fullWidth disabled={uploading}>
              <InputLabel>Visible to</InputLabel>
              <Select
                label="Visible to"
                value={visibilityMode}
                onChange={(e) => {
                  const v = e.target.value as 'all' | 'restrict';
                  setVisibilityMode(v);
                  if (v === 'all') {
                    setSelectedHospitalIds([]);
                    setSelectedPrograms([]);
                    setSelectedCohortIds([]);
                    setSelectedUserIds([]);
                    setSelectedStates([]);
                  }
                }}
              >
                <MenuItem value="all">All users (no restriction)</MenuItem>
                <MenuItem value="restrict">Only specific cohorts, programs, hospitals, users, or states</MenuItem>
              </Select>
            </FormControl>

            {visibilityMode === 'restrict' && (
              <>
                <Typography variant="subtitle2" color="text.secondary">Select who can see this module (any match = visible)</Typography>
                <Autocomplete
                  multiple
                  options={hospitalOptions}
                  value={hospitalOptions.filter((h) => selectedHospitalIds.includes(h.id))}
                  onChange={(_, v) => setSelectedHospitalIds(v.map((x) => x.id))}
                  getOptionLabel={(opt) => opt.label}
                  renderInput={(params) => <TextField {...params} label="Hospitals" placeholder="By state, city, name" size="small" />}
                  disabled={uploading}
                />
                <Autocomplete
                  multiple
                  freeSolo
                  options={programOptions}
                  value={selectedPrograms}
                  onChange={(_, v) => setSelectedPrograms(v.map((x) => String(x)).filter(Boolean))}
                  renderInput={(params) => <TextField {...params} label="Programs" placeholder="Select or type" size="small" />}
                  disabled={uploading}
                />
                <Autocomplete
                  multiple
                  options={cohortOptions}
                  value={cohortOptions.filter((c) => selectedCohortIds.includes(c.id))}
                  onChange={(_, v) => setSelectedCohortIds(v.map((x) => x.id))}
                  getOptionLabel={(opt) => opt.name}
                  renderInput={(params) => <TextField {...params} label="Cohorts" placeholder="Select cohorts" size="small" />}
                  disabled={uploading}
                />
                <Autocomplete
                  multiple
                  options={userOptions}
                  value={userOptions.filter((u) => selectedUserIds.includes(u.id))}
                  onChange={(_, v) => setSelectedUserIds(v.map((x) => x.id))}
                  getOptionLabel={(opt) => opt.label}
                  renderInput={(params) => <TextField {...params} label="Users" placeholder="Select users" size="small" />}
                  disabled={uploading}
                />
                <Autocomplete
                  multiple
                  options={stateOptions}
                  value={selectedStates}
                  onChange={(_, v) => setSelectedStates(v)}
                  renderInput={(params) => <TextField {...params} label="States" placeholder="Select states" size="small" />}
                  disabled={uploading}
                />
              </>
            )}

            {!editingId && (
              <>
                <Button variant="outlined" component="label" disabled={uploading}>
                  {uploadFile ? `Selected: ${uploadFile.name}` : 'Choose SCORM .zip'}
                  <input type="file" hidden accept=".zip" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Requires a Supabase Storage bucket named "{SCORM_BUCKET}". Keep the bucket public so SCORM assets load correctly.
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={
              uploading ||
              !uploadTitle.trim() ||
              (!editingId && !uploadFile) ||
              (visibilityMode === 'restrict' &&
                selectedHospitalIds.length === 0 &&
                selectedPrograms.length === 0 &&
                selectedCohortIds.length === 0 &&
                selectedUserIds.length === 0 &&
                selectedStates.length === 0)
            }
          >
            {uploading ? (editingId ? 'Saving…' : 'Uploading…') : editingId ? 'Save changes' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

