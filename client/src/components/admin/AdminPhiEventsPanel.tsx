import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { supabase } from '../../supabase';
import { HIPAA_18_CATEGORIES } from '../../utils/phiScanner';

type PhiEventRow = {
  id: string;
  event_type: string;
  email: string | null;
  user_id: string | null;
  metadata: {
    surface?: string;
    severity?: string;
    categories?: number[];
    categoryLabels?: string[];
    findingCount?: number;
    fieldHint?: string | null;
    serverSide?: boolean;
  } | null;
  created_at: string;
};

const PHI_EVENT_TYPES = ['phi_input_blocked', 'phi_input_warned', 'phi_input_acknowledged'] as const;

const AdminPhiEventsPanel: React.FC = () => {
  const [rows, setRows] = useState<PhiEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from('security_events')
      .select('id, event_type, email, user_id, metadata, created_at')
      .in('event_type', [...PHI_EVENT_TYPES])
      .order('created_at', { ascending: false })
      .limit(100);
    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows((data || []) as PhiEventRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const labelForType = (t: string) => {
    if (t === 'phi_input_blocked') return 'Blocked';
    if (t === 'phi_input_acknowledged') return 'Acknowledged';
    return 'Warned';
  };

  const colorForType = (t: string): 'error' | 'warning' | 'info' => {
    if (t === 'phi_input_blocked') return 'error';
    if (t === 'phi_input_acknowledged') return 'info';
    return 'warning';
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        PHI screening events
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Automated scans of free-text for HIPAA Safe Harbor identifiers. Raw match text is never stored — only
        category numbers and redacted metadata. Client screening is the primary UX; database triggers also
        reject high-severity patterns on narrative saves (user/hospital data, CRM notes, checklist tasks).
        Heuristic only; not a guarantee of zero PHI. File/image contents are not OCR-scanned.
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Categories follow the HIPAA Safe Harbor 18 identifiers (e.g. #7 SSN, #8 MRN). See{' '}
        <a href="https://cphs.berkeley.edu/hipaa/hipaa18.html" target="_blank" rel="noreferrer">
          CPHS guidance
        </a>
        .
      </Alert>
      <Button startIcon={<RefreshIcon />} onClick={() => void load()} sx={{ mb: 2 }} disabled={loading}>
        Refresh
      </Button>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={22} />
          <Typography variant="body2">Loading…</Typography>
        </Box>
      ) : rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No PHI screening events yet.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Surface</TableCell>
                <TableCell>Categories</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const cats = row.metadata?.categories || [];
                return (
                  <TableRow key={row.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={colorForType(row.event_type)} label={labelForType(row.event_type)} />
                      {row.metadata?.serverSide ? (
                        <Chip size="small" variant="outlined" label="Server" sx={{ ml: 0.5 }} />
                      ) : null}
                    </TableCell>
                    <TableCell>{row.email || row.user_id || '—'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.metadata?.surface || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {cats.length
                        ? cats
                            .map((n) => `#${n} ${HIPAA_18_CATEGORIES[n] || ''}`.trim())
                            .join('; ')
                        : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default AdminPhiEventsPanel;
