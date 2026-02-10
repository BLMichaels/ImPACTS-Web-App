import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
  Box,
  Typography
} from '@mui/material';
import { supabase } from '../../supabase';
import { createAndSendInvitation } from '../../utils/invitations';
import { UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';

interface SendInvitationDialogProps {
  open: boolean;
  onClose: () => void;
  contactEmail?: string;
  contactName?: string;
  contactId?: string;
  onSuccess?: (code: string) => void;
}

export const SendInvitationDialog: React.FC<SendInvitationDialogProps> = ({
  open,
  onClose,
  contactEmail = '',
  contactName = '',
  contactId,
  onSuccess
}) => {
  const { userProfile } = useUserProfile();
  const [email, setEmail] = useState(contactEmail);
  const [role, setRole] = useState<UserRole>('pecc');
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [managerIdForPECC, setManagerIdForPECC] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationCode, setInvitationCode] = useState<string>('');
  
  // Options for dropdowns
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string }>>([]);
  const [mentors, setMentors] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [managers, setManagers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  
  useEffect(() => {
    if (open) {
      setEmail(contactEmail);
      setRole('pecc');
      setHospitalId(null);
      setMentorId(null);
      setManagerId(null);
      setManagerIdForPECC(null);
      setError(null);
      setSuccess(false);
      setInvitationCode('');
      loadOptions();
    }
  }, [open, contactEmail]);
  
  const loadOptions = async () => {
    // Load hospitals
    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('id, name')
      .order('name');
    if (hospitalsData) {
      setHospitals(hospitalsData.map(h => ({ id: h.id, name: h.name })));
    }
    
    // Load mentors
    const { data: mentorsData } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'mentor')
      .eq('is_active', true);
    if (mentorsData) {
      setMentors(mentorsData.map(m => ({
        id: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
        email: m.email
      })));
    }
    
    // Load managers
    const { data: managersData } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('role', 'manager')
      .eq('is_active', true);
    if (managersData) {
      setManagers(managersData.map(m => ({
        id: m.id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
        email: m.email
      })));
    }
  };
  
  const handleSend = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!userProfile?.id) {
      setError('You must be logged in to send invitations');
      return;
    }
    
    // Validate role-specific requirements
    if (role === 'pecc' && !mentorId && !managerIdForPECC) {
      setError('PECC invitations require either a mentor or direct manager assignment');
      return;
    }
    
    if (role === 'mentor' && !managerId) {
      setError('Mentor invitations require a manager assignment');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { code } = await createAndSendInvitation({
        email: email.trim(),
        role,
        invitedBy: userProfile.id,
        hospitalId: hospitalId || null,
        mentorId: role === 'pecc' ? (mentorId || null) : null,
        managerId: role === 'mentor' ? (managerId || null) : null,
        managerIdForPECC: role === 'pecc' ? (managerIdForPECC || null) : null
      });
      
      setInvitationCode(code);
      setSuccess(true);
      if (onSuccess) onSuccess(code);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    if (!loading) {
      setSuccess(false);
      setError(null);
      onClose();
    }
  };
  
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Send Account Invitation
        {contactName && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            For: {contactName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Invitation sent successfully! Invitation code: <strong>{invitationCode}</strong>
            <Typography variant="body2" sx={{ mt: 1 }}>
              The user will receive an email with a link to complete their registration.
            </Typography>
          </Alert>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              disabled={loading}
              sx={{ mb: 2 }}
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  // Clear assignments when role changes
                  setMentorId(null);
                  setManagerId(null);
                  setManagerIdForPECC(null);
                  setHospitalId(null);
                }}
                label="Role"
                disabled={loading}
              >
                <MenuItem value="pecc">PECC</MenuItem>
                <MenuItem value="mentor">Mentor</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            
            {role === 'pecc' && (
              <>
                <Autocomplete
                  options={hospitals}
                  getOptionLabel={(option) => option.name}
                  value={hospitals.find(h => h.id === hospitalId) || null}
                  onChange={(_, value) => setHospitalId(value?.id || null)}
                  renderInput={(params) => (
                    <TextField {...params} label="Hospital (optional)" sx={{ mb: 2 }} />
                  )}
                  disabled={loading}
                />
                
                <Autocomplete
                  options={mentors}
                  getOptionLabel={(option) => option.name}
                  value={mentors.find(m => m.id === mentorId) || null}
                  onChange={(_, value) => {
                    setMentorId(value?.id || null);
                    if (value) setManagerIdForPECC(null); // Clear direct manager if mentor is selected
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Mentor (optional)" sx={{ mb: 2 }} />
                  )}
                  disabled={loading}
                />
                
                <Autocomplete
                  options={managers}
                  getOptionLabel={(option) => option.name}
                  value={managers.find(m => m.id === managerIdForPECC) || null}
                  onChange={(_, value) => {
                    setManagerIdForPECC(value?.id || null);
                    if (value) setMentorId(null); // Clear mentor if direct manager is selected
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Direct Manager (optional, bypasses mentor)" sx={{ mb: 2 }} />
                  )}
                  disabled={loading}
                />
                
                {!mentorId && !managerIdForPECC && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Please assign either a mentor or a direct manager for this PECC.
                  </Alert>
                )}
              </>
            )}
            
            {role === 'mentor' && (
              <Autocomplete
                options={managers}
                getOptionLabel={(option) => option.name}
                value={managers.find(m => m.id === managerId) || null}
                onChange={(_, value) => setManagerId(value?.id || null)}
                renderInput={(params) => (
                  <TextField {...params} label="Manager (required)" required sx={{ mb: 2 }} />
                )}
                disabled={loading}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            onClick={handleSend}
            variant="contained"
            disabled={loading || !email.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : undefined}
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
