import React, { useMemo } from 'react';
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

export interface SnapshotHorizontalBarDatum {
  label: string;
  value: number;
  sublabel?: string;
}

interface SnapshotHorizontalBarChartProps {
  data: SnapshotHorizontalBarDatum[];
  valueLabel?: string;
  emptyMessage?: string;
  /** Minimum chart height; grows with row count for long category lists */
  minHeight?: number;
  rowHeight?: number;
}

export function SnapshotHorizontalBarChart({
  data,
  valueLabel = 'Count',
  emptyMessage = 'No data to display',
  minHeight = 280,
  rowHeight = 34,
}: SnapshotHorizontalBarChartProps) {
  const chartHeight = useMemo(
    () => Math.max(minHeight, data.length * rowHeight + 56),
    [data.length, minHeight, rowHeight]
  );

  const labelWidth = useMemo(() => {
    const longest = data.reduce((max, row) => Math.max(max, row.label.length), 0);
    return Math.min(320, Math.max(160, longest * 5.2));
  }, [data]);

  if (data.length === 0) {
    return (
      <Box sx={{ minHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const chartRows = data.map((d) => ({
    name: d.label,
    fullName: d.label,
    value: d.value,
    sublabel: d.sublabel,
  }));

  return (
    <Box sx={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartRows}
          margin={{ top: 8, right: 20, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth}
            tick={{ fontSize: 11, fill: '#374151' }}
            interval={0}
          />
          <Tooltip
            formatter={(value: number) => [value, valueLabel]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { fullName?: string; sublabel?: string } | undefined;
              if (!row) return '';
              return row.sublabel ? `${row.fullName} (${row.sublabel})` : row.fullName || '';
            }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
            {chartRows.map((_, index) => (
              <Cell key={index} fill={REPORT_CHART_COLORS[index % REPORT_CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default SnapshotHorizontalBarChart;
