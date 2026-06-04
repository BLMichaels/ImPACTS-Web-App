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
  ReferenceDot,
} from 'recharts';

export interface ReadinessScorePoint {
  id?: string;
  date: string;
  score: number;
  isLive?: boolean;
}

interface PeccReadinessTrendChartProps {
  scores: ReadinessScorePoint[];
  liveScore?: number | null;
  height?: number;
}

export function PeccReadinessTrendChart({
  scores,
  liveScore = null,
  height = 360,
}: PeccReadinessTrendChartProps) {
  const chartData = useMemo(() => {
    const rows: Array<{ xLabel: string; score: number; isLive?: boolean }> = scores.map((s) => ({
      xLabel: format(new Date(s.date), 'MMM d, yy'),
      score: s.score,
      isLive: s.isLive,
    }));

    const today = new Date().toISOString().split('T')[0];
    const hasToday = rows.some((r) => r.xLabel === format(new Date(today), 'MMM d, yy'));
    if (liveScore != null && !hasToday) {
      rows.push({
        xLabel: 'Today (live)',
        score: liveScore,
        isLive: true,
      });
    }

    return rows;
  }, [scores, liveScore]);

  if (chartData.length < 2) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Log at least two readiness assessments to see a trend line.
        </Typography>
      </Box>
    );
  }

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <Box sx={{ width: '100%', height }} role="img" aria-label="Readiness score trend over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="xLabel" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip formatter={(value: number) => [`${value}%`, 'Score']} />
          <Line
            type="monotone"
            dataKey="score"
            name="Readiness"
            stroke="#1976d2"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#1976d2' }}
            activeDot={{ r: 6 }}
            isAnimationActive={!reducedMotion}
          />
          {chartData.map((row, index) =>
            row.isLive ? (
              <ReferenceDot
                key={`live-${index}`}
                x={row.xLabel}
                y={row.score}
                r={6}
                fill="#ed6c02"
                stroke="#fff"
                strokeWidth={2}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default PeccReadinessTrendChart;
