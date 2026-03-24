/**
 * Single source for CRM contact type labels and colors (admin CRM, reports, exports).
 * Align with UserRole labels in roleUtils for people-type contacts where applicable.
 */

export type CrmContactTypeKey =
  | 'organization'
  | 'hospital'
  | 'system'
  | 'hiring_group'
  | 'manager'
  | 'mentor'
  | 'pecc'
  | 'staff'
  | 'other';

export const CRM_CONTACT_TYPE_LABELS: Record<CrmContactTypeKey, string> = {
  organization: 'Organization',
  hospital: 'Hospital',
  system: 'Hospital System',
  hiring_group: 'Hiring Group',
  manager: 'Manager',
  mentor: 'Mentor',
  pecc: 'PECC',
  staff: 'Staff',
  other: 'Other',
};

export const CRM_CONTACT_TYPE_COLORS: Record<CrmContactTypeKey, string> = {
  organization: '#2196f3',
  hospital: '#4caf50',
  system: '#2e7d32',
  hiring_group: '#1565c0',
  manager: '#9c27b0',
  mentor: '#ff9800',
  pecc: '#e91e63',
  staff: '#00bcd4',
  other: '#607d8b',
};

/** Normalize raw DB / report cell value to a display label. */
export function getCrmContactTypeLabel(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return '';
  const label = (CRM_CONTACT_TYPE_LABELS as Record<string, string>)[t];
  return label || String(raw).trim();
}

/**
 * Map CRM contact_type to a coarse users.role string for merged permission lists (pending CRM-only rows).
 * Non-user types (organization, system, hospital, etc.) map to pecc for grouping unless they are people types.
 */
export function crmContactTypeToListRole(contactType: string | null | undefined): string {
  const t = (contactType || 'pecc').toLowerCase();
  if (t === 'staff') return 'admin';
  if (['manager', 'mentor', 'pecc', 'admin'].includes(t)) return t;
  return 'pecc';
}
