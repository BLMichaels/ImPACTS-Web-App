import React, { useEffect, useMemo, useState } from 'react';
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
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Autocomplete,
  Chip
} from '@mui/material';
import { Add as AddIcon, PlayArrow as PlayIcon } from '@mui/icons-material';
import { supabase } from '../supabase';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

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

export default function ScormPackagesSection(props: { title?: string }) {
  const { title = 'Learning Modules' } = props;
  const { userRole, siteId } = useUserProfile();

  const canManage = userRole === UserRole.ADMIN;

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<ScormPackage[]>([]);
  const [error, setError] = useState<string>('');

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = useMemo(() => packages.find(p => p.id === selectedId) ?? null, [packages, selectedId]);

  const [playerUrl, setPlayerUrl] = useState<string>('');

  // Upload dialog
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Scoping for upload
  const [scopeMode, setScopeMode] = useState<'all' | 'hospitals' | 'programs'>('all');
  const [selectedHospitalIds, setSelectedHospitalIds] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [hospitalOptions, setHospitalOptions] = useState<{ id: string; label: string; state: string; city: string; name: string }[]>([]);
  const [programOptions, setProgramOptions] = useState<string[]>([]);

  // Viewer context: try to resolve this site's programs (for filtering visibility)
  const [sitePrograms, setSitePrograms] = useState<string[]>([]);

  const loadPackages = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('scorm_packages')
        .select('*')
        .order('updated_at', { ascending: false });
      if (err) throw err;
      setPackages((data as unknown as ScormPackage[]) ?? []);
    } catch (e: unknown) {
      setPackages([]);
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to load SCORM packages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!siteId) { setSitePrograms([]); return; }
      try {
        const { data } = await supabase
          .from('hospitals')
          .select('programs')
          .or(`facility_id.eq.${siteId},id.eq.${siteId}`)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const raw = data && typeof data === 'object' && data != null && 'programs' in data ? (data as { programs?: unknown }).programs : null;
        const list = Array.isArray(raw) ? (raw as unknown[]).map((x) => String(x)).filter(Boolean) : [];
        setSitePrograms(list);
      } catch {
        if (!cancelled) setSitePrograms([]);
      }
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  // Only show packages that apply to the viewer's context (unless admin)
  const visiblePackages = useMemo(() => {
    if (canManage) return packages;
    return packages.filter((p) => {
      const appliesAll = p.applies_to_all !== false; // default true if missing
      if (appliesAll) return true;
      const siteMatch = siteId && Array.isArray(p.applies_to_site_ids) && p.applies_to_site_ids.includes(siteId);
      if (siteMatch) return true;
      const progMatch = sitePrograms.length > 0 && Array.isArray(p.applies_to_programs) && p.applies_to_programs.some((x) => sitePrograms.includes(x));
      return Boolean(progMatch);
    });
  }, [packages, canManage, siteId, sitePrograms]);

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

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      setError('Please provide a title and choose a SCORM zip file.');
      return;
    }
    if (!uploadFile.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload a .zip SCORM package.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      // Create package row first (so we can use its id as prefix)
      const { data: created, error: createErr } = await supabase
        .from('scorm_packages')
        .insert({
          title: uploadTitle.trim(),
          description: uploadDescription.trim() || null,
          site_id: null,
          applies_to_all: scopeMode === 'all',
          applies_to_site_ids: scopeMode === 'hospitals' ? selectedHospitalIds : null,
          applies_to_programs: scopeMode === 'programs' ? selectedPrograms : null,
          storage_prefix: 'packages/pending',
          entry_path: 'index.html',
          manifest_path: null,
          created_by: null
        })
        .select('id')
        .limit(1)
        .maybeSingle();
      if (createErr) throw createErr;
      const id = created && typeof (created as { id?: string }).id === 'string' ? (created as { id: string }).id : '';
      if (!id) throw new Error('Failed to create SCORM record.');

      const prefix = `packages/${id}`;

      // Read zip and upload each file into Storage prefix
      const arrayBuffer = await uploadFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const files = Object.keys(zip.files)
        .filter((k) => !zip.files[k].dir)
        .filter((k) => k && !k.endsWith('/'));

      // Find imsmanifest.xml and guess entrypoint
      const manifestPath = files.find((p) => p.toLowerCase().endsWith('imsmanifest.xml')) ?? null;
      const entryCandidates = [
        files.find((p) => p.toLowerCase().endsWith('index.html')),
        files.find((p) => p.toLowerCase().endsWith('index.htm')),
        files.find((p) => p.toLowerCase().includes('story.html')),
        files.find((p) => p.toLowerCase().includes('launch.html'))
      ].filter(Boolean) as string[];
      const entryPath = entryCandidates[0] ?? 'index.html';

      // Upload sequentially to avoid rate issues; can be parallelized later
      for (const relPath of files) {
        const fileData = await zip.files[relPath].async('uint8array');
        const objectPath = `${prefix}/${relPath}`;
        const contentType = guessContentType(relPath);
        const { error: upErr } = await supabase.storage.from(SCORM_BUCKET).upload(objectPath, fileData, {
          upsert: true,
          contentType
        });
        if (upErr) throw upErr;
      }

      const { error: updErr } = await supabase
        .from('scorm_packages')
        .update({
          storage_prefix: prefix,
          entry_path: entryPath,
          manifest_path: manifestPath
        })
        .eq('id', id);
      if (updErr) throw updErr;

      setOpen(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      setScopeMode('all');
      setSelectedHospitalIds([]);
      setSelectedPrograms([]);
      await loadPackages();
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Load options for Admin scoping controls (only when dialog is opened)
  useEffect(() => {
    if (!open || !canManage) return;
    let mounted = true;
    (async () => {
      try {
        const list: { id: string; label: string; state: string; city: string; name: string }[] = [];
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
            const name = String(row.name ?? 'Unknown');
            const state = String(row.state ?? '');
            const city = String(row.city ?? '');
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
        // Best effort: infer program options from CRM (AdminCRM already uses hospitals.programs)
        // Pull programs from the same query by selecting again with programs is expensive; instead keep it simple:
        // We'll offer free-typed programs and also suggest from any programs visible in CRM page later.
        // Here: if hospitals returned have programs, use them.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data: progData } = await supabase.from('hospitals').select('programs').limit(2000);
        if (Array.isArray(progData)) {
          for (const row of progData as Record<string, unknown>[]) {
            const raw = row.programs;
            if (Array.isArray(raw)) raw.map((x) => String(x)).filter(Boolean).forEach((p) => programsSet.add(p));
          }
        }
        if (mounted) {
          setHospitalOptions(list);
          setProgramOptions(Array.from(programsSet).sort());
        }
      } catch {
        if (mounted) {
          setHospitalOptions([]);
          setProgramOptions([]);
        }
      }
    })();
    return () => { mounted = false; };
  }, [open, canManage]);

  // Hide section entirely for non-admin users unless there is at least one visible package
  if (!canManage && !loading && visiblePackages.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              Launch learning modules (SCORM). Admins can upload; everyone can launch.
            </Typography>
          </Box>
          {canManage && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)}>
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
        ) : visiblePackages.length === 0 ? (
          <Typography color="text.secondary">
            No learning modules yet.
          </Typography>
        ) : (
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
        )}

        {selected?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {selected.description}
          </Typography>
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
        <DialogTitle>Add Learning Module (SCORM)</DialogTitle>
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
              <InputLabel>Visible to</InputLabel>
              <Select
                label="Visible to"
                value={scopeMode}
                onChange={(e) => {
                  const v = String(e.target.value) as 'all' | 'hospitals' | 'programs';
                  setScopeMode(v);
                  if (v !== 'hospitals') setSelectedHospitalIds([]);
                  if (v !== 'programs') setSelectedPrograms([]);
                }}
              >
                <MenuItem value="all">All hospitals / users</MenuItem>
                <MenuItem value="hospitals">Only selected hospitals</MenuItem>
                <MenuItem value="programs">Only selected program(s)</MenuItem>
              </Select>
            </FormControl>

            {scopeMode === 'hospitals' && (
              <Autocomplete
                multiple
                options={hospitalOptions}
                value={hospitalOptions.filter((h) => selectedHospitalIds.includes(h.id))}
                onChange={(_, v) => setSelectedHospitalIds(v.map(x => x.id))}
                getOptionLabel={(opt) => opt.label}
                renderInput={(params) => <TextField {...params} label="Hospitals" placeholder="Search by state, city, name" />}
                disabled={uploading}
              />
            )}

            {scopeMode === 'programs' && (
              <Autocomplete
                multiple
                freeSolo
                options={programOptions}
                value={selectedPrograms}
                onChange={(_, v) => setSelectedPrograms(v.map(x => String(x)).filter(Boolean))}
                renderTags={(value, getTagProps) =>
                  value.map((opt, i) => (
                    <Chip
                      {...getTagProps({ index: i })}
                      label={opt}
                      size="small"
                    />
                  ))
                }
                renderInput={(params) => <TextField {...params} label="Program(s)" placeholder="Select or type new program" />}
                disabled={uploading}
              />
            )}

            <Button
              variant="outlined"
              component="label"
              disabled={uploading}
            >
              {uploadFile ? `Selected: ${uploadFile.name}` : 'Choose SCORM .zip'}
              <input
                type="file"
                hidden
                accept=".zip"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              Requires a Supabase Storage bucket named "{SCORM_BUCKET}". For best results, keep the bucket public so SCORM assets can load by relative URLs.
            </Typography>
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
              !uploadFile ||
              (scopeMode === 'hospitals' && selectedHospitalIds.length === 0) ||
              (scopeMode === 'programs' && selectedPrograms.length === 0)
            }
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

