import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  Button,
  Chip,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useNavigate } from 'react-router-dom';

interface GapPlan {
  id: string;
  questionId: string;
  questionText: string;
  action: string;
  owner: string;
  status: string;
  priority: string;
  difficulty: string;
  notes: string;
  dueDate: string;
  completionDate: string;
  rank: number | '';
  attachments: any[];
}

interface GapPlanReminder {
  id: string;
  questionId: string;
  questionText: string;
  action: string;
  dueDate: string;
  daysUntilDue: number;
  status: string;
}

const GapPlanReminderBanner: React.FC = () => {
  const { currentUser } = useAuth();
  const { userProfile } = useUserProfile();
  const navigate = useNavigate();
  const [gapPlans, setGapPlans] = useState<GapPlan[]>([]);
  const [reminders, setReminders] = useState<GapPlanReminder[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (currentUser?.uid && userProfile.tier === 'PECC') {
      loadGapPlans();
    }
  }, [currentUser?.uid, userProfile.tier]);

  useEffect(() => {
    if (gapPlans.length > 0) {
      generateReminders();
    }
  }, [gapPlans]);

  const loadGapPlans = () => {
    try {
      const savedPlans = localStorage.getItem(`gapPlans_${currentUser?.uid}`);
      if (savedPlans) {
        const parsedPlans = JSON.parse(savedPlans);
        setGapPlans(parsedPlans);
      }
    } catch (err) {
      console.error('Error loading gap plans:', err);
    }
  };

  const generateReminders = () => {
    if (!userProfile || userProfile.tier !== 'PECC') return;

    const reminderSettings = (userProfile as any).gapPlanReminders;
    if (!reminderSettings?.enabled) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const reminderDays = reminderSettings.reminderDays || 7;
    
    const newReminders = gapPlans
      .filter(plan => {
        // Only show reminders for active plans (not completed)
        if (plan.status === 'Completed' || !plan.dueDate) return false;
        
        const dueDate = new Date(plan.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        // Show reminders for plans due within the configured days
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue >= -1 && daysUntilDue <= reminderDays; // -1 means overdue, 0-reminderDays means due soon
      })
      .map(plan => {
        const dueDate = new Date(plan.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: plan.id,
          questionId: plan.questionId,
          questionText: plan.questionText,
          action: plan.action,
          dueDate: plan.dueDate,
          daysUntilDue,
          status: plan.status
        };
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue); // Sort by urgency (overdue first, then by days until due)

    setReminders(newReminders);
  };

  const formatDate = (dateString: string) => {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (err) {
      return dateString;
    }
  };

  const getUrgencyColor = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return 'error'; // Overdue
    if (daysUntilDue === 0) return 'warning'; // Due today
    if (daysUntilDue <= 3) return 'warning'; // Due soon
    return 'info'; // Due later
  };

  const getUrgencyText = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue} days`;
  };

  // Don't show banner if no reminders or reminders disabled
  if (reminders.length === 0 || !(userProfile as any)?.gapPlanReminders?.enabled) {
    return null;
  }

  return (
    <Box sx={{ mt: 4 }}>
      <Alert 
        severity="warning" 
        sx={{ 
          mb: 3,
          '& .MuiAlert-message': { width: '100%' }
        }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => navigate('/account')}
              startIcon={<SettingsIcon />}
            >
              Settings
            </Button>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              color="inherit"
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        }
      >
        <Box sx={{ width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningIcon />
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              ⏰ Gap Plan Due Date Reminders
            </Typography>
            <Chip 
              label={`${reminders.length} reminder${reminders.length > 1 ? 's' : ''}`}
              size="small"
              color="warning"
              variant="outlined"
            />
          </Box>
          
          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              {reminders.map((reminder, index) => (
                <Box 
                  key={reminder.id} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    mb: 1, 
                    p: 1, 
                    bgcolor: 'rgba(255, 255, 255, 0.1)', 
                    borderRadius: 1 
                  }}
                >
                  <Chip 
                    label={reminder.questionId}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ minWidth: 60 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {reminder.questionText}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {reminder.action}
                    </Typography>
                  </Box>
                  <Chip 
                    label={getUrgencyText(reminder.daysUntilDue)}
                    size="small"
                    color={getUrgencyColor(reminder.daysUntilDue) as any}
                    variant="filled"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(reminder.dueDate)}
                  </Typography>
                </Box>
              ))}
              
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button 
                  variant="outlined" 
                  size="small" 
                  onClick={() => navigate('/gap-plan')}
                  color="inherit"
                >
                  View All Gap Plans
                </Button>
              </Box>
            </Box>
          </Collapse>
          
          {!expanded && (
            <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
              {reminders.slice(0, 2).map((reminder, index) => (
                <span key={reminder.id}>
                  {index > 0 && ', '}
                  {reminder.questionText} - {getUrgencyText(reminder.daysUntilDue)}
                </span>
              ))}
              {reminders.length > 2 && ` ...and ${reminders.length - 2} more`}
            </Typography>
          )}
        </Box>
      </Alert>
    </Box>
  );
};

export default GapPlanReminderBanner;
