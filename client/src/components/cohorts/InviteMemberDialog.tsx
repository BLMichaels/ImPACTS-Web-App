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
import { CohortMember, UserRole } from '../../types/database';
import { getRoleMuiColor, getRoleLabel } from '../../utils/roleUtils';
import { getUserDisplayName } from '../../utils/displayName';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';

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
        let data: UserOption[] = [];

        // Admins: load everyone via RPC so we see all users (avoids users table RLS limiting the list)
        if (userRole === UserRole.ADMIN) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_users_for_granular_permissions');
          if (rpcError) {
            console.warn('InviteMemberDialog: get_users_for_granular_permissions failed, falling back to users table', rpcError);
            const { data: fallback } = await supabase
              .from('users')
              .select('id, first_name, last_name, email, role')
              .eq('is_active', true)
              .order('first_name');
            data = (fallback || []) as UserOption[];
          } else if (Array.isArray(rpcData) && rpcData.length > 0) {
            data = rpcData
              .filter((row: { is_active?: boolean }) => row.is_active !== false)
              .map((row: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }) => ({
                id: row.id,
                first_name: row.first_name ?? '',
                last_name: row.last_name ?? '',
                email: (row.email ?? '').trim(),
                role: (row.role as UserRole) || UserRole.PECC
              }));
          }
        } else {
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
            const { data: mentors } = await supabase
              .from('users')
              .select('id')
              .eq('manager_id', userProfile?.id);
            const mentorIds = mentors?.map(m => m.id) || [];
            if (mentorIds.length > 0) {
              query = query.or(`manager_id.eq.${userProfile?.id},mentor_id.in.(${mentorIds.join(',')})`);
            } else {
              query = query.eq('manager_id', userProfile?.id);
            }
          }

          const { data: queryData, error: fetchError } = await query;
          if (fetchError) throw fetchError;
          data = (queryData || []) as UserOption[];
        }

        // Filter out existing members
        const availableUsers = data.filter(u => !existingMemberIds.includes(u.id));
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

        if (insertError) {
          if (insertError.code === '23505') {
            setError('This user is already a member of this cohort.');
            return;
          }
          throw insertError;
        }
        // Normalize: Supabase sometimes returns user as array from join
        const rawUser = (data as any).user;
        const userObj = Array.isArray(rawUser) ? rawUser[0] : rawUser;
        const normalized: CohortMember = {
          id: data.id,
          cohort_id: data.cohort_id,
          user_id: data.user_id,
          added_by: data.added_by,
          status: data.status,
          added_at: data.added_at || new Date().toISOString(),
          user: userObj ? {
            id: userObj.id,
            first_name: userObj.first_name,
            last_name: userObj.last_name,
            email: userObj.email,
            role: userObj.role
          } : undefined
        };
        onMemberAdded(normalized);
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
          getOptionLabel={(option) => getUserDisplayName(option)}
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
                    bgcolor: getRoleMuiColor(option.role) + '.main',
                    fontSize: '0.875rem'
                  }}
                >
                  {(option.first_name || option.last_name || option.email || '?').toString().charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1">
                    {getUserDisplayName(option)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.email}
                  </Typography>
                </Box>
                <Chip
                  label={getRoleLabel(option.role)}
                  size="small"
                  color={getRoleMuiColor(option.role)}
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
