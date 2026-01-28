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
  Alert
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
  const { title = 'SCORM packages' } = props;
  const { userRole, siteId } = useUserProfile();

  const canManage = userRole === UserRole.ADMIN || userRole === UserRole.MANAGER || userRole === UserRole.MENTOR;

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

  const loadPackages = async () => {
    setLoading(true);
    setError('');
    try {
      // MVP: show global packages + (optionally) site-scoped ones
      // If siteId exists, include both site_id is null and site_id == siteId.
      const q = supabase
        .from('scorm_packages')
        .select('*')
        .order('updated_at', { ascending: false });

      const { data, error: err } = siteId
        ? await q.or(`site_id.is.null,site_id.eq.${siteId}`)
        : await q.eq('site_id', null);

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
          site_id: siteId ?? null,
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
      await loadPackages();
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              Upload and launch SCORM packages (MVP: launch-only; tracking can be added next).
            </Typography>
          </Box>
          {canManage && (
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setOpen(true)}>
              Add SCORM package
            </Button>
          )}
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : packages.length === 0 ? (
          <Typography color="text.secondary">
            No SCORM packages yet.
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
                {packages.map((p) => (
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
        <DialogTitle>Add SCORM package</DialogTitle>
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
          <Button onClick={handleUpload} variant="contained" disabled={uploading || !uploadTitle.trim() || !uploadFile}>
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

