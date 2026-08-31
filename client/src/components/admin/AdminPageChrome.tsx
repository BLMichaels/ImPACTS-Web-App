/**
 * Shared page chrome for Admin tools (CRM, Reports, Settings).
 * Matches PECC restyle: full-width shell, teal–slate gradient hero, elevation-0 section Papers.
 */
import React, { type ReactNode } from 'react';
import {
  Box,
  Container,
  Paper,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';

export const adminSectionShellSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  overflow: 'hidden',
} as const;

export const adminHeroPaperSx = {
  p: { xs: 2, md: 2.75 },
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  background: (t: { palette: { secondary: { main: string }; primary: { main: string }; background: { paper: string } } }) =>
    `linear-gradient(120deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, ${t.palette.background.paper} 42%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
} as const;

export const adminSectionHeaderSx = {
  px: { xs: 2, md: 2.5 },
  py: 1.5,
  borderBottom: '1px solid',
  borderColor: 'divider',
  bgcolor: (t: { palette: { secondary: { main: string } } }) => alpha(t.palette.secondary.main, 0.04),
  display: 'flex',
  alignItems: 'flex-start',
  gap: 1.5,
} as const;

export const adminSectionBodySx = {
  px: { xs: 2, md: 2.5 },
  py: { xs: 2, md: 2.25 },
} as const;

export function AdminPageShell({
  children,
  spacing = true,
}: {
  children: ReactNode;
  /** When false, render children without Stack spacing (caller manages layout). */
  spacing?: boolean;
}) {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100%', pb: { xs: 10, md: 5 } }}>
      <Container
        maxWidth={false}
        sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, md: 4, lg: 5 }, width: '100%' }}
      >
        {spacing ? (
          <Stack spacing={{ xs: 2, md: 2.5 }}>{children}</Stack>
        ) : (
          children
        )}
      </Container>
    </Box>
  );
}

export function AdminHero({
  overline = 'Admin',
  title,
  description,
  actions,
}: {
  overline?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Paper elevation={0} sx={adminHeroPaperSx}>
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
            width: '100%',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block', mb: 0.5 }}
            >
              {overline}
            </Typography>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                letterSpacing: -0.02,
                color: 'text.primary',
                fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
              }}
            >
              {title}
            </Typography>
          </Box>
          {actions && (
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              alignItems="center"
              sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' }, ml: { sm: 'auto' } }}
            >
              {actions}
            </Stack>
          )}
        </Box>
        {description && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              width: '100%',
              lineHeight: 1.6,
              fontSize: { xs: '0.925rem', sm: '0.975rem' },
            }}
          >
            {description}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export function AdminSection({
  overline,
  title,
  description,
  icon,
  actions,
  children,
  /** Omit body padding (e.g. for flush tables / tabs). */
  disableBodyPadding = false,
  bodySx,
}: {
  overline?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  disableBodyPadding?: boolean;
  bodySx?: object;
}) {
  const theme = useTheme();
  const hasHeader = Boolean(overline || title || description || actions || icon);

  return (
    <Paper elevation={0} sx={adminSectionShellSx}>
      {hasHeader && (
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha(theme.palette.secondary.main, 0.04),
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {overline && (
              <Typography
                variant="overline"
                sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
              >
                {overline}
              </Typography>
            )}
            {(title || actions || icon) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {icon}
                {title && (
                  <Typography
                    variant="h6"
                    component="h2"
                    sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: { xs: '1.1rem', sm: '1.2rem' } }}
                  >
                    {title}
                  </Typography>
                )}
                {actions && (
                  <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {actions}
                  </Box>
                )}
              </Box>
            )}
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 820, lineHeight: 1.55 }}>
                {description}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      <Box
        sx={{
          ...(disableBodyPadding ? {} : adminSectionBodySx),
          ...bodySx,
        }}
      >
        {children}
      </Box>
    </Paper>
  );
}
