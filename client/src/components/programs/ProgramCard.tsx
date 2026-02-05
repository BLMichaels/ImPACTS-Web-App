import React from 'react';
import { Card, CardContent, CardActionArea, Typography, Box, Chip, Avatar, Badge } from '@mui/material';
import { 
  School as ProgramIcon, 
  Campaign as AnnouncementIcon, 
  Group as GroupIcon,
  Schedule as ScheduleIcon 
} from '@mui/icons-material';
import { ProgramWithStats } from '../../types/database';
import { formatDistanceToNow, format } from 'date-fns';

interface ProgramCardProps {
  program: ProgramWithStats;
  onClick: () => void;
  showManagerBadge?: boolean;
}

export const ProgramCard: React.FC<ProgramCardProps> = ({ 
  program, 
  onClick,
  showManagerBadge = false
}) => {
  const hasUnreadAnnouncements = false; // Could be enhanced with read tracking

  return (
    <Card 
      sx={{ 
        height: '100%',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box display="flex" alignItems="flex-start" gap={2} mb={2}>
            <Badge
              color="error"
              variant="dot"
              invisible={!hasUnreadAnnouncements}
            >
              <Avatar sx={{ bgcolor: 'secondary.main', width: 48, height: 48 }}>
                <ProgramIcon />
              </Avatar>
            </Badge>
            <Box flex={1} minWidth={0}>
              <Typography variant="h6" component="h3" noWrap fontWeight="bold">
                {program.name}
              </Typography>
              {program.description && (
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {program.description}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Date Range */}
          {(program.start_date || program.end_date) && (
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <ScheduleIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {program.start_date && format(new Date(program.start_date), 'MMM d, yyyy')}
                {program.start_date && program.end_date && ' - '}
                {program.end_date && format(new Date(program.end_date), 'MMM d, yyyy')}
              </Typography>
            </Box>
          )}

          {/* Stats */}
          <Box display="flex" gap={2} mt="auto" pt={2}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <GroupIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {program.member_count || 0} members
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <AnnouncementIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {program.announcement_count || 0} announcements
              </Typography>
            </Box>
          </Box>

          {/* Badges */}
          <Box display="flex" gap={1} mt={2} flexWrap="wrap">
            {showManagerBadge && program.is_manager && (
              <Chip 
                label="Manager" 
                size="small" 
                color="primary"
                variant="outlined"
              />
            )}
            {program.cohort_count !== undefined && program.cohort_count > 0 && (
              <Chip 
                label={`${program.cohort_count} cohorts`} 
                size="small" 
                variant="outlined"
              />
            )}
            {!program.is_active && (
              <Chip 
                label="Inactive" 
                size="small" 
                color="default"
              />
            )}
          </Box>

          {/* Last Activity */}
          {program.last_activity_at && (
            <Typography variant="caption" color="text.secondary" mt={1}>
              Last activity {formatDistanceToNow(new Date(program.last_activity_at), { addSuffix: true })}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default ProgramCard;
