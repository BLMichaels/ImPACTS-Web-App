import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
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
  MenuItem
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
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { normalizeHospitalOrOrgName, getUserDisplayName } from '../utils/displayName';
import { getUserData, setUserData } from '../utils/userData';
import { UserRole } from '../types/database';
import { useNavigate } from 'react-router-dom';
import TermsOfService from '../components/TermsOfService';
import { supabase } from '../supabase';

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
}

const AccountPage = () => {
  const { logout, currentUser } = useAuth();
  const accountUserId = currentUser?.uid ?? (currentUser as { id?: string })?.id;
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
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
  }, [accountUserId]);
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
    setMentorWorkMode
  } = useUserProfile();
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
  const profileHospitalId = (userProfile as { hospital_facility_id?: string | null })?.hospital_facility_id ?? null;
  const canEditHospitalInfo = settingsRole === UserRole.ADMIN || settingsRole === UserRole.MANAGER;

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>({
    name: '',
    type: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    emergencyDepartment: '',
    pediatricVolume: ''
  });
  const [hospitalLoadId, setHospitalLoadId] = useState<string | null>(null); // primary hospital id from CRM for save
  const [, setPrimaryHospitalContactId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState(false);
  const [editingHospital, setEditingHospital] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [showTerms, setShowTerms] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const SUPPORT_EMAIL = 'BenjaminLMichaels@gmail.com';
  const [editingNotifications, setEditingNotifications] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    gapPlanReminders: {
      enabled: userProfile?.gapPlanReminders?.enabled ?? true,
      emailNotifications: userProfile?.gapPlanReminders?.emailNotifications ?? false,
      reminderDays: userProfile?.gapPlanReminders?.reminderDays ?? 7,
      emailFrequency: userProfile?.gapPlanReminders?.emailFrequency ?? 'weekly' as 'daily' | 'weekly' | 'monthly'
    }
  });
  const [peccFullSiteAccessApproved, setPeccFullSiteAccessApproved] = useState(false);
  useEffect(() => {
    if (userProfile?.gapPlanReminders) {
      setNotificationSettings(prev => ({
        ...prev,
        gapPlanReminders: {
          enabled: userProfile.gapPlanReminders?.enabled ?? true,
          emailNotifications: userProfile.gapPlanReminders?.emailNotifications ?? false,
          reminderDays: userProfile.gapPlanReminders?.reminderDays ?? 7,
          emailFrequency: (userProfile.gapPlanReminders?.emailFrequency ?? 'weekly') as 'daily' | 'weekly' | 'monthly'
        }
      }));
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

  // Load hospital and CRM contact data for Account (personal/hospital from CRM + registration)
  useEffect(() => {
    if (!accountUserId) return;
    const loadCrmData = async () => {
      const hid = profileHospitalId;
      if (hid) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('id, name, address, city, state, zip, phone, trauma_level, ed_size, region')
          .or(`id.eq.${hid},facility_id.eq.${hid}`)
          .maybeSingle();
        if (hospital) {
          setHospitalLoadId((hospital as { id: string }).id);
          setHospitalInfo(prev => ({
            ...prev,
            name: (hospital as { name?: string }).name ?? '',
            type: (hospital as { region?: string }).region ?? 'General Acute Care',
            address: (hospital as { address?: string }).address ?? '',
            city: (hospital as { city?: string }).city ?? '',
            state: (hospital as { state?: string }).state ?? '',
            zipCode: (hospital as { zip?: string }).zip ?? '',
            phone: (hospital as { phone?: string }).phone ?? '',
            emergencyDepartment: (hospital as { ed_size?: string }).ed_size ?? (hospital as { trauma_level?: string }).trauma_level ?? '',
            pediatricVolume: (hospital as { region?: string }).region ?? ''
          }));
        }
      }
      const { data: contacts } = await supabase
        .from('hospital_contacts')
        .select('id, hospital_id, first_name, last_name, email, phone')
        .eq('user_id', accountUserId);
      if (contacts && contacts.length > 0) {
        const primary = hid ? contacts.find((c: { hospital_id: string }) => c.hospital_id === hid) : contacts[0];
        if (primary) setPrimaryHospitalContactId((primary as { id: string }).id);
      }
      if (!hid) {
        setHospitalInfo(prev => ({
          name: prev.name || '—',
          type: prev.type || '—',
          address: prev.address || '—',
          city: prev.city || '—',
          state: prev.state || '—',
          zipCode: prev.zipCode || '—',
          phone: prev.phone || '—',
          emergencyDepartment: prev.emergencyDepartment || '—',
          pediatricVolume: prev.pediatricVolume || '—'
        }));
      }
    };
    loadCrmData();
  }, [accountUserId, profileHospitalId]);

  const handleUserSave = async () => {
    const firstName = getFirstName();
    const lastName = getLastName();
    const phone = userProfile?.phone || '';
    updateUserProfile({
      firstName,
      lastName,
      phone,
      tier: getTier(),
      department: getDepartment()
    } as any);
    if (accountUserId) {
      await supabase
        .from('hospital_contacts')
        .update({ first_name: firstName, last_name: lastName, phone: phone || null, updated_at: new Date().toISOString() })
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
          ed_size: hospitalInfo.emergencyDepartment || null,
          region: hospitalInfo.type || hospitalInfo.pediatricVolume || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', hospitalLoadId);
      if (error) {
        setAlert({ type: 'error', message: 'Could not update hospital. You may not have permission.' });
        setTimeout(() => setAlert(null), 5000);
        return;
      }
      setAlert({ type: 'success', message: 'Hospital information updated successfully!' });
    } else {
      setAlert({ type: 'info', message: 'Hospital details are managed by your organization administrator.' });
    }
    setTimeout(() => setAlert(null), 3000);
  };

  const handleNotificationSave = async () => {
    if (userProfile?.role === 'pecc' && accountUserId) {
      await setUserData(accountUserId, 'gap_plan_reminders', notificationSettings.gapPlanReminders);
      await setUserData(accountUserId, 'pecc_allow_manager_mentor_full_view', peccFullSiteAccessApproved);
      await refreshProfile();
    }
    setEditingNotifications(false);
    setAlert({ type: 'success', message: 'Settings updated successfully!' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handlePasswordReset = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setAlert({ type: 'error', message: 'New passwords do not match!' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setAlert({ type: 'error', message: 'New password must be at least 8 characters long!' });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) {
        setAlert({ type: 'error', message: error.message || 'Failed to update password.' });
        return;
      }
      setAlert({ type: 'success', message: 'Password updated successfully!' });
      setPasswordDialogOpen(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setAlert(null), 3000);
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to update password. Please try again.' });
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
      webmailUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(SUPPORT_EMAIL)}&su=${encodeURIComponent(subjectRaw)}&body=${encodeURIComponent(bodyRaw)}`
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
      setAlert({ type: 'info', message: 'If your email app did not open, use "Open webmail fallback" below.' });
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
      setAlert({ type: 'error', message: 'Could not copy to clipboard on this device. Please copy manually.' });
    }
    setTimeout(() => setAlert(null), 4000);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h3" gutterBottom color="primary">
          Account Settings
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Manage your personal information, hospital details, and account security. Personal and hospital information are synced with the CRM when available.
        </Typography>

        {alert && (
          <Alert severity={alert.type} sx={{ mb: 3 }}>
            {alert.message}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* User Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PersonIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" component="h2">
                    Personal Information
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    {editingUser ? (
                      <>
                        <IconButton onClick={handleUserSave} color="primary" size="small">
                          <SaveIcon />
                        </IconButton>
                        <IconButton onClick={() => setEditingUser(false)} color="error" size="small">
                          <CancelIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => setEditingUser(true)} color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="First Name"
                      value={getFirstName()}
                      onChange={(e) => updateUserProfile({ ...userProfile, firstName: e.target.value } as any)}
                      disabled={!editingUser}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
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
                    <TextField
                      fullWidth
                      label="Email"
                      value={userProfile?.email || ''}
                      disabled
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={userProfile?.phone || ''}
                      onChange={(e) => updateUserProfile({ ...userProfile, phone: e.target.value } as any)}
                      disabled={!editingUser}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
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
              </CardContent>
            </Card>
          </Grid>

          {/* Hospital Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BusinessIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" component="h2">
                    Hospital Information
                  </Typography>
                  <Box sx={{ ml: 'auto' }}>
                    {canEditHospitalInfo && editingHospital ? (
                      <>
                        <IconButton onClick={handleHospitalSave} color="primary" size="small">
                          <SaveIcon />
                        </IconButton>
                        <IconButton onClick={() => setEditingHospital(false)} color="error" size="small">
                          <CancelIcon />
                        </IconButton>
                      </>
                    ) : canEditHospitalInfo ? (
                      <IconButton onClick={() => setEditingHospital(true)} color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                    ) : null}
                  </Box>
                </Box>
                {!canEditHospitalInfo && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Hospital information is read-only and automatically synced from CRM.
                  </Alert>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Hospital Name"
                      value={normalizeHospitalOrOrgName(hospitalInfo.name)}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, name: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Hospital Type"
                      value={hospitalInfo.type}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, type: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={hospitalInfo.phone}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, phone: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Address"
                      value={hospitalInfo.address}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, address: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="City"
                      value={hospitalInfo.city}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, city: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="State"
                      value={hospitalInfo.state}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, state: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="ZIP Code"
                      value={hospitalInfo.zipCode}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, zipCode: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Emergency Department"
                      value={hospitalInfo.emergencyDepartment}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, emergencyDepartment: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Pediatric Volume"
                      value={hospitalInfo.pediatricVolume}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, pediatricVolume: e.target.value })}
                      disabled={!canEditHospitalInfo || !editingHospital}
                      size="small"
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Terms of Service */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <SecurityIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" component="h2">
                    Terms of Service
                  </Typography>
                </Box>

                <Typography variant="body1" paragraph>
                  You have agreed to our Terms of Service and User Agreement. This agreement covers 
                  important information about data usage, privacy, and your responsibilities when 
                  using the ImPACTS PECC Support Tool.
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Terms accepted on: {termsAcceptedAt 
                      ? new Date(termsAcceptedAt).toLocaleDateString()
                      : 'Not available'
                    }
                  </Typography>
                </Box>

                <Button
                  variant="outlined"
                  onClick={() => setShowTerms(true)}
                  sx={{ mt: 2 }}
                >
                  View Terms of Service
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        {/* Security & Account Actions */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <SecurityIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" component="h2">
                    Security & Account Actions
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<SecurityIcon />}
                      onClick={() => setPasswordDialogOpen(true)}
                      sx={{ py: 1.5 }}
                    >
                      Change Password
                    </Button>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="error"
                      startIcon={<LogoutIcon />}
                      onClick={handleLogout}
                      sx={{ py: 1.5 }}
                    >
                      Logout
                    </Button>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {getFirstName().charAt(0)}{getLastName().charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">
                      {getUserDisplayName(userProfile)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {getTier()} • {getDepartment()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {userProfile?.email || ''}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Feedback & Report Technical Issues - PECC, Mentor, Manager (and Admin) */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <FeedbackIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h5" component="h2">
                    Feedback &amp; technical issues
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Send feedback or report a technical issue. If your default email app does not open on this device, use the fallback options below.
                </Typography>
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
                  <Button variant="outlined" size="small" onClick={() => window.open(buildFeedbackEmailPayload().webmailUrl, '_blank', 'noopener,noreferrer')}>
                    Open webmail fallback
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={copyFeedbackTemplate}>
                    Copy email details
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Admin View As Section - Only for Admins */}
          {!isViewingAsUser && actualRole === UserRole.ADMIN && (
            <Grid item xs={12}>
              <Card sx={{ border: isViewingAs ? '2px solid' : 'none', borderColor: 'warning.main' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SecurityIcon sx={{ mr: 1, color: isViewingAs ? 'warning.main' : 'primary.main' }} />
                    <Typography variant="h6" color={isViewingAs ? 'warning.main' : 'inherit'}>
                      {isViewingAs ? '👁️ Viewing As Different Role' : 'Admin View As'}
                    </Typography>
                  </Box>
                  
                  {isViewingAs && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      You are currently viewing the app as a <strong>{viewAsRole?.toUpperCase()}</strong>. 
                      Navigation and features are restricted to what that role can see.
                    </Alert>
                  )}

                  <Typography variant="body2" color="text.secondary" paragraph>
                    As an Admin, you can preview how the application looks and functions for different user roles. 
                    This helps you understand the experience of each tier without changing your actual role.
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>View Application As</InputLabel>
                    <Select
                      value={viewAsRole || ''}
                      onChange={(e) => {
                        const role = e.target.value as UserRole | '';
                        setViewAsRole(role === '' ? null : role);
                        if (role) {
                          setAlert({ type: 'info', message: `Now viewing as ${role.toUpperCase()}. Navigate to see their experience.` });
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
                      <MenuItem value={UserRole.HOSPITAL_SYSTEM}>Hospital System - PECC data and checklist for assigned systems</MenuItem>
                      <MenuItem value={UserRole.HIRING_GROUP}>Hiring Group - Read-only snapshot for assigned systems</MenuItem>
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

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Role Overview:
                    </Typography>
                    <Typography variant="body2">
                      <strong>Admin:</strong> Full access to all features, user management, CRM, permissions, and system settings.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>Manager:</strong> Oversees Mentors, views aggregated data, manages team CRM and expenses.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>Mentor (PRISM):</strong> Works directly with hospitals, logs activities, invites PECCs, tracks site milestones.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>PECC:</strong> Hospital-level access to Snapshot, Activities, Checklist, Education, Gap Plan, and Simulation.
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>Hospital System:</strong> Sees PECC data and 7-step checklist for their assigned hospital systems (aggregated view).
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      <strong>Hiring Group:</strong> Read-only snapshot of hospital systems and hospitals they are assigned to.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* View as user status only – enter from CRM (contact detail → View as this user) */}
          {isViewingAsUser && viewAsUserProfile && (
            <Grid item xs={12}>
              <Card sx={{ border: '2px solid', borderColor: 'info.main' }}>
                <CardContent>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    You are viewing the app as <strong>{viewAsUserProfile.first_name} {viewAsUserProfile.last_name}</strong>. Use the &quot;Exit&quot; button in the bar above to return to your account. To view as a different user, open them in <strong>CRM</strong> and click &quot;View as this user&quot; in their contact detail.
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
                  <Button variant="outlined" color="primary" onClick={() => { clearViewAsUser(); setAlert({ type: 'success', message: 'Stopped viewing as another user.' }); }}>
                    Exit View As User
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Tier Display for Non-Admins */}
          {settingsRole !== UserRole.ADMIN && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="h6">
                        Your Role
                      </Typography>
                    </Box>
                    <Button variant="outlined" size="small" onClick={async () => { await refreshProfile(); setAlert({ type: 'info', message: 'Profile refreshed. If your role is still wrong, ensure Supabase public.users has a row where id = your Auth User UID and role = admin.' }); setTimeout(() => setAlert(null), 6000); }}>
                      Refresh my profile
                    </Button>
                  </Box>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Your current role determines which features and data you can access.
                  </Typography>
                  
                  <Alert severity="info">
                    <Typography variant="body2">
                      You are a <strong>{getTier().toUpperCase()}</strong>.
                    </Typography>
                    {getTier() === 'pecc' && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Access to Snapshot, Activities, Checklist, Education, Gap Plan, and Simulation.
                      </Typography>
                    )}
                    {getTier() === 'mentor' && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Access to Mentor workflows and assigned hospital support tools.
                      </Typography>
                    )}
                    {getTier() === 'manager' && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
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
                        Switch between Mentor and PECC modes. PECC mode uses the same hospital continuity data model, so your updates stay with the hospital for handoff continuity.
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
                              message: next === 'pecc'
                                ? 'Switched to PECC mode. Navigate to Support Tool to continue hospital-level work.'
                                : 'Switched to Mentor mode.'
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
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Notification Preferences - Only show for PECC users */}
          {userProfile?.role === 'pecc' && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SecurityIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h5" component="h2">
                      Notification Preferences
                    </Typography>
                    <Box sx={{ ml: 'auto' }}>
                      {editingNotifications ? (
                        <>
                          <IconButton onClick={handleNotificationSave} color="primary" size="small">
                            <SaveIcon />
                          </IconButton>
                          <IconButton onClick={() => setEditingNotifications(false)} color="error" size="small">
                            <CancelIcon />
                          </IconButton>
                        </>
                      ) : (
                        <IconButton onClick={() => setEditingNotifications(true)} color="primary" size="small">
                          <EditIcon />
                        </IconButton>
                      )}
                    </Box>
                  </Box>

                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        Gap Plan Reminders
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Configure how you receive reminders for gap plans with approaching due dates.
                      </Typography>
                      
                      <Box sx={{ mb: 2 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={notificationSettings.gapPlanReminders.enabled}
                              onChange={(e) => setNotificationSettings({
                                ...notificationSettings,
                                gapPlanReminders: {
                                  ...notificationSettings.gapPlanReminders,
                                  enabled: e.target.checked
                                }
                              })}
                              disabled={!editingNotifications}
                            />
                          }
                          label="Enable gap plan reminders"
                        />
                      </Box>

                      {notificationSettings.gapPlanReminders.enabled && (
                        <>
                          <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={notificationSettings.gapPlanReminders.emailNotifications}
                                  onChange={(e) => setNotificationSettings({
                                    ...notificationSettings,
                                    gapPlanReminders: {
                                      ...notificationSettings.gapPlanReminders,
                                      emailNotifications: e.target.checked
                                    }
                                  })}
                                  disabled={!editingNotifications}
                                />
                              }
                              label="Receive email notifications"
                            />
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Days before due date to show reminder"
                              value={notificationSettings.gapPlanReminders.reminderDays}
                              onChange={(e) => setNotificationSettings({
                                ...notificationSettings,
                                gapPlanReminders: {
                                  ...notificationSettings.gapPlanReminders,
                                  reminderDays: parseInt(e.target.value) || 7
                                }
                              })}
                              disabled={!editingNotifications}
                              size="small"
                              InputProps={{ inputProps: { min: 1, max: 30 } }}
                              helperText="Show reminders 1-30 days before due date"
                            />
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Email Frequency</InputLabel>
                              <Select
                                value={notificationSettings.gapPlanReminders.emailFrequency}
                                label="Email Frequency"
                                onChange={(e) => setNotificationSettings({
                                  ...notificationSettings,
                                  gapPlanReminders: {
                                    ...notificationSettings.gapPlanReminders,
                                    emailFrequency: e.target.value as 'daily' | 'weekly' | 'monthly'
                                  }
                                })}
                                disabled={!editingNotifications}
                              >
                                <MenuItem value="daily">Daily</MenuItem>
                                <MenuItem value="weekly">Weekly</MenuItem>
                                <MenuItem value="monthly">Monthly</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                        </>
                      )}
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        Reminder Preview
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        See how your reminders will appear:
                      </Typography>
                      
                      <Box sx={{ p: 2, bgcolor: 'warning.light', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          ⏰ Gap Plan Due Date Reminder
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          • Question 25: Pediatric Equipment - Due in {notificationSettings.gapPlanReminders.reminderDays} days
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          • Question 32: Staff Training - Due in {notificationSettings.gapPlanReminders.reminderDays} days
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {notificationSettings.gapPlanReminders.emailNotifications ? 
                            `You'll receive ${notificationSettings.gapPlanReminders.emailFrequency} email reminders` : 
                            'Email notifications are disabled'
                          }
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        PECC Site Sharing
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        If enabled, your assigned mentor/manager can open your full PECC site view (all tabs). If disabled, they can only view your Site Milestones checklist(s).
                      </Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={peccFullSiteAccessApproved}
                            onChange={(e) => setPeccFullSiteAccessApproved(e.target.checked)}
                            disabled={!editingNotifications}
                          />
                        }
                        label="Allow mentor/manager full PECC site access"
                      />
                      <Alert severity={peccFullSiteAccessApproved ? 'success' : 'info'} sx={{ mt: 1.5 }}>
                        {peccFullSiteAccessApproved
                          ? 'Approved: mentor/manager may open your full PECC view.'
                          : 'Not approved: mentor/manager can only access your checklist view.'}
                      </Alert>
                    </Grid>
                    
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Password Reset Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              type={showPasswords.current ? 'text' : 'password'}
              label="Current Password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      edge="end"
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
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      edge="end"
                    >
                      {showPasswords.new ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              type={showPasswords.confirm ? 'text' : 'password'}
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      edge="end"
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
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button onClick={handlePasswordReset} variant="contained">
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      <TermsOfService
        open={showTerms}
        onClose={() => setShowTerms(false)}
        readOnly={true}
      />
    </Container>
  );
};

export default AccountPage;
