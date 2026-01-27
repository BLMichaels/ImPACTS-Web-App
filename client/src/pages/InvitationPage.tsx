import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Container,
  Alert,
  CircularProgress,
  Divider,
  Chip
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface InvitationData {
  code: string;
  email: string;
  role: string;
  hospitalName?: string;
  mentorName?: string;
  status: string;
}

const InvitationPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });

  useEffect(() => {
    validateInvitation();
  }, [code]);

  const validateInvitation = async () => {
    if (!code) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    try {
      // In production, this would fetch from Supabase
      // For now, simulate validation
      
      // Mock invitation data based on code
      const mockInvitation: InvitationData = {
        code: code,
        email: 'invited@example.com',
        role: code.startsWith('M') ? 'mentor' : 'pecc',
        hospitalName: code.startsWith('P') ? 'Memorial General Hospital' : undefined,
        mentorName: code.startsWith('P') ? 'Sarah Johnson' : undefined,
        status: 'pending'
      };

      // Simulate checking if valid
      if (code.length < 6) {
        setError('This invitation link is invalid or has expired.');
        setInvitation(null);
      } else {
        setInvitation(mockInvitation);
        setFormData(prev => ({ ...prev, email: mockInvitation.email }));
      }
    } catch (err) {
      setError('Failed to validate invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      // Create account with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            role: invitation?.role,
            invitation_code: code
          }
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // Mark invitation as accepted (in production, this would update the database)
        
        // Navigate to appropriate dashboard
        const dashboardPath = invitation?.role === 'mentor' ? '/mentor/dashboard' : '/dashboard';
        navigate(dashboardPath);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Validating invitation...</Typography>
        </Box>
      </Container>
    );
  }

  if (!invitation) {
    return (
      <Container maxWidth="sm">
        <Paper sx={{ mt: 8, p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Invalid Invitation
          </Typography>
          <Typography color="textSecondary" sx={{ mb: 3 }}>
            {error || 'This invitation link is invalid or has expired.'}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Paper sx={{ mt: 4, p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Welcome to ImPACTS
        </Typography>
        <Typography color="textSecondary" align="center" gutterBottom>
          Complete your registration to get started
        </Typography>

        {/* Invitation Details */}
        <Box sx={{ my: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Invitation Details
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip 
              label={`Role: ${invitation.role.toUpperCase()}`} 
              color={invitation.role === 'mentor' ? 'warning' : 'primary'}
            />
            {invitation.hospitalName && (
              <Chip label={`Hospital: ${invitation.hospitalName}`} variant="outlined" />
            )}
            {invitation.mentorName && (
              <Chip label={`Mentor: ${invitation.mentorName}`} variant="outlined" />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              fullWidth
              required
              disabled={submitting}
            />
            <TextField
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              fullWidth
              required
              disabled={submitting}
            />
          </Box>

          <TextField
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            fullWidth
            required
            disabled={submitting}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Phone (optional)"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            fullWidth
            disabled={submitting}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            fullWidth
            required
            disabled={submitting}
            helperText="At least 8 characters"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            fullWidth
            required
            disabled={submitting}
            sx={{ mb: 3 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={24} /> : 'Complete Registration'}
          </Button>
        </form>

        <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 3 }}>
          Already have an account?{' '}
          <Button size="small" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </Typography>
      </Paper>
    </Container>
  );
};

export default InvitationPage;
