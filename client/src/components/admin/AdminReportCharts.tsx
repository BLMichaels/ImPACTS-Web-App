import React, { useState } from 'react';
import { Box, Typography, FormControlLabel, Switch, Stack } from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';

const CHART_H = 280;

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/** @internal */
export const REPORT_CHART_COLORS = [
  '#1976d2',
  '#9c27b0',
  '#2e7d32',
  '#ed6c02',
  '#d32f2f',
  '#0288d1',
  '#7b1fa2',
  '#c2185b',
];

interface PlatformPieProps {
  managers: number;
  mentors: number;
  peccs: number;
}

export function PlatformPeoplePieChart({ managers, mentors, peccs }: PlatformPieProps) {
  const data = [
    { name: 'Managers', value: managers },
    { name: 'Mentors', value: mentors },
    { name: 'PECCs', value: peccs },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No people counts to chart
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [v, 'Count']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface SitesBarProps {
  sites: number;
  contacts: number;
  activeAssignments: number;
  totalHospitals: number;
}

export function PlatformSitesBarChart({ sites, contacts, activeAssignments, totalHospitals }: SitesBarProps) {
  const data = [
    { name: 'Sites (assigned)', value: sites },
    { name: 'Hospitals (total)', value: totalHospitals },
    { name: 'CRM contacts', value: contacts },
    { name: 'Mentor–site links', value: activeAssignments },
  ];

  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
        <YAxis allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, '']} />
        <Bar dataKey="value" fill="#0288d1" radius={[4, 4, 0, 0]} barSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface ProgramRow {
  id: string;
  name: string;
  mentorCount: number;
  peccCount: number;
  sites: number;
}

export function ProgramBreakdownGroupedBar({ programs }: { programs: ProgramRow[] }) {
  const rows = programs.slice(0, 14).map((p) => ({
    name: truncate(p.name, 22),
    Mentors: p.mentorCount,
    PECCs: p.peccCount,
    Sites: p.sites,
  }));

  if (rows.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No program data
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_H + 40}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={90} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Mentors" fill={REPORT_CHART_COLORS[0]} />
        <Bar dataKey="PECCs" fill={REPORT_CHART_COLORS[1]} />
        <Bar dataKey="Sites" fill={REPORT_CHART_COLORS[2]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CohortBreakdownGroupedBar({ cohorts }: { cohorts: ProgramRow[] }) {
  const rows = cohorts.slice(0, 14).map((p) => ({
    name: truncate(p.name, 22),
    Mentors: p.mentorCount,
    PECCs: p.peccCount,
    Sites: p.sites,
  }));

  if (rows.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No cohort data
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_H + 40}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 64 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={90} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Mentors" fill={REPORT_CHART_COLORS[0]} />
        <Bar dataKey="PECCs" fill={REPORT_CHART_COLORS[1]} />
        <Bar dataKey="Sites" fill={REPORT_CHART_COLORS[2]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface DayCount {
  date: string;
  count: number;
}

export function UsageActivityVolumeChart({ byDay }: { byDay: DayCount[] }) {
  if (byDay.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No events in this period
        </Typography>
      </Box>
    );
  }

  const data = byDay.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));

  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="usageColor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1976d2" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis allowDecimals={false} />
        <Tooltip labelFormatter={(l) => `Date ${l}`} formatter={(v: number) => [v, 'Events']} />
        <Area type="monotone" dataKey="count" stroke="#1976d2" fillOpacity={1} fill="url(#usageColor)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface PageRow {
  path: string;
  count: number;
}

export function UsageTopPagesBar({ pages, pathLabel }: { pages: PageRow[]; pathLabel: (path: string) => string }) {
  const rows = pages.slice(0, 12).map((p) => ({
    name: truncate(pathLabel(p.path), 28),
    views: p.count,
  }));

  if (rows.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No page views
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(CHART_H, rows.length * 28)}>
      <BarChart layout="vertical" data={rows} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => [v, 'Views']} />
        <Bar dataKey="views" fill="#1976d2" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface RoleRow {
  name: string;
  value: number;
}

export function UsageUniqueLoginsPie({ byRole }: { byRole: RoleRow[] }) {
  const [showPercent, setShowPercent] = useState(false);
  const data = byRole.filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No login events in this period
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={<Switch size="small" checked={showPercent} onChange={(_, v) => setShowPercent(v)} />}
        label="Show slice as %"
      />
      <ResponsiveContainer width="100%" height={CHART_H}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={
              showPercent
                ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
                : ({ name, value }) => `${name}: ${value}`
            }
          >
          {data.map((_, i) => (
            <Cell key={i} fill={REPORT_CHART_COLORS[i % REPORT_CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [v, 'Unique users']} />
        <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Stack>
  );
}

interface EventTypeRow {
  name: string;
  value: number;
}

export function UsageEventTypesBar({ rows }: { rows: EventTypeRow[] }) {
  const data = rows.filter((r) => r.value > 0);

  if (data.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No events
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={70} />
        <YAxis allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, 'Events']} />
        <Bar dataKey="value" fill="#7b1fa2" radius={[4, 4, 0, 0]} barSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClicksByRoleBar({ byRole }: { byRole: RoleRow[] }) {
  const data = byRole.filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <Box sx={{ height: CHART_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary" variant="body2">
          No click events
        </Typography>
      </Box>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_H}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, 'Clicks']} />
        <Bar dataKey="value" fill="#ed6c02" radius={[4, 4, 0, 0]} barSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
