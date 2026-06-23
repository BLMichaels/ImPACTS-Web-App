import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { isIosDevice } from '../utils/device';

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ number, title, children }) => (
  <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
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
}

const MfaInstructionSteps: React.FC<MfaInstructionStepsProps> = ({ mode }) => {
  const ios = isIosDevice();

  if (mode === 'verify') {
    return (
      <Box component="section" aria-label="How to verify MFA" sx={{ mb: 2.5 }}>
        <Step number={1} title="Open your authenticator app">
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
        <Step number={2} title="Find your ImPACTS code">
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
        <Step number={3} title="Enter the code below">
          Type the current 6-digit code and tap <strong>Verify code</strong>. If it fails, wait for
          the next code and try again.
        </Step>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label="How to set up MFA" sx={{ mb: 2.5 }}>
      <Step number={1} title="Choose a free authenticator app">
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
      <Step number={2} title="Add ImPACTS to that app">
        {ios ? (
          <>
            <strong>On this iPhone:</strong> long-press the QR code below and tap{' '}
            <strong>Add Verification Code in Passwords</strong>. If the Camera or Passwords app opens
            instead, that is expected — follow the prompts to save the code.
            <br />
            <br />
            <strong>On another device:</strong> open your authenticator app, choose{' '}
            <strong>Scan QR code</strong>, and scan the code below.
            <br />
            <br />
            <strong>Can&apos;t scan?</strong> Expand <strong>Manual entry</strong> below, copy the setup
            key, and paste it into your app under <strong>Enter setup key</strong>.
          </>
        ) : (
          <>
            In your authenticator app, choose <strong>Add account</strong> or{' '}
            <strong>Scan QR code</strong>, then scan the QR code below with your phone camera.
            <br />
            <br />
            If you are setting up on the same screen (for example, a phone browser), expand{' '}
            <strong>Manual entry</strong> below and type or paste the setup key into your app.
          </>
        )}
      </Step>
      <Step number={3} title="Get your 6-digit code">
        After ImPACTS is added, your app shows a 6-digit verification code. It changes about every 30
        seconds — use the current code only.
      </Step>
      <Step number={4} title="Confirm setup in ImPACTS">
        Enter that 6-digit code in the box below and tap <strong>Enable authenticator</strong>. Setup is
        complete once verified.
      </Step>
    </Box>
  );
};

export default MfaInstructionSteps;
