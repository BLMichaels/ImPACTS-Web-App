import React, { useState, useEffect, useMemo } from 'react';
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
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { createAndSendInvitation } from '../../utils/invitations';
import { fetchManagerVisibleUserIdsSet } from '../../utils/managerTeamScope';

interface InviteMemberDialogProps {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  existingMemberIds: string[];
  /** Emails already in this cohort (so we don't show duplicate or invite again) */
  existingMemberEmails?: string[];
  canAddDirectly: boolean;  // True for admins/managers, false for mentors
  onMemberAdded: (member: CohortMember) => void;
}

/** User with an account - can be added to cohort_members directly */
export interface UserOption {
  type: 'user';
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
}

/** CRM contact without an account - we send app invitation; they join cohort when they accept */
export interface CrmOnlyOption {
  type: 'crm';
  id: string;  // 'crm:' + crm_organizations.id
  first_name: string;
  last_name: string;
  email: string;
  contact_type: string;
  /** Fallback when first/last are empty (e.g. organization-style name in CRM) */
  name?: string;
}

export type AddMemberOption = UserOption | CrmOnlyOption;

function isUserOption(o: AddMemberOption): o is UserOption {
  return o.type === 'user' || ('role' in o && o.role != null);
}

/** Single display name for Add Member list: "First Last" for everyone, same across all cohorts. */
function getFullDisplayName(o: AddMemberOption, nameFallback?: string): string {
  const first = (o.first_name ?? '').trim();
  const last = (o.last_name ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (nameFallback?.trim()) return nameFallback.trim();
  if (o.email?.trim()) return o.email.trim();
  return 'Unknown';
}

const CRM_PERSON_TYPES = ['staff', 'manager', 'mentor', 'pecc', 'system', 'hiring_group', 'other'];

const InviteMemberDialog: React.FC<InviteMemberDialogProps> = ({
  open,
  onClose,
  cohortId,
  existingMemberIds,
  existingMemberEmails = [],
  canAddDirectly,
  onMemberAdded
}) => {
  const { userProfile, userRole } = useUserProfile();
  const [options, setOptions] = useState<AddMemberOption[]>([]);
  const [selected, setSelected] = useState<AddMemberOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const existingEmailsLower = useMemo(
    () => new Set(existingMemberEmails.map(e => (e || '').trim().toLowerCase())),
    [existingMemberEmails]
  );

  // Load EVERYONE: users (with accounts) + CRM contacts (with or without accounts)
  useEffect(() => {
    const loadEveryone = async () => {
      if (!open) return;
      
      setLoading(true);
      setError(null);
      setSuccess(false);
      setSelected(null);

      try {
        let userList: UserOption[] = [];

        if (canAddDirectly) {
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_users_for_granular_permissions');
          if (rpcError) {
            const { data: fallback, error: fallbackError } = await supabase
              .from('users')
              .select('id, first_name, last_name, email, role')
              .eq('is_active', true)
              .order('first_name');
            if (fallbackError) {
              setError('Could not load user list. Run GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql in Supabase SQL Editor.');
              setOptions([]);
              return;
            }
            userList = (fallback || []).map((row: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }) => ({
              type: 'user' as const,
              id: row.id,
              first_name: row.first_name ?? '',
              last_name: row.last_name ?? '',
              email: (row.email ?? '').trim(),
              role: (row.role as UserRole) || UserRole.PECC
            }));
          } else {
            const rows = Array.isArray(rpcData) ? rpcData : [];
            userList = rows
              .filter((row: { is_active?: boolean }) => row.is_active !== false)
              .map((row: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }) => ({
                type: 'user' as const,
                id: row.id,
                first_name: row.first_name ?? '',
                last_name: row.last_name ?? '',
                email: (row.email ?? '').trim(),
                role: (row.role as UserRole) || UserRole.PECC
              }));
          }

          // Load CRM contacts (everyone in CRM - with or without accounts); same list for every cohort
          const { data: crmRows } = await supabase
            .from('crm_organizations')
            .select('id, name, first_name, last_name, email, contact_type')
            .in('contact_type', CRM_PERSON_TYPES)
            .not('email', 'is', null);

          const userEmailsLower = new Set(userList.map(u => (u.email || '').toLowerCase()));
          const crmOnly: CrmOnlyOption[] = (crmRows || [])
            .map((row: { id: string; name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; contact_type?: string | null }) => ({
              type: 'crm' as const,
              id: 'crm:' + row.id,
              first_name: row.first_name ?? '',
              last_name: row.last_name ?? '',
              email: (row.email ?? '').trim().toLowerCase(),
              contact_type: row.contact_type ?? 'other',
              name: row.name ?? undefined
            }))
            .filter((c: CrmOnlyOption) => c.email && !userEmailsLower.has(c.email));

          const combined: AddMemberOption[] = [...userList, ...crmOnly];
          const filtered = combined.filter(o => {
            if (o.type === 'user') {
              if (existingMemberIds.includes(o.id)) return false;
            }
            if (existingEmailsLower.has((o.email || '').toLowerCase())) return false;
            return true;
          });
          // Deterministic sort: last name, first name, email so the same order in every cohort
          filtered.sort((a, b) => {
            const lastA = (a.last_name ?? '').toLowerCase();
            const lastB = (b.last_name ?? '').toLowerCase();
            if (lastA !== lastB) return lastA.localeCompare(lastB);
            const firstA = (a.first_name ?? '').toLowerCase();
            const firstB = (b.first_name ?? '').toLowerCase();
            if (firstA !== firstB) return firstA.localeCompare(firstB);
            return (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
          });
          setOptions(filtered);
        } else {
          let query = supabase
            .from('users')
            .select('id, first_name, last_name, email, role')
            .eq('is_active', true)
            .order('first_name');
          if (userRole === UserRole.MENTOR && !canAddDirectly) {
            query = query.eq('mentor_id', userProfile?.id);
          } else if (userRole === UserRole.MANAGER && userProfile?.id) {
            const visibleIds = await fetchManagerVisibleUserIdsSet(userProfile.id);
            visibleIds.delete(userProfile.id);
            const idList = [...visibleIds];
            if (idList.length === 0) {
              setOptions([]);
              return;
            }
            const { data: queryData, error: fetchError } = await supabase
              .from('users')
              .select('id, first_name, last_name, email, role')
              .eq('is_active', true)
              .in('id', idList)
              .order('first_name');
            if (fetchError) throw fetchError;
            const list = (queryData || []).map((row: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }) => ({
              type: 'user' as const,
              id: row.id,
              first_name: row.first_name ?? '',
              last_name: row.last_name ?? '',
              email: (row.email ?? '').trim(),
              role: (row.role as UserRole) || UserRole.PECC
            }));
            const filteredList = list.filter(u => !existingMemberIds.includes(u.id) && !existingEmailsLower.has((u.email || '').toLowerCase()));
            filteredList.sort((a, b) => {
              const lastA = (a.last_name ?? '').toLowerCase();
              const lastB = (b.last_name ?? '').toLowerCase();
              if (lastA !== lastB) return lastA.localeCompare(lastB);
              const firstA = (a.first_name ?? '').toLowerCase();
              const firstB = (b.first_name ?? '').toLowerCase();
              if (firstA !== firstB) return firstA.localeCompare(firstB);
              return (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
            });
            setOptions(filteredList);
            return;
          }
          const { data: queryData, error: fetchError } = await query;
          if (fetchError) throw fetchError;
          const list = (queryData || []).map((row: { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; role?: string | null }) => ({
            type: 'user' as const,
            id: row.id,
            first_name: row.first_name ?? '',
            last_name: row.last_name ?? '',
            email: (row.email ?? '').trim(),
            role: (row.role as UserRole) || UserRole.PECC
          }));
          const filteredList = list.filter(u => !existingMemberIds.includes(u.id) && !existingEmailsLower.has((u.email || '').toLowerCase()));
          filteredList.sort((a, b) => {
            const lastA = (a.last_name ?? '').toLowerCase();
            const lastB = (b.last_name ?? '').toLowerCase();
            if (lastA !== lastB) return lastA.localeCompare(lastB);
            const firstA = (a.first_name ?? '').toLowerCase();
            const firstB = (b.first_name ?? '').toLowerCase();
            if (firstA !== firstB) return firstA.localeCompare(firstB);
            return (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
          });
          setOptions(filteredList);
        }
      } catch (err: any) {
        console.error('Error loading options:', err);
        setError('Failed to load list');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadEveryone();
  }, [open, cohortId, existingMemberIds, existingMemberEmails, existingEmailsLower, userProfile?.id, userRole, canAddDirectly]);

  const handleSave = async () => {
    if (!selected || !userProfile?.id) return;

    setSaving(true);
    setError(null);

    try {
      if (canAddDirectly && selected.type === 'crm') {
        // No account yet: send app invitation; they join cohort when they accept
        await createAndSendInvitation({
          email: selected.email,
          role: UserRole.PECC,
          invitedBy: userProfile.id,
          cohortIds: [cohortId]
        });
        setSuccessMessage("Invitation sent. They'll be added to the cohort when they create their account.");
        setSuccess(true);
        setTimeout(() => onClose(), 2500);
        return;
      }

      if (canAddDirectly && isUserOption(selected)) {
        const selectedUser = selected;
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
        return;
      }

      if (!canAddDirectly && isUserOption(selected)) {
        const { error: insertError } = await supabase
          .from('cohort_invitations')
          .insert({
            cohort_id: cohortId,
            user_id: selected.id,
            invited_by: userProfile?.id,
            status: 'pending'
          });
        if (insertError) {
          if (insertError.code === '23505') throw new Error('This user already has a pending invitation to this cohort');
          throw insertError;
        }
        setSuccess(true);
        setTimeout(() => onClose(), 2000);
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
            {successMessage || 'Invitation sent! A manager will review and approve the invitation.'}
          </Alert>
        )}

        {!canAddDirectly && !success && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Your invitation will be sent to a manager for approval before the PECC is added to the cohort.
          </Alert>
        )}

        <Autocomplete<AddMemberOption>
          options={options}
          loading={loading}
          value={selected}
          onChange={(_, value) => setSelected(value)}
          getOptionLabel={(option) => {
            const name = option.type === 'crm' ? getFullDisplayName(option, option.name) : getFullDisplayName(option);
            if (option.type === 'crm') return `${name} (${option.email}) — No account yet`;
            return name;
          }}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select person"
              placeholder="Search by name or email..."
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
                    bgcolor: option.type === 'crm' ? 'grey.500' : getRoleMuiColor((option as UserOption).role) + '.main',
                    fontSize: '0.875rem'
                  }}
                >
                  {(option.type === 'crm' ? getFullDisplayName(option, option.name) : getFullDisplayName(option)).charAt(0) || '?'}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1">
                    {option.type === 'crm' ? getFullDisplayName(option, option.name) : getFullDisplayName(option)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {option.email}
                    {option.type === 'crm' && ' — No account yet'}
                  </Typography>
                </Box>
                {option.type === 'crm' ? (
                  <Chip label="Invite to join" size="small" color="default" variant="outlined" />
                ) : (
                  <Chip
                    label={getRoleLabel((option as UserOption).role)}
                    size="small"
                    color={getRoleMuiColor((option as UserOption).role)}
                    variant="outlined"
                  />
                )}
              </Box>
            </li>
          )}
          sx={{ mt: 1 }}
          disabled={success}
        />

        {options.length === 0 && !loading && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            {canAddDirectly
              ? 'Everyone in the list is already in this cohort, or the list could not be loaded. Run GRANULAR_PERMISSIONS_USERS_LIST_RLS.sql in Supabase and ensure CRM has contacts with emails.'
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
            disabled={saving || !selected}
          >
            {saving ? <CircularProgress size={24} /> : selected?.type === 'crm' ? 'Send invitation' : canAddDirectly ? 'Add' : 'Send Invitation'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InviteMemberDialog;
