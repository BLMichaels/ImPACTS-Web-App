import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Collapse,
  IconButton,
  Container,
} from '@mui/material';
import {
  Business as BusinessIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';

interface HospitalRow {
  id: string;
  name: string;
  facility_id?: string | null;
  city?: string | null;
  state?: string | null;
  hospital_system?: string | null;
}

const HiringGroupSnapshotPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [systemNames, setSystemNames] = useState<string[]>([]);
  const [hospitalsBySystem, setHospitalsBySystem] = useState<Record<string, HospitalRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSystem, setExpandedSystem] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) return;
      setLoading(true);
      setError(null);
      try {
        const { data: assignments, error: assignErr } = await supabase
          .from('hiring_group_assignments')
          .select('hospital_system_name')
          .eq('user_id', currentUser.id);
        if (assignErr) throw assignErr;
        const names = (assignments || []).map((a: { hospital_system_name: string }) => a.hospital_system_name).filter(Boolean);
        setSystemNames(names);
        if (names.length > 0) setExpandedSystem((prev) => (prev == null ? names[0] : prev));

        const bySystem: Record<string, HospitalRow[]> = {};
        for (const sys of names) {
          const { data: hospData, error: hospErr } = await supabase
            .from('hospitals')
            .select('id, name, facility_id, city, state, hospital_system')
            .eq('hospital_system', sys)
            .order('name');
          if (!hospErr && hospData) bySystem[sys] = hospData as HospitalRow[];
        }
        setHospitalsBySystem(bySystem);
      } catch (e: any) {
        setError(e?.message || 'Failed to load assignments');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser?.id, retryCount]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: 200, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">Loading snapshot...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom color="error">Error Loading Snapshot</Typography>
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }} action={
          <Button color="inherit" size="small" onClick={() => { setError(null); setRetryCount(c => c + 1); }}>
            Retry
          </Button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  if (systemNames.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom color="text.secondary">No systems assigned</Typography>
        <Alert severity="info" sx={{ textAlign: 'left' }}>
          You are not assigned to any hospital system yet. An admin can assign you via the CRM (Team tab) by setting your role to Hiring Group and selecting one or more systems.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
        Snapshot – Hiring Group
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Read-only view of hospital systems and their sites to track progress. You can only view snapshots for the systems you are assigned to.
      </Typography>

      <Grid container spacing={2}>
        {systemNames.map((sysName) => {
          const hospitals = hospitalsBySystem[sysName] || [];
          const isExpanded = expandedSystem === sysName;
          return (
            <Grid item xs={12} key={sysName}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton size="small" onClick={() => setExpandedSystem(isExpanded ? null : sysName)} aria-label={isExpanded ? `Collapse ${sysName}` : `Expand ${sysName}`}>
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <BusinessIcon color="action" />
                      <Typography variant="subtitle1" fontWeight={600}>
                        {sysName}
                      </Typography>
                      <Chip size="small" label={`${hospitals.length} hospital(s)`} />
                    </Box>
                  </Box>
                  <Collapse in={isExpanded}>
                    <List dense sx={{ pl: 4, pt: 1 }}>
                      {hospitals.length === 0 ? (
                        <ListItem>
                          <ListItemText primary="No hospitals in this system" secondary="Ensure Hospital system is set in the CRM for each site." />
                        </ListItem>
                      ) : (
                        hospitals.map((h) => (
                          <ListItem key={h.id}>
                            <ListItemText
                              primary={h.name || 'Unnamed'}
                              secondary={[h.city, h.state].filter(Boolean).join(', ') || (h.facility_id ? `Facility ID: ${h.facility_id}` : undefined)}
                            />
                          </ListItem>
                        ))
                      )}
                    </List>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Alert severity="info" sx={{ mt: 3 }}>
        This view shows the hospital systems and sites you have access to. Use this list to track which systems and hospitals you work with.
      </Alert>
    </Container>
  );
};

export default HiringGroupSnapshotPage;
