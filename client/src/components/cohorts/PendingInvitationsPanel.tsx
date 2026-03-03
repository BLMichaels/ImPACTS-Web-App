import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
  Badge,
  Collapse
} from '@mui/material';
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Notifications as NotificationIcon
} from '@mui/icons-material';
import { CohortInvitation, UserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { formatDistanceToNow } from 'date-fns';

interface PendingInvitationsPanelProps {
  cohortIds?: string[];  // Optional: filter by specific cohorts. If not provided, shows all for the manager
  onInvitationProcessed?: (invitation: CohortInvitation, approved: boolean) => void;
}

const PendingInvitationsPanel: React.FC<PendingInvitationsPanelProps> = ({
  cohortIds,
  onInvitationProcessed
}) => {
  const { userProfile } = useUserProfile();
  const [invitations, setInvitations] = useState<CohortInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!userProfile?.id) return;

    try {
      let query = supabase
        .from('cohort_invitations')
        .select(`
          *,
          cohort:cohort_id(id, name),
          invitee:user_id(id, first_name, last_name, email, role),
          inviter:invited_by(id, first_name, last_name)
        `)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      // Filter by cohorts if provided
      if (cohortIds && cohortIds.length > 0) {
        query = query.in('cohort_id', cohortIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      setInvitations(data || []);
    } catch (err) {
      console.error('Error loading invitations:', err);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.id, cohortIds]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const handleApprove = async (invitation: CohortInvitation) => {
    setProcessing(invitation.id);

    try {
      // Update invitation status
      const { error: updateError } = await supabase
        .from('cohort_invitations')
        .update({
          status: 'approved',
          reviewed_by: userProfile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // Add user to cohort
      const { error: memberError } = await supabase
        .from('cohort_members')
        .insert({
          cohort_id: invitation.cohort_id,
          user_id: invitation.user_id,
          added_by: invitation.invited_by,
          status: 'active'
        });

      if (memberError && memberError.code !== '23505') {
        // Ignore duplicate key error (user might already be a member)
        throw memberError;
      }

      setInvitations(prev => prev.filter(i => i.id !== invitation.id));
      onInvitationProcessed?.(invitation, true);
    } catch (err) {
      console.error('Error approving invitation:', err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (invitation: CohortInvitation) => {
    setProcessing(invitation.id);

    try {
      const { error } = await supabase
        .from('cohort_invitations')
        .update({
          status: 'rejected',
          reviewed_by: userProfile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (error) throw error;

      setInvitations(prev => prev.filter(i => i.id !== invitation.id));
      onInvitationProcessed?.(invitation, false);
    } catch (err) {
      console.error('Error rejecting invitation:', err);
    } finally {
      setProcessing(null);
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

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      </Paper>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show panel if no pending invitations
  }

  return (
    <Paper sx={{ mb: 3, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'warning.light',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={invitations.length} color="error">
            <NotificationIcon />
          </Badge>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Pending Cohort Invitations
          </Typography>
        </Box>
        <IconButton size="small">
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>

      {/* Content */}
      <Collapse in={expanded}>
        <List disablePadding>
          {invitations.map((invitation, index) => (
            <ListItem
              key={invitation.id}
              divider={index < invitations.length - 1}
              sx={{ py: 2 }}
            >
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: getRoleBadgeColor(invitation.invitee?.role) + '.main' }}>
                  {invitation.invitee?.first_name?.charAt(0) || '?'}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body1">
                      <strong>{invitation.inviter?.first_name} {invitation.inviter?.last_name}</strong>
                      {' wants to add '}
                      <strong>{invitation.invitee?.first_name} {invitation.invitee?.last_name}</strong>
                    </Typography>
                    <Chip
                      label={getRoleLabel(invitation.invitee?.role)}
                      size="small"
                      color={getRoleBadgeColor(invitation.invitee?.role) as any}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    to <strong>{invitation.cohort?.name}</strong>
                    {' • '}
                    {formatDistanceToNow(new Date(invitation.invited_at), { addSuffix: true })}
                  </Typography>
                }
              />
              <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                <Tooltip title="Approve">
                  <IconButton
                    color="success"
                    onClick={() => handleApprove(invitation)}
                    disabled={processing === invitation.id}
                  >
                    {processing === invitation.id ? (
                      <CircularProgress size={20} />
                    ) : (
                      <ApproveIcon />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reject">
                  <IconButton
                    color="error"
                    onClick={() => handleReject(invitation)}
                    disabled={processing === invitation.id}
                  >
                    <RejectIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Paper>
  );
};

export default PendingInvitationsPanel;
