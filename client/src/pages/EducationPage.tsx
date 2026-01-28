import React, { useState } from 'react';
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
  Divider
} from '@mui/material';
import { Add as AddIcon, School as SchoolIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { ASSESSMENT_QUESTIONS } from './PRSPage';

interface EducationContent {
  question: string;
  why: string;
  background: string;
  example: string;
  sustainability: string;
  resources: string[];
}

const EDUCATION_CONTENT: Record<string, EducationContent> = {
  '22': {
    question: 'Does your ED have a physician/APP coordinator—sometimes referred to as a pediatric emergency care coordinator (PECC) or pediatric champion—who is assigned the role of overseeing various administrative aspects of pediatric emergency care (e.g., oversees quality improvement, collaborates with nursing, ensures pediatric skills of staff, develops and periodically reviews policies)?',
    why: 'A PECC ensures the ED maintains a consistent focus on pediatric-specific needs, promoting high quality and safe emergency care for children. PECCs drive system-wide improvements, protocol compliance, and advocacy for children at all care stages.',
    background: 'A PECC, often a physician champion, acts as a central figure driving pediatric quality and systems integration. Research demonstrates that EDs with a PECC achieve significantly higher pediatric readiness scores, which correlate with reduced pediatric mortality and better patient outcomes. The PECC role is endorsed by national organizations and is considered the foundation of a robust pediatric emergency care structure. The PECC facilitates multidisciplinary collaboration, supports ongoing education, and sustains improvement by coordinating QI projects, reviewing standards, and serving as a pediatric advocate within the ED and hospital.',
    example: 'The ED\'s physician PECC organizes pediatric simulation drills, reviews pediatric protocols regularly, and ensures ongoing pediatric staff training.',
    sustainability: 'Establish regular meetings with ED leadership and pediatric staff to align goals and review progress. Champion ongoing training and competency assessments for all staff. Develop a system for periodic review and updates of policies and pediatric guidelines. Foster collaboration with regional pediatric centers and networks for shared resources and mentorship.',
    resources: [
      'EIIC PECC Toolkit (https://emscimprovement.center/domains/pecc/)',
      'JAMA - PECC National Impact Study (https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2828228)',
      'LA Peds Ready Facility Guide (https://partnersforfamilyhealth.org/wp-content/uploads/2023/03/EMSC_PedReadyFacilityGuide-3_2023-3.pdf)'
    ]
  }
  // Add more education content for other questions as needed
};

const EducationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);

  const handleQuestionClick = (questionId: string) => {
    setSelectedQuestion(questionId);
    setEducationDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setEducationDialogOpen(false);
    setSelectedQuestion(null);
  };

  const handleAddGapPlan = (questionId: string) => {
    // TODO: Implement gap plan creation
    console.log('Add gap plan for question:', questionId);
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
                + Gap Plan
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const selectedEducationContent = selectedQuestion ? EDUCATION_CONTENT[selectedQuestion] : null;

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
                {selectedEducationContent.resources.map((resource, index) => (
                  <Typography key={index} variant="body2" sx={{ mb: 1 }}>
                    {resource}
                  </Typography>
                ))}
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
    </Container>
  );
};

export default EducationPage;
