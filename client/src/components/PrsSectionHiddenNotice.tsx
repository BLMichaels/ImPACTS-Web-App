import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useUserProfile } from '../context/UserProfileContext';
import { canRestorePediatricReadinessSection } from '../hooks/usePermissions';

type Props = {
  onShow: () => void | Promise<void>;
};

/**
 * Shown when Pediatric Readiness Scores are hidden (Dashboard + Snapshot).
 * PECCs cannot self-restore; mentors/managers/admins can.
 */
const PrsSectionHiddenNotice: React.FC<Props> = ({ onShow }) => {
  const { actualRole, hasAdminAccess } = useUserProfile();
  const canRestore = canRestorePediatricReadinessSection(actualRole, hasAdminAccess);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 3,
        p: 2.5,
        borderRadius: 2,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start'
      }}
    >
      <InfoOutlinedIcon color="action" sx={{ mt: 0.25 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Pediatric Readiness Scores are hidden
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: canRestore ? 1.5 : 0 }}>
          This matches your Dashboard: scores and PRS-related blocks stay off here until turned back on.
          {canRestore
            ? ' You can show this section again below.'
            : ' Your mentor, manager, or administrator can turn this section back on from user permissions.'}
        </Typography>
        {canRestore && (
          <Button size="small" variant="contained" onClick={() => void onShow()}>
            Show Pediatric Readiness Scores
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default PrsSectionHiddenNotice;
