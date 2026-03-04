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
  Box,
  Typography,
  IconButton,
  Tooltip,
  InputAdornment
} from '@mui/material';
import { Refresh as RefreshIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { supabase } from '../../supabase';
import { createAndSendInvitation } from '../../utils/invitations';
import { UserRole, normalizeUserRole } from '../../types/database';
import { useUserProfile } from '../../context/UserProfileContext';
import { normalizeHospitalOrOrgName } from '../../utils/displayName';

interface SendInvitationDialogProps {
  open: boolean;
  onClose: () => void;
  contactEmail?: string;
  contactName?: string;
  contactId?: string;
  /** Prefill from CRM: hospital, programs, cohorts, and role when sending from a contact that already has these set */
  initialHospitalId?: string | null;
  initialProgramIds?: string[];
  initialCohortIds?: string[];
  initialRole?: UserRole;
  onSuccess?: (code: string) => void;
}

export const SendInvitationDialog: React.FC<SendInvitationDialogProps> = ({
  open,
  onClose,
  contactEmail = '',
  contactName = '',
  contactId,
  initialHospitalId = null,
  initialProgramIds = [],
  initialCohortIds = [],
  initialRole,
  onSuccess
}) => {
  const { userProfile, actualRole } = useUserProfile();
  const [email, setEmail] = useState(contactEmail);
  const [role, setRole] = useState<UserRole>(UserRole.PECC);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [managerIdForPECC, setManagerIdForPECC] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationCode, setInvitationCode] = useState<string>('');
  const [invitationEmailSent, setInvitationEmailSent] = useState<boolean>(true);
  
  // Options for dropdowns
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string }>>([]);
  const [mentors, setMentors] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [managers, setManagers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [cohorts, setCohorts] = useState<Array<{ id: string; name: string }>>([]);
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [programIds, setProgramIds] = useState<string[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [optionsLoading, setOptionsLoading] = useState(false);
  
  useEffect(() => {
    if (open) {
      setEmail(contactEmail);
      setRole(initialRole ?? UserRole.PECC);
      setHospitalId(initialHospitalId ?? null);
      setMentorId(null);
      setManagerId(null);
      setManagerIdForPECC(null);
      setError(null);
      setSuccess(false);
      setInvitationCode('');
      setInvitationEmailSent(true);
      setCohortIds(Array.isArray(initialCohortIds) ? [...initialCohortIds] : []);
      setProgramIds(Array.isArray(initialProgramIds) ? [...initialProgramIds] : []);
      setCustomMessage('');
      setMentors([]);
      setManagers([]);
      setHospitals([]);
      setCohorts([]);
      setPrograms([]);
      loadOptions();
    }
  }, [open, contactEmail, initialHospitalId, initialProgramIds, initialCohortIds, initialRole]);
  
  const loadOptions = async () => {
    setOptionsLoading(true);
    try {
      await loadOptionsInner();
    } finally {
      setOptionsLoading(false);
    }
  };

  const mapUserToOption = (u: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }) => ({
    id: u.id,
    name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '',
    email: u.email || ''
  });

  const loadOptionsInner = async () => {
    // Load hospitals
    const { data: hospitalsData } = await supabase
      .from('hospitals')
      .select('id, name')
      .order('name');
    if (hospitalsData) {
      setHospitals(hospitalsData.map(h => ({ id: h.id, name: normalizeHospitalOrOrgName(h.name) })));
    }

    // 1) Load ALL managers and mentors from CRM first (same source as CRM list) so every CRM entry appears in dropdowns.
    const { data: crmContacts } = await supabase
      .from('crm_organizations')
      .select('id, contact_type, first_name, last_name, name, email')
      .in('contact_type', ['manager', 'mentor']);

    let mentorOptions: Array<{ id: string; name: string; email: string }> = [];
    let managerOptions: Array<{ id: string; name: string; email: string }> = [];

    if (Array.isArray(crmContacts) && crmContacts.length > 0) {
      crmContacts.forEach((row: { id: string; contact_type?: string; first_name?: string | null; last_name?: string | null; name?: string | null; email?: string | null }) => {
        const email = (row.email ?? '').trim() || '';
        const fullName =
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
          String(row.name ?? '').trim() ||
          email ||
          'No name';
        const opt = { id: `crm:${String(row.id)}`, name: fullName, email };
        if (row.contact_type === 'mentor') {
          mentorOptions.push(opt);
        } else if (row.contact_type === 'manager') {
          managerOptions.push(opt);
        }
      });
    }

    // 2) Load app users (mentors/managers) and merge: replace CRM entry by email with user entry so we can send real user id when they have an account.
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_mentors_and_managers_for_invite');
    let userMentors: Array<{ id: string; name: string; email: string }> = [];
    let userManagers: Array<{ id: string; name: string; email: string }> = [];

    if (!rpcError && Array.isArray(rpcData)) {
      const rows = rpcData as { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role: string }[];
      userMentors = rows.filter((r) => normalizeUserRole(r.role) === UserRole.MENTOR).map(mapUserToOption);
      userManagers = rows.filter((r) => normalizeUserRole(r.role) === UserRole.MANAGER).map(mapUserToOption);
    } else {
      const [mentorsRes, managersRes] = await Promise.all([
        supabase.from('users').select('id, first_name, last_name, email').eq('role', 'mentor'),
        supabase.from('users').select('id, first_name, last_name, email').eq('role', 'manager')
      ]);
      if (mentorsRes.data) userMentors = mentorsRes.data.map(mapUserToOption);
      if (managersRes.data) userManagers = managersRes.data.map(mapUserToOption);
    }

    const mergeByEmail = (
      crmList: Array<{ id: string; name: string; email: string }>,
      userList: Array<{ id: string; name: string; email: string }>
    ) => {
      const byEmail = new Map<string, { id: string; name: string; email: string }>();
      crmList.forEach((o) => {
        const key = (o.email || '').trim().toLowerCase();
        byEmail.set(key || `crm:${o.id}`, o); // no-email: keep CRM entry keyed by id so we don't overwrite
      });
      userList.forEach((u) => {
        const key = (u.email || '').trim().toLowerCase();
        if (key) byEmail.set(key, u); // user wins when same email so we send real user id
      });
      return Array.from(byEmail.values());
    };

    mentorOptions = mergeByEmail(mentorOptions, userMentors);
    managerOptions = mergeByEmail(managerOptions, userManagers);

    setMentors(mentorOptions);
    setManagers(managerOptions);
    
    // Load cohorts (for PECC pre-designation). Mentors only see cohorts they're allowed to invite to.
    if (actualRole === UserRole.MENTOR && userProfile?.id) {
      const { data: allowedRows } = await supabase
        .from('cohort_invite_mentors')
        .select('cohort_id')
        .eq('mentor_id', userProfile.id);
      const allowedIds = (allowedRows || []).map((r: { cohort_id: string }) => r.cohort_id);
      if (allowedIds.length === 0) {
        setCohorts([]);
      } else {
        const { data: cohortsData } = await supabase
          .from('cohorts')
          .select('id, name')
          .eq('is_active', true)
          .in('id', allowedIds)
          .order('name');
        setCohorts((cohortsData || []).map(c => ({ id: c.id, name: c.name })));
      }
    } else {
      const { data: cohortsData } = await supabase
        .from('cohorts')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (cohortsData) {
        setCohorts(cohortsData.map(c => ({ id: c.id, name: c.name })));
      }
    }
    
    // Load programs (for pre-designation on invitation). Mentors and Managers only see programs they're part of.
    if (actualRole === UserRole.ADMIN) {
      const { data: programsData } = await supabase
        .from('programs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (programsData) {
        setPrograms(programsData.map(p => ({ id: p.id, name: p.name })));
      }
    } else if ((actualRole === UserRole.MANAGER || actualRole === UserRole.MENTOR) && userProfile?.id) {
      let allowedProgramIds: string[] = [];
      if (actualRole === UserRole.MANAGER) {
        const { data: managingData } = await supabase
          .from('program_managers')
          .select('program_id')
          .eq('manager_id', userProfile.id);
        const { data: memberData } = await supabase
          .from('program_members')
          .select('program_id')
          .eq('user_id', userProfile.id)
          .eq('status', 'active');
        const managingIds = (managingData || []).map((m: { program_id: string }) => m.program_id);
        const memberIds = (memberData || []).map((m: { program_id: string }) => m.program_id);
        allowedProgramIds = [...new Set([...managingIds, ...memberIds])];
      } else {
        const { data: memberData } = await supabase
          .from('program_members')
          .select('program_id')
          .eq('user_id', userProfile.id)
          .eq('status', 'active');
        allowedProgramIds = (memberData || []).map((m: { program_id: string }) => m.program_id);
      }
      if (allowedProgramIds.length === 0) {
        setPrograms([]);
      } else {
        const { data: programsData } = await supabase
          .from('programs')
          .select('id, name')
          .eq('is_active', true)
          .in('id', allowedProgramIds)
          .order('name');
        if (programsData) {
          setPrograms(programsData.map(p => ({ id: p.id, name: p.name })));
        }
      }
    } else {
      setPrograms([]);
    }
  };
  
  const handleSend = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!userProfile?.id) {
      setError('You must be logged in to send invitations');
      return;
    }
    
    // Validate role-specific requirements (admins may send PECC without mentor/manager)
    if (role === UserRole.PECC && !mentorId && !managerIdForPECC && actualRole !== UserRole.ADMIN) {
      setError('PECC invitations require either a mentor or direct manager assignment');
      return;
    }
    
    if (role === UserRole.MENTOR && !managerId) {
      setError('Mentor invitations require a manager assignment');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Only send mentor/manager IDs for real app users (ids from users table), not CRM-only contacts (prefixed with 'crm:')
      const selectedMentor = mentors.find((m) => m.id === mentorId) || null;
      const selectedManager = managers.find((m) => m.id === managerId) || null;
      const selectedManagerForPecc = managers.find((m) => m.id === managerIdForPECC) || null;
      const mentorUserId = selectedMentor && !selectedMentor.id.startsWith('crm:') ? selectedMentor.id : null;
      const managerUserId = selectedManager && !selectedManager.id.startsWith('crm:') ? selectedManager.id : null;
      const managerForPeccUserId =
        selectedManagerForPecc && !selectedManagerForPecc.id.startsWith('crm:') ? selectedManagerForPecc.id : null;

      const { code, emailSent } = await createAndSendInvitation({
        email: email.trim(),
        role,
        invitedBy: userProfile.id,
        hospitalId: hospitalId || null,
        mentorId: role === UserRole.PECC ? mentorUserId : null,
        managerId: role === UserRole.MENTOR ? managerUserId : null,
        managerIdForPECC: role === UserRole.PECC ? managerForPeccUserId : null,
        cohortIds: role === UserRole.PECC && cohortIds.length > 0 ? cohortIds : undefined,
        programIds: programIds.length > 0 ? programIds : undefined,
        customMessage: customMessage.trim() || undefined
      });
      
      setInvitationCode(code);
      setInvitationEmailSent(emailSent);
      setSuccess(true);
      if (onSuccess) onSuccess(code);
      
      // Auto-close after 3 seconds only when email was sent (so they can copy link if not)
      if (emailSent) {
        setTimeout(() => handleClose(), 3000);
      }
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
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          Send Account Invitation
          {contactName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              For: {contactName}
            </Typography>
          )}
        </Box>
        {!success && (
          <Tooltip title="Refresh mentor and manager list">
            <span>
              <IconButton
                onClick={() => loadOptions()}
                disabled={optionsLoading}
                size="small"
                aria-label="Refresh mentor and manager list"
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ mb: 2 }}>
            {!invitationEmailSent && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                The invitation was created but the email could not be sent automatically. Please copy the link below and send it to the invitee yourself (e.g. by email or message).
              </Alert>
            )}
            <Alert severity="success" sx={{ mb: 2 }}>
              Invitation created. Code: <strong>{invitationCode}</strong>
              {invitationEmailSent && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  An email with the registration link has been sent to the invitee.
                </Typography>
              )}
            </Alert>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Registration link (copy and share if needed):</Typography>
            <TextField
              fullWidth
              size="small"
              value={typeof window !== 'undefined' ? `${window.location.origin}/invite/${invitationCode}` : `/invite/${invitationCode}`}
              readOnly
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copy link">
                      <IconButton
                        onClick={() => {
                          const url = typeof window !== 'undefined' ? `${window.location.origin}/invite/${invitationCode}` : `${invitationCode}`;
                          navigator.clipboard.writeText(url).then(() => {}, () => {});
                        }}
                        size="small"
                        aria-label="Copy invitation link"
                      >
                        <CopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                )
              }}
            />
          </Box>
        ) : (
          <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {(initialHospitalId || (initialProgramIds?.length ?? 0) > 0 || (initialCohortIds?.length ?? 0) > 0) && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Hospital, program(s), and cohort(s) are pre-filled from this contact&apos;s CRM profile. You can change them if needed.
              </Alert>
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              disabled={loading}
              autoFocus
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
                <MenuItem value={UserRole.PECC}>PECC</MenuItem>
                <MenuItem value={UserRole.MENTOR}>Mentor</MenuItem>
                <MenuItem value={UserRole.MANAGER}>Manager</MenuItem>
                <MenuItem value={UserRole.ADMIN}>Admin</MenuItem>
              </Select>
            </FormControl>
            
            {role === UserRole.PECC && (
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
                  loading={optionsLoading}
                  renderInput={(params) => (
                    <TextField {...params} label="Mentor (optional)" placeholder={optionsLoading ? 'Loading mentors…' : undefined} sx={{ mb: 2 }} />
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
                  loading={optionsLoading}
                  renderInput={(params) => (
                    <TextField {...params} label="Direct Manager (optional, bypasses mentor)" placeholder={optionsLoading ? 'Loading managers…' : undefined} sx={{ mb: 2 }} />
                  )}
                  disabled={loading}
                />
                
                {!optionsLoading && mentors.length === 0 && managers.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No mentors or managers in the app yet. Add users with Manager or Mentor role, then click Refresh in the title bar for live updates.
                  </Alert>
                )}
                {!mentorId && !managerIdForPECC && (mentors.length > 0 || managers.length > 0) && actualRole !== UserRole.ADMIN && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Please assign either a mentor or a direct manager for this PECC.
                  </Alert>
                )}
                
                <Autocomplete
                  multiple
                  options={programs}
                  getOptionLabel={(option) => option.name}
                  value={programs.filter(p => programIds.includes(p.id))}
                  onChange={(_, value) => setProgramIds(value.map(p => p.id))}
                  renderInput={(params) => (
                    <TextField {...params} label="Program(s) (optional)" placeholder="Select programs" sx={{ mb: 2 }} />
                  )}
                  disabled={loading}
                />
                
                <Autocomplete
                  multiple
                  options={cohorts}
                  getOptionLabel={(option) => option.name}
                  value={cohorts.filter(c => cohortIds.includes(c.id))}
                  onChange={(_, value) => setCohortIds(value.map(c => c.id))}
                  renderInput={(params) => (
                    <TextField {...params} label="Pre-designate cohorts (optional)" placeholder="Select cohorts" sx={{ mb: 2 }} />
                  )}
                  disabled={loading}
                />
                
                <TextField
                  label="Custom message (optional)"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  placeholder="Add a personal message to the invitation..."
                  disabled={loading}
                  sx={{ mb: 2 }}
                />
              </>
            )}
            
            {role === UserRole.MENTOR && (
              <Autocomplete
                options={managers}
                getOptionLabel={(option) => option.name}
                value={managers.find(m => m.id === managerId) || null}
                onChange={(_, value) => setManagerId(value?.id || null)}
                loading={optionsLoading}
                renderInput={(params) => (
                  <TextField {...params} label="Manager (required)" required placeholder={optionsLoading ? 'Loading managers…' : undefined} sx={{ mb: 2 }} />
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
