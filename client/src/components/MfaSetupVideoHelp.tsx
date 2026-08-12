import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  PlayCircleOutline as PlayIcon,
  VideocamOutlined as VideoIcon,
} from '@mui/icons-material';
import {
  MFA_SETUP_VIDEO_DESCRIPTION,
  MFA_SETUP_VIDEO_DURATION_LABEL,
  MFA_SETUP_VIDEO_MAX_SECONDS,
  MFA_SETUP_VIDEO_STEPS,
  MFA_SETUP_VIDEO_TITLE,
  MFA_SETUP_VIDEO_URL,
} from '../config/mfaSetupVideo';
import { resolveVideoEmbed } from '../utils/videoEmbed';

type MfaSetupVideoHelpProps = {
  /** landing = homepage section; inline = embedded player; trigger = button opens dialog */
  variant?: 'landing' | 'inline' | 'trigger' | 'accordion';
  /** Accent for buttons/icons on marketing pages */
  accent?: string;
  /** Slate tone for auth screens */
  slate?: string;
};

function DurationChip({ sx }: { sx?: object }) {
  return (
    <Chip
      size="small"
      label={MFA_SETUP_VIDEO_DURATION_LABEL}
      sx={{ fontWeight: 650, height: 22, ...sx }}
    />
  );
}

function VideoPlayer({
  title,
  maxHeight = 420,
  fallbackContext = 'default',
}: {
  title: string;
  maxHeight?: number;
  fallbackContext?: 'landing' | 'default';
}) {
  const embed = useMemo(
    () => resolveVideoEmbed(MFA_SETUP_VIDEO_URL, { maxSeconds: MFA_SETUP_VIDEO_MAX_SECONDS }),
    []
  );
  const [directFailed, setDirectFailed] = useState(false);

  if (embed.kind === 'none' || (embed.kind === 'direct' && directFailed)) {
    return (
      <Box
        sx={{
          aspectRatio: '16 / 9',
          maxHeight,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: (t) => alpha(t.palette.text.primary, 0.03),
          display: 'grid',
          placeItems: 'center',
          px: 2,
          textAlign: 'center',
        }}
      >
        <Stack spacing={1} alignItems="center" sx={{ maxWidth: 420 }}>
          <VideoIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight={650}>
              MFA setup walkthrough
            </Typography>
            <DurationChip />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {fallbackContext === 'landing'
              ? 'Follow the three quick steps on this page after sign-in.'
              : 'Follow the three quick steps below after sign-in.'}
          </Typography>
          {process.env.NODE_ENV === 'development' ? (
            <Typography variant="caption" color="text.disabled">
              Dev: add a ≤{MFA_SETUP_VIDEO_MAX_SECONDS}s file at{' '}
              <code>client/public/media/mfa-first-login-setup.mp4</code> or set{' '}
              <code>REACT_APP_MFA_SETUP_VIDEO_URL</code>.
            </Typography>
          ) : null}
        </Stack>
      </Box>
    );
  }

  if (embed.kind === 'direct' && embed.src) {
    return (
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: '#000',
          aspectRatio: '16 / 9',
          maxHeight,
          position: 'relative',
        }}
      >
        <video
          controls
          playsInline
          preload="metadata"
          title={title}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          onError={() => setDirectFailed(true)}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (el.duration > MFA_SETUP_VIDEO_MAX_SECONDS + 1) {
              el.currentTime = 0;
            }
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.currentTime > MFA_SETUP_VIDEO_MAX_SECONDS) {
              el.pause();
              el.currentTime = MFA_SETUP_VIDEO_MAX_SECONDS;
            }
          }}
        >
          <source src={embed.src} />
          Your browser does not support embedded video.
        </video>
      </Box>
    );
  }

  if (embed.embedUrl) {
    return (
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          aspectRatio: '16 / 9',
          maxHeight,
        }}
      >
        <Box
          component="iframe"
          title={title}
          src={embed.embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sx={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </Box>
    );
  }

  return null;
}

const MfaSetupVideoHelp: React.FC<MfaSetupVideoHelpProps> = ({
  variant = 'inline',
  accent = '#0e7490',
  slate = '#455a64',
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const dialog = (
    <Dialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      maxWidth="md"
      fullWidth
      aria-labelledby="mfa-setup-video-title"
    >
      <DialogTitle id="mfa-setup-video-title" sx={{ pr: 6, fontWeight: 650 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <span>{MFA_SETUP_VIDEO_TITLE}</span>
          <DurationChip />
        </Stack>
        <IconButton
          aria-label="Close video"
          onClick={() => setDialogOpen(false)}
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {MFA_SETUP_VIDEO_DESCRIPTION}
        </Typography>
        <VideoPlayer title={MFA_SETUP_VIDEO_TITLE} />
        <Stack component="ol" spacing={0.75} sx={{ mt: 2.5, pl: 2.25, mb: 0 }}>
          {MFA_SETUP_VIDEO_STEPS.map((step) => (
            <Typography key={step} component="li" variant="body2" color="text.secondary">
              {step}
            </Typography>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );

  if (variant === 'trigger') {
    return (
      <>
        <Button
          size="small"
          variant="text"
          startIcon={<PlayIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ fontWeight: 600, color: slate, alignSelf: 'flex-start', px: 0 }}
        >
          Watch {MFA_SETUP_VIDEO_DURATION_LABEL} MFA setup video
        </Button>
        {dialog}
      </>
    );
  }

  if (variant === 'accordion') {
    return (
      <>
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: alpha(slate, 0.12),
            borderRadius: '12px !important',
            '&:before': { display: 'none' },
            bgcolor: 'rgba(255,255,255,0.55)',
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="mfa-video-content">
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <PlayIcon sx={{ color: slate }} />
              <Typography variant="subtitle2" fontWeight={650}>
                Watch: first-time MFA setup
              </Typography>
              <DurationChip />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {MFA_SETUP_VIDEO_DESCRIPTION}
            </Typography>
            <VideoPlayer title={MFA_SETUP_VIDEO_TITLE} maxHeight={360} />
          </AccordionDetails>
        </Accordion>
        {dialog}
      </>
    );
  }

  if (variant === 'landing') {
    return (
      <Box
        component="section"
        aria-labelledby="mfa-setup-video-heading"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha(accent, 0.18),
          bgcolor: alpha(accent, 0.04),
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2.5, md: 4 }} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Typography
                id="mfa-setup-video-heading"
                component="h2"
                variant="h5"
                sx={{ fontWeight: 650, letterSpacing: '-0.01em' }}
              >
                {MFA_SETUP_VIDEO_TITLE}
              </Typography>
              <DurationChip sx={{ bgcolor: alpha(accent, 0.12), color: accent }} />
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.65, mb: 2 }}>
              {MFA_SETUP_VIDEO_DESCRIPTION}
            </Typography>
            <Stack component="ol" spacing={1} sx={{ pl: 2.25, m: 0 }}>
              {MFA_SETUP_VIDEO_STEPS.map((step, i) => (
                <Typography key={step} component="li" variant="body2" color="text.secondary">
                  <strong>{i + 1}.</strong> {step}
                </Typography>
              ))}
            </Stack>
          </Box>
          <Box sx={{ width: { xs: '100%', md: 'min(520px, 48vw)' }, flexShrink: 0 }}>
            <VideoPlayer title={MFA_SETUP_VIDEO_TITLE} maxHeight={320} fallbackContext="landing" />
          </Box>
        </Stack>
      </Box>
    );
  }

  return <VideoPlayer title={MFA_SETUP_VIDEO_TITLE} />;
};

export default MfaSetupVideoHelp;
