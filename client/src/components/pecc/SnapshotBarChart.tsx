import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { REPORT_CHART_COLORS } from '../admin/AdminReportCharts';

export interface SnapshotBarDatum {
  label: string;
  value: number;
  sublabel?: string;
}

interface SnapshotBarChartProps {
  data: SnapshotBarDatum[];
  valueLabel?: string;
  height?: number;
  emptyMessage?: string;
}

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

export function SnapshotBarChart({
  data,
  valueLabel = 'Count',
  height = 300,
  emptyMessage = 'No data to display',
}: SnapshotBarChartProps) {
  if (data.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const chartRows = data.map((d) => ({
    name: truncate(d.label, 28),
    fullName: d.label,
    value: d.value,
    sublabel: d.sublabel,
  }));

  const bottomMargin = Math.min(120, Math.max(56, Math.ceil(data.length / 3) * 18));

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows} margin={{ top: 8, right: 16, left: 4, bottom: bottomMargin }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#4b5563' }}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={bottomMargin - 8}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: number) => [value, valueLabel]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { fullName?: string; sublabel?: string } | undefined;
              if (!row) return '';
              return row.sublabel ? `${row.fullName} (${row.sublabel})` : row.fullName || '';
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartRows.map((_, index) => (
              <Cell key={index} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default SnapshotBarChart;
