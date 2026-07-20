import React from 'react';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export const AUTH_SLATE = '#455a64';
export const AUTH_SLATE_DARK = '#2f3e46';

interface AuthMarketingShellProps {
  children: React.ReactNode;
  /** Optional right-side action in the header (defaults to Back to home). */
  headerAction?: React.ReactNode;
  showBackHome?: boolean;
}

/**
 * Full-bleed gradient chrome shared by public auth surfaces (login, MFA gate).
 */
const AuthMarketingShell: React.FC<AuthMarketingShellProps> = ({
  children,
  headerAction,
  showBackHome = true,
}) => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        color: AUTH_SLATE_DARK,
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(ellipse 90% 60% at 8% -10%, ${alpha('#93c5fd', 0.55)} 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 95% 5%, ${alpha('#fda4af', 0.4)} 0%, transparent 50%),
            radial-gradient(ellipse 80% 55% at 50% 100%, ${alpha('#5eead4', 0.35)} 0%, transparent 55%),
            linear-gradient(165deg, #f8fafc 0%, #eef2ff 38%, #f0fdfa 72%, #f8fafc 100%)
          `,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.28,
          backgroundImage: `
            linear-gradient(${alpha(AUTH_SLATE, 0.06)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(AUTH_SLATE, 0.06)} 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(180deg, black 0%, black 75%, transparent 100%)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          component="header"
          sx={{
            px: { xs: 2, sm: 3, md: 4 },
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            component="button"
            type="button"
            onClick={() => navigate('/')}
            sx={{
              border: 0,
              background: 'none',
              cursor: 'pointer',
              p: 0,
              textAlign: 'left',
              color: 'inherit',
              '&:focus-visible': {
                outline: `2px solid ${AUTH_SLATE}`,
                outlineOffset: 4,
                borderRadius: 1,
              },
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                background: `linear-gradient(135deg, ${AUTH_SLATE} 0%, ${alpha(AUTH_SLATE, 0.75)} 100%)`,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.95rem',
                boxShadow: `0 4px 14px ${alpha(AUTH_SLATE, 0.2)}`,
              }}
              aria-hidden
            >
              P
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.15 }}>
                PECC Support Tool
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                From the ImPACTS program
              </Typography>
            </Box>
          </Stack>
          {headerAction ??
            (showBackHome ? (
              <Button variant="text" onClick={() => navigate('/')} sx={{ fontWeight: 600, color: AUTH_SLATE_DARK }}>
                Back to home
              </Button>
            ) : null)}
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>
      </Box>
    </Box>
  );
};

export default AuthMarketingShell;
