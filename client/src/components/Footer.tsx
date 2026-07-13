import React from 'react';
import { Box, Typography, Link } from '@mui/material';

const PHI_DISCLAIMER =
  'Do not enter any Protected Health Information (PHI) or real patient data. Free-text fields are screened for common HIPAA identifiers. This tool is for educational and pediatric readiness purposes only.';

const Footer: React.FC = () => {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 2,
        px: 1,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'grey.50',
      }}
    >
      <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 720, mx: 'auto' }}>
        <strong>ImPACTS</strong> — Pediatric Readiness Improvement. {PHI_DISCLAIMER}
      </Typography>
      <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 0.5 }}>
        By using this site you agree to our{' '}
        <Link href="/account" color="inherit" underline="hover">
          Terms of Service
        </Link>
        .
      </Typography>
    </Box>
  );
};

export default Footer;
