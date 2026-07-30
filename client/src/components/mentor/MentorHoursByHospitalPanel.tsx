import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
} from '@mui/material';
import type { MentorHoursRollup } from '../../utils/mentorHoursByHospital';

interface MentorHoursByHospitalPanelProps {
  rollups: MentorHoursRollup[];
  unlinkedHours?: number;
  caption?: string;
  emptyMessage?: string;
}

export function MentorHoursByHospitalPanel({
  rollups,
  unlinkedHours = 0,
  caption = 'Hours from your mentoring log linked to each hospital',
  emptyMessage = 'Link activities to hospitals on the Activities page to see hours per site.',
}: MentorHoursByHospitalPanelProps) {
  const maxHours = Math.max(...rollups.map((r) => r.totalHours), 0);
  const hasAny = rollups.some((r) => r.totalHours > 0) || unlinkedHours > 0;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        {caption}
      </Typography>
      {!hasAny ? (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      ) : (
        <Box sx={{ mt: 1 }}>
          {rollups
            .filter((r) => r.totalHours > 0 || r.hoursThisMonth > 0)
            .sort((a, b) => b.totalHours - a.totalHours)
            .map((row) => {
              const pct = maxHours > 0 ? (row.totalHours / maxHours) * 100 : 0;
              return (
                <Box key={row.hospitalId} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ maxWidth: '70%' }}>
                      {row.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {row.totalHours.toFixed(1)}h total
                      {row.hoursThisMonth > 0 ? ` · ${row.hoursThisMonth.toFixed(1)}h this month` : ''}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    color="secondary"
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {row.activityCount} linked activit{row.activityCount === 1 ? 'y' : 'ies'}
                  </Typography>
                </Box>
              );
            })}
          {unlinkedHours > 0 && (
            <Alert severity="info" sx={{ mt: 2 }} variant="outlined">
              {unlinkedHours.toFixed(1)} hours logged without a hospital link. Edit activities to assign a site.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
}

export default MentorHoursByHospitalPanel;
