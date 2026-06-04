import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Avatar,
  Grid,
  Alert,
  Snackbar,
  Collapse,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
  LocalHospital as HospitalIcon,
  ContentCopy as CopyIcon,
  Assignment as ActivityIcon,
  CheckCircle as ChecklistIcon,
  Description as GapPlanIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';
import {
  getUserData,
  setUserData,
  batchGetUserDataForKey,
  batchGetHospitalDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
} from '../../utils/userData';
import { createAndSendInvitation } from '../../utils/invitations';
import { UserRole } from '../../types/database';
import ManagerWagesExpensesPage from './ManagerWagesExpensesPage';

interface MentorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'pending' | 'inactive';
  assignedHospitals: Array<{
    id: string;
    name: string;
    peccs: PECCData[];
  }>;
  totalActivities: number;
  hoursThisMonth: number;
  lastActivity: string | null;
}

interface PECCData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hospitalName: string;
  checklistProgress: number;
  activityCount: number;
  gapPlanCount: number;
  lastActivity: string | null;
  activities?: any[];
  gapPlans?: any[];
  fullSiteAccessApproved?: boolean;
}

const getActivityCategories = (activity: { categories?: unknown; category?: unknown }): string[] => {
  if (Array.isArray(activity.categories)) {
    const normalized = activity.categories
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  const fallback = String(activity.category || '').trim();
  return fallback ? [fallback] : [];
};

const displayActivityCategories = (activity: { categories?: unknown; category?: unknown }): string => {
  const normalized = getActivityCategories(activity);
  return normalized.length > 0 ? normalized.join(', ') : '-';
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const USER_DATA_MENTOR_MANAGER_IDS = 'mentor_manager_ids';
const USER_DATA_PECC_FULL_SITE_APPROVAL = 'pecc_allow_manager_mentor_full_view';

function normalizeManagerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

const ManagerMentorsPage: React.FC = () => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState(0);
  const [mentors, setMentors] = useState<MentorData[]>([]);
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [expandedPECC, setExpandedPECC] = useState<string | null>(null);
  const [viewingPECC, setViewingPECC] = useState<PECCData | null>(null);
  const [peccDetailTab, setPeccDetailTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const isMountedRef = useRef(true);
  
  // Wages feature toggle - stored in user_data for current manager
  const [wagesEnabled, setWagesEnabled] = useState(true);
  const managerId = userProfile?.id;
  useEffect(() => {
    if (!managerId) return;
    getUserData<boolean>(managerId, 'manager_wages_enabled').then((v) => {
      setWagesEnabled(v !== false);
    });
  }, [managerId]);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [inviteCohortIds, setInviteCohortIds] = useState<string[]>([]);
  const [inviteCohorts, setInviteCohorts] = useState<Array<{ id: string; name: string }>>([]);
  const [inviteSending, setInviteSending] = useState(false);
  // Assign existing mentor to cohorts
  const [cohortAssignMentor, setCohortAssignMentor] = useState<MentorData | null>(null);
  const [cohortAssignOptions, setCohortAssignOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [cohortAssignSelectedIds, setCohortAssignSelectedIds] = useState<string[]>([]);
  const [cohortAssignSaving, setCohortAssignSaving] = useState(false);

  const handleToggleWages = async (enabled: boolean) => {
    setWagesEnabled(enabled);
    if (managerId) await setUserData(managerId, 'manager_wages_enabled', enabled);
    setSnackbar({ 
      open: true, 
      message: `Wages & Expenses tab ${enabled ? 'enabled' : 'disabled'}`, 
      severity: 'success' 
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    void loadMentors();
    return () => { isMountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMentors defined below
  }, [userProfile?.id]);

  // Load cohorts the manager manages when opening Invite Mentor dialog
  useEffect(() => {
    if (!dialogOpen || !userProfile?.id) return;
    (async () => {
      const { data: cm } = await supabase
        .from('cohort_managers')
        .select('cohort_id')
        .eq('manager_id', userProfile.id);
      const cohortIds = cm?.map(c => c.cohort_id) || [];
      if (cohortIds.length === 0) {
        setInviteCohorts([]);
        return;
      }
      const { data: cohorts } = await supabase
        .from('cohorts')
        .select('id, name')
        .in('id', cohortIds)
        .eq('is_active', true)
        .order('name');
      setInviteCohorts((cohorts || []).map(c => ({ id: c.id, name: c.name })));
    })();
  }, [dialogOpen, userProfile?.id]);

  // Load cohort options and current assignment when opening Assign to cohorts dialog
  useEffect(() => {
    if (!cohortAssignMentor || !userProfile?.id) return;
    (async () => {
      const { data: cm } = await supabase.from('cohort_managers').select('cohort_id').eq('manager_id', userProfile.id);
      const cohortIds = cm?.map(c => c.cohort_id) || [];
      if (cohortIds.length === 0) {
        setCohortAssignOptions([]);
        setCohortAssignSelectedIds([]);
        return;
      }
      const { data: cohorts } = await supabase.from('cohorts').select('id, name').in('id', cohortIds).eq('is_active', true).order('name');
      setCohortAssignOptions((cohorts || []).map(c => ({ id: c.id, name: c.name })));
      const { data: existing } = await supabase
        .from('cohort_invite_mentors')
        .select('cohort_id')
        .eq('mentor_id', cohortAssignMentor.id)
        .in('cohort_id', cohortIds);
      setCohortAssignSelectedIds((existing || []).map((r: any) => r.cohort_id));
    })();
  }, [cohortAssignMentor, userProfile?.id]);

  const handleSaveCohortAssign = async () => {
    if (!cohortAssignMentor || !userProfile?.id) return;
    setCohortAssignSaving(true);
    try {
      const managerScopedCohortIds = cohortAssignOptions.map((c) => c.id);
      const { data: existing, error: existingError } = await supabase
        .from('cohort_invite_mentors')
        .select('cohort_id')
        .eq('mentor_id', cohortAssignMentor.id)
        .in('cohort_id', managerScopedCohortIds);
      if (existingError) throw existingError;

      const existingIds = new Set((existing || []).map((r: any) => r.cohort_id as string));
      const selectedIds = new Set(cohortAssignSelectedIds);
      const toAdd = cohortAssignSelectedIds.filter((id) => !existingIds.has(id));
      const toRemove = Array.from(existingIds).filter((id) => !selectedIds.has(id));

      if (toAdd.length > 0) {
        const { error: upsertError } = await supabase.from('cohort_invite_mentors').upsert(
          toAdd.map((cohortId) => ({ cohort_id: cohortId, mentor_id: cohortAssignMentor.id, assigned_by: userProfile.id })),
          { onConflict: 'cohort_id,mentor_id' }
        );
        if (upsertError) throw upsertError;
      }

      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('cohort_invite_mentors')
          .delete()
          .eq('mentor_id', cohortAssignMentor.id)
          .in('cohort_id', toRemove);
        if (deleteError) throw deleteError;
      }
      setSnackbar({ open: true, message: 'Cohort assignments updated', severity: 'success' });
      setCohortAssignMentor(null);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'Failed to update', severity: 'error' });
    } finally {
      setCohortAssignSaving(false);
    }
  };

  const loadMentors = async () => {
    if (!userProfile?.id) return;
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
        setLoadError(null);
      }

      // Load all mentors and include both primary and additional manager assignments.
      const { data: mentorUsers, error: mentorError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone, is_active, manager_id')
        .eq('role', 'mentor');

      if (mentorError) throw mentorError;
      if (!mentorUsers || mentorUsers.length === 0) {
        if (isMountedRef.current) setMentors([]);
        return;
      }

      const mentorIds = mentorUsers.map((m) => m.id);
      const extraManagerMap = await batchGetUserDataForKey<string[]>(mentorIds, USER_DATA_MENTOR_MANAGER_IDS);
      const scopedMentors = mentorUsers.filter((mentor) => {
        if (mentor.manager_id === userProfile.id) return true;
        const additional = normalizeManagerIds(extraManagerMap.get(mentor.id));
        return additional.includes(userProfile.id);
      });
      if (scopedMentors.length === 0) {
        if (isMountedRef.current) setMentors([]);
        return;
      }

      // Load mentor hospital assignments
      const scopedMentorIds = scopedMentors.map((m) => m.id);
      const { data: assignments, error: assignmentError } = await supabase
        .from('mentor_hospital_assignments')
        .select(`
          mentor_id,
          hospital:hospital_id(id, name)
        `)
        .in('mentor_id', scopedMentorIds)
        .eq('is_active', true);

      if (assignmentError) throw assignmentError;

      // Get all hospital IDs
      const hospitalIds = (assignments || [])
        .map((a: any) => Array.isArray(a.hospital) ? a.hospital[0]?.id : a.hospital?.id)
        .filter(Boolean);
      const uniqueHospitalIds = Array.from(new Set(hospitalIds));

      // Load hospitals to get names + facility refs
      const { data: hospitals, error: hospitalsError } = uniqueHospitalIds.length > 0
        ? await supabase
          .from('hospitals')
          .select('id, name, facility_id')
          .in('id', uniqueHospitalIds)
        : { data: [], error: null };

      if (hospitalsError) throw hospitalsError;
      const hospitalRefs = [
        ...new Set(
          (hospitals || []).flatMap((h: { id: string; facility_id?: string | null }) => [
            String(h.id),
            h.facility_id != null ? String(h.facility_id) : null,
          ]).filter(Boolean) as string[]
        ),
      ];

      // Load PECCs for these hospitals (supports users keyed by either hospital UUID or facility ref).
      const { data: peccs, error: peccsError } = hospitalRefs.length > 0
        ? await supabase
          .from('users')
          .select('id, first_name, last_name, email, hospital_facility_id')
          .eq('role', 'pecc')
          .in('hospital_facility_id', hospitalRefs)
        : { data: [], error: null };

      if (peccsError) throw peccsError;

      // Batch checklist progress by hospital to avoid per-PECC N+1 queries.
      const { data: checklistRows, error: checklistError } = uniqueHospitalIds.length > 0
        ? await supabase
          .from('site_checklist_progress')
          .select('hospital_id, completed')
          .in('hospital_id', uniqueHospitalIds)
        : { data: [], error: null };
      if (checklistError) throw checklistError;
      const checklistStatsByHospital = new Map<string, { total: number; completed: number }>();
      (checklistRows || []).forEach((row: { hospital_id: string; completed: boolean }) => {
        const prev = checklistStatsByHospital.get(row.hospital_id) || { total: 0, completed: 0 };
        prev.total += 1;
        if (row.completed) prev.completed += 1;
        checklistStatsByHospital.set(row.hospital_id, prev);
      });

      const peccList = (peccs || []) as { id: string; first_name: string; last_name: string; email: string; hospital_facility_id: string }[];
      const peccIds = peccList.map((p) => p.id);
      const peccSiteRefs = peccList.map((p) => p.hospital_facility_id).filter(Boolean) as string[];
      const refToHospitalId = await mapSiteRefsToHospitalRowIds(peccSiteRefs);
      const canonHospitalIds = [
        ...new Set(peccSiteRefs.map((r) => refToHospitalId.get(r)).filter((x): x is string => Boolean(x))),
      ];
      const legacyMirror = shouldMirrorLegacyUserData();
      const [udPeccActivities, udPeccGapPlans, hospActivities, hospGapPlans] = await Promise.all([
        legacyMirror ? batchGetUserDataForKey<unknown[]>(peccIds, 'activities') : Promise.resolve(new Map()),
        legacyMirror ? batchGetUserDataForKey<unknown[]>(peccIds, 'gapPlans') : Promise.resolve(new Map()),
        batchGetHospitalDataForKey<unknown[]>(canonHospitalIds, 'activities'),
        batchGetHospitalDataForKey<unknown[]>(canonHospitalIds, 'gapPlans'),
      ]);
      const peccFullSiteApprovalMap = await batchGetUserDataForKey<boolean>(peccIds, USER_DATA_PECC_FULL_SITE_APPROVAL);

      const hospitalRefsByCanonical = new Map<string, Set<string>>();
      (hospitals || []).forEach((h: { id: string; facility_id?: string | null }) => {
        const refs = new Set<string>([String(h.id)]);
        if (h.facility_id != null && String(h.facility_id).trim()) refs.add(String(h.facility_id).trim());
        hospitalRefsByCanonical.set(String(h.id), refs);
      });

      // Build mentor data with PECCs
      const mentorData: MentorData[] = await Promise.all(
        scopedMentors.map(async (mentor) => {
          const mentorAssignments = (assignments || []).filter((a: any) => a.mentor_id === mentor.id);
          
          // Load mentor activities from Supabase (user_data)
          const activities = await getMentorActivitiesForUser(mentor.id);
          const totalActivities = activities.length;

          // Calculate hours this month
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const hoursThisMonth = activities
            .filter((a: any) => new Date(a.date) >= monthStart)
            .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);

          const lastActivity = activities.length > 0
            ? activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
            : null;

          const hospitalData = mentorAssignments.map((a: any) => {
              const hospital = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
              const hospitalRefs = hospital?.id ? hospitalRefsByCanonical.get(String(hospital.id)) : undefined;
              const hospitalPeccs = peccList.filter((p) => hospitalRefs?.has(String(p.hospital_facility_id)) ?? false);

              const peccData: PECCData[] = hospitalPeccs.map((pecc) => {
                  const canonicalHospitalId = pecc.hospital_facility_id ? refToHospitalId.get(pecc.hospital_facility_id) : undefined;
                  const stats = canonicalHospitalId ? checklistStatsByHospital.get(canonicalHospitalId) : undefined;
                  const totalTasks = stats?.total || 0;
                  const completedTasks = stats?.completed || 0;
                  const checklistProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                  const hActs = canonicalHospitalId ? hospActivities.get(canonicalHospitalId) : null;
                  const hGaps = canonicalHospitalId ? hospGapPlans.get(canonicalHospitalId) : null;
                  const uActs = udPeccActivities.get(pecc.id);
                  const uGaps = udPeccGapPlans.get(pecc.id);
                  const activities = Array.isArray(hActs) ? hActs : (Array.isArray(uActs) ? uActs : []);
                  const gapPlansList = Array.isArray(hGaps) ? hGaps : (Array.isArray(uGaps) ? uGaps : []);
                  const activityCount = activities.length;
                  const gapPlanCount = gapPlansList.length;
                  const lastPeccActivity = activities.length > 0
                    ? activities.sort((x: any, y: any) => new Date(y.date).getTime() - new Date(x.date).getTime())[0].date
                    : null;

                  const hospitalName =
                    (hospitals || []).find((h: { id: string; facility_id?: string | null }) =>
                      h.id === canonicalHospitalId || String(h.facility_id || '') === String(pecc.hospital_facility_id)
                    )?.name || 'Unknown';

                  return {
                    id: pecc.id,
                    firstName: pecc.first_name,
                    lastName: pecc.last_name,
                    email: pecc.email,
                    hospitalName,
                    checklistProgress,
                    activityCount,
                    gapPlanCount,
                    lastActivity: lastPeccActivity,
                    activities,
                    gapPlans: gapPlansList,
                    fullSiteAccessApproved: peccFullSiteApprovalMap.get(pecc.id) === true
                  };
                });

              return {
                id: hospital?.id || '',
                name: hospital?.name || 'Unknown',
                peccs: peccData
              };
            });

          return {
            id: mentor.id,
            firstName: mentor.first_name,
            lastName: mentor.last_name,
            email: mentor.email,
            phone: mentor.phone || '',
            status: (mentor.is_active !== false ? 'active' : 'inactive') as 'active' | 'pending' | 'inactive',
            assignedHospitals: hospitalData,
            totalActivities,
            hoursThisMonth,
            lastActivity
          };
        })
      );

      if (isMountedRef.current) setMentors(mentorData);
    } catch (err) {
      console.error('Error loading mentors:', err);
      if (isMountedRef.current) {
        setLoadError('Failed to load mentor data. Please try again.');
        setSnackbar({ open: true, message: 'Error loading mentor data', severity: 'error' });
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleInviteMentor = async () => {
    const email = formData.email?.trim();
    if (!email) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' });
      return;
    }
    if (!userProfile?.id) {
      setSnackbar({ open: true, message: 'You must be logged in to invite', severity: 'error' });
      return;
    }
    setInviteSending(true);
    try {
      const { code, emailSent, emailError } = await createAndSendInvitation({
        email,
        role: UserRole.MENTOR,
        invitedBy: userProfile.id,
        managerId: userProfile.id,
        cohortIds: inviteCohortIds.length > 0 ? inviteCohortIds : undefined
      });
      const inviteUrl = `${window.location.origin}/invite/${code}`;
      await navigator.clipboard.writeText(inviteUrl);
      setDialogOpen(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '' });
      setInviteCohortIds([]);
      const baseMsg = inviteCohortIds.length > 0
        ? `Invitation created! Link copied. Mentor will be able to invite PECCs to ${inviteCohortIds.length} cohort(s).`
        : `Invitation link copied! Send to ${email}`;
      setSnackbar({
        open: true,
        message: emailSent
          ? baseMsg
          : `${baseMsg} (Email was not sent${emailError ? `: ${emailError}` : ''} — please send the copied link to the invitee.)`,
        severity: 'success'
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.message || 'Failed to create invitation', severity: 'error' });
    } finally {
      setInviteSending(false);
    }
  };

  const handleExpandMentor = (mentorId: string) => {
    setExpandedMentor(expandedMentor === mentorId ? null : mentorId);
    setExpandedPECC(null);
  };

  const handleExpandPECC = (peccId: string) => {
    setExpandedPECC(expandedPECC === peccId ? null : peccId);
  };

  const handleViewPECCDetail = (pecc: PECCData) => {
    setViewingPECC(pecc);
    setPeccDetailTab(pecc.fullSiteAccessApproved ? 0 : 1);
  };

  const renderPECCActivities = (pecc: PECCData) => {
    const activityList = pecc.activities ?? [];

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Activity</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Hours</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {activityList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No activities logged
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              activityList
                .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map((activity: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(activity.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{activity.activityName || '-'}</TableCell>
                    <TableCell>{displayActivityCategories(activity)}</TableCell>
                    <TableCell>{activity.hours || 0}h</TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderPECCChecklist = (pecc: PECCData) => {
    return (
      <Box>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h2" color="primary" fontWeight="bold">
            {pecc.checklistProgress}%
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Overall Completion
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={pecc.checklistProgress} 
            sx={{ mt: 2, height: 10, borderRadius: 5 }}
          />
        </Box>
        <Alert severity="info">
          Checklist data is stored in site_checklist_progress table. Full checklist view available on PECC's account.
        </Alert>
      </Box>
    );
  };

  const renderPECCGapPlans = (pecc: PECCData) => {
    const gapPlanList = pecc.gapPlans ?? [];

    return (
      <Box>
        {gapPlanList.length === 0 ? (
          <Typography variant="body2" color="textSecondary" textAlign="center" sx={{ py: 4 }}>
            No gap plans created yet
          </Typography>
        ) : (
          <List>
            {gapPlanList.map((plan: any, index: number) => (
              <React.Fragment key={index}>
                {index > 0 && <Divider />}
                <ListItem>
                  <ListItemText
                    primary={plan.gap || 'Untitled Gap Plan'}
                    secondary={
                      <>
                        <Typography variant="body2" component="span">
                          <strong>Action:</strong> {plan.action || 'N/A'}
                        </Typography>
                        <br />
                        <Typography variant="caption" component="span">
                          Status: {plan.status || 'Pending'} | Due: {plan.dueDate ? format(new Date(plan.dueDate), 'MMM d, yyyy') : 'Not set'}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Manage Mentors
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
          <Button size="small" sx={{ ml: 1 }} onClick={() => { setLoadError(null); loadMentors(); }}>
            Retry
          </Button>
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" color="primary" fontWeight={600}>
            Manage Mentors
          </Typography>
          <Typography variant="body2" color="textSecondary">
            View and manage your mentor team. Expand to see their PECCs and review activities, progress, and gap plans.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Switch
                checked={wagesEnabled}
                onChange={(e) => handleToggleWages(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="caption" color="textSecondary">
                Show Wages
              </Typography>
            }
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Invite Mentor
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Team View" icon={<PeopleIcon />} iconPosition="start" />
          {wagesEnabled && <Tab label="Wages & Expenses" icon={<MoneyIcon />} iconPosition="start" />}
        </Tabs>
      </Paper>

      {/* Team View Tab */}
      {activeTab === 0 && (
        <Box>
          {/* Summary Stats */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">{mentors.length}</Typography>
                <Typography variant="body2" color="textSecondary">Total Mentors</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {mentors.reduce((sum, m) => sum + m.assignedHospitals.reduce((s, h) => s + h.peccs.length, 0), 0)}
                </Typography>
                <Typography variant="body2" color="textSecondary">Total PECCs</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {mentors.reduce((sum, m) => sum + m.totalActivities, 0)}
                </Typography>
                <Typography variant="body2" color="textSecondary">Total Activities</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {mentors.reduce((sum, m) => sum + m.hoursThisMonth, 0).toFixed(1)}h
                </Typography>
                <Typography variant="body2" color="textSecondary">Hours This Month</Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Mentors List */}
          {mentors.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                No mentors found. Invite mentors to start building your team.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ mt: 2 }}>
                Invite First Mentor
              </Button>
            </Paper>
          ) : (
            <Box>
          {mentors.map((mentor, index) => (
            <Card key={mentor.id} sx={{ mb: 2 }}>
              <CardContent>
                {/* Mentor Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleExpandMentor(mentor.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 50, height: 50 }}>
                      {mentor.firstName.charAt(0)}{mentor.lastName.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight={600}>
                        {mentor.firstName} {mentor.lastName}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {mentor.email}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      size="small"
                      label={`${mentor.assignedHospitals.length} hospitals`}
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`${mentor.assignedHospitals.reduce((sum, h) => sum + h.peccs.length, 0)} PECCs`}
                      color="secondary"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`${mentor.hoursThisMonth.toFixed(1)}h/month`}
                      color="success"
                      variant="outlined"
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExpandMentor(mentor.id);
                      }}
                      aria-label={expandedMentor === mentor.id ? 'Collapse mentor details' : 'Expand mentor details'}
                      aria-expanded={expandedMentor === mentor.id}
                    >
                      {expandedMentor === mentor.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </Box>

                {/* Expanded Mentor Content */}
                <Collapse in={expandedMentor === mentor.id} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        Assigned Hospitals & PECCs:
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => { e.stopPropagation(); setCohortAssignMentor(mentor); }}
                      >
                        Assign to cohorts
                      </Button>
                    </Box>

                    {mentor.assignedHospitals.length === 0 ? (
                      <Typography variant="body2" color="textSecondary">
                        No hospitals assigned yet
                      </Typography>
                    ) : (
                      mentor.assignedHospitals.map((hospital) => (
                        <Paper key={hospital.id} sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <HospitalIcon color="primary" />
                              <Typography variant="subtitle1" fontWeight={600}>
                                {hospital.name}
                              </Typography>
                              <Chip size="small" label={`${hospital.peccs.length} PECCs`} />
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ViewIcon />}
                              onClick={() => navigate(`/manager/crm?hospital=${hospital.id}`)}
                            >
                              View in CRM
                            </Button>
                          </Box>

                          {/* PECCs List */}
                          {hospital.peccs.length === 0 ? (
                            <Typography variant="body2" color="textSecondary">
                              No PECCs at this hospital yet
                            </Typography>
                          ) : (
                            <List>
                              {hospital.peccs.map((pecc) => (
                                <React.Fragment key={pecc.id}>
                                  <ListItem
                                    sx={{
                                      flexDirection: 'column',
                                      alignItems: 'stretch',
                                      bgcolor: 'white',
                                      borderRadius: 1,
                                      mb: 1
                                    }}
                                  >
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => handleExpandPECC(pecc.id)}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Avatar sx={{ bgcolor: 'secondary.main', width: 36, height: 36 }}>
                                          {pecc.firstName.charAt(0)}{pecc.lastName.charAt(0)}
                                        </Avatar>
                                        <Box>
                                          <Typography variant="body1" fontWeight={600}>
                                            {pecc.firstName} {pecc.lastName}
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            {pecc.email}
                                          </Typography>
                                        </Box>
                                      </Box>

                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip
                                          size="small"
                                          label={`${pecc.checklistProgress}% complete`}
                                          color={pecc.checklistProgress >= 75 ? 'success' : pecc.checklistProgress >= 50 ? 'warning' : 'error'}
                                          variant="outlined"
                                        />
                                        <Button
                                          size="small"
                                          variant="text"
                                          startIcon={<ViewIcon />}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewPECCDetail(pecc);
                                          }}
                                        >
                                          {pecc.fullSiteAccessApproved ? 'Open Full Site' : 'View Summary + Checklist'}
                                        </Button>
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleExpandPECC(pecc.id);
                                          }}
                                          aria-label={expandedPECC === pecc.id ? 'Collapse PECC details' : 'Expand PECC details'}
                                          aria-expanded={expandedPECC === pecc.id}
                                        >
                                          {expandedPECC === pecc.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </IconButton>
                                      </Box>
                                    </Box>

                                    {/* Quick PECC Stats */}
                                    <Collapse in={expandedPECC === pecc.id} timeout="auto" unmountOnExit>
                                      <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'space-around' }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                          <Typography variant="h6" color="primary">
                                            {pecc.activityCount}
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            Activities
                                          </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                          <Typography variant="h6" color="info.main">
                                            {pecc.checklistProgress}%
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            Checklist
                                          </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                          <Typography variant="h6" color="success.main">
                                            {pecc.gapPlanCount}
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            Gap Plans
                                          </Typography>
                                        </Box>
                                        <Box sx={{ textAlign: 'center' }}>
                                          <Typography variant="body2" color="textSecondary">
                                            Last Active
                                          </Typography>
                                          <Typography variant="caption">
                                            {pecc.lastActivity ? format(new Date(pecc.lastActivity), 'MMM d') : 'Never'}
                                          </Typography>
                                        </Box>
                                      </Box>
                                    </Collapse>
                                  </ListItem>
                                </React.Fragment>
                              ))}
                            </List>
                          )}
                        </Paper>
                      ))
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
        )}
      </Box>
      )}

      {/* Wages & Expenses Tab */}
      {wagesEnabled && activeTab === 1 && (
        <Box>
          <ManagerWagesExpensesPage />
        </Box>
      )}

      {/* PECC Detail Dialog */}
      <Dialog 
        open={viewingPECC !== null} 
        onClose={() => setViewingPECC(null)} 
        maxWidth="md" 
        fullWidth
      >
        {viewingPECC && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  {viewingPECC.firstName.charAt(0)}{viewingPECC.lastName.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6">
                    {viewingPECC.firstName} {viewingPECC.lastName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {viewingPECC.hospitalName}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              {viewingPECC.fullSiteAccessApproved ? (
                <>
                  <Tabs value={peccDetailTab} onChange={(e, v) => setPeccDetailTab(v)}>
                    <Tab icon={<ActivityIcon />} label="Activities" />
                    <Tab icon={<ChecklistIcon />} label="Checklist" />
                    <Tab icon={<GapPlanIcon />} label="Gap Plans" />
                  </Tabs>

                  <TabPanel value={peccDetailTab} index={0}>
                    {renderPECCActivities(viewingPECC)}
                  </TabPanel>
                  <TabPanel value={peccDetailTab} index={1}>
                    {renderPECCChecklist(viewingPECC)}
                  </TabPanel>
                  <TabPanel value={peccDetailTab} index={2}>
                    {renderPECCGapPlans(viewingPECC)}
                  </TabPanel>
                </>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    This PECC has not approved full-site sharing. You can view aggregated summary metrics and checklist progress, but not individual activity or gap details.
                  </Alert>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={3}>
                      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" color="primary">{viewingPECC.activityCount}</Typography>
                        <Typography variant="caption" color="textSecondary">Total Activities</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" color="success.main">{viewingPECC.gapPlanCount}</Typography>
                        <Typography variant="caption" color="textSecondary">Total Gaps</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" color="info.main">{viewingPECC.checklistProgress}%</Typography>
                        <Typography variant="caption" color="textSecondary">Checklist Completion</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <Paper sx={{ p: 1.5, textAlign: 'center' }}>
                        <Typography variant="body2" fontWeight={600}>
                          {viewingPECC.lastActivity ? format(new Date(viewingPECC.lastActivity), 'MMM d, yyyy') : 'No activity'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">Last Activity</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                  {renderPECCChecklist(viewingPECC)}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewingPECC(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={dialogOpen} onClose={() => !inviteSending && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite New Mentor</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Send an invitation link to add a new mentor to your team. Optionally assign them to cohorts so they can invite PECCs to those cohorts.
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                size="small"
                options={inviteCohorts}
                getOptionLabel={(opt) => opt.name}
                value={inviteCohorts.filter(c => inviteCohortIds.includes(c.id))}
                onChange={(_, value) => setInviteCohortIds(value.map(c => c.id))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cohorts (mentor can invite PECCs to these)"
                    placeholder="Select cohorts"
                    helperText="Optional. Leave empty to assign later from Cohorts."
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={inviteSending}>Cancel</Button>
          <Button onClick={handleInviteMentor} variant="contained" startIcon={<CopyIcon />} disabled={inviteSending}>
            {inviteSending ? 'Creating…' : 'Create invitation & copy link'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Assign mentor to cohorts dialog */}
      <Dialog open={!!cohortAssignMentor} onClose={() => !cohortAssignSaving && setCohortAssignMentor(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Assign to cohorts — {cohortAssignMentor ? `${cohortAssignMentor.firstName} ${cohortAssignMentor.lastName}` : ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Choose which cohorts this mentor can invite PECCs to.
          </Typography>
          <Autocomplete
            multiple
            size="small"
            options={cohortAssignOptions}
            getOptionLabel={(opt) => opt.name}
            value={cohortAssignOptions.filter(c => cohortAssignSelectedIds.includes(c.id))}
            onChange={(_, value) => setCohortAssignSelectedIds(value.map(c => c.id))}
            renderInput={(params) => (
              <TextField {...params} label="Cohorts" placeholder="Select cohorts" />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCohortAssignMentor(null)} disabled={cohortAssignSaving}>Cancel</Button>
          <Button onClick={handleSaveCohortAssign} variant="contained" disabled={cohortAssignSaving}>
            {cohortAssignSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ManagerMentorsPage;
