import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip
} from '@mui/material';
import { Add as AddIcon, School as SchoolIcon, Assignment as AssignmentIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUsageAnalytics } from '../context/UsageAnalyticsContext';
import { supabase } from '../supabase';
import { getUserData, setUserData, migrateFromLocalStorage } from '../utils/userData';
import ScormPackagesSection from '../components/ScormPackagesSection';

interface EducationContent {
  category?: string;
  notes?: string;
  question: string;
  why: string;
  background: string;
  example: string;
  sustainability: string;
  resources: string[];
}

interface GapPlan {
  id: string;
  questionId: string;
  questionText: string;
  action: string;
  owner: string;
  status: 'In Progress' | 'Needs Update' | 'Need to Develop' | 'Cannot be done at this time' | 'Completed' | '';
  priority: 'High Importance & High Urgency (Do Now)' | 'High Importance & Low Urgency (Do Next)' | 'Low Importance & High Urgency (Do Later)' | 'Low Importance & Low Urgency (Do Last)' | '';
  difficulty: 'Low Impact & Low Effort (Filler Tasks)' | 'Low Impact & High Effort (Hard Slogs)' | 'High Impact & Low Effort (Quick Wins)' | 'High Impact & High Effort (Big Projects)' | '';
  notes: string;
  dueDate: string;
  completionDate: string;
  rank: number | '';
  attachments: any[];
}

// Parse resource string to extract title and URL
const parseResource = (resource: string): { title: string; url: string } => {
  // Format: "Title (URL)" or just "URL"
  const match = resource.match(/^(.+?)\s*\((.+?)\)$/);
  if (match) {
    return { title: match[1].trim(), url: match[2].trim() };
  }
  // If no parentheses, check if it's a URL
  if (resource.startsWith('http://') || resource.startsWith('https://')) {
    return { title: resource, url: resource };
  }
  // Otherwise, treat as title only
  return { title: resource, url: '' };
};

// Format URL to ensure it's clickable
const formatUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

// Check if HTML/rich text has any visible content (strip tags and trim)
const hasHtmlContent = (html: string | undefined): boolean =>
  Boolean(html && (html.replace(/<[^>]*>/g, '').trim().length > 0));

export const GAP_PLANS_UPDATED_EVENT = 'impacts:gapPlansUpdated';

interface EducationPageProps {
  onGapPlanSaved?: () => void;
  /** When set, only show questions in this category (for Gap Plan page accordions). */
  categoryFilter?: string;
}

const EducationPage: React.FC<EducationPageProps> = ({ onGapPlanSaved, categoryFilter }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { trackLinkClick } = useUsageAnalytics();
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  const [gapPlansRefreshKey, setGapPlansRefreshKey] = useState(0);
  const [educationContent, setEducationContent] = useState<Record<string, EducationContent>>({});
  const [gapPlanDialogOpen, setGapPlanDialogOpen] = useState(false);
  const [gapPlanQuestionId, setGapPlanQuestionId] = useState<string | null>(null);
  const [gapPlanFormData, setGapPlanFormData] = useState<Partial<GapPlan>>({
    action: '',
    owner: '',
    status: '',
    priority: '',
    difficulty: '',
    notes: '',
    dueDate: '',
    completionDate: '',
    rank: '',
    attachments: []
  });
  const [gapPlansList, setGapPlansList] = useState<GapPlan[]>([]);
  
  // Load education content from Supabase (app_settings) so it syncs across devices
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'education_questions').maybeSingle();
      if (!mounted) return;
      const parsed = (data as { value?: unknown } | null)?.value;
      if (parsed != null && Array.isArray(parsed) && parsed.length > 0) {
        const contentMap: Record<string, EducationContent> = {};
        (parsed as any[]).forEach((eq: any) => {
          contentMap[eq.questionId] = {
            category: eq.category ?? '',
            notes: eq.notes ?? '',
            question: eq.question ?? '',
            why: eq.why ?? '',
            background: eq.background ?? '',
            example: eq.example ?? '',
            sustainability: eq.sustainability ?? '',
            resources: eq.resources || []
          };
        });
        setEducationContent(contentMap);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const onGapPlansUpdated = () => setGapPlansRefreshKey((k) => k + 1);
    window.addEventListener(GAP_PLANS_UPDATED_EVENT, onGapPlansUpdated);
    return () => window.removeEventListener(GAP_PLANS_UPDATED_EVENT, onGapPlansUpdated);
  }, []);

  const userId = currentUser?.uid ?? (currentUser as { id?: string })?.id;
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      let plans = await getUserData<GapPlan[]>(userId, 'gapPlans');
      if (plans == null || !Array.isArray(plans)) {
        await migrateFromLocalStorage(userId, 'gapPlans', `gapPlans_${userId}`, (raw) => {
          if (mounted) setGapPlansList(Array.isArray(raw) ? raw : []);
        });
        return;
      }
      if (mounted) setGapPlansList(plans);
    })();
    return () => { mounted = false; };
  }, [userId, gapPlansRefreshKey]);

  const handleQuestionClick = (questionId: string) => {
    setSelectedQuestion(questionId);
    setEducationDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEducationDialogOpen(false);
    setSelectedQuestion(null);
  };

  const handleAddGapPlan = (questionId: string) => {
    if (!questionId) return;

    // Always open the Create Gap Plan dialog for this question (user can add multiple plans per question)
    setGapPlanQuestionId(questionId);
    setGapPlanFormData({
      action: '',
      owner: '',
      status: '',
      priority: '',
      difficulty: '',
      notes: '',
      dueDate: '',
      completionDate: '',
      rank: '',
      attachments: []
    });
    setGapPlanDialogOpen(true);
  };
  
  const handleSaveGapPlan = async () => {
    if (!userId || !gapPlanQuestionId) return;

    if (!gapPlanFormData.action?.trim() || !gapPlanFormData.owner?.trim()) {
      alert('Please fill in "What is the action/plan to resolve?" and "Owner(s) Name" fields.');
      return;
    }

    const content = educationContent[gapPlanQuestionId];
    const questionText = content?.question || `Question ${gapPlanQuestionId}`;

    const newGapPlan: GapPlan = {
      id: Date.now().toString(),
      questionId: gapPlanQuestionId,
      questionText,
      action: gapPlanFormData.action || '',
      owner: gapPlanFormData.owner || '',
      status: gapPlanFormData.status || '',
      priority: gapPlanFormData.priority || '',
      difficulty: gapPlanFormData.difficulty || '',
      notes: gapPlanFormData.notes || '',
      dueDate: gapPlanFormData.dueDate || '',
      completionDate: gapPlanFormData.completionDate || '',
      rank: gapPlanFormData.rank || '',
      attachments: gapPlanFormData.attachments || []
    };

    const updatedPlans = [...gapPlansList, newGapPlan];
    await setUserData(userId, 'gapPlans', updatedPlans);
    setGapPlansList(updatedPlans);

    onGapPlanSaved?.();
    window.dispatchEvent(new CustomEvent(GAP_PLANS_UPDATED_EVENT));

    setGapPlanDialogOpen(false);
    setGapPlanQuestionId(null);
    navigate('/gap-plan');
  };

  // All gap plans for current user (from Supabase; filtered to real gap plans only)
  const allGapPlans = useMemo(() => {
    return gapPlansList.filter((p: any) => p && typeof p.questionId !== 'undefined' && typeof p.action === 'string');
  }, [gapPlansList]);

  // Only show actual gap plans (have questionId + action), not activity-shaped items
  const gapPlansForSelectedQuestion = useMemo(() => {
    if (!selectedQuestion) return [];
    return (allGapPlans as GapPlan[]).filter(
      (p) =>
        p &&
        String(p.questionId) === String(selectedQuestion) &&
        typeof (p as any).action === 'string'
    );
  }, [selectedQuestion, allGapPlans]);

  // Build list from Admin education settings only (no pre-canned questions)
  const educationQuestionList = Object.entries(educationContent)
    .map(([questionId, content]) => ({
      id: questionId,
      text: content.question,
      category: content.category ?? '',
      notes: content.notes ?? '',
      gapPlanCount: (allGapPlans as GapPlan[]).filter(
        (p) => p && String(p.questionId) === String(questionId) && typeof (p as any).action === 'string'
      ).length
    }))
    .filter((q) => !categoryFilter || q.category === categoryFilter)
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const renderQuestionCard = (question: { id: string; text: string; category: string; notes: string; gapPlanCount: number }) => (
    <Card
      key={question.id}
      sx={{
        mb: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3
        }
      }}
      onClick={() => handleQuestionClick(question.id)}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h3" sx={{ mb: 0.5, color: '#1976d2' }}>
              {question.category?.trim() ? question.category : `Question ${question.id}`}
            </Typography>
            {question.notes?.trim() ? (
              <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {question.notes}
              </Typography>
            ) : null}
            {question.gapPlanCount > 0 && (
              <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                {question.gapPlanCount} gap plan{question.gapPlanCount !== 1 ? 's' : ''} for this question
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1, ml: 2, flexShrink: 0 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SchoolIcon />}
              onClick={(e) => {
                e.stopPropagation();
                trackLinkClick(`/gap-plan?q=${question.id}`, 'Learn More', 'education_card');
                handleQuestionClick(question.id);
              }}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Learn More
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                trackLinkClick('/gap-plan', 'Gap Plan', 'education_card');
                handleAddGapPlan(question.id);
              }}
              sx={{
                minWidth: 'auto',
                px: 2,
                backgroundColor: '#4caf50',
                '&:hover': { backgroundColor: '#45a049' }
              }}
            >
              Gap Plan
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const selectedEducationContent = selectedQuestion ? educationContent[selectedQuestion] : null;

  return (
    <Container maxWidth="lg" sx={{ py: categoryFilter ? 2 : 4 }}>
      {!categoryFilter && (
        <>
          <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
            Click on any question below to learn more about pediatric emergency care readiness requirements,
            best practices, and implementation strategies.
          </Typography>
        </>
      )}

      {educationQuestionList.map(renderQuestionCard)}

      {educationQuestionList.length === 0 && (
        <Alert severity="info" sx={{ mt: 4 }}>
          <Typography variant="body1" gutterBottom>
            {categoryFilter ? 'No questions in this section yet.' : 'No education content available yet.'}
          </Typography>
          <Typography variant="body2">
            {categoryFilter
              ? 'Add questions in Admin Settings → Gap Closure and assign them to this category.'
              : 'Education content must be configured in Admin Settings → Gap Closure tab before it can be displayed here.'}
          </Typography>
        </Alert>
      )}

      {!categoryFilter && <ScormPackagesSection title="SCORM learning modules" placement="education" />}

      {/* Education Dialog */}
      <Dialog 
        open={educationDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: '#1976d2', fontWeight: 'bold' }}>
          {selectedEducationContent?.category?.trim()
            ? `Question ${selectedQuestion}: ${selectedEducationContent.category}`
            : `Question ${selectedQuestion}`}
        </DialogTitle>
        <DialogContent>
          {selectedEducationContent ? (
            <Box>
              {selectedEducationContent.question?.trim() ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Assessment Question:
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 3 }}>
                    {selectedEducationContent.question}
                  </Typography>
                </>
              ) : null}

              {hasHtmlContent(selectedEducationContent.why) ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#2e7d32' }}>
                    Why:
                  </Typography>
                  <Box
                    sx={{ mb: 3, '& ul, & ol': { pl: 3 }, '& li': { mb: 1 }, '& a': { color: 'primary.main', textDecoration: 'underline' }, '& strong': { fontWeight: 'bold' }, '& em': { fontStyle: 'italic' }, '& u': { textDecoration: 'underline' } }}
                    dangerouslySetInnerHTML={{ __html: selectedEducationContent.why }}
                  />
                </>
              ) : null}

              {hasHtmlContent(selectedEducationContent.background) ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                    Background:
                  </Typography>
                  <Box
                    sx={{ mb: 3, '& ul, & ol': { pl: 3 }, '& li': { mb: 1 }, '& a': { color: 'primary.main', textDecoration: 'underline' }, '& strong': { fontWeight: 'bold' }, '& em': { fontStyle: 'italic' }, '& u': { textDecoration: 'underline' } }}
                    dangerouslySetInnerHTML={{ __html: selectedEducationContent.background }}
                  />
                </>
              ) : null}

              {hasHtmlContent(selectedEducationContent.example) ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#f57c00' }}>
                    Example:
                  </Typography>
                  <Box
                    sx={{ mb: 3, '& ul, & ol': { pl: 3 }, '& li': { mb: 1 }, '& a': { color: 'primary.main', textDecoration: 'underline' }, '& strong': { fontWeight: 'bold' }, '& em': { fontStyle: 'italic' }, '& u': { textDecoration: 'underline' } }}
                    dangerouslySetInnerHTML={{ __html: selectedEducationContent.example }}
                  />
                </>
              ) : null}

              {hasHtmlContent(selectedEducationContent.sustainability) ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#7b1fa2' }}>
                    Sustainability Practices for PECC:
                  </Typography>
                  <Box
                    sx={{ mb: 3, '& ul, & ol': { pl: 3 }, '& li': { mb: 1 }, '& a': { color: 'primary.main', textDecoration: 'underline' }, '& strong': { fontWeight: 'bold' }, '& em': { fontStyle: 'italic' }, '& u': { textDecoration: 'underline' } }}
                    dangerouslySetInnerHTML={{ __html: selectedEducationContent.sustainability }}
                  />
                </>
              ) : null}

              {selectedEducationContent.resources?.length > 0 && selectedEducationContent.resources.some((r) => r && String(r).trim()) ? (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#d32f2f' }}>
                    Additional Resources:
                  </Typography>
                  <Box component="ul" sx={{ mb: 2, pl: 3, m: 0, listStyle: 'disc', '& li': { mb: 0.5 } }}>
                    {selectedEducationContent.resources.filter((r) => r && String(r).trim()).map((resource, index) => {
                      const parsed = parseResource(resource);
                      const url = formatUrl(parsed.url);
                      const linkBlue = '#0000EE';
                      return (
                        <Box component="li" key={index}>
                          {url ? (
                            <Link
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="body2"
                              sx={{
                                color: linkBlue,
                                textDecoration: 'underline',
                                '&:hover': { color: '#551A8B' }
                              }}
                            >
                              {parsed.title || resource}
                            </Link>
                          ) : (
                            <Typography variant="body2" component="span" sx={{ color: linkBlue }}>
                              {parsed.title || resource}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </>
              ) : null}

              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 'bold', color: '#1565c0', display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon fontSize="small" />
                Gap Plans for this question:
              </Typography>
              {gapPlansForSelectedQuestion.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No gap plans yet. Use &quot;Gap Plan&quot; on the card or add one from the Gap Closure & Education table.
                </Typography>
              ) : (
                <Box sx={{ mb: 2 }}>
                  {gapPlansForSelectedQuestion.map((plan) => (
                    <Box
                      key={plan.id}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'action.hover'
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{plan.action}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        <Chip size="small" label={plan.owner || '—'} variant="outlined" />
                        {plan.status ? <Chip size="small" label={plan.status} color="primary" variant="outlined" /> : null}
                        {plan.priority ? <Chip size="small" label={plan.priority} variant="outlined" /> : null}
                      </Box>
                    </Box>
                  ))}
                  <Button size="small" variant="outlined" onClick={() => { handleCloseDialog(); navigate('/gap-plan'); }} sx={{ mt: 1 }}>
                    View all on Gap Closure & Education
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Typography variant="body1" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              Educational content for this question is coming soon. Please check back later.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Gap Plan Creation Dialog */}
      <Dialog open={gapPlanDialogOpen} onClose={() => setGapPlanDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Create Gap Plan for Question {gapPlanQuestionId}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Question: {gapPlanQuestionId
                  ? (educationContent[gapPlanQuestionId]?.question || `Question ${gapPlanQuestionId}`)
                  : ''}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="What is the action/plan to resolve?"
                multiline
                rows={3}
                value={gapPlanFormData.action || ''}
                onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, action: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Owner(s) Name"
                value={gapPlanFormData.owner || ''}
                onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, owner: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={gapPlanFormData.status || ''}
                  label="Status"
                  onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, status: e.target.value as GapPlan['status'] })}
                >
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Needs Update">Needs Update</MenuItem>
                  <MenuItem value="Need to Develop">Need to Develop</MenuItem>
                  <MenuItem value="Cannot be done at this time">Cannot be done at this time</MenuItem>
                  <MenuItem value="Completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={gapPlanFormData.priority || ''}
                  label="Priority"
                  onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, priority: e.target.value as GapPlan['priority'] })}
                >
                  <MenuItem value="High Importance & High Urgency (Do Now)">High Importance & High Urgency (Do Now)</MenuItem>
                  <MenuItem value="High Importance & Low Urgency (Do Next)">High Importance & Low Urgency (Do Next)</MenuItem>
                  <MenuItem value="Low Importance & High Urgency (Do Later)">Low Importance & High Urgency (Do Later)</MenuItem>
                  <MenuItem value="Low Importance & Low Urgency (Do Last)">Low Importance & Low Urgency (Do Last)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={gapPlanFormData.difficulty || ''}
                  label="Difficulty"
                  onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, difficulty: e.target.value as GapPlan['difficulty'] })}
                >
                  <MenuItem value="Low Impact & Low Effort (Filler Tasks)">Low Impact & Low Effort (Filler Tasks)</MenuItem>
                  <MenuItem value="Low Impact & High Effort (Hard Slogs)">Low Impact & High Effort (Hard Slogs)</MenuItem>
                  <MenuItem value="High Impact & Low Effort (Quick Wins)">High Impact & Low Effort (Quick Wins)</MenuItem>
                  <MenuItem value="High Impact & High Effort (Big Projects)">High Impact & High Effort (Big Projects)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                value={gapPlanFormData.dueDate || ''}
                onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {gapPlanFormData.status === 'Completed' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Completion Date"
                  type="date"
                  value={gapPlanFormData.completionDate || ''}
                  onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, completionDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes (ex. Progress? Where did you get this information? Link to resource? Equipment location, etc.)"
                multiline
                rows={3}
                value={gapPlanFormData.notes || ''}
                onChange={(e) => setGapPlanFormData({ ...gapPlanFormData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGapPlanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveGapPlan} variant="contained" color="primary">
            Create Gap Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default EducationPage;
