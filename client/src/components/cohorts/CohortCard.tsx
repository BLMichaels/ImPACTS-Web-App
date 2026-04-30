import React from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  Chip,
  Avatar,
  Badge
} from '@mui/material';
import {
  Group as GroupIcon,
  Campaign as AnnouncementIcon,
  Forum as DiscussionIcon,
  Schedule as ScheduleIcon,
  MenuBook as ResourcesIcon
} from '@mui/icons-material';
import { CohortWithStats } from '../../types/database';
import { formatDistanceToNow } from 'date-fns';

interface CohortCardProps {
  cohort: CohortWithStats;
  onClick: () => void;
}

const CohortCard: React.FC<CohortCardProps> = ({ cohort, onClick }) => {
  const hasUnread =
    (cohort.unread_announcements ?? 0) > 0 ||
    (cohort.unread_discussions ?? 0) > 0 ||
    (cohort.unread_resources ?? 0) > 0;
  
  const getLastActivityText = () => {
    if (!cohort.last_activity_at) return 'No activity yet';
    try {
      return `Last activity ${formatDistanceToNow(new Date(cohort.last_activity_at), { addSuffix: true })}`;
    } catch {
      return 'No activity yet';
    }
  };

  return (
    <Card 
      sx={{ 
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4
        },
        border: hasUnread ? '2px solid' : '1px solid',
        borderColor: hasUnread ? 'primary.main' : 'divider'
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header with avatar and name */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                width: 48, 
                height: 48,
                fontSize: '1.25rem'
              }}
            >
              {cohort.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
                {cohort.name}
              </Typography>
              {cohort.program_id && (
                <Chip 
                  label={cohort.program_id} 
                  size="small" 
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              )}
            </Box>
            {cohort.is_manager && (
              <Chip 
                label="Manager" 
                size="small" 
                color="secondary"
                sx={{ flexShrink: 0 }}
              />
            )}
          </Box>

          {/* Description */}
          {cohort.description && (
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: 2,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {cohort.description}
            </Typography>
          )}

          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {cohort.member_count} member{cohort.member_count !== 1 ? 's' : ''}
              </Typography>
            </Box>
            
            <Badge 
              badgeContent={cohort.unread_announcements || 0} 
              color="error"
              max={99}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AnnouncementIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {cohort.announcement_count}
                </Typography>
              </Box>
            </Badge>

            <Badge 
              badgeContent={cohort.unread_discussions || 0} 
              color="error"
              max={99}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DiscussionIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {cohort.topic_count}
                </Typography>
              </Box>
            </Badge>

            <Badge
              badgeContent={cohort.unread_resources || 0}
              color="error"
              max={99}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ResourcesIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {cohort.resource_count || 0}
                </Typography>
              </Box>
            </Badge>
          </Box>

          {/* Last activity */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2 }}>
            <ScheduleIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled">
              {getLastActivityText()}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default CohortCard;
