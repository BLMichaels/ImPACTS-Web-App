import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { CohortMember, User, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../lib/supabase';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  existingMemberIds: string[];
  canAddDirectly: boolean;  // True for admins/managers, false for mentors
  onMemberAdded: (member: CohortMember) => void;
}

interface UserOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
}

const InviteMemberDialog: React.FC<InviteMemberDialogProps> = ({
  open,
  onClose,
  cohortId,
  existingMemberIds,
  canAddDirectly,
  onMemberAdded
}) => {
  const { userProfile, userRole } = useUserProfile();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load available users
  useEffect(() => {
    const loadUsers = async () => {
      if (!open) return;
      
      setLoading(true);
      setError(null);
      setSuccess(false);
      setSelectedUser(null);

      try {
        let query = supabase
          .from('users')
          .select('id, first_name, last_name, email, role')
          .eq('is_active', true)
          .order('first_name');

        // If user is a mentor, they can only invite PECCs they mentor
        if (userRole === UserRole.MENTOR && !canAddDirectly) {
          query = query.eq('mentor_id', userProfile?.id);
        }
        // If user is a manager, they can add mentors under them and PECCs
        else if (userRole === UserRole.MANAGER) {
          // Get mentors managed by this manager and their PECCs
          const { data: mentors } = await supabase
            .from('users')
            .select('id')
            .eq('manager_id', userProfile?.id);
          
          const mentorIds = mentors?.map(m => m.id) || [];
          
          // Get PECCs under those mentors
          if (mentorIds.length > 0) {
            query = query.or(`manager_id.eq.${userProfile?.id},mentor_id.in.(${mentorIds.join(',')})`);
          } else {
            query = query.eq('manager_id', userProfile?.id);
          }
        }
        // Admins can see everyone

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        // Filter out existing members
        const availableUsers = (data || []).filter(
          u => !existingMemberIds.includes(u.id)
        );

        setUsers(availableUsers);
      } catch (err: any) {
        console.error('Error loading users:', err);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [open, cohortId, existingMemberIds, userProfile?.id, userRole, canAddDirectly]);

  const handleSave = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setError(null);

    try {
      if (canAddDirectly) {
        // Directly add the member
        const { data, error: insertError } = await supabase
          .from('cohort_members')
          .insert({
            cohort_id: cohortId,
            user_id: selectedUser.id,
            added_by: userProfile?.id,
            status: 'active'
          })
          .select(`
            *,
            user:user_id(id, first_name, last_name, email, role)
          `)
          .single();

        if (insertError) throw insertError;
        onMemberAdded(data);
        onClose();
      } else {
        // Create an invitation that needs approval
        const { error: insertError } = await supabase
          .from('cohort_invitations')
          .insert({
            cohort_id: cohortId,
            user_id: selectedUser.id,
            invited_by: userProfile?.id,
            status: 'pending'
          });

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('This user already has a pending invitation to this cohort');
          }
          throw insertError;
        }

        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error adding/inviting member:', err);
      setError(err.message || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'error';
      case UserRole.MANAGER: return 'secondary';
      case UserRole.MENTOR: return 'warning';
      default: return 'primary';
    }
  };

  const getRoleLabel = (role?: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'Admin';
      case UserRole.MANAGER: return 'Manager';
      case UserRole.MENTOR: return 'Mentor';
      default: return 'PECC';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {canAddDirectly ? 'Add Member' : 'Invite PECC'}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Invitation sent! A manager will review and approve the invitation.
          </Alert>
        )}

        {!canAddDirectly && !success && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Your invitation will be sent to a manager for approval before the PECC is added to the cohort.
          </Alert>
        )}

        <Autocomplete
          options={users}
          loading={loading}
          value={selectedUser}
          onChange={(_, value) => setSelectedUser(value)}
          getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select User"
              placeholder="Search by name..."
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <li {...props} key={option.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32,
                    bgcolor: getRoleBadgeColor(option.role) + '.main',
                    fontSize: '0.875rem'
                  }}
                >
                  {option.first_name.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1">
                    {option.first_name} {option.last_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.email}
                  </Typography>
                </Box>
                <Chip
                  label={getRoleLabel(option.role)}
                  size="small"
                  color={getRoleBadgeColor(option.role) as any}
                  variant="outlined"
                />
              </Box>
            </li>
          )}
          sx={{ mt: 1 }}
          disabled={success}
        />

        {users.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            {canAddDirectly 
              ? 'All available users are already members of this cohort'
              : 'No PECCs available to invite. They may already be members of this cohort.'
            }
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {success ? 'Close' : 'Cancel'}
        </Button>
        {!success && (
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={saving || !selectedUser}
          >
            {saving ? <CircularProgress size={24} /> : canAddDirectly ? 'Add' : 'Send Invitation'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InviteMemberDialog;
