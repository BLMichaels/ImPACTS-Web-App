import React from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole } from '../types/database';

const getDefaultDashboard = (role: UserRole): string => {
  switch (role) {
    case UserRole.ADMIN: return '/admin/dashboard';
    case UserRole.MANAGER: return '/manager/reports';
    case UserRole.MENTOR: return '/mentor/dashboard';
    case UserRole.PECC: return '/dashboard';
    case UserRole.HOSPITAL_SYSTEM: return '/hospital-system/dashboard';
    case UserRole.HIRING_GROUP: return '/hiring-group/snapshot';
    default: return '/dashboard';
  }
};

const NotFoundPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { userRole } = useUserProfile();

  const handleGoHome = () => {
    if (!currentUser) {
      navigate('/login');
    } else {
      navigate(getDefaultDashboard(userRole ?? UserRole.PECC));
    }
  };

  return (
    <Container>
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h1" gutterBottom>
          404
        </Typography>
        <Typography variant="h4" gutterBottom>
          Page Not Found
        </Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>
          The page you are looking for does not exist.
        </Typography>
        <Button variant="contained" onClick={handleGoHome}>
          {currentUser ? 'Go to Support Tool' : 'Go to Login'}
        </Button>
      </Box>
    </Container>
  );
};

export default NotFoundPage;
