import React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';
import { AdminPageShell, AdminHero, AdminSection } from '../../components/admin/AdminPageChrome';

/**
 * Manager reports — same builder as Admin, scoped to:
 * - Direct team: mentors you supervise and their sites/PECCs
 * - Managed cohorts: people and filters for cohorts where you are a cohort manager
 */
const ManagerReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const actorId = currentUser?.id || userProfile?.id || '';

  return (
    <AdminPageShell>
      <AdminHero
        overline="Manager"
        title="Reports"
        description="Build and export reports for your direct mentoring team and for cohorts you manage. Wages/payroll reports are not available at the manager tier."
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" onClick={() => navigate('/manager/cohorts')}>
              My cohorts
            </Button>
            <Button size="small" variant="outlined" onClick={() => navigate('/manager/snapshot')}>
              Snapshot
            </Button>
          </Stack>
        }
      />

      {!actorId ? (
        <Alert severity="info">Sign in to build and export reports.</Alert>
      ) : (
        <AdminSection
          overline="Scoped reports"
          title="Report builder"
          description="Two complementary scopes: Direct team (mentors you supervise and their sites) and Managed cohorts (cohorts assigned to you as manager). Program filters list only programs linked to your managed cohorts or program_managers rows."
          disableBodyPadding
        >
          <StaffPeccReportBuilder scope="manager" actorUserId={actorId} />
        </AdminSection>
      )}
    </AdminPageShell>
  );
};

export default ManagerReportsPage;
