import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  FormControl,
  InputLabel,
  InputAdornment,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup
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
  Search as SearchIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { batchGetMentorActivitiesForUsers } from '../../utils/mentorActivities';
import {
  getUserData,
  setUserData,
  batchGetUserDataForKey,
  batchGetHospitalDataForKey,
  mapSiteRefsToHospitalRowIds,
  shouldMirrorLegacyUserData,
} from '../../utils/userData';
import { buildMentorHospitalContext } from '../../utils/mentorHospitalScope';
import { getRosterMentorUsersForManager } from '../../utils/managerTeamScope';
import { loadSiteChecklistStats } from '../../utils/checklistTemplates';
import { buildPeccHospitalFacilityOrClause } from '../../utils/mentorHospitalAssignments';
import { createAndSendInvitation } from '../../utils/invitations';
import { UserRole } from '../../types/database';
import {
  AdminPageShell,
  AdminHero,
  AdminSection,
  adminSectionShellSx,
} from '../../components/admin/AdminPageChrome';

interface MentorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'pending' | 'inactive';
  supervision: 'direct' | 'cohort' | 'both';
  lastLogin: string | null;
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

type RosterRoleFilter = 'all' | 'mentors' | 'peccs';
type RosterActivityFilter = 'all' | 'last30' | 'inactive30' | 'never';
type RosterSort = 'recent' | 'name' | 'activities' | 'checklist';

type FlatPeccData = PECCData & {
  mentorId: string;
  mentorName: string;
};

const activityTimestamp = (value: string | null): number =>
  value ? new Date(value).getTime() : 0;

const matchesActivityFilter = (
  lastActivity: string | null,
  filter: RosterActivityFilter
): boolean => {
  if (filter === 'all') return true;
  const timestamp = activityTimestamp(lastActivity);
  if (filter === 'never') return timestamp === 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return filter === 'last30' ? timestamp >= cutoff : timestamp > 0 && timestamp < cutoff;
};

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

const USER_DATA_PECC_FULL_SITE_APPROVAL = 'pecc_allow_manager_mentor_full_view';

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  const tabId = `pecc-detail-tab-${index}`;
  const panelId = `pecc-detail-tabpanel-${index}`;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={panelId}
      aria-labelledby={tabId}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

type ManagerMentorsPageProps = {
  /** When true, render without page chrome (used inside Team hub). */
  embedded?: boolean;
};

const ManagerMentorsPage: React.FC<ManagerMentorsPageProps> = ({ embedded = false }) => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  
  const [mentors, setMentors] = useState<MentorData[]>([]);
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [expandedPECC, setExpandedPECC] = useState<string | null>(null);
  const [viewingPECC, setViewingPECC] = useState<PECCData | null>(null);
  const [peccDetailTab, setPeccDetailTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [rosterRole, setRosterRole] = useState<RosterRoleFilter>('all');
  const [activityFilter, setActivityFilter] = useState<RosterActivityFilter>('all');
  const [rosterSort, setRosterSort] = useState<RosterSort>('recent');
  const [rosterSearch, setRosterSearch] = useState('');
  const isMountedRef = useRef(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [inviteCohortIds, setInviteCohortIds] = useState<string[]>([]);
  const [inviteCohorts, setInviteCohorts] = useState<Array<{ id: string; name: string }>>([]);
  const [inviteSending, setInviteSending] = useState(false);
  const [cohortAssignMentor, setCohortAssignMentor] = useState<MentorData | null>(null);
  const [cohortAssignOptions, setCohortAssignOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [cohortAssignSelectedIds, setCohortAssignSelectedIds] = useState<string[]>([]);
  const [cohortAssignSaving, setCohortAssignSaving] = useState(false);

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

      const scopedMentorsRaw = await getRosterMentorUsersForManager(userProfile.id);
      if (scopedMentorsRaw.length === 0) {
        if (isMountedRef.current) setMentors([]);
        return;
      }

      const { data: mentorStatusRows } = await supabase
        .from('users')
        .select('id, phone, is_active, last_login')
        .in('id', scopedMentorsRaw.map((m) => m.id));
      const statusById = new Map(
        (mentorStatusRows || []).map(
          (r: { id: string; phone: string | null; is_active: boolean; last_login: string | null }) => [r.id, r]
        )
      );
      const scopedMentors = scopedMentorsRaw.map((m) => ({
        ...m,
        phone: statusById.get(m.id)?.phone ?? null,
        is_active: statusById.get(m.id)?.is_active ?? true,
        last_login: statusById.get(m.id)?.last_login ?? null,
      }));

      const scopedMentorIds = scopedMentors.map((m) => m.id);
      const hospitalCtx = await buildMentorHospitalContext(scopedMentorIds);
      const uniqueHospitalIds = hospitalCtx.allHospitalUuids;
      const { data: peccs, error: peccsError } = hospitalCtx.allHospitalRefs.length > 0
        ? await supabase
          .from('users')
          .select('id, first_name, last_name, email, hospital_facility_id')
          .eq('role', 'pecc')
          .or(buildPeccHospitalFacilityOrClause(hospitalCtx.allHospitalRefs))
        : { data: [], error: null };

      if (peccsError) throw peccsError;

      // Batch checklist progress by hospital, measured against each site's default or custom template.
      const checklistStatsByHospital =
        uniqueHospitalIds.length > 0
          ? await loadSiteChecklistStats(uniqueHospitalIds)
          : new Map();

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
      uniqueHospitalIds.forEach((uuid) => {
        const refs = new Set<string>([uuid]);
        hospitalCtx.refToCanonicalId.forEach((canonical, ref) => {
          if (canonical === uuid) refs.add(ref);
        });
        hospitalRefsByCanonical.set(uuid, refs);
      });

      const activitiesByMentor = await batchGetMentorActivitiesForUsers(scopedMentors.map((m) => m.id));
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Build mentor data with PECCs
      const mentorData: MentorData[] = scopedMentors.map((mentor) => {
          const mergedRows = hospitalCtx.rowsByMentor.get(mentor.id) || [];
          
          const activities = activitiesByMentor.get(mentor.id) || [];
          const totalActivities = activities.length;
          const hoursThisMonth = activities
            .filter((a: any) => new Date(a.date) >= monthStart)
            .reduce((sum: number, a: any) => sum + (a.hours || 0), 0);

          const lastActivity = activities.length > 0
            ? [...activities].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
            : null;

          const hospitalData = mergedRows.map((row) => {
              const hospitalRefs = hospitalRefsByCanonical.get(row.hospital.id);
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
                    (canonicalHospitalId ? hospitalCtx.hospitalNameById.get(canonicalHospitalId) : undefined) || 'Unknown';

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
                id: row.hospital.id,
                name: hospitalCtx.hospitalNameById.get(row.hospital.id) || row.hospital.name || 'Unknown',
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
            supervision: mentor.supervision,
            lastLogin: mentor.last_login || null,
            assignedHospitals: hospitalData,
            totalActivities,
            hoursThisMonth,
            lastActivity
          };
        });

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

  const flatPeccs = useMemo<FlatPeccData[]>(
    () =>
      mentors.flatMap((mentor) =>
        mentor.assignedHospitals.flatMap((hospital) =>
          hospital.peccs.map((pecc) => ({
            ...pecc,
            mentorId: mentor.id,
            mentorName: `${mentor.firstName} ${mentor.lastName}`.trim(),
          }))
        )
      ),
    [mentors]
  );

  const normalizedRosterSearch = rosterSearch.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | null | undefined>) =>
    !normalizedRosterSearch ||
    values.some((value) => String(value || '').toLowerCase().includes(normalizedRosterSearch));

  const filteredPeccs = useMemo(() => {
    const rows = flatPeccs.filter(
      (pecc) =>
        matchesActivityFilter(pecc.lastActivity, activityFilter) &&
        matchesSearch(
          pecc.firstName,
          pecc.lastName,
          pecc.email,
          pecc.hospitalName,
          pecc.mentorName
        )
    );
    return [...rows].sort((a, b) => {
      if (rosterSort === 'name') {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }
      if (rosterSort === 'activities') return b.activityCount - a.activityCount;
      if (rosterSort === 'checklist') return b.checklistProgress - a.checklistProgress;
      return activityTimestamp(b.lastActivity) - activityTimestamp(a.lastActivity);
    });
    // matchesSearch depends only on normalizedRosterSearch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatPeccs, activityFilter, rosterSort, normalizedRosterSearch]);

  const filteredMentors = useMemo(() => {
    const rows = mentors.filter((mentor) => {
      const mentorMatches =
        matchesActivityFilter(mentor.lastActivity, activityFilter) &&
        matchesSearch(mentor.firstName, mentor.lastName, mentor.email);
      if (rosterRole !== 'all') return mentorMatches;
      const peccMatches = mentor.assignedHospitals.some((hospital) =>
        hospital.peccs.some(
          (pecc) =>
            matchesActivityFilter(pecc.lastActivity, activityFilter) &&
            matchesSearch(
              pecc.firstName,
              pecc.lastName,
              pecc.email,
              pecc.hospitalName,
              mentor.firstName,
              mentor.lastName
            )
        )
      );
      return mentorMatches || peccMatches;
    });
    return [...rows].sort((a, b) => {
      if (rosterSort === 'name') {
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
      }
      if (rosterSort === 'activities') return b.totalActivities - a.totalActivities;
      if (rosterSort === 'checklist') {
        const avg = (mentor: MentorData) => {
          const peccs = mentor.assignedHospitals.flatMap((hospital) => hospital.peccs);
          return peccs.length
            ? peccs.reduce((sum, pecc) => sum + pecc.checklistProgress, 0) / peccs.length
            : -1;
        };
        return avg(b) - avg(a);
      }
      const latestActivity = (mentor: MentorData) =>
        Math.max(
          activityTimestamp(mentor.lastActivity),
          ...mentor.assignedHospitals.flatMap((hospital) =>
            hospital.peccs.map((pecc) => activityTimestamp(pecc.lastActivity))
          )
        );
      return latestActivity(b) - latestActivity(a);
    });
    // matchesSearch depends only on normalizedRosterSearch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentors, activityFilter, rosterSort, rosterRole, normalizedRosterSearch]);

  const resultCount = rosterRole === 'peccs' ? filteredPeccs.length : filteredMentors.length;
  const resultLabel =
    rosterRole === 'peccs'
      ? `${resultCount} PECC${resultCount === 1 ? '' : 's'}`
      : `${resultCount} mentor${resultCount === 1 ? '' : 's'}`;

  const rosterControls = (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 2,
        bgcolor: 'background.default',
        borderColor: 'divider',
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} alignItems={{ lg: 'center' }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={rosterRole}
          onChange={(_, value: RosterRoleFilter | null) => value && setRosterRole(value)}
          aria-label="Filter roster by role"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="mentors">Mentors</ToggleButton>
          <ToggleButton value="peccs">PECCs</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          value={rosterSearch}
          onChange={(event) => setRosterSearch(event.target.value)}
          placeholder="Search name, email, hospital…"
          inputProps={{ 'aria-label': 'Search team roster' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: '100%', lg: 260 }, flex: 1 }}
        />

        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel id="manager-roster-activity-label">Activity</InputLabel>
          <Select
            labelId="manager-roster-activity-label"
            value={activityFilter}
            label="Activity"
            onChange={(event) => setActivityFilter(event.target.value as RosterActivityFilter)}
          >
            <MenuItem value="all">Any activity</MenuItem>
            <MenuItem value="last30">Active in last 30 days</MenuItem>
            <MenuItem value="inactive30">No activity in 30+ days</MenuItem>
            <MenuItem value="never">No recorded activity</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel id="manager-roster-sort-label">Sort by</InputLabel>
          <Select
            labelId="manager-roster-sort-label"
            value={rosterSort}
            label="Sort by"
            onChange={(event) => setRosterSort(event.target.value as RosterSort)}
          >
            <MenuItem value="recent">Most recent activity</MenuItem>
            <MenuItem value="activities">Most activities</MenuItem>
            <MenuItem value="checklist">Checklist progress</MenuItem>
            <MenuItem value="name">Name A–Z</MenuItem>
          </Select>
        </FormControl>

        <Chip
          icon={<TuneIcon />}
          label={resultLabel}
          size="small"
          color="primary"
          variant="outlined"
        />
      </Stack>
    </Paper>
  );

  const overviewChips = (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: embedded ? 2 : 0 }}>
      <Chip label={`${mentors.length} mentors`} color="secondary" variant="outlined" size="small" />
      <Chip
        label={`${mentors.reduce((sum, m) => sum + m.assignedHospitals.reduce((s, h) => s + h.peccs.length, 0), 0)} PECCs`}
        variant="outlined"
        size="small"
      />
      <Chip label={`${mentors.reduce((sum, m) => sum + m.totalActivities, 0)} activities`} variant="outlined" size="small" />
      <Chip label={`${mentors.reduce((sum, m) => sum + m.hoursThisMonth, 0).toFixed(1)}h this month`} variant="outlined" size="small" />
      {embedded && (
        <Button
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ ml: { xs: 0, sm: 'auto' } }}
        >
          Invite Mentor
        </Button>
      )}
    </Stack>
  );

  if (loading) {
    if (embedded) {
      return (
        <Paper elevation={0} sx={{ ...adminSectionShellSx, p: 3 }}>
          <LinearProgress />
        </Paper>
      );
    }
    return (
      <AdminPageShell>
        <AdminHero overline="Manager" title="Mentors" description="Loading your mentor team…" />
        <Paper elevation={0} sx={{ ...adminSectionShellSx, p: 3 }}>
          <LinearProgress />
        </Paper>
      </AdminPageShell>
    );
  }

  const body = (
    <>
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
          <Button size="small" sx={{ ml: 1 }} onClick={() => { setLoadError(null); loadMentors(); }}>
            Retry
          </Button>
        </Alert>
      )}

      {embedded ? (
        overviewChips
      ) : (
        <AdminSection
          overline="Roster"
          title="Team overview"
          description={`${mentors.length} mentors · ${mentors.reduce((sum, m) => sum + m.assignedHospitals.reduce((s, h) => s + h.peccs.length, 0), 0)} PECCs · ${mentors.reduce((sum, m) => sum + m.hoursThisMonth, 0).toFixed(1)}h this month`}
        >
          {overviewChips}
        </AdminSection>
      )}

      <AdminSection
        overline={embedded ? undefined : 'Team'}
        title={embedded ? 'Mentors & PECCs' : 'Mentors'}
        description="Direct reports and mentors in cohorts you manage. Expand a card for sites, checklist %, activity counts, and gap plans."
      >
        {rosterControls}
          {resultCount === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="textSecondary" gutterBottom>
                No team members match these filters.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setRosterRole('all');
                  setActivityFilter('all');
                  setRosterSearch('');
                }}
                sx={{ mt: 2 }}
              >
                Clear filters
              </Button>
            </Paper>
          ) : rosterRole === 'peccs' ? (
            <Stack spacing={1.25}>
              {filteredPeccs.map((pecc) => (
                <Card key={pecc.id} variant="outlined">
                  <CardContent
                    sx={{
                      display: 'flex',
                      alignItems: { xs: 'flex-start', md: 'center' },
                      justifyContent: 'space-between',
                      flexDirection: { xs: 'column', md: 'row' },
                      gap: 2,
                      '&:last-child': { pb: 2 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                        {pecc.firstName.charAt(0)}{pecc.lastName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={650}>
                          {pecc.firstName} {pecc.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {pecc.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {pecc.hospitalName} · Mentor: {pecc.mentorName}
                        </Typography>
                      </Box>
                    </Box>

                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ width: { xs: '100%', md: 'auto' } }}
                    >
                      <Chip
                        size="small"
                        label={`${pecc.checklistProgress}% checklist`}
                        color={
                          pecc.checklistProgress >= 75
                            ? 'success'
                            : pecc.checklistProgress >= 50
                              ? 'warning'
                              : 'error'
                        }
                        variant="outlined"
                      />
                      <Chip size="small" label={`${pecc.activityCount} activities`} variant="outlined" />
                      <Chip
                        size="small"
                        label={
                          pecc.lastActivity
                            ? `Active ${format(new Date(pecc.lastActivity), 'MMM d')}`
                            : 'No activity'
                        }
                        variant="outlined"
                      />
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<ViewIcon />}
                        onClick={() => handleViewPECCDetail(pecc)}
                      >
                        View
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box>
          {filteredMentors.map((mentor) => (
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

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Chip
                      size="small"
                      label={
                        mentor.supervision === 'cohort'
                          ? 'Managed cohort'
                          : mentor.supervision === 'both'
                            ? 'Direct + cohort'
                            : 'Direct report'
                      }
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={
                        mentor.lastLogin
                          ? `Login ${format(new Date(mentor.lastLogin), 'MMM d')}`
                          : 'No login'
                      }
                      variant="outlined"
                    />
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
                              onClick={() => navigate(`/manager/team?tab=sites&hospital=${hospital.id}`)}
                            >
                              View site
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
      </AdminSection>

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
                  <Tabs value={peccDetailTab} onChange={(e, v) => setPeccDetailTab(v)} aria-label="PECC detail sections">
                    <Tab id="pecc-detail-tab-0" aria-controls="pecc-detail-tabpanel-0" icon={<ActivityIcon />} label="Activities" />
                    <Tab id="pecc-detail-tab-1" aria-controls="pecc-detail-tabpanel-1" icon={<ChecklistIcon />} label="Checklist" />
                    <Tab id="pecc-detail-tab-2" aria-controls="pecc-detail-tabpanel-2" icon={<GapPlanIcon />} label="Gap Plans" />
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
    </>
  );

  if (embedded) return body;

  return (
    <AdminPageShell>
      <AdminHero
        overline="Manager"
        title="Mentors"
        description="View and manage your mentor team. Expand to see their PECCs and review activities, progress, and gap plans."
        actions={
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Invite Mentor
          </Button>
        }
      />
      {body}
    </AdminPageShell>
  );
};

export default ManagerMentorsPage;
