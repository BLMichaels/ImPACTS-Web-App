import React, { useMemo } from 'react';
import { Alert, Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import {
  AdminPageShell,
  AdminHero,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';
import ManagerMentorsPage from './ManagerMentorsPage';
import ManagerCRMPage from './ManagerCRMPage';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';

type TeamTab = 'roster' | 'sites' | 'reports';

const TAB_META: Record<
  TeamTab,
  { label: string; title: string; description: string }
> = {
  roster: {
    label: 'Roster',
    title: 'People under your supervision',
    description:
      'Mentors you supervise and mentors in cohorts you manage — with PECC checklist progress, activity counts, and hours at their sites.',
  },
  sites: {
    label: 'Sites',
    title: 'Hospitals & contacts',
    description:
      'Hospitals assigned to your team and sites tied to PECCs in your managed cohorts. Add contacts and notes for those sites only.',
  },
  reports: {
    label: 'Reports',
    title: 'Ops reports for your hierarchy',
    description:
      'Export checklist progress, logins, activity counts, and mentor hours for your direct team and managed cohorts — nothing outside that hierarchy.',
  },
};

function parseTab(raw: string | null): TeamTab {
  if (raw === 'sites' || raw === 'reports' || raw === 'roster') return raw;
  return 'roster';
}

/**
 * Manager Team hub — single place for supervising people, their sites, and
 * hierarchy-scoped reporting. Replaces separate Mentors / CRM / Reports tabs.
 */
const ManagerTeamPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorId = currentUser?.id || userProfile?.id || '';
  const tab = parseTab(searchParams.get('tab'));
  const meta = TAB_META[tab];

  const tabsValue = useMemo(() => tab, [tab]);

  const setTab = (next: TeamTab) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    if (next !== 'sites') {
      nextParams.delete('hospital');
      nextParams.delete('contact');
      nextParams.delete('openUser');
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <AdminPageShell>
      <AdminHero
        overline="Manager"
        title="Team"
        description="Oversee the mentors and PECCs in your direct hierarchy and the cohorts you manage. Snapshot is the glance dashboard; this hub is where you act and export."
      />

      <Paper elevation={0} sx={{ ...adminSectionShellSx, mb: 2 }}>
        <Tabs
          value={tabsValue}
          onChange={(_, v: TeamTab) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Team hub sections"
        >
          <Tab
            value="roster"
            label={TAB_META.roster.label}
            icon={<PeopleIcon />}
            iconPosition="start"
          />
          <Tab
            value="sites"
            label={TAB_META.sites.label}
            icon={<LocalHospitalIcon />}
            iconPosition="start"
          />
          <Tab
            value="reports"
            label={TAB_META.reports.label}
            icon={<AssessmentIcon />}
            iconPosition="start"
          />
        </Tabs>
        <Box sx={{ px: 2.5, pb: 2, pt: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {meta.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {meta.description}
          </Typography>
        </Box>
      </Paper>

      {tab === 'roster' && <ManagerMentorsPage embedded />}
      {tab === 'sites' && <ManagerCRMPage embedded />}
      {tab === 'reports' &&
        (!actorId ? (
          <Alert severity="info">Sign in to build and export reports.</Alert>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Report options are limited to mentors, PECCs, team sites, checklist/PRS progress, logins (on people
              rows), PECC activity logs, and mentor hours — scoped to your supervised team and managed cohorts.
              Organization-wide CRM and wages reports stay in Admin.
            </Alert>
            <StaffPeccReportBuilder scope="manager" actorUserId={actorId} />
          </Box>
        ))}
    </AdminPageShell>
  );
};

export default ManagerTeamPage;
