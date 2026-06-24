import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { isIosDevice } from '../utils/device';

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

const Step: React.FC<StepProps & { spacing?: number }> = ({ number, title, children, spacing = 2 }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: spacing }}>
    <Box
      aria-hidden
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.875rem',
        flexShrink: 0,
        mt: 0.15,
      }}
    >
      {number}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.35, lineHeight: 1.35 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  </Stack>
);

interface MfaInstructionStepsProps {
  mode: 'enroll' | 'verify';
  compact?: boolean;
  qrBeside?: boolean;
}

const MfaInstructionSteps: React.FC<MfaInstructionStepsProps> = ({
  mode,
  compact = false,
  qrBeside = false,
}) => {
  const ios = isIosDevice();
  const stepSpacing = compact ? 1 : 1.5;
  const enrollGridSx = compact
    ? {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        columnGap: 2,
        rowGap: 0,
        '@media (max-width: 520px)': {
          gridTemplateColumns: '1fr',
        },
      }
    : undefined;

  if (mode === 'verify') {
    return (
      <Box component="section" aria-label="How to verify MFA" sx={{ mb: compact ? 1.5 : 2.5 }}>
        <Step number={1} title="Open your authenticator app" spacing={stepSpacing}>
          Use the same app you set up earlier — for example{' '}
          {ios ? (
            <>
              <strong>Passwords</strong> (built into iPhone), Google Authenticator, Microsoft
              Authenticator, Authy, or 1Password.
            </>
          ) : (
            <>
              Google Authenticator, Microsoft Authenticator, Authy, 1Password, or Apple Passwords.
            </>
          )}
        </Step>
        <Step number={2} title="Find your ImPACTS code" spacing={stepSpacing}>
          {ios ? (
            <>
              In <strong>Passwords</strong>, open the ImPACTS entry and view the verification code.
              In other apps, select your ImPACTS account. The code is 6 digits and changes about every
              30 seconds.
            </>
          ) : (
            <>
              Look for an entry named <strong>ImPACTS</strong> (or your email). The 6-digit code
              refreshes about every 30 seconds.
            </>
          )}
        </Step>
        <Step number={3} title="Enter the code below" spacing={stepSpacing}>
          Type the current 6-digit code and tap <strong>Verify code</strong>. If it fails, wait for
          the next code and try again.
        </Step>
      </Box>
    );
  }

  const qrRef = qrBeside ? 'to the right' : 'below';
  const manualRef = qrBeside ? 'on the right' : 'below';

  return (
    <Box
      component="section"
      aria-label="How to set up MFA"
      sx={{ mb: compact ? 0 : 2.5, ...enrollGridSx }}
    >
      <Step number={1} title="Choose a free authenticator app" spacing={stepSpacing}>
        {ios ? (
          <>
            On iPhone, the built-in <strong>Passwords</strong> app works and requires no download.
            You can also use Google Authenticator, Microsoft Authenticator, Authy, or 1Password.
          </>
        ) : (
          <>
            Install or open a free app such as Google Authenticator, Microsoft Authenticator, Authy,
            1Password, or Apple Passwords on your phone.
          </>
        )}
      </Step>
      <Step number={2} title="Add ImPACTS to that app" spacing={stepSpacing}>
        <Box component="span" sx={{ display: 'block', mb: 0.75 }}>
          <strong>Do not use your phone&apos;s regular Camera app.</strong> Open your authenticator app
          first, then choose <strong>Scan QR code</strong> (or equivalent) inside that app.
        </Box>
        {ios ? (
          <>
            On iPhone with <strong>Passwords</strong>, you can long-press the QR code {qrRef} on this page
            (not the Camera app) and tap <strong>Add Verification Code in Passwords</strong>. Or scan from
            another device using your app&apos;s built-in scanner. Can&apos;t scan? Use{' '}
            <strong>Manual entry</strong> {manualRef}.
          </>
        ) : (
          <>
            Point your authenticator app&apos;s scanner at the QR code {qrRef}. Setting up on the same
            screen? Use <strong>Manual entry</strong> {manualRef} instead.
          </>
        )}
      </Step>
      <Step number={3} title="Get your 6-digit code" spacing={stepSpacing}>
        Your app shows a 6-digit code that changes about every 30 seconds.
      </Step>
      <Step number={4} title="Confirm setup in ImPACTS" spacing={compact ? 0 : stepSpacing}>
        Enter the code {qrBeside ? 'on the right' : 'below'} and tap <strong>Enable authenticator</strong>.
      </Step>
    </Box>
  );
};

export default MfaInstructionSteps;
