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
import { getRoleMuiColor, getRoleLabel } from '../../utils/roleUtils';
import { getUserDisplayName } from '../../utils/displayName';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
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
  const { userProfile } = useUserProfile();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<CohortMember | null>(null);
  const [removing, setRemoving] = useState(false);

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

  const roleOrder: UserRole[] = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.MENTOR,
    UserRole.PECC,
    UserRole.HOSPITAL_SYSTEM,
    UserRole.HIRING_GROUP
  ];

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
                    color={getRoleMuiColor(role) as any}
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
                          <Avatar sx={{ bgcolor: `${getRoleMuiColor(member.user?.role)}.main` }}>
                            {member.user?.first_name?.charAt(0) || '?'}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle2">
                              {getUserDisplayName(member.user)}
                              {member.user_id === userProfile?.id && (
                                <Chip label="You" size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem' }} />
                              )}
                              {String(member.id).startsWith('pending-') && (
                                <Chip label="Pending" size="small" color="default" sx={{ ml: 1, height: 18, fontSize: '0.7rem' }} />
                              )}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {member.user?.email}
                              {String(member.id).startsWith('pending-') ? (
                                <> • Pending — will join when they accept invitation</>
                              ) : member.added_at ? (
                                <> • Joined {format(new Date(member.added_at), 'MMM d, yyyy')}</>
                              ) : null}
                            </Typography>
                          }
                        />
                        {canManage && member.user_id !== userProfile?.id && !String(member.id).startsWith('manager-') && !String(member.id).startsWith('pending-') && (
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
        existingMemberEmails={members.map(m => m.user?.email).filter((e): e is string => Boolean(e))}
        canAddDirectly={canManage}
        onMemberAdded={onMemberAdded}
      />

      {/* Remove Confirmation Dialog */}
      <Dialog open={removeConfirmOpen} onClose={() => setRemoveConfirmOpen(false)}>
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove{' '}
            <strong>{getUserDisplayName(removingMember?.user)}</strong>{' '}
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
