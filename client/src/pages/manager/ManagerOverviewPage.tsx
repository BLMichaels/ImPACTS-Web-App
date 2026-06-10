import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  Divider,
  Button,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  Alert,
  Container,
} from '@mui/material';
import {
  People as PeopleIcon,
  LocalHospital as HospitalIcon,
  Assignment as ActivityIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Timeline as TimelineIcon,
  PictureAsPdf as PictureAsPdfIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { supabase } from '../../supabase';
import { format } from 'date-fns';
import { useManagerTeamDashboard } from '../../hooks/useManagerTeamDashboard';
import { exportManagerTeamSnapshotPdf } from '../../utils/managerTeamSnapshotPdf';
import { getUserDisplayName } from '../../utils/displayName';

const ManagerOverviewPage: React.FC = () => {
  useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);
  const [hospitalNotes, setHospitalNotes] = useState<Array<{ date: string; text: string }>>([]);
  const [hospitalNotesName, setHospitalNotesName] = useState<string | null>(null);

  const { data, loading, error, retry } = useManagerTeamDashboard(userProfile?.id);
  const { mentors, totalPeccs, totalSites, avgPeccProgress, managerOwn, teamHoursThisMonth, teamActivitiesThisMonth, teamTotalHours } = data;

  const selectedHospitalId = searchParams.get('hospital');
  useEffect(() => {
    if (!selectedHospitalId) {
      setHospitalNotes([]);
      setHospitalNotesName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: row, error: fetchError } = await supabase
        .from('hospitals')
        .select('name, notes_log')
        .eq('id', selectedHospitalId)
        .maybeSingle();
      if (cancelled || fetchError) return;
      setHospitalNotesName((row as { name?: string } | null)?.name ?? null);
      const raw = (row as { notes_log?: unknown })?.notes_log;
      const log = Array.isArray(raw)
        ? raw
            .map((e: { date?: string; text?: string }) => ({ date: e.date ?? '', text: e.text ?? '' }))
            .filter((n) => n.date && n.text)
        : [];
      setHospitalNotes(log.sort((a, b) => b.date.localeCompare(a.date)));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedHospitalId]);

  const handleExportPdf = () => {
    const name = userProfile ? getUserDisplayName(userProfile) : 'Manager';
    exportManagerTeamSnapshotPdf(data, name);
  };

  const KpiCard = ({
    title,
    value,
    icon,
    color,
    caption,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    caption?: string;
  }) => (
    <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
      <CardContent sx={{ textAlign: 'center', p: 3 }}>
        <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: `${color}22`, mb: 1.5 }}>
          {icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color, mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {caption && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Typography variant="h4" gutterBottom>
          Manager Overview
        </Typography>
        <LinearProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => {}}>
          {error}
          <Button size="small" sx={{ ml: 1 }} onClick={retry}>
            Retry
          </Button>
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h4" color="primary" sx={{ fontWeight: 600 }}>
            Manager Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
            Team mentoring metrics, sites, and PECC progress. Export a PDF snapshot or open Reports for CSV and longitudinal data.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/manager/reports')}>
            Reports
          </Button>
          <Button variant="outlined" size="small" onClick={() => navigate('/manager/crm')}>
            CRM
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<PictureAsPdfIcon />}
            onClick={handleExportPdf}
            sx={{ bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {userProfile?.has_hospital_assignments && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You are also assigned as a mentor to hospitals. Use{' '}
          <Button size="small" onClick={() => navigate('/manager/activities')}>
            My Activities
          </Button>{' '}
          and{' '}
          <Button size="small" onClick={() => navigate('/manager/hospitals')}>
            My Hospitals
          </Button>{' '}
          for your direct mentoring work.
        </Alert>
      )}

      {selectedHospitalId && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Site notes: {hospitalNotesName ?? 'Hospital'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Notes from mentors, managers, and admins (also in CRM).
            </Typography>
            {hospitalNotes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No notes yet.
              </Typography>
            ) : (
              <List dense>
                {hospitalNotes.map((entry, i) => (
                  <ListItem key={i} alignItems="flex-start" sx={{ flexDirection: 'column', alignItems: 'stretch', py: 0.5 }}>
                    <Typography variant="caption" color="primary">
                      {entry.date}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {entry.text}
                    </Typography>
                    {i < hospitalNotes.length - 1 && <Divider sx={{ my: 1 }} />}
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {mentors.length} Mentors • {totalSites} Sites • {totalPeccs} PECCs
            </Typography>
            <Typography variant="body2">
              Average PECC checklist progress: {avgPeccProgress}% • Team hours this month: {teamHoursThisMonth.toFixed(1)}h
            </Typography>
          </Box>
          <Chip label={`${teamActivitiesThisMonth} activities this month`} color="primary" variant="outlined" />
        </Box>
      </Alert>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Total Mentors"
            value={mentors.length}
            icon={<PeopleIcon sx={{ fontSize: 32, color: 'primary.main' }} />}
            color="primary.main"
            caption="Under your management"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Sites"
            value={totalSites}
            icon={<HospitalIcon sx={{ fontSize: 32, color: 'success.main' }} />}
            color="success.main"
            caption="Hospitals being supported"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="PECCs"
            value={totalPeccs}
            icon={<GroupIcon sx={{ fontSize: 32, color: 'info.main' }} />}
            color="info.main"
            caption={`Avg progress ${avgPeccProgress}%`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Team Hours (Month)"
            value={teamHoursThisMonth.toFixed(1)}
            icon={<WorkIcon sx={{ fontSize: 32, color: 'warning.main' }} />}
            color="warning.main"
            caption={`${teamActivitiesThisMonth} activities • ${teamTotalHours.toFixed(1)}h total`}
          />
        </Grid>
      </Grid>

      {managerOwn.hasAssignments && (
        <Card sx={{ mb: 4, borderLeft: 4, borderColor: 'secondary.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  My Mentoring
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Your direct mentor work with PECCs at assigned hospitals.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip size="small" icon={<ActivityIcon />} label={`${managerOwn.totalActivities} activities`} />
                  <Chip size="small" icon={<TimelineIcon />} label={`${managerOwn.hoursTotal.toFixed(1)}h total`} />
                  <Chip size="small" label={`${managerOwn.hoursThisMonth.toFixed(1)}h this month`} color="primary" variant="outlined" />
                  <Chip size="small" label={`${managerOwn.lastMonthHours.toFixed(1)}h last month`} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Sites: {managerOwn.hospitalNames.join(', ') || 'None'}
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<ActivityIcon />} onClick={() => navigate('/manager/activities')}>
                My activities
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Mentors and Their Sites
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Expand a mentor to see sites and activity. Use View in CRM for contacts and hospital details.
          </Typography>

          {mentors.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No mentors found yet. Assign mentors to hospitals in the CRM, or ask an admin to link you as a secondary manager.
              </Typography>
              <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/manager/crm')}>
                Go to CRM
              </Button>
            </Box>
          ) : (
            <List>
              {mentors.map((mentor, index) => (
                <React.Fragment key={mentor.id}>
                  {index > 0 && <Divider />}
                  <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
                      onClick={() => setExpandedMentor(expandedMentor === mentor.id ? null : mentor.id)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {mentor.firstName.charAt(0)}
                          {mentor.lastName.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {mentor.firstName} {mentor.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {mentor.email}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Chip size="small" label={`${mentor.assignedHospitals.length} sites`} color="primary" variant="outlined" />
                        <Chip
                          size="small"
                          label={`${mentor.assignedHospitals.reduce((s, h) => s + h.peccCount, 0)} PECCs`}
                          color="secondary"
                          variant="outlined"
                        />
                        <Chip size="small" label={`${mentor.hoursThisMonth.toFixed(1)}h this month`} color="success" variant="outlined" />
                        <IconButton
                          size="small"
                          aria-label={expandedMentor === mentor.id ? 'Collapse' : 'Expand'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMentor(expandedMentor === mentor.id ? null : mentor.id);
                          }}
                        >
                          {expandedMentor === mentor.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                    </Box>
                    <Collapse in={expandedMentor === mentor.id} timeout="auto" unmountOnExit>
                      <Box sx={{ mt: 2, ml: { xs: 0, sm: 7 } }}>
                        {mentor.assignedHospitals.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            No sites assigned yet
                          </Typography>
                        ) : (
                          <Grid container spacing={2}>
                            {mentor.assignedHospitals.map((hospital) => (
                              <Grid item xs={12} md={6} key={hospital.id}>
                                <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'grey.50' }}>
                                  <Box>
                                    <Typography variant="body1" fontWeight={600}>
                                      {hospital.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {hospital.peccCount} PECC{hospital.peccCount !== 1 ? 's' : ''}
                                    </Typography>
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<ViewIcon />}
                                    onClick={() => navigate(`/manager/crm?hospital=${hospital.id}`)}
                                  >
                                    View in CRM
                                  </Button>
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        )}
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ color: 'info.contrastText' }}>
                            <strong>Total activities:</strong> {mentor.totalActivities} •{' '}
                            <strong>This month:</strong> {mentor.activitiesThisMonth} ({mentor.hoursThisMonth.toFixed(1)}h) •{' '}
                            <strong>Last activity:</strong>{' '}
                            {mentor.lastActivity ? format(new Date(mentor.lastActivity), 'MMM d, yyyy') : 'None'}
                          </Typography>
                        </Box>
                        <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/manager/mentors')}>
                          Open mentor detail
                        </Button>
                      </Box>
                    </Collapse>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default ManagerOverviewPage;
