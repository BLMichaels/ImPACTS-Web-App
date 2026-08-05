import React, { useMemo } from 'react';
import { Alert, Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
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
import ManagerSimpleReports from './ManagerSimpleReports';

type TeamTab = 'roster' | 'sites' | 'reports';

const TAB_META: Record<TeamTab, { label: string; title: string; description: string }> = {
  roster: {
    label: 'Roster',
    title: 'Your mentors & PECCs',
    description: 'People you supervise and mentors in cohorts you manage.',
  },
  sites: {
    label: 'Sites',
    title: 'Team hospitals',
    description: 'Hospitals on your team — contacts and notes for those sites only.',
  },
  reports: {
    label: 'Reports',
    title: 'Team reports',
    description: 'Simple exports for your mentors and PECCs.',
  },
};

function parseTab(raw: string | null): TeamTab {
  if (raw === 'sites' || raw === 'reports' || raw === 'roster') return raw;
  return 'roster';
}

/** Manager Team hub — roster, sites, and simple hierarchy reports. */
const ManagerTeamPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
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
        description="Supervise your mentors and PECCs, their sites, and pull simple team reports."
      />

      <Paper elevation={0} sx={{ ...adminSectionShellSx, mb: 2 }}>
        <Tabs
          value={tabsValue}
          onChange={(_, v: TeamTab) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Team sections"
        >
          <Tab value="roster" label={TAB_META.roster.label} icon={<PeopleIcon />} iconPosition="start" />
          <Tab value="sites" label={TAB_META.sites.label} icon={<LocalHospitalIcon />} iconPosition="start" />
          <Tab value="reports" label={TAB_META.reports.label} icon={<AssessmentIcon />} iconPosition="start" />
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
          <Alert severity="info">Sign in to view reports.</Alert>
        ) : (
          <ManagerSimpleReports actorUserId={actorId} />
        ))}
    </AdminPageShell>
  );
};

export default ManagerTeamPage;
