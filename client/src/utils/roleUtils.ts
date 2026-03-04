/**
 * Shared role display utilities - single source for colors and labels.
 */
import { UserRole } from '../types/database';

const ROLE_HEX: Record<string, string> = {
  admin: '#1976d2',
  manager: '#9c27b0',
  mentor: '#ff9800',
  pecc: '#2196f3',
  hospital_system: '#4caf50',
  hiring_group: '#795548'
};

const ROLE_MUI: Record<string, 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error' | 'default'> = {
  admin: 'error',
  manager: 'secondary',
  mentor: 'warning',
  pecc: 'info',
  hospital_system: 'success',
  hiring_group: 'default'
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  mentor: 'Mentor',
  pecc: 'PECC',
  hospital_system: 'Hospital System',
  hiring_group: 'Hiring Group'
};

/** Hex color for role (for sx bgcolor, etc.) */
export function getRoleColorHex(role?: string | null): string {
  if (!role) return '#757575';
  const r = String(role).toLowerCase();
  return ROLE_HEX[r] || '#757575';
}

/** MUI theme color name for Chip/Avatar color prop */
export function getRoleMuiColor(role?: string | null): 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error' | 'default' {
  if (!role) return 'default';
  const r = String(role).toLowerCase();
  return ROLE_MUI[r] || 'default';
}

/** Display label for role */
export function getRoleLabel(role?: UserRole | string | null): string {
  if (!role) return 'Unknown';
  const r = String(role).toLowerCase();
  return ROLE_LABELS[r] || r.charAt(0).toUpperCase() + r.slice(1);
}
