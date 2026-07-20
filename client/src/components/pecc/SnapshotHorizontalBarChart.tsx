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

function wrapLabel(text: string, maxCharsPerLine: number, maxLines = 2): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = current ? `${current} ${word}` : word;
    const isLastLine = lines.length >= maxLines - 1;

    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }

    if (!isLastLine) {
      if (current) lines.push(current);
      current = word;
      continue;
    }

    // Final line: fit what we can and ellipsize if more words remain
    const rest = [word, ...words.slice(i + 1)].join(' ');
    const combined = current ? `${current} ${rest}` : rest;
    if (combined.length <= maxCharsPerLine) {
      current = combined;
    } else {
      const base = current || combined;
      current = `${base.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`;
    }
    break;
  }

  if (current) lines.push(current);
  return lines;
}

/** Compact wrapped Y-axis tick so long labels don't reserve a huge left gutter. */
function WrappedCategoryTick({
  x = 0,
  y = 0,
  payload,
  width,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  width: number;
}) {
  const maxChars = Math.max(12, Math.floor(width / 6.2));
  const lines = wrapLabel(String(payload?.value || ''), maxChars, 2);
  const lineHeight = 12;
  const startY = y - ((lines.length - 1) * lineHeight) / 2 + 3;

  return (
    <text x={x - 4} y={startY} textAnchor="end" fill="#374151" fontSize={10.5}>
      {lines.map((line, i) => (
        <tspan key={i} x={x - 4} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function SnapshotHorizontalBarChart({
  data,
  valueLabel = 'Count',
  emptyMessage = 'No data to display',
  minHeight = 280,
  rowHeight = 38,
}: SnapshotHorizontalBarChartProps) {
  const chartHeight = useMemo(
    () => Math.max(minHeight, data.length * rowHeight + 48),
    [data.length, minHeight, rowHeight]
  );

  // Keep Y-axis compact so bars use most of the width; full labels stay in the tooltip.
  const labelWidth = useMemo(() => {
    const longest = data.reduce((max, row) => Math.max(max, row.label.length), 0);
    if (longest <= 18) return 108;
    if (longest <= 32) return 132;
    return 148;
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
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth}
            interval={0}
            tick={<WrappedCategoryTick width={labelWidth} />}
            tickLine={false}
            axisLine={false}
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
