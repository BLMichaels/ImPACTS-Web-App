import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  PersonRemove as RemoveIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { CohortMember, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../lib/supabase';
import InviteMemberDialog from './InviteMemberDialog';
import { format } from 'date-fns';

interface MemberListProps {
  cohortId: string;
  members: CohortMember[];
  canManage: boolean;
  canInvite: boolean;
  onMemberAdded: (member: CohortMember) => void;
  onMemberRemoved: (memberId: string) => void;
  loading: boolean;
}

const MemberList: React.FC<MemberListProps> = ({
  cohortId,
  members,
  canManage,
  canInvite,
  onMemberAdded,
  onMemberRemoved,
  loading
}) => {
  const { userProfile, userRole } = useUserProfile();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<CohortMember | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const handleRemoveClick = (member: CohortMember) => {
    setRemovingMember(member);
    setRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!removingMember) return;

    setRemoving(true);
    try {
      const { error } = await supabase
        .from('cohort_members')
        .update({ status: 'removed' })
        .eq('id', removingMember.id);

      if (error) throw error;
      onMemberRemoved(removingMember.id);
    } catch (err) {
      console.error('Error removing member:', err);
    } finally {
      setRemoving(false);
      setRemoveConfirmOpen(false);
      setRemovingMember(null);
    }
  };

  // Group members by role
  const groupedMembers = members.reduce((acc, member) => {
    const role = member.user?.role || UserRole.PECC;
    if (!acc[role]) acc[role] = [];
    acc[role].push(member);
    return acc;
  }, {} as Record<UserRole, CohortMember[]>);

  const roleOrder = [UserRole.ADMIN, UserRole.MANAGER, UserRole.MENTOR, UserRole.PECC];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with add button */}
      {(canManage || canInvite) && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setInviteDialogOpen(true)}
          >
            {canManage ? 'Add Member' : 'Invite PECC'}
          </Button>
        </Box>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No members yet
          </Typography>
          {(canManage || canInvite) && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              Add members to this cohort to get started
            </Typography>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {roleOrder.map(role => {
            const roleMembers = groupedMembers[role];
            if (!roleMembers || roleMembers.length === 0) return null;

            return (
              <Box key={role}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={`${getRoleLabel(role)}s`}
                    size="small"
                    color={getRoleBadgeColor(role) as any}
                  />
                  <Typography variant="body2" color="text.secondary">
                    ({roleMembers.length})
                  </Typography>
                </Box>
                
                <Paper>
                  <List disablePadding>
                    {roleMembers.map((member, index) => (
                      <ListItem 
                        key={member.id}
                        divider={index < roleMembers.length - 1}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: getRoleBadgeColor(member.user?.role) + '.main' }}>
                            {member.user?.first_name?.charAt(0) || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2">
                              {member.user?.first_name} {member.user?.last_name}
                              {member.user_id === userProfile?.id && (
                                <Chip 
                                  label="You" 
                                  size="small" 
                                  sx={{ ml: 1, height: 18, fontSize: '0.7rem' }}
                                />
                              )}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {member.user?.email}
                              {member.added_at && (
                                <> • Joined {format(new Date(member.added_at), 'MMM d, yyyy')}</>
                              )}
                            </Typography>
                          }
                        />
                        {canManage && member.user_id !== userProfile?.id && (
                          <ListItemSecondaryAction>
                            <Tooltip title="Remove from cohort">
                              <IconButton 
                                edge="end" 
                                onClick={() => handleRemoveClick(member)}
                                color="error"
                              >
                                <RemoveIcon />
                              </IconButton>
                            </Tooltip>
                          </ListItemSecondaryAction>
                        )}
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Invite/Add Member Dialog */}
      <InviteMemberDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        cohortId={cohortId}
        existingMemberIds={members.map(m => m.user_id)}
        canAddDirectly={canManage}
        onMemberAdded={onMemberAdded}
      />

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeConfirmOpen} onClose={() => setRemoveConfirmOpen(false)}>
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove{' '}
            <strong>{removingMember?.user?.first_name} {removingMember?.user?.last_name}</strong>{' '}
            from this cohort?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveConfirmOpen(false)} disabled={removing}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmRemove} 
            color="error" 
            variant="contained"
            disabled={removing}
          >
            {removing ? <CircularProgress size={24} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MemberList;
