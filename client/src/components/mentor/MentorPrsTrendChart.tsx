import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { REPORT_CHART_COLORS } from '../admin/AdminReportCharts';

export interface MentorPrsSeries {
  seriesKey: string;
  label: string;
  scores: Array<{ score: number; date: string }>;
}

interface MentorPrsTrendChartProps {
  series: MentorPrsSeries[];
  height?: number;
}

const CHART_H = 360;

export function MentorPrsTrendChart({ series, height = CHART_H }: MentorPrsTrendChartProps) {
  const useDateAxis = series.length === 1 && (series[0]?.scores.length ?? 0) > 0;

  const chartData = useMemo(() => {
    if (series.length === 0) return [];

    if (useDateAxis) {
      const primary = series[0];
      return primary.scores.map((point) => ({
        xLabel: format(new Date(point.date), 'MMM d, yyyy'),
        [primary.seriesKey]: point.score,
      }));
    }

    const maxLen = Math.max(...series.map((s) => s.scores.length), 0);
    return Array.from({ length: maxLen }, (_, index) => {
      const row: Record<string, string | number> = { xLabel: `PRS ${index + 1}` };
      series.forEach((s) => {
        const point = s.scores[index];
        if (point) row[s.seriesKey] = point.score;
      });
      return row;
    });
  }, [series, useDateAxis]);

  if (series.length === 0 || chartData.length === 0) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography color="text.secondary" variant="body2">
          No PRS assessment data to chart
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        height,
        '@media (prefers-reduced-motion: reduce)': {
          '& .recharts-line *': { transition: 'none !important' },
        },
      }}
      role="img"
      aria-label="Pediatric readiness score trends by hospital"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="xLabel" tick={{ fontSize: 11 }} interval={useDateAxis ? 'preserveStartEnd' : 0} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [`${value}`, 'PRS score']}
            labelFormatter={(label) => (useDateAxis ? String(label) : String(label))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, index) => (
            <Line
              key={s.seriesKey}
              type="monotone"
              dataKey={s.seriesKey}
              name={s.label}
              stroke={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default MentorPrsTrendChart;
