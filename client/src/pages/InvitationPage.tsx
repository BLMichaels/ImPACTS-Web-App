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
import { getInvitationByCode, acceptInvitation } from '../utils/invitations';
import { UserRole } from '../types/database';

interface InvitationData {
  code: string;
  email: string;
  role: UserRole;
  hospitalName?: string;
  mentorName?: string;
  managerName?: string;
  status: string;
  expiresAt: string;
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
      const invitationData = await getInvitationByCode(code);
      
      if (!invitationData) {
        setError('This invitation link is invalid or has expired.');
        setInvitation(null);
        setLoading(false);
        return;
      }
      
      // Check if invitation has expired
      const expiresAt = new Date(invitationData.expires_at);
      if (expiresAt < new Date()) {
        setError('This invitation has expired. Please contact your administrator for a new invitation.');
        setInvitation(null);
        setLoading(false);
        return;
      }
      
      // Fetch related data if available
      let hospitalName: string | undefined;
      let mentorName: string | undefined;
      let managerName: string | undefined;
      
      if (invitationData.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', invitationData.hospital_id)
          .single();
        if (hospital) hospitalName = hospital.name;
      }
      
      if (invitationData.mentor_id) {
        const { data: mentor } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', invitationData.mentor_id)
          .single();
        if (mentor) {
          mentorName = [mentor.first_name, mentor.last_name].filter(Boolean).join(' ') || mentor.email;
        }
      }
      
      if (invitationData.manager_id) {
        const { data: manager } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', invitationData.manager_id)
          .single();
        if (manager) {
          managerName = [manager.first_name, manager.last_name].filter(Boolean).join(' ') || manager.email;
        }
      }
      
      const invitation: InvitationData = {
        code: invitationData.code,
        email: invitationData.email,
        role: invitationData.role as UserRole,
        hospitalName,
        mentorName,
        managerName,
        status: invitationData.status,
        expiresAt: invitationData.expires_at
      };
      
      setInvitation(invitation);
      setFormData(prev => ({ ...prev, email: invitationData.email }));
    } catch (err: any) {
      setError(err.message || 'Failed to validate invitation. Please try again.');
      setInvitation(null);
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
    
    // Validate email matches invitation
    if (invitation && invitation.email && formData.email.trim().toLowerCase() !== invitation.email.toLowerCase()) {
      setError('Email does not match the invitation. Please use the email address the invitation was sent to.');
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
      if (!invitation || !code) {
        throw new Error('Invalid invitation');
      }
      
      // Create account with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone || null,
            role: invitation.role,
            invitation_code: code
          },
          emailRedirectTo: `${window.location.origin}/login?confirmed=true`
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // Update user record with role and assignments
        const updatePayload: any = {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          phone: formData.phone.trim() || null,
          role: invitation.role,
          updated_at: new Date().toISOString()
        };
        
        // Add assignments based on invitation
        const { data: invData } = await supabase
          .from('invitations')
          .select('mentor_id, manager_id')
          .eq('code', code)
          .single();
        
        if (invitation.role === 'pecc') {
          // For PECC: if mentor_id exists, use it; if manager_id exists but no mentor_id, it's a direct manager assignment
          if (invData?.mentor_id) {
            updatePayload.mentor_id = invData.mentor_id;
          } else if (invData?.manager_id) {
            // Direct manager assignment (bypassing mentor)
            updatePayload.manager_id_for_pecc = invData.manager_id;
          }
        } else if (invitation.role === 'mentor' && invData?.manager_id) {
          updatePayload.manager_id = invData.manager_id;
        }
        
        const { error: updateError } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('id', data.user.id);
        
        if (updateError) {
          console.error('Failed to update user profile:', updateError);
          // Continue anyway - profile can be updated later
        }
        
        // Mark invitation as accepted
        try {
          await acceptInvitation(code, data.user.id);
        } catch (acceptError) {
          console.error('Failed to mark invitation as accepted:', acceptError);
          // Continue anyway
        }
        
        // Show success message and inform about email confirmation
        setError(null);
        alert('Account created successfully! Please check your email to confirm your account before logging in.');
        
        // Navigate to login
        navigate('/login?message=Please check your email to confirm your account');
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
              color={
                invitation.role === 'mentor' ? 'warning' : 
                invitation.role === 'manager' ? 'secondary' : 
                'primary'
              }
            />
            {invitation.hospitalName && (
              <Chip label={`Hospital: ${invitation.hospitalName}`} variant="outlined" />
            )}
            {invitation.mentorName && (
              <Chip label={`Mentor: ${invitation.mentorName}`} variant="outlined" />
            )}
            {invitation.managerName && (
              <Chip label={`Manager: ${invitation.managerName}`} variant="outlined" />
            )}
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            {(() => {
              const savedMessage = localStorage.getItem('email_confirmation_message');
              return savedMessage || 'After completing registration, you will receive an email to confirm your account. Please check your inbox and click the confirmation link before logging in.';
            })()}
          </Alert>
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
            disabled={submitting || !!invitation?.email}
            helperText={invitation?.email ? 'This email is pre-filled from your invitation' : undefined}
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
