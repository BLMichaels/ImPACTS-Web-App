import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Stack, Button, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PublicIcon from '@mui/icons-material/Public';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';
import StateMetricsMapPanel from '../../components/reports/StateMetricsMapPanel';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getManagedHospitalScopeKeysForManager } from '../../utils/managerTeamScope';

export default function ManagerReportsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [hospitalScope, setHospitalScope] = useState<string[] | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    getManagedHospitalScopeKeysForManager(currentUser.id).then((keys) => {
      if (!cancelled) setHospitalScope(keys);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  if (!currentUser?.id) return null;

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TimelineIcon fontSize="large" />
        Reports
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        Export scoped data for your mentoring team — PECCs, PRS timelines, mentor hours, invitations, wages,
        and site milestones. Use CSV with de-identification for research submissions.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'action.hover' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Need a quick team summary? The Overview dashboard has live KPIs and a one-click PDF export.
          </Typography>
          <Button size="small" variant="outlined" onClick={() => navigate('/manager/overview')}>
            Open Overview
          </Button>
        </Stack>
      </Paper>

      <Accordion defaultExpanded={false} sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PublicIcon fontSize="small" />
            Team coverage by state
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {hospitalScope === null ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Loading team hospital scope…
              </Typography>
            </Box>
          ) : hospitalScope.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No hospitals in your team scope yet. Assign mentors in CRM to see geographic coverage.
              </Typography>
            </Box>
          ) : (
            <StateMetricsMapPanel
              hospitalScopeKeys={hospitalScope}
              title="Team coverage by state"
              subtitle="States where your mentors and PECCs are active. Export CSV for grant or program reporting."
            />
          )}
        </AccordionDetails>
      </Accordion>

      <StaffPeccReportBuilder scope="manager" actorUserId={currentUser.id} />
    </Box>
  );
}
