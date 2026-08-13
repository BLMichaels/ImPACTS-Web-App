import React from 'react';
import { Box } from '@mui/material';

export const MFA_SETUP_GUIDDE_EMBED_SRC =
  'https://embed.app.guidde.com/playbooks/xmJK1BwjfqskMhvE5RsyAM?mode=videoAndDoc';

const TRANSCRIPT = [
  '00:05: First click the sign in button in the top right corner.',
  '00:10: Then enter your email and password and press sign in.',
  '00:13: If you do not remember your password, click forgot password and a reset link will be sent directly to your email.',
  '00:21: On your smartphone, open your preferred authenticator app. Popular free options include Google Authenticator, Microsoft Authenticator, Authy, 1Password, and Apple Passwords. You will use that application to scan the QR code that appears on your screen.',
  '00:39: Do not use your phone\'s camera application. You must do this through an authenticator app.',
  '00:46: On your phone, open your preferred app, select the option to add a new code or use the button that looks like a plus sign. From there, it will give you an option to scan a QR code.',
  '00:59: Now using the app\'s camera field, scan the QR code on your browser\'s login screen. This will automatically create a rotating unique password that changes every 30 seconds. Type this 6-digit string as it appears on your phone as the multi-factor authentication code.',
  '01:17: Next time you go to login, all you will need to do is open the authenticator app, type the password displayed on your phone, and you\'re ready to use the PECC Support Tool.',
];

/**
 * Guidde video + step-by-step doc for MFA enrollment (hosted embed).
 */
const MfaSetupGuiddeEmbed: React.FC = () => (
  <Box
    component="figure"
    sx={{
      m: 0,
      position: 'relative',
      width: '100%',
      borderRadius: '10px',
      overflow: 'hidden',
      bgcolor: 'rgba(255,255,255,0.55)',
      border: '1px solid',
      borderColor: 'rgba(69, 90, 100, 0.12)',
      boxShadow: '0 12px 32px rgba(69, 90, 100, 0.08)',
    }}
  >
    <Box
      component="iframe"
      title="PECC Support Tool Multi-Factor Authentication (MFA) Setup"
      src={MFA_SETUP_GUIDDE_EMBED_SRC}
      allowFullScreen
      referrerPolicy="unsafe-url"
      allow="clipboard-write; fullscreen"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts allow-forms allow-same-origin allow-presentation"
      loading="lazy"
      sx={{
        display: 'block',
        width: '100%',
        maxWidth: 700,
        height: { xs: 520, sm: 640, md: 800 },
        mx: 'auto',
        border: 0,
        borderRadius: '10px',
      }}
    />
    {/* Visually hidden transcript for accessibility / SEO parity with Guidde markup */}
    <Box
      component="div"
      sx={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
      aria-hidden={false}
    >
      <p>MFA setup video transcript</p>
      {TRANSCRIPT.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </Box>
  </Box>
);

export default MfaSetupGuiddeEmbed;
