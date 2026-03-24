import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Button,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Autocomplete,
  Menu,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  School as ProgramIcon,
  Campaign as AnnouncementIcon,
  Group as MembersIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as AddMemberIcon,
  MoreVert as MoreIcon,
  Schedule as ScheduleIcon,
  Timeline as SnapshotIcon
} from '@mui/icons-material';
import { supabase } from '../../supabase';
import { useUserProfile } from '../../context/UserProfileContext';
import { useTabVisibility, usePermission } from '../../hooks/usePermissions';
import { 
  Program, 
  ProgramMember, 
  UserRole,
  ProgramMemberStatus 
} from '../../types/database';
import { format } from 'date-fns';
import ProgramAnnouncementList from './ProgramAnnouncementList';
import ProgramSnapshotTab from './ProgramSnapshotTab';

interface ProgramDetailProps {
  programId: string;
  onBack: () => void;
  onEdit?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`program-tabpanel-${index}`}
      aria-labelledby={`program-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const ProgramDetail: React.FC<ProgramDetailProps> = ({
  programId,
  onBack,
  onEdit
}) => {
  const { userProfile } = useUserProfile();
  const [program, setProgram] = useState<Program | null>(null);
  const [members, setMembers] = useState<ProgramMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [isManager, setIsManager] = useState(false);
  
  // Check tab visibility permissions
  const showAnnouncementsTab = useTabVisibility('announcements', undefined, programId);
  const showMembersTab = useTabVisibility('members', undefined, programId);
  const canManageProgramsByPermission = usePermission('manage_programs', undefined, programId);
  const canProgramAnnounceByPermission = usePermission('program_announce', undefined, programId);
  
  // Add Member Dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; first_name: string; last_name: string; email: string; role: UserRole }>>([]);
  const [selectedUsers, setSelectedUsers] = useState<Array<{ id: string; first_name: string; last_name: string; email: string; role: UserRole }>>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  // Remove member confirmation
  const [removeMemberDialog, setRemoveMemberDialog] = useState<{ open: boolean; member: ProgramMember | null }>({
    open: false,
    member: null
  });
  const [removingMember, setRemovingMember] = useState(false);

  // Member menu
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<{ el: HTMLElement | null; member: ProgramMember | null }>({
    el: null,
    member: null
  });

  const canManageProgram = canManageProgramsByPermission || 
    (userProfile?.role === UserRole.ADMIN) ||
    isManager;

  const showSnapshotTab = canManageProgram; // Admins and program managers see snapshot
  const canAnnounce = canManageProgram || canProgramAnnounceByPermission;

  const loadProgram = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load program details
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .single();

      if (programError) throw programError;
      setProgram(programData);

      // Check if current user is a manager (maybeSingle so 0 rows is ok)
      if (userProfile) {
        const { data: managerData } = await supabase
          .from('program_managers')
          .select('id')
          .eq('program_id', programId)
          .eq('manager_id', userProfile.id)
          .maybeSingle();
        
        setIsManager(!!managerData);
      }

      // Load members (use !user_id so PostgREST uses program_members.user_id → users, not added_by)
      const { data: membersData, error: membersError } = await supabase
        .from('program_members')
        .select(`
          *,
          user:users!user_id(id, first_name, last_name, email, role)
        `)
        .eq('program_id', programId)
        .eq('status', 'active');

      if (membersError) throw membersError;
      setMembers(membersData || []);

    } catch (err) {
      console.error('Error loading program:', err);
      setError('Failed to load program details');
    } finally {
      setLoading(false);
    }
  }, [programId, userProfile]);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  const loadAvailableUsers = async () => {
    try {
      // Get existing member IDs
      const existingMemberIds = members.map(m => m.user_id);

      // Load users who aren't already members
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .eq('is_active', true)
        .not('id', 'in', `(${existingMemberIds.length > 0 ? existingMemberIds.join(',') : 'null'})`)
        .order('last_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (err) {
      console.error('Error loading available users:', err);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setAddingMembers(true);

      const newMembers = selectedUsers.map(user => ({
        program_id: programId,
        user_id: user.id,
        added_by: userProfile?.id,
        status: ProgramMemberStatus.ACTIVE
      }));

      const { error } = await supabase
        .from('program_members')
        .insert(newMembers);

      if (error) throw error;

      setAddMemberOpen(false);
      setSelectedUsers([]);
      loadProgram();
    } catch (err) {
      console.error('Error adding members:', err);
      setError('Failed to add members');
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberDialog.member) return;

    try {
      setRemovingMember(true);

      const { error } = await supabase
        .from('program_members')
        .update({ status: ProgramMemberStatus.REMOVED })
        .eq('id', removeMemberDialog.member.id);

      if (error) throw error;

      setRemoveMemberDialog({ open: false, member: null });
      loadProgram();
    } catch (err) {
      console.error('Error removing member:', err);
      setError('Failed to remove member');
    } finally {
      setRemovingMember(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !program) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Back to Programs
        </Button>
        <Alert severity="error">{error || 'Program not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={onBack}>
          <BackIcon />
        </IconButton>
        <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56 }}>
          <ProgramIcon sx={{ fontSize: 32 }} />
        </Avatar>
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h4" component="h1" fontWeight="bold">
              {program.name}
            </Typography>
            {isManager && (
              <Chip label="Manager" size="small" color="primary" variant="outlined" />
            )}
            {!program.is_active && (
              <Chip label="Inactive" size="small" color="default" />
            )}
          </Box>
          {program.description && (
            <Typography variant="body1" color="text.secondary" mt={0.5}>
              {program.description}
            </Typography>
          )}
          {(program.start_date || program.end_date) && (
            <Box display="flex" alignItems="center" gap={1} mt={1}>
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {program.start_date && format(new Date(program.start_date), 'MMM d, yyyy')}
                {program.start_date && program.end_date && ' - '}
                {program.end_date && format(new Date(program.end_date), 'MMM d, yyyy')}
              </Typography>
            </Box>
          )}
        </Box>
        {canManageProgram && onEdit && (
          <Button startIcon={<EditIcon />} variant="outlined" onClick={onEdit}>
            Edit Program
          </Button>
        )}
      </Box>

      {/* Tabs */}
      {(showAnnouncementsTab || showMembersTab || showSnapshotTab) && (
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            {showAnnouncementsTab && (
              <Tab 
                icon={<AnnouncementIcon />} 
                iconPosition="start" 
                label="Announcements" 
              />
            )}
            {showMembersTab && (
              <Tab 
                icon={<MembersIcon />} 
                iconPosition="start" 
                label={`Members (${members.length})`} 
              />
            )}
            {showSnapshotTab && (
              <Tab 
                icon={<SnapshotIcon />} 
                iconPosition="start" 
                label="Snapshot" 
              />
            )}
          </Tabs>
        </Paper>
      )}

      {/* Tab Content */}
      {(() => {
        const visibleTabs = [
          showAnnouncementsTab ? 'announcements' : null,
          showMembersTab ? 'members' : null,
          showSnapshotTab ? 'snapshot' : null
        ].filter(Boolean);
        
        const activeTab = visibleTabs[tabValue];
        const snapshotIndex = [showAnnouncementsTab, showMembersTab].filter(Boolean).length;
        
        if (activeTab === 'announcements') {
          return (
            <TabPanel value={tabValue} index={0}>
              <ProgramAnnouncementList 
                programId={programId} 
                canAnnounce={canAnnounce}
              />
            </TabPanel>
          );
        }
        if (activeTab === 'members') {
          return (
            <TabPanel value={tabValue} index={showAnnouncementsTab ? 1 : 0}>
              <Paper sx={{ p: 3 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Members</Typography>
                  {canManageProgram && (
                    <Button 
                      startIcon={<AddMemberIcon />} 
                      variant="contained"
                      onClick={() => {
                        loadAvailableUsers();
                        setAddMemberOpen(true);
                      }}
                    >
                      Add Members
                    </Button>
                  )}
                </Box>

                {members.length === 0 ? (
                  <Typography color="text.secondary" textAlign="center" py={4}>
                    No members in this program yet
                  </Typography>
                ) : (
                  <List>
              {members.map((member, index) => (
                <React.Fragment key={member.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    secondaryAction={
                      canManageProgram && (
                        <IconButton 
                          onClick={(e) => setMemberMenuAnchor({ el: e.currentTarget, member })}
                        >
                          <MoreIcon />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemAvatar>
                      <Avatar>
                        {member.user?.first_name?.[0]}{member.user?.last_name?.[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={`${member.user?.first_name} ${member.user?.last_name}`}
                      secondary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" color="text.secondary">
                            {member.user?.email}
                          </Typography>
                          <Chip 
                            label={member.user?.role} 
                            size="small" 
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
                  </List>
                )}
              </Paper>
            </TabPanel>
          );
        }
        if (activeTab === 'snapshot') {
          return (
            <TabPanel value={tabValue} index={snapshotIndex}>
              <ProgramSnapshotTab programId={programId} programName={program?.name || 'Program'} />
            </TabPanel>
          );
        }
        return null;
      })()}

      {/* Member Menu */}
      <Menu
        anchorEl={memberMenuAnchor.el}
        open={Boolean(memberMenuAnchor.el)}
        onClose={() => setMemberMenuAnchor({ el: null, member: null })}
      >
        <MenuItem 
          onClick={() => {
            setRemoveMemberDialog({ open: true, member: memberMenuAnchor.member });
            setMemberMenuAnchor({ el: null, member: null });
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} /> Remove from Program
        </MenuItem>
      </Menu>

      {/* Add Members Dialog */}
      <Dialog 
        open={addMemberOpen} 
        onClose={() => setAddMemberOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Members to Program</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            options={availableUsers}
            getOptionLabel={(option) => `${option.first_name} ${option.last_name} (${option.email})`}
            value={selectedUsers}
            onChange={(_, value) => setSelectedUsers(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Users"
                placeholder="Search users..."
                margin="normal"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography>{option.first_name} {option.last_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.email} • {option.role}
                  </Typography>
                </Box>
              </li>
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddMembers}
            disabled={selectedUsers.length === 0 || addingMembers}
          >
            {addingMembers ? 'Adding...' : `Add ${selectedUsers.length} Member${selectedUsers.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={removeMemberDialog.open}
        onClose={() => setRemoveMemberDialog({ open: false, member: null })}
      >
        <DialogTitle>Remove Member</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove{' '}
            <strong>
              {removeMemberDialog.member?.user?.first_name} {removeMemberDialog.member?.user?.last_name}
            </strong>{' '}
            from this program?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveMemberDialog({ open: false, member: null })}>
            Cancel
          </Button>
          <Button 
            color="error" 
            onClick={handleRemoveMember}
            disabled={removingMember}
          >
            {removingMember ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProgramDetail;
