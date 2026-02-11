import React, { useState, useEffect } from 'react';
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
  Chip,
  Divider,
  Link,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Add as AddIcon, School as SchoolIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ASSESSMENT_QUESTIONS } from './PRSPage';
import ScormPackagesSection from '../components/ScormPackagesSection';

interface EducationContent {
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

const EducationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
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
  
  // Load education content from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('education_questions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const contentMap: Record<string, EducationContent> = {};
          parsed.forEach((eq: any) => {
            contentMap[eq.questionId] = {
              question: eq.question,
              why: eq.why,
              background: eq.background,
              example: eq.example,
              sustainability: eq.sustainability,
              resources: eq.resources || []
            };
          });
          setEducationContent(contentMap);
        }
      } catch (e) {
        console.error('Error loading education content:', e);
      }
    }
  }, []);

  const handleQuestionClick = (questionId: string) => {
    setSelectedQuestion(questionId);
    setEducationDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEducationDialogOpen(false);
    setSelectedQuestion(null);
  };

  const handleAddGapPlan = (questionId: string) => {
    const question = ASSESSMENT_QUESTIONS.find(q => q.id === questionId);
    if (!question) return;
    
    // Check if gap plan already exists
    const existingGapPlans = currentUser?.uid 
      ? JSON.parse(localStorage.getItem(`gapPlans_${currentUser.uid}`) || '[]')
      : [];
    const existingPlan = existingGapPlans.find((plan: GapPlan) => plan.questionId === questionId);
    
    if (existingPlan) {
      // Navigate to gap plan page to edit
      navigate('/gap-plan');
      return;
    }
    
    // Open dialog to create new gap plan
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
  
  const handleSaveGapPlan = () => {
    if (!currentUser?.uid || !gapPlanQuestionId) return;
    
    const question = ASSESSMENT_QUESTIONS.find(q => q.id === gapPlanQuestionId);
    if (!question) return;
    
    if (!gapPlanFormData.action?.trim() || !gapPlanFormData.owner?.trim()) {
      alert('Please fill in "What is the action/plan to resolve?" and "Owner(s) Name" fields.');
      return;
    }
    
    // Load existing gap plans
    const existingGapPlans = JSON.parse(localStorage.getItem(`gapPlans_${currentUser.uid}`) || '[]');
    
    // Create new gap plan
    const newGapPlan: GapPlan = {
      id: Date.now().toString(),
      questionId: gapPlanQuestionId,
      questionText: question.text,
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
    
    // Save to localStorage
    const updatedPlans = [...existingGapPlans, newGapPlan];
    localStorage.setItem(`gapPlans_${currentUser.uid}`, JSON.stringify(updatedPlans));
    
    // Close dialog and navigate to gap plan page
    setGapPlanDialogOpen(false);
    setGapPlanQuestionId(null);
    navigate('/gap-plan');
  };

  const renderQuestionCard = (question: any) => {
    if (question.type === 'header') {
      return (
        <Box key={question.id} sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom color="primary">
            {question.text}
          </Typography>
          <Divider sx={{ mb: 2 }} />
        </Box>
      );
    }

    return (
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
              <Typography variant="h6" component="h3" sx={{ mb: 1, color: '#1976d2' }}>
                Question {question.id}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {question.text}
              </Typography>
              
              {question.options && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Options:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {question.options.map((option: string, index: number) => (
                      <Chip 
                        key={index} 
                        label={option} 
                        size="small" 
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SchoolIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuestionClick(question.id);
                }}
                sx={{ 
                  minWidth: 'auto',
                  px: 2
                }}
              >
                Learn More
              </Button>
              
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddGapPlan(question.id);
                }}
                sx={{ 
                  minWidth: 'auto',
                  px: 2,
                  backgroundColor: '#4caf50',
                  '&:hover': {
                    backgroundColor: '#45a049'
                  }
                }}
              >
                Gap Plan
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const selectedEducationContent = selectedQuestion ? educationContent[selectedQuestion] : null;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h3" component="h1" gutterBottom color="primary">
        Pediatric Readiness Education
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
        Click on any question below to learn more about pediatric emergency care readiness requirements, 
        best practices, and implementation strategies.
      </Typography>

      {ASSESSMENT_QUESTIONS
        .filter(question => {
          // Start with question 22, remove questions 1-21
          const questionNumber = parseInt(question.id);
          if (questionNumber >= 1 && questionNumber <= 21) {
            return false;
          }
          
          // Remove questions 79-82
          if (questionNumber >= 79 && questionNumber <= 82) {
            return false;
          }
          
          return true;
        })
        .map(renderQuestionCard)}

      <ScormPackagesSection title="SCORM learning modules" />

      {/* Education Dialog */}
      <Dialog 
        open={educationDialogOpen} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ color: '#1976d2', fontWeight: 'bold' }}>
          Question {selectedQuestion}
        </DialogTitle>
        <DialogContent>
          {selectedEducationContent ? (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Question:
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {selectedEducationContent.question}
              </Typography>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#2e7d32' }}>
                Why:
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {selectedEducationContent.why}
              </Typography>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1976d2' }}>
                Background:
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {selectedEducationContent.background}
              </Typography>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#f57c00' }}>
                Example:
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {selectedEducationContent.example}
              </Typography>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#7b1fa2' }}>
                Sustainability Practices for PECC:
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                {selectedEducationContent.sustainability}
              </Typography>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#d32f2f' }}>
                Additional Resources:
              </Typography>
              <Box sx={{ mb: 2 }}>
                {selectedEducationContent.resources.map((resource, index) => {
                  const parsed = parseResource(resource);
                  const url = formatUrl(parsed.url);
                  return (
                    <Box key={index} sx={{ mb: 1 }}>
                      {url ? (
                        <Link
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="body2"
                          sx={{ 
                            display: 'inline-block',
                            color: 'primary.main',
                            textDecoration: 'underline',
                            '&:hover': {
                              color: 'primary.dark'
                            }
                          }}
                        >
                          {parsed.title || resource}
                        </Link>
                      ) : (
                        <Typography variant="body2">
                          {parsed.title || resource}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
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
                Question: {ASSESSMENT_QUESTIONS.find(q => q.id === gapPlanQuestionId)?.text}
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
