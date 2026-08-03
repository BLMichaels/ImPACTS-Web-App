import React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import StaffPeccReportBuilder from '../../components/reports/StaffPeccReportBuilder';
import { AdminPageShell, AdminHero, AdminSection } from '../../components/admin/AdminPageChrome';

/**
 * Manager reports — same builder as Admin, scoped to cohorts this manager
 * directly manages (plus mentors/managers/PECCs in those cohorts and directly supervised mentors).
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
        description="Build and export reports for the cohorts you directly manage — including mentors and managers in those cohorts, plus sites and PECCs on your team."
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" onClick={() => navigate('/manager/cohorts')}>
              My cohorts
            </Button>
            <Button size="small" variant="outlined" onClick={() => navigate('/manager/overview')}>
              Snapshot
            </Button>
          </Stack>
        }
      />

      {!actorId ? (
        <Alert severity="info">Sign in to build and export reports.</Alert>
      ) : (
        <AdminSection
          overline="Your managed cohorts"
          title="Report builder"
          description="Cohort filters list only cohorts assigned to you as manager. People reports include mentors and managers in those cohorts."
          disableBodyPadding
        >
          <StaffPeccReportBuilder scope="manager" actorUserId={actorId} />
        </AdminSection>
      )}
    </AdminPageShell>
  );
};

export default ManagerReportsPage;
