/**
 * First-time MFA setup how-to video (keep the recording ≤ 45 seconds).
 *
 * Set REACT_APP_MFA_SETUP_VIDEO_URL to:
 * - YouTube watch or youtu.be link
 * - Vimeo link
 * - Direct mp4/webm URL
 * - Site-relative path (default: /media/mfa-first-login-setup.mp4 in client/public)
 */
export const MFA_SETUP_VIDEO_MAX_SECONDS = 45;

export const MFA_SETUP_VIDEO_URL =
  process.env.REACT_APP_MFA_SETUP_VIDEO_URL?.trim() || '/media/mfa-first-login-setup.mp4';

export const MFA_SETUP_VIDEO_TITLE = 'First sign-in: MFA in under a minute';

export const MFA_SETUP_VIDEO_DESCRIPTION =
  'A quick 45-second walkthrough — sign in, scan the QR code in your authenticator app, enter the code, and you’re in.';

/** On-screen beats to match when recording (target ≤ 45s total). */
export const MFA_SETUP_VIDEO_BEATS = [
  { at: '0:00', line: 'Sign in with your invitation email and password.' },
  { at: '0:12', line: 'Open your authenticator app and choose Scan QR code (not the phone Camera app).' },
  { at: '0:28', line: 'Scan the code on screen, enter the 6-digit code, tap Enable authenticator.' },
] as const;

export const MFA_SETUP_VIDEO_STEPS = [
  'Sign in — MFA setup appears right after.',
  'Scan the QR code inside your authenticator app.',
  'Enter the 6-digit code and tap Enable.',
];

export const MFA_SETUP_VIDEO_DURATION_LABEL = `${MFA_SETUP_VIDEO_MAX_SECONDS} sec`;
