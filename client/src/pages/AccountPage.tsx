import React, { useState, useEffect, ReactNode } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Divider,
  Alert,
  IconButton,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Logout as LogoutIcon,
  Feedback as FeedbackIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
  Notifications as NotificationsIcon,
  Share as ShareIcon,
  Gavel as GavelIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { normalizeHospitalOrOrgName, getUserDisplayName } from '../utils/displayName';
import { getUserData, setUserData } from '../utils/userData';
import { UserRole } from '../types/database';
import { useNavigate } from 'react-router-dom';
import TermsOfService from '../components/TermsOfService';
import { supabase } from '../supabase';
import { hospitalIdOrFacilityOrClause, isQueryableHospitalRef } from '../utils/hospitalId';
import { validateNewPassword } from '../utils/passwordPolicy';
import PasswordPolicyChecklist, { passwordFieldHelperText } from '../components/PasswordPolicyChecklist';
import MfaSettingsCard from '../components/MfaSettingsCard';
import {
  CURRENT_TERMS_VERSION,
  TERMS_LAST_UPDATED_LABEL,
  TERMS_VERSION_KEY,
} from '../utils/termsOfService';

interface HospitalInfo {
  name: string;
  type: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  emergencyDepartment: string;
  pediatricVolume: string;
}

const EMPTY_HOSPITAL: HospitalInfo = {
  name: '',
  type: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  emergencyDepartment: '',
  pediatricVolume: '',
};

// Extended profile type for backward compatibility
interface LegacyProfile {
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  tier?: string;
  role?: string;
  department?: string;
  phone?: string;
  email?: string;
  gapPlanReminders?: any;
  hospital_facility_id?: string | null;
  hospital_name?: string;
}

const sectionShellSx = {
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  overflow: 'hidden',
} as const;

function displayField(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v || '—';
}

function AccountSection({
  overline,
  title,
  description,
  icon,
  actions,
  children,
}: {
  overline?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={sectionShellSx}>
      <Box
        sx={{
          px: { xs: 2, md: 2.5 },
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.secondary.main, 0.04),
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {overline && (
            <Typography
              variant="overline"
              sx={{ color: 'secondary.dark', fontWeight: 700, letterSpacing: 0.1, display: 'block' }}
            >
              {overline}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {icon}
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontWeight: 700, letterSpacing: -0.015, fontSize: { xs: '1.1rem', sm: '1.2rem' } }}
            >
              {title}
            </Typography>
            {actions && <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>{actions}</Box>}
          </Box>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 820, lineHeight: 1.55 }}>
              {description}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ px: { xs: 2, md: 2.5 }, py: { xs: 2, md: 2.25 } }}>{children}</Box>
    </Paper>
  );
}

const AccountPage = () => {
  const theme = useTheme();
  const { logout, currentUser, updatePassword } = useAuth();
  const {
    userProfile: rawUserProfile,
    updateUserProfile,
    refreshProfile,
    actualRole,
    viewAsRole,
    setViewAsRole,
    isViewingAs,
    viewAsUserProfile,
    clearViewAsUser,
    isViewingAsUser,
    mentorWorkMode,
    canToggleMentorWorkMode,
    setMentorWorkMode,
    effectiveUserId,
    siteId,
  } = useUserProfile();
  const accountUserId =
    effectiveUserId ?? currentUser?.uid ?? (currentUser as { id?: string })?.id;
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [termsAcceptedVersion, setTermsAcceptedVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!accountUserId) return;
    getUserData<string>(accountUserId, 'terms_accepted_at').then((v) => {
      if (v) setTermsAcceptedAt(v);
      else {
        try {
          const ls = localStorage.getItem('termsAcceptedDate');
          if (ls) setTermsAcceptedAt(ls);
        } catch {}
      }
    });
    getUserData<string>(accountUserId, TERMS_VERSION_KEY).then((v) => {
      if (v) setTermsAcceptedVersion(v);
    });
  }, [accountUserId]);
  const navigate = useNavigate();

  // Handle both old and new field names
  const userProfile = rawUserProfile as LegacyProfile | null;
  const getFirstName = () => userProfile?.firstName || userProfile?.first_name || 'User';
  const getLastName = () => userProfile?.lastName || userProfile?.last_name || '';
  const getTier = () => userProfile?.tier || userProfile?.role || 'PECC';
  const getDepartment = () => userProfile?.department || '';
  const viewedRole = ((userProfile?.role ?? userProfile?.tier ?? '') as string).toLowerCase();
  const settingsRole: UserRole = isViewingAsUser
    ? (viewedRole === UserRole.ADMIN
        ? UserRole.ADMIN
        : viewedRole === UserRole.MANAGER
          ? UserRole.MANAGER
          : viewedRole === UserRole.MENTOR
            ? UserRole.MENTOR
            : viewedRole === UserRole.HOSPITAL_SYSTEM
              ? UserRole.HOSPITAL_SYSTEM
              : viewedRole === UserRole.HIRING_GROUP
                ? UserRole.HIRING_GROUP
                : UserRole.PECC)
    : actualRole;
  const profileHospitalId =
    (userProfile as { hospital_facility_id?: string | null })?.hospital_facility_id ?? null;
  const canEditHospitalInfo = settingsRole === UserRole.ADMIN || settingsRole === UserRole.MANAGER;
  const isPeccSettings = settingsRole === UserRole.PECC;

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>(EMPTY_HOSPITAL);
  const [hospitalLoadId, setHospitalLoadId] = useState<string | null>(null);
  const [hospitalAssigned, setHospitalAssigned] = useState(false);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [, setPrimaryHospitalContactId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState(false);
  const [editingHospital, setEditingHospital] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordDialogError, setPasswordDialogError] = useState('');
  const [passwordValidationShown, setPasswordValidationShown] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [showTerms, setShowTerms] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const SUPPORT_EMAIL = 'BenjaminLMichaels@gmail.com';
  const [editingNotifications, setEditingNotifications] = useState(false);
  const [editingSharing, setEditingSharing] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    enabled: userProfile?.gapPlanReminders?.enabled ?? true,
    reminderDays: userProfile?.gapPlanReminders?.reminderDays ?? 7,
  });
  const [peccFullSiteAccessApproved, setPeccFullSiteAccessApproved] = useState(false);

  useEffect(() => {
    if (userProfile?.gapPlanReminders) {
      setNotificationSettings({
        enabled: userProfile.gapPlanReminders?.enabled ?? true,
        reminderDays: userProfile.gapPlanReminders?.reminderDays ?? 7,
      });
    }
  }, [userProfile?.gapPlanReminders]);

  useEffect(() => {
    if (userProfile?.role !== UserRole.PECC || !accountUserId) return;
    let cancelled = false;
    (async () => {
      const approved = await getUserData<boolean>(accountUserId, 'pecc_allow_manager_mentor_full_view');
      if (!cancelled) setPeccFullSiteAccessApproved(approved === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userProfile?.role, accountUserId]);

  // Load hospital from CRM (users.hospital_facility_id / siteId / hospital_contacts)
  useEffect(() => {
    if (!accountUserId) return;
    let cancelled = false;
    const loadCrmData = async () => {
      setHospitalLoading(true);
      try {
        const { data: contacts } = await supabase
          .from('hospital_contacts')
          .select('id, hospital_id, first_name, last_name, email, phone')
          .eq('user_id', accountUserId);

        let contactHospitalId: string | null = null;
        if (contacts && contacts.length > 0) {
          const primary = profileHospitalId
            ? contacts.find((c: { hospital_id: string }) => c.hospital_id === profileHospitalId) ?? contacts[0]
            : contacts[0];
          if (primary && !cancelled) setPrimaryHospitalContactId((primary as { id: string }).id);
          const hid = String((primary as { hospital_id?: string })?.hospital_id ?? '').trim();
          contactHospitalId = hid || null;
        }

        const hospitalRefCandidates = [profileHospitalId, siteId, contactHospitalId].filter(
          (v): v is string => !!v && isQueryableHospitalRef(v)
        );
        const hospitalRef = hospitalRefCandidates[0] ?? null;

        if (!hospitalRef) {
          if (!cancelled) {
            setHospitalAssigned(false);
            setHospitalLoadId(null);
            setHospitalInfo(EMPTY_HOSPITAL);
          }
          return;
        }

        const { data: hospital } = await supabase
          .from('hospitals')
          .select(
            'id, name, address, city, state, zip, phone, trauma_level, ed_size, hospital_type, region'
          )
          .or(hospitalIdOrFacilityOrClause(hospitalRef))
          .maybeSingle();

        if (cancelled) return;

        if (hospital) {
          const row = hospital as {
            id: string;
            name?: string;
            address?: string;
            city?: string;
            state?: string;
            zip?: string;
            phone?: string;
            trauma_level?: string;
            ed_size?: string;
            hospital_type?: string;
          };
          setHospitalAssigned(true);
          setHospitalLoadId(row.id);
          setHospitalInfo({
            name: row.name ?? '',
            type: row.hospital_type ?? '',
            address: row.address ?? '',
            city: row.city ?? '',
            state: row.state ?? '',
            zipCode: row.zip ?? '',
            phone: row.phone ?? '',
            emergencyDepartment: row.trauma_level ?? '',
            pediatricVolume: row.ed_size ?? '',
          });
        } else {
          setHospitalAssigned(false);
          setHospitalLoadId(null);
          setHospitalInfo(EMPTY_HOSPITAL);
        }
      } finally {
        if (!cancelled) setHospitalLoading(false);
      }
    };
    loadCrmData();
    return () => {
      cancelled = true;
    };
  }, [accountUserId, profileHospitalId, siteId]);

  const handleUserSave = async () => {
    const firstName = getFirstName();
    const lastName = getLastName();
    const phone = userProfile?.phone || '';
    updateUserProfile({
      firstName,
      lastName,
      phone,
      tier: getTier(),
      department: getDepartment(),
    } as any);
    if (accountUserId) {
      await supabase
        .from('hospital_contacts')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', accountUserId);
    }
    setEditingUser(false);
    setAlert({ type: 'success', message: 'Personal information updated successfully!' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleHospitalSave = async () => {
    setEditingHospital(false);
    if (hospitalLoadId && (actualRole === 'admin' || actualRole === 'manager')) {
      const { error } = await supabase
        .from('hospitals')
        .update({
          name: hospitalInfo.name || null,
          address: hospitalInfo.address || null,
          city: hospitalInfo.city || null,
          state: hospitalInfo.state || null,
          zip: hospitalInfo.zipCode || null,
          phone: hospitalInfo.phone || null,
          hospital_type: hospitalInfo.type || null,
          trauma_level: hospitalInfo.emergencyDepartment || null,
          ed_size: hospitalInfo.pediatricVolume || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', hospitalLoadId);
      if (error) {
        setAlert({ type: 'error', message: 'Could not update hospital. You may not have permission.' });
        setTimeout(() => setAlert(null), 5000);
        return;
      }
      setAlert({ type: 'success', message: 'Hospital information updated successfully!' });
    } else {
      setAlert({
        type: 'info',
        message: 'Hospital details are managed by your organization administrator.',
      });
    }
    setTimeout(() => setAlert(null), 3000);
  };

  const persistGapPlanAndSharing = async () => {
    if (userProfile?.role === 'pecc' && accountUserId) {
      await setUserData(accountUserId, 'gap_plan_reminders', {
        enabled: notificationSettings.enabled,
        reminderDays: notificationSettings.reminderDays,
        // Preserve unused email prefs if already stored; do not invent new email UI
        emailNotifications: userProfile?.gapPlanReminders?.emailNotifications ?? false,
        emailFrequency: userProfile?.gapPlanReminders?.emailFrequency ?? 'weekly',
      });
      await setUserData(accountUserId, 'pecc_allow_manager_mentor_full_view', peccFullSiteAccessApproved);
      await refreshProfile();
    }
  };

  const handleNotificationSave = async () => {
    await persistGapPlanAndSharing();
    setEditingNotifications(false);
    setAlert({ type: 'success', message: 'Notification preferences updated.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleSharingSave = async () => {
    await persistGapPlanAndSharing();
    setEditingSharing(false);
    setAlert({ type: 'success', message: 'Site sharing settings updated.' });
    setTimeout(() => setAlert(null), 3000);
  };

  const resetPasswordDialogState = () => {
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordDialogError('');
    setPasswordValidationShown(false);
  };

  const handlePasswordReset = async () => {
    setPasswordValidationShown(true);
    setPasswordDialogError('');

    if (!passwordData.currentPassword.trim()) {
      setPasswordDialogError('Enter your current password.');
      return;
    }

    const passwordPolicyError = validateNewPassword(passwordData.newPassword);
    if (passwordPolicyError) {
      setPasswordDialogError(passwordPolicyError);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordDialogError('New passwords do not match.');
      return;
    }

    try {
      await updatePassword(passwordData.newPassword, passwordData.currentPassword);
      setAlert({ type: 'success', message: 'Password updated successfully!' });
      setPasswordDialogOpen(false);
      resetPasswordDialogState();
      setTimeout(() => setAlert(null), 3000);
    } catch (err) {
      setPasswordDialogError(
        err instanceof Error ? err.message : 'Failed to update password. Please try again.'
      );
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setAlert({ type: 'error', message: 'Logout failed. Please try again.' });
    }
  };

  const buildFeedbackEmailPayload = () => {
    const subjectRaw = 'ImPACTS - Feedback / Technical issue';
    const role = actualRole || getTier() || 'User';
    const email = currentUser?.email || userProfile?.email || '';
    const bodyRaw = `Role: ${role}\nEmail: ${email}\n\nMessage:\n${feedbackMessage.trim() || '(No additional message)'}`;
    return {
      subjectRaw,
      bodyRaw,
      mailtoUrl: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subjectRaw)}&body=${encodeURIComponent(bodyRaw)}`,
      webmailUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(subjectRaw)}&body=${encodeURIComponent(bodyRaw)}`,
    };
  };

  const launchFeedbackEmail = () => {
    const { mailtoUrl } = buildFeedbackEmailPayload();
    try {
      const link = document.createElement('a');
      link.href = mailtoUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setAlert({
        type: 'info',
        message: 'If your email app did not open, use "Open webmail fallback" below.',
      });
      setTimeout(() => setAlert(null), 4500);
    } catch {
      window.location.href = mailtoUrl;
    }
  };

  const copyFeedbackTemplate = async () => {
    const { subjectRaw, bodyRaw } = buildFeedbackEmailPayload();
    const text = `To: ${SUPPORT_EMAIL}\nSubject: ${subjectRaw}\n\n${bodyRaw}`;
    try {
      await navigator.clipboard.writeText(text);
      setAlert({ type: 'success', message: 'Support email details copied to clipboard.' });
    } catch {
      setAlert({
        type: 'error',
        message: 'Could not copy to clipboard on this device. Please copy manually.',
      });
    }
    setTimeout(() => setAlert(null), 4000);
  };

  const hospitalFieldsEditable = canEditHospitalInfo && editingHospital && hospitalAssigned;
  const hospitalFieldValue = (key: keyof HospitalInfo) =>
    hospitalAssigned ? (hospitalFieldsEditable ? hospitalInfo[key] : displayField(hospitalInfo[key])) : '';

  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        minHeight: '100%',
        pb: { xs: 4, md: 5 },
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          py: { xs: 2, md: 3 },
          px: { xs: 2, sm: 3, md: 4, lg: 5 },
          width: '100%',
        }}
      >
        <Stack spacing={{ xs: 2, md: 2.5 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.75 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: (t) =>
                `linear-gradient(120deg, ${alpha(t.palette.secondary.main, 0.07)} 0%, ${t.palette.background.paper} 42%, ${alpha(t.palette.primary.main, 0.04)} 100%)`,
            }}
          >
            <Box sx={{ maxWidth: { md: 640 } }}>
              <Typography
                variant="overline"
                sx={{
                  color: 'secondary.dark',
                  fontWeight: 700,
                  letterSpacing: 0.1,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                PECC Support Tool
              </Typography>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  letterSpacing: -0.02,
                  mb: 0.75,
                  color: 'text.primary',
                  fontSize: { xs: '1.45rem', sm: '1.7rem', md: '1.85rem' },
                }}
              >
                Account settings
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ lineHeight: 1.6, fontSize: { xs: '0.925rem', sm: '0.975rem' } }}
              >
                Manage your profile, review hospital details from the CRM, and keep security preferences up to date.
              </Typography>
            </Box>
          </Paper>

          {alert && (
            <Alert severity={alert.type} onClose={() => setAlert(null)}>
              {alert.message}
            </Alert>
          )}

          {/* 1. Personal Information */}
          <AccountSection
            overline="Profile"
            title="Personal information"
            description="Your name and contact details. Email is managed through your sign-in account."
            icon={<PersonIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
            actions={
              editingUser ? (
                <>
                  <IconButton onClick={handleUserSave} color="primary" size="small" aria-label="Save personal information">
                    <SaveIcon />
                  </IconButton>
                  <IconButton onClick={() => setEditingUser(false)} color="error" size="small" aria-label="Cancel editing">
                    <CancelIcon />
                  </IconButton>
                </>
              ) : (
                <IconButton onClick={() => setEditingUser(true)} color="primary" size="small" aria-label="Edit personal information">
                  <EditIcon />
                </IconButton>
              )
            }
          >
            <Grid container spacing={1.75}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={getFirstName()}
                  onChange={(e) => updateUserProfile({ ...userProfile, firstName: e.target.value } as any)}
                  disabled={!editingUser}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={getLastName()}
                  onChange={(e) => updateUserProfile({ ...userProfile, lastName: e.target.value } as any)}
                  disabled={!editingUser}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Email" value={userProfile?.email || ''} disabled size="small" />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={userProfile?.phone || ''}
                  onChange={(e) => updateUserProfile({ ...userProfile, phone: e.target.value } as any)}
                  disabled={!editingUser}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Tier"
                  value={getTier()}
                  onChange={(e) => updateUserProfile({ ...userProfile, tier: e.target.value } as any)}
                  disabled={!editingUser}
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Department"
                  value={getDepartment()}
                  onChange={(e) => updateUserProfile({ ...userProfile, department: e.target.value } as any)}
                  disabled={!editingUser}
                  size="small"
                />
              </Grid>
            </Grid>
          </AccountSection>

          {/* 2. Hospital Information — CRM read-only for PECC */}
          <AccountSection
            overline="CRM"
            title="Hospital information"
            description={
              canEditHospitalInfo
                ? 'Hospital record from the CRM. Admins and managers can update these fields here.'
                : 'Read-only hospital details synced from the CRM. Contact your mentor or administrator to request changes.'
            }
            icon={<BusinessIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
            actions={
              canEditHospitalInfo && hospitalAssigned ? (
                editingHospital ? (
                  <>
                    <IconButton onClick={handleHospitalSave} color="primary" size="small" aria-label="Save hospital information">
                      <SaveIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => setEditingHospital(false)}
                      color="error"
                      size="small"
                      aria-label="Cancel hospital editing"
                    >
                      <CancelIcon />
                    </IconButton>
                  </>
                ) : (
                  <IconButton
                    onClick={() => setEditingHospital(true)}
                    color="primary"
                    size="small"
                    aria-label="Edit hospital information"
                  >
                    <EditIcon />
                  </IconButton>
                )
              ) : null
            }
          >
            {!canEditHospitalInfo && hospitalAssigned && (
              <Alert
                severity="info"
                variant="outlined"
                icon={false}
                sx={{ mb: 2, bgcolor: alpha(theme.palette.secondary.main, 0.04) }}
              >
                Hospital information is read-only and synced from the CRM.
              </Alert>
            )}

            {hospitalLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading hospital details from CRM…
              </Typography>
            ) : !hospitalAssigned ? (
              <Alert severity="info" variant="outlined">
                No hospital is assigned to your account yet. Ask your mentor or manager to confirm your hospital
                assignment in the CRM, then refresh this page.
              </Alert>
            ) : (
              <Grid container spacing={1.75}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Hospital Name"
                    value={
                      hospitalFieldsEditable
                        ? normalizeHospitalOrOrgName(hospitalInfo.name)
                        : displayField(normalizeHospitalOrOrgName(hospitalInfo.name))
                    }
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, name: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Hospital Type"
                    value={hospitalFieldValue('type')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, type: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={hospitalFieldValue('phone')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, phone: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={hospitalFieldValue('address')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, address: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="City"
                    value={hospitalFieldValue('city')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, city: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    label="State"
                    value={hospitalFieldValue('state')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, state: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    label="ZIP Code"
                    value={hospitalFieldValue('zipCode')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, zipCode: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Emergency Department"
                    value={hospitalFieldValue('emergencyDepartment')}
                    onChange={(e) =>
                      setHospitalInfo({ ...hospitalInfo, emergencyDepartment: e.target.value })
                    }
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    helperText={hospitalFieldsEditable ? 'Maps to CRM trauma level' : undefined}
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Pediatric Volume"
                    value={hospitalFieldValue('pediatricVolume')}
                    onChange={(e) => setHospitalInfo({ ...hospitalInfo, pediatricVolume: e.target.value })}
                    disabled={!hospitalFieldsEditable}
                    size="small"
                    helperText={hospitalFieldsEditable ? 'Maps to CRM ED size' : undefined}
                    InputProps={!hospitalFieldsEditable ? { readOnly: true } : undefined}
                  />
                </Grid>
              </Grid>
            )}
          </AccountSection>

          {/* 3. Notifications (PECC) */}
          {userProfile?.role === 'pecc' && (
            <AccountSection
              overline="Preferences"
              title="Notifications"
              description="Configure in-app reminders for gap plans with approaching due dates."
              icon={<NotificationsIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
              actions={
                editingNotifications ? (
                  <>
                    <IconButton onClick={handleNotificationSave} color="primary" size="small" aria-label="Save notifications">
                      <SaveIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => setEditingNotifications(false)}
                      color="error"
                      size="small"
                      aria-label="Cancel notifications"
                    >
                      <CancelIcon />
                    </IconButton>
                  </>
                ) : (
                  <IconButton
                    onClick={() => setEditingNotifications(true)}
                    color="primary"
                    size="small"
                    aria-label="Edit notifications"
                  >
                    <EditIcon />
                  </IconButton>
                )
              }
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Gap plan reminders
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Show reminders for gap plans nearing their due date.
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={notificationSettings.enabled}
                        onChange={(e) =>
                          setNotificationSettings({
                            ...notificationSettings,
                            enabled: e.target.checked,
                          })
                        }
                        disabled={!editingNotifications}
                      />
                    }
                    label="Enable gap plan reminders"
                  />
                  {notificationSettings.enabled && (
                    <TextField
                      fullWidth
                      type="number"
                      label="Days before due date to show reminder"
                      value={notificationSettings.reminderDays}
                      onChange={(e) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          reminderDays: parseInt(e.target.value, 10) || 7,
                        })
                      }
                      disabled={!editingNotifications}
                      size="small"
                      sx={{ mt: 1.5 }}
                      InputProps={{ inputProps: { min: 1, max: 30 } }}
                      helperText="Show reminders 1–30 days before due date"
                    />
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Reminder preview
                  </Typography>
                  <Box
                    sx={{
                      p: 1.75,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: alpha(theme.palette.secondary.main, 0.04),
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                      Gap plan due date reminder
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      • Question 25: Pediatric Equipment — Due in {notificationSettings.reminderDays} days
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      • Question 32: Staff Training — Due in {notificationSettings.reminderDays} days
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reminders appear in-app based on your selected lead time.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </AccountSection>
          )}

          {/* 4. Site sharing (PECC) — split from notifications */}
          {userProfile?.role === 'pecc' && (
            <AccountSection
              overline="Access"
              title="Site sharing"
              description="Control whether your mentor or manager can open your full PECC site view."
              icon={<ShareIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
              actions={
                editingSharing ? (
                  <>
                    <IconButton onClick={handleSharingSave} color="primary" size="small" aria-label="Save site sharing">
                      <SaveIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => setEditingSharing(false)}
                      color="error"
                      size="small"
                      aria-label="Cancel site sharing"
                    >
                      <CancelIcon />
                    </IconButton>
                  </>
                ) : (
                  <IconButton
                    onClick={() => setEditingSharing(true)}
                    color="primary"
                    size="small"
                    aria-label="Edit site sharing"
                  >
                    <EditIcon />
                  </IconButton>
                )
              }
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                If enabled, your assigned mentor/manager can open your full PECC site view (all tabs). If disabled,
                they can only view summary metrics and Site Milestones checklist progress.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={peccFullSiteAccessApproved}
                    onChange={(e) => setPeccFullSiteAccessApproved(e.target.checked)}
                    disabled={!editingSharing}
                  />
                }
                label="Allow mentor/manager full PECC site access"
              />
              <Alert severity={peccFullSiteAccessApproved ? 'success' : 'info'} sx={{ mt: 1.5 }}>
                {peccFullSiteAccessApproved
                  ? 'Approved: mentor/manager may open your full PECC view.'
                  : 'Not approved: mentor/manager can only access summary metrics and checklist progress.'}
              </Alert>
            </AccountSection>
          )}

          {/* 5. Security */}
          <AccountSection
            overline="Account"
            title="Security"
            description="Password, multi-factor authentication, and sign-out."
            icon={<SecurityIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
          >
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<SecurityIcon />}
                  onClick={() => setPasswordDialogOpen(true)}
                  sx={{ py: 1.25 }}
                >
                  Change password
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  color="error"
                  startIcon={<LogoutIcon />}
                  onClick={handleLogout}
                  sx={{ py: 1.25 }}
                >
                  Logout
                </Button>
              </Grid>
            </Grid>

            <MfaSettingsCard />

            <Divider sx={{ my: 2.5 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {getFirstName().charAt(0)}
                {getLastName().charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {getUserDisplayName(userProfile)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getTier()}
                  {getDepartment() ? ` · ${getDepartment()}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {userProfile?.email || ''}
                </Typography>
              </Box>
            </Box>
          </AccountSection>

          {/* 6. Terms */}
          <AccountSection
            overline="Legal"
            title="Terms of Service"
            description="You have agreed to our Terms of Service and User Agreement covering data usage, privacy, and responsibilities."
            icon={<GavelIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Terms accepted on:{' '}
                {termsAcceptedAt ? new Date(termsAcceptedAt).toLocaleDateString() : 'Not available'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Terms version: {termsAcceptedVersion || 'Prior to versioning'} (current:{' '}
                {CURRENT_TERMS_VERSION}, updated {TERMS_LAST_UPDATED_LABEL})
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => setShowTerms(true)}>
              View Terms of Service
            </Button>
          </AccountSection>

          {/* 7. Feedback */}
          <AccountSection
            overline="Support"
            title="Feedback & technical issues"
            description="Send feedback or report a technical issue. If your default email app does not open, use the fallback options below."
            icon={<FeedbackIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
          >
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Your message (optional)"
              placeholder="Describe your feedback or the technical issue..."
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              size="small"
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              startIcon={<EmailIcon />}
              type="button"
              onClick={launchFeedbackEmail}
              sx={{ py: 1 }}
            >
              Email feedback to support
            </Button>
            <Box sx={{ mt: 1.25, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() =>
                  window.open(buildFeedbackEmailPayload().webmailUrl, '_blank', 'noopener,noreferrer')
                }
              >
                Open webmail fallback
              </Button>
              <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={copyFeedbackTemplate}>
                Copy email details
              </Button>
            </Box>
          </AccountSection>

          {/* 8. Admin View As */}
          {!isViewingAsUser && actualRole === UserRole.ADMIN && (
            <AccountSection
              overline="Admin"
              title={isViewingAs ? 'Viewing as different role' : 'Admin view as'}
              description="Preview how the application looks and functions for different user roles."
              icon={
                <SecurityIcon
                  sx={{ color: isViewingAs ? 'warning.main' : 'secondary.dark', fontSize: 22 }}
                />
              }
            >
              {isViewingAs && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  You are currently viewing the app as a <strong>{viewAsRole?.toUpperCase()}</strong>. Navigation and
                  features are restricted to what that role can see.
                </Alert>
              )}

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>View Application As</InputLabel>
                <Select
                  value={viewAsRole || ''}
                  onChange={(e) => {
                    const role = e.target.value as UserRole | '';
                    setViewAsRole(role === '' ? null : role);
                    if (role) {
                      setAlert({
                        type: 'info',
                        message: `Now viewing as ${role.toUpperCase()}. Navigate to see their experience.`,
                      });
                    } else {
                      setAlert({ type: 'success', message: 'Returned to Admin view.' });
                    }
                  }}
                  label="View Application As"
                >
                  <MenuItem value="">
                    <em>Admin (Your actual role)</em>
                  </MenuItem>
                  <MenuItem value={UserRole.MANAGER}>Manager - Oversees Mentors and sees aggregated data</MenuItem>
                  <MenuItem value={UserRole.MENTOR}>Mentor (PRISM) - Works with hospitals directly</MenuItem>
                  <MenuItem value={UserRole.PECC}>PECC - Hospital-level user</MenuItem>
                  <MenuItem value={UserRole.HOSPITAL_SYSTEM}>
                    Hospital System - PECC data and checklist for assigned systems
                  </MenuItem>
                  <MenuItem value={UserRole.HIRING_GROUP}>
                    Hiring Group - Read-only snapshot for assigned systems
                  </MenuItem>
                </Select>
              </FormControl>

              {viewAsRole && (
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => {
                    setViewAsRole(null);
                    setAlert({ type: 'success', message: 'Returned to Admin view.' });
                  }}
                  sx={{ mb: 2 }}
                >
                  Exit View As Mode
                </Button>
              )}

              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                  Role overview
                </Typography>
                <Typography variant="body2">
                  <strong>Admin:</strong> Full access to all features, user management, CRM, permissions, and system
                  settings.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Manager:</strong> Oversees Mentors, views aggregated data, manages team CRM and expenses.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Mentor (PRISM):</strong> Works directly with hospitals, logs activities, invites PECCs,
                  tracks site milestones.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>PECC:</strong> Hospital-level access to Snapshot, Activities, Checklist, Education, Gap Plan,
                  and Simulation.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Hospital System:</strong> Sees PECC data and 7-step checklist for their assigned hospital
                  systems.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Hiring Group:</strong> Read-only snapshot of hospital systems and hospitals they are assigned
                  to.
                </Typography>
              </Alert>
            </AccountSection>
          )}

          {/* View as user status */}
          {isViewingAsUser && viewAsUserProfile && (
            <AccountSection
              overline="Admin"
              title="Viewing as another user"
              icon={<SecurityIcon sx={{ color: 'info.main', fontSize: 22 }} />}
            >
              <Alert severity="info" sx={{ mb: 1.5 }}>
                You are viewing the app as{' '}
                <strong>
                  {viewAsUserProfile.first_name} {viewAsUserProfile.last_name}
                </strong>
                . Use the &quot;Exit&quot; button in the bar above to return to your account. To view as a different
                user, open them in <strong>CRM</strong> and click &quot;View as this user&quot; in their contact
                detail.
              </Alert>
              {actualRole === UserRole.ADMIN && settingsRole === UserRole.MENTOR && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant={viewAsRole === UserRole.PECC ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={() => {
                      setViewAsRole(UserRole.PECC);
                      navigate('/dashboard');
                    }}
                  >
                    View this mentor as PECC
                  </Button>
                  <Button
                    variant={viewAsRole == null ? 'contained' : 'outlined'}
                    color="inherit"
                    onClick={() => {
                      setViewAsRole(null);
                      navigate('/mentor/dashboard');
                    }}
                  >
                    Back to mentor view
                  </Button>
                </Box>
              )}
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  clearViewAsUser();
                  setAlert({ type: 'success', message: 'Stopped viewing as another user.' });
                }}
              >
                Exit View As User
              </Button>
            </AccountSection>
          )}

          {/* Role for non-admins */}
          {settingsRole !== UserRole.ADMIN && (
            <AccountSection
              overline="Access"
              title="Your role"
              description={
                isPeccSettings
                  ? 'Your PECC role gives hospital-level access to the Support Tool.'
                  : 'Your current role determines which features and data you can access.'
              }
              icon={<SecurityIcon sx={{ color: 'secondary.dark', fontSize: 22 }} />}
              actions={
                <Button
                  variant="outlined"
                  size="small"
                  onClick={async () => {
                    await refreshProfile();
                    setAlert({
                      type: 'info',
                      message:
                        'Profile refreshed. If your role is still wrong, ensure Supabase public.users has a row where id = your Auth User UID and role = admin.',
                    });
                    setTimeout(() => setAlert(null), 6000);
                  }}
                >
                  Refresh my profile
                </Button>
              }
            >
              <Alert
                severity="info"
                variant="outlined"
                icon={false}
                sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.04) }}
              >
                <Typography variant="body2">
                  You are a <strong>{getTier().toUpperCase()}</strong>.
                </Typography>
                {isPeccSettings && (
                  <Typography variant="body2" sx={{ mt: 0.75 }} color="text.secondary">
                    Access includes Snapshot, Activities, Checklist, Education, Gap Plan, and Simulation for your
                    assigned hospital.
                  </Typography>
                )}
                {getTier() === 'mentor' && (
                  <Typography variant="body2" sx={{ mt: 0.75 }}>
                    Access to Mentor workflows and assigned hospital support tools.
                  </Typography>
                )}
                {getTier() === 'manager' && (
                  <Typography variant="body2" sx={{ mt: 0.75 }}>
                    Access to Manager Support Tool (PST), Mentors management, and CRM.
                  </Typography>
                )}
              </Alert>
              {canToggleMentorWorkMode && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Work mode
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Switch between Mentor and PECC modes. PECC mode uses the same hospital continuity data model, so
                    your updates stay with the hospital for handoff continuity.
                  </Typography>
                  <FormControl fullWidth size="small" sx={{ maxWidth: 320 }}>
                    <InputLabel>Active mode</InputLabel>
                    <Select
                      value={mentorWorkMode}
                      label="Active mode"
                      onChange={(e) => {
                        const next = e.target.value as 'mentor' | 'pecc';
                        setMentorWorkMode(next);
                        setAlert({
                          type: 'success',
                          message:
                            next === 'pecc'
                              ? 'Switched to PECC mode. Navigate to Support Tool to continue hospital-level work.'
                              : 'Switched to Mentor mode.',
                        });
                        setTimeout(() => setAlert(null), 3500);
                      }}
                    >
                      <MenuItem value="mentor">Mentor</MenuItem>
                      <MenuItem value="pecc">PECC</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
            </AccountSection>
          )}
        </Stack>
      </Container>

      <Dialog
        open={passwordDialogOpen}
        onClose={() => {
          setPasswordDialogOpen(false);
          resetPasswordDialogState();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {passwordDialogError && (
              <Alert severity="error" sx={{ mb: 2 }} role="alert">
                {passwordDialogError}
              </Alert>
            )}
            <TextField
              fullWidth
              type={showPasswords.current ? 'text' : 'password'}
              label="Current Password"
              value={passwordData.currentPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, currentPassword: e.target.value });
                if (passwordDialogError) setPasswordDialogError('');
              }}
              margin="normal"
              required
              error={passwordValidationShown && !passwordData.currentPassword.trim()}
              helperText={
                passwordValidationShown && !passwordData.currentPassword.trim()
                  ? 'Required to confirm your identity.'
                  : undefined
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        setShowPasswords({ ...showPasswords, current: !showPasswords.current })
                      }
                      edge="end"
                      aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
                    >
                      {showPasswords.current ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              type={showPasswords.new ? 'text' : 'password'}
              label="New Password"
              value={passwordData.newPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, newPassword: e.target.value });
                if (passwordDialogError) setPasswordDialogError('');
              }}
              onBlur={() => setPasswordValidationShown(true)}
              margin="normal"
              required
              error={
                passwordValidationShown &&
                !!validateNewPassword(passwordData.newPassword) &&
                passwordData.newPassword.length > 0
              }
              helperText={passwordFieldHelperText(passwordData.newPassword, passwordValidationShown)}
              FormHelperTextProps={{
                sx: {
                  color:
                    passwordValidationShown && validateNewPassword(passwordData.newPassword)
                      ? 'error.main'
                      : 'text.secondary',
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      edge="end"
                      aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
                    >
                      {showPasswords.new ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <PasswordPolicyChecklist
              password={passwordData.newPassword}
              showValidation={passwordValidationShown}
            />
            <TextField
              fullWidth
              type={showPasswords.confirm ? 'text' : 'password'}
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={(e) => {
                setPasswordData({ ...passwordData, confirmPassword: e.target.value });
                if (passwordDialogError) setPasswordDialogError('');
              }}
              margin="normal"
              required
              error={
                passwordValidationShown &&
                passwordData.confirmPassword.length > 0 &&
                passwordData.newPassword !== passwordData.confirmPassword
              }
              helperText={
                passwordValidationShown &&
                passwordData.confirmPassword.length > 0 &&
                passwordData.newPassword !== passwordData.confirmPassword
                  ? 'Passwords do not match.'
                  : undefined
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })
                      }
                      edge="end"
                      aria-label={showPasswords.confirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showPasswords.confirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPasswordDialogOpen(false);
              resetPasswordDialogState();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handlePasswordReset} variant="contained">
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      <TermsOfService open={showTerms} onClose={() => setShowTerms(false)} readOnly={true} />
    </Box>
  );
};

export default AccountPage;
