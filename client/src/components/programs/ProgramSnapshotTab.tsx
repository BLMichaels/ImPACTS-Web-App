import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Chip,
  Alert,
  Avatar,
  List,
  ListItem,
  Divider,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { supabase } from '../../supabase';
import { getMentorActivitiesForUser } from '../../utils/mentorActivities';

interface AssignedHospital {
  id: string;
  name: string;
  peccCount: number;
}

interface MentorRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  assignedHospitals: AssignedHospital[];
  totalActivities: number;
  hoursThisMonth: number;
  hoursTotal: number;
  lastActivity: string | null;
  activitiesThisMonthCount: number;
}

interface ProgramSnapshotTabProps {
  programId: string;
  programName: string;
}

export const ProgramSnapshotTab: React.FC<ProgramSnapshotTabProps> = ({ programId, programName }) => {
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [totalPeccs, setTotalPeccs] = useState(0);
  const [totalSites, setTotalSites] = useState(0);
  const [peccProgressSum, setPeccProgressSum] = useState(0);
  const [peccProgressCount, setPeccProgressCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: membersData, error: membersErr } = await supabase
          .from('program_members')
          .select('user_id')
          .eq('program_id', programId)
          .eq('status', 'active');

        if (membersErr) throw membersErr;
        const memberIds = (membersData || []).map((m: { user_id: string }) => m.user_id).filter(Boolean);
        if (memberIds.length === 0) {
          setMentors([]);
          setTotalPeccs(0);
          setTotalSites(0);
          setPeccProgressSum(0);
          setPeccProgressCount(0);
          setLoading(false);
          return;
        }

        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role, hospital_facility_id')
          .in('id', memberIds);

        if (usersErr) throw usersErr;
        const mentorUsers = (usersData || []).filter((u: { role: string }) => u.role === 'mentor');
        const peccList = (usersData || []).filter((u: { role: string }) => u.role === 'pecc') as { id: string; hospital_facility_id: string }[];
        const mentorIds = mentorUsers.map((m: { id: string }) => m.id);

        const { data: assignments, error: assignErr } = await supabase
          .from('mentor_hospital_assignments')
          .select('mentor_id, hospital:hospital_id(id, name)')
          .in('mentor_id', mentorIds)
          .eq('is_active', true);

        if (assignErr) throw assignErr;

        const hospitalIds = (assignments || [])
          .map((a: any) => (Array.isArray(a.hospital) ? a.hospital[0]?.id : a.hospital?.id))
          .filter(Boolean);

        const { data: hospitals } = await supabase
          .from('hospitals')
          .select('id, name')
          .in('id', hospitalIds);
        const hospitalMap = new Map<string, string>();
        (hospitals || []).forEach((h: any) => hospitalMap.set(h.id, h.name || 'Unknown'));

        let progSum = 0;
        let progCnt = 0;
        for (const p of peccList) {
          if (!p.hospital_facility_id) continue;
          const { data: cl } = await supabase
            .from('site_checklist_progress')
            .select('completed')
            .eq('hospital_id', p.hospital_facility_id);
          const done = (cl || []).filter((t: any) => t.completed).length;
          progSum += 100 > 0 ? Math.round((done / 100) * 100) : 0;
          progCnt += 1;
        }
        setPeccProgressSum(progSum);
        setPeccProgressCount(progCnt);
        setTotalPeccs(peccList.length);
        setTotalSites(new Set(hospitalIds).size);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const mentorRows: MentorRow[] = await Promise.all(
          mentorUsers.map(async (mentor: any) => {
            const mentorAssignments = (assignments || []).filter((a: any) => a.mentor_id === mentor.id);
            const assignedHospitals: AssignedHospital[] = mentorAssignments.map((a: any) => {
              const h = Array.isArray(a.hospital) ? a.hospital[0] : a.hospital;
              const hid = h?.id;
              const peccCount = peccList.filter((p: any) => p.hospital_facility_id === hid).length;
              return {
                id: hid || '',
                name: hospitalMap.get(hid) || h?.name || 'Unknown',
                peccCount,
              };
            }).filter((h: AssignedHospital) => h.id);

            const activities = await getMentorActivitiesForUser(mentor.id);
            const thisMonth = activities.filter((a: any) => new Date(a.date) >= monthStart);
            const hoursThisMonth = thisMonth.reduce((s: number, a: any) => s + (a.hours || 0), 0);
            const lastActivity =
              activities.length > 0
                ? activities.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
                : null;

            return {
              id: mentor.id,
              firstName: mentor.first_name,
              lastName: mentor.last_name,
              email: mentor.email,
              assignedHospitals,
              totalActivities: activities.length,
              hoursThisMonth,
              hoursTotal: activities.reduce((s: number, a: any) => s + (a.hours || 0), 0),
              lastActivity,
              activitiesThisMonthCount: thisMonth.length,
            };
          })
        );
        setMentors(mentorRows);
      } catch (err) {
        console.error('Program snapshot error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load snapshot');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [programId, retryCount]);

  const teamHoursThisMonth = useMemo(() => mentors.reduce((s, m) => s + m.hoursThisMonth, 0), [mentors]);
  const teamActivitiesThisMonth = useMemo(() => mentors.reduce((s, m) => s + m.activitiesThisMonthCount, 0), [mentors]);
  const avgPeccProgress = useMemo(
    () => (peccProgressCount > 0 ? Math.round(peccProgressSum / peccProgressCount) : 0),
    [peccProgressSum, peccProgressCount]
  );

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <LinearProgress sx={{ width: '50%', mx: 'auto', mb: 2 }} />
        <Typography color="text.secondary">Loading program snapshot...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Snapshot: {programName}</Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={() => setRetryCount((c) => c + 1)}>
          Refresh
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Metrics for mentors and PECCs in this program.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {mentors.length} Mentors • {totalSites} Sites • {totalPeccs} PECCs
        </Typography>
        <Typography variant="body2">
          Avg PECC progress: {avgPeccProgress}% • Team hours this month: {teamHoursThisMonth.toFixed(1)}h
        </Typography>
      </Alert>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <PeopleIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="primary">{mentors.length}</Typography>
              <Typography variant="caption" color="text.secondary">Mentors</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <HospitalIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="success.main">{totalSites}</Typography>
              <Typography variant="caption" color="text.secondary">Sites</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <GroupIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="info.main">{totalPeccs}</Typography>
              <Typography variant="caption" color="text.secondary">PECCs ({avgPeccProgress}% avg)</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <WorkIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="warning.main">{teamHoursThisMonth.toFixed(1)}h</Typography>
              <Typography variant="caption" color="text.secondary">This month ({teamActivitiesThisMonth} activities)</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Mentors in program</Typography>
          {mentors.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>No mentors in this program</Typography>
          ) : (
            <List>
              {mentors.map((mentor, idx) => (
                <React.Fragment key={mentor.id}>
                  {idx > 0 && <Divider />}
                  <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                      onClick={() => setExpandedMentor(expandedMentor === mentor.id ? null : mentor.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {mentor.firstName?.[0]}{mentor.lastName?.[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {mentor.firstName} {mentor.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">{mentor.email}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip size="small" label={`${mentor.assignedHospitals.length} sites`} variant="outlined" />
                        <Chip size="small" label={`${mentor.hoursThisMonth.toFixed(1)}h this month`} color="primary" variant="outlined" />
                        <IconButton size="small">
                          {expandedMentor === mentor.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                    </Box>
                    <Collapse in={expandedMentor === mentor.id}>
                      <Box sx={{ mt: 2, ml: 6 }}>
                        {mentor.assignedHospitals.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">No sites assigned</Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {mentor.assignedHospitals.map((h) => (
                              <Chip key={h.id} label={`${h.name} (${h.peccCount} PECC${h.peccCount !== 1 ? 's' : ''})`} size="small" variant="outlined" />
                            ))}
                          </Box>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          {mentor.totalActivities} activities • {mentor.hoursTotal.toFixed(1)}h total • Last: {mentor.lastActivity ? format(new Date(mentor.lastActivity), 'MMM d, yyyy') : 'None'}
                        </Typography>
                      </Box>
                    </Collapse>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProgramSnapshotTab;
