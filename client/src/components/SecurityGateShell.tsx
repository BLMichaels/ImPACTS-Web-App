import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { isSecurityGateBlocking, useSecurityGate } from '../hooks/useSecurityGate';
import ForcePasswordUpdateDialog from './ForcePasswordUpdateDialog';
import TermsReacceptanceDialog from './TermsReacceptanceDialog';
import MfaGateScreen from './MfaGateScreen';

interface SecurityGateShellProps {
  children: React.ReactNode;
}

const blockingShellSx = {
  minHeight: '100vh',
  bgcolor: 'background.default',
  display: 'flex',
  flexDirection: 'column' as const,
};

/**
 * Renders security gates (password, terms, MFA) BEFORE any authenticated app chrome.
 * Children (navbar, dashboards, profile context) mount only when status is `ready`.
 */
const SecurityGateShell: React.FC<SecurityGateShellProps> = ({ children }) => {
  const { currentUser, isPasswordRecovery } = useAuth();
  const { status, refresh } = useSecurityGate(currentUser?.id);

  // Password-reset email flow: never block with MFA/terms until the new password is saved.
  if (isPasswordRecovery) {
    return <>{children}</>;
  }

  if (!currentUser) {
    return <>{children}</>;
  }

  if (isSecurityGateBlocking(status)) {
    if (status === 'checking') {
      return (
        <Box sx={{ ...blockingShellSx, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <CircularProgress aria-label="Checking security requirements" />
          <Typography variant="body2" color="text.secondary">
            Securing your session…
          </Typography>
        </Box>
      );
    }

    if (status === 'password') {
      return (
        <Box sx={blockingShellSx}>
          <ForcePasswordUpdateDialog gateManaged onComplete={() => void refresh()} />
        </Box>
      );
    }

    if (status === 'terms') {
      return (
        <Box sx={blockingShellSx}>
          <TermsReacceptanceDialog gateManaged onComplete={() => void refresh()} />
        </Box>
      );
    }

    if (status === 'mfa-challenge' || status === 'mfa-enroll') {
      return <MfaGateScreen mode={status} onComplete={() => void refresh()} />;
    }
  }

  return <>{children}</>;
};

export default SecurityGateShell;
