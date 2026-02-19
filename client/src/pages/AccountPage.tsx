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
  Logout as LogoutIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUserProfile, UserProfile } from '../context/UserProfileContext';
import { normalizeHospitalOrOrgName } from '../utils/displayName';
import { getUserData } from '../utils/userData';
import { UserRole } from '../types/database';
import { useNavigate } from 'react-router-dom';
import TermsOfService from '../components/TermsOfService';

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
    actualRole,
    viewAsRole, 
    setViewAsRole,
    isViewingAs,
    refreshProfile
  } = useUserProfile();
  const navigate = useNavigate();
  
  // Handle both old and new field names
  const userProfile = rawUserProfile as LegacyProfile | null;
  const getFirstName = () => userProfile?.firstName || userProfile?.first_name || 'User';
  const getLastName = () => userProfile?.lastName || userProfile?.last_name || '';
  const getTier = () => userProfile?.tier || userProfile?.role || 'PECC';
  const getDepartment = () => userProfile?.department || '';

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo>({
    name: 'General Hospital',
    type: 'General Acute Care',
    address: '123 Main Street',
    city: 'Anytown',
    state: 'CA',
    zipCode: '90210',
    phone: '(555) 987-6543',
    emergencyDepartment: 'Level II Trauma Center',
    pediatricVolume: '15-20%'
  });

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
  const [editingNotifications, setEditingNotifications] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    gapPlanReminders: {
      enabled: userProfile?.gapPlanReminders?.enabled ?? true,
      emailNotifications: userProfile?.gapPlanReminders?.emailNotifications ?? false,
      reminderDays: userProfile?.gapPlanReminders?.reminderDays ?? 7,
      emailFrequency: userProfile?.gapPlanReminders?.emailFrequency ?? 'weekly' as 'daily' | 'weekly' | 'monthly'
    }
  });

  const handleUserSave = () => {
    // Update the user profile context
    updateUserProfile({
      firstName: getFirstName(),
      lastName: getLastName(),
      phone: userProfile?.phone || '',
      tier: getTier(),
      department: getDepartment()
    } as any);
    setEditingUser(false);
    setAlert({ type: 'success', message: 'User information updated successfully!' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleHospitalSave = () => {
    // Here you would typically save to your backend
    setEditingHospital(false);
    setAlert({ type: 'success', message: 'Hospital information updated successfully!' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleNotificationSave = () => {
    // Update the user profile with notification settings
    if (userProfile?.role === 'pecc') {
      updateUserProfile({
        ...userProfile,
        gapPlanReminders: notificationSettings.gapPlanReminders
      } as any);
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

    // Here you would typically call your backend to change the password
    setAlert({ type: 'success', message: 'Password updated successfully!' });
    setPasswordDialogOpen(false);
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setAlert({ type: 'error', message: 'Logout failed. Please try again.' });
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 6 }}>
        <Typography variant="h3" gutterBottom color="primary">
          Account Settings
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Manage your personal information, hospital details, and account security.
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
                    {editingHospital ? (
                      <>
                        <IconButton onClick={handleHospitalSave} color="primary" size="small">
                          <SaveIcon />
                        </IconButton>
                        <IconButton onClick={() => setEditingHospital(false)} color="error" size="small">
                          <CancelIcon />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton onClick={() => setEditingHospital(true)} color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Hospital Name"
                      value={normalizeHospitalOrOrgName(hospitalInfo.name)}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, name: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Hospital Type"
                      value={hospitalInfo.type}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, type: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={hospitalInfo.phone}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, phone: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Address"
                      value={hospitalInfo.address}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, address: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="City"
                      value={hospitalInfo.city}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, city: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="State"
                      value={hospitalInfo.state}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, state: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="ZIP Code"
                      value={hospitalInfo.zipCode}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, zipCode: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Emergency Department"
                      value={hospitalInfo.emergencyDepartment}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, emergencyDepartment: e.target.value })}
                      disabled={!editingHospital}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Pediatric Volume"
                      value={hospitalInfo.pediatricVolume}
                      onChange={(e) => setHospitalInfo({ ...hospitalInfo, pediatricVolume: e.target.value })}
                      disabled={!editingHospital}
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
                  using the ImPACTS Pediatric Readiness Assessment Tool.
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
                      {getFirstName()} {getLastName()}
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

          {/* Admin View As Section - Only for Admins */}
          {actualRole === UserRole.ADMIN && (
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
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Tier Display for Non-Admins */}
          {actualRole !== UserRole.ADMIN && (
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
                        Access to Mentor Dashboard, Activities, Hospital Contacts, Site Milestones, and Wages/Expenses.
                      </Typography>
                    )}
                    {getTier() === 'manager' && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Access to Manager Dashboard, Mentors management, and CRM.
                      </Typography>
                    )}
                  </Alert>
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
