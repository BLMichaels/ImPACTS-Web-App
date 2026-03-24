export const REPORT_RESTORE_STORAGE_KEY = (userId: string) => `impacts-report-restore-v1-${userId}`;
export const SAVED_REPORTS_STORAGE_KEY = (userId: string) => `impacts-saved-reports-v1-${userId}`;

/** Optional IDs for opening CRM / hospital views from report rows (not exported to CSV). */
export interface ReportRowLinkHints {
  userId?: string;
  crmContactId?: string;
  hospitalId?: string;
  hospitalContactId?: string;
}

export type ReportDatasetKey =
  | 'pecc'
  | 'hospital'
  | 'organization'
  | 'crm_system'
  | 'crm_hiring_group'
  | 'contacts'
  /** @deprecated Presets may still store "staff"; map to platform_users when loading. */
  | 'staff'
  | 'internal_staff'
  | 'managers'
  | 'mentors'
  | 'user_hospital_system'
  | 'user_hiring_group'
  | 'platform_users';

export type ColumnFilterOp = 'contains' | 'equals' | 'not_contains' | 'starts_with' | 'empty' | 'not_empty';

/** Per-column rules (AND). Saved with layouts and session restore. */
export interface ColumnFilterRule {
  id: string;
  columnId: string;
  op: ColumnFilterOp;
  value: string;
}

export interface ReportStateSnapshot {
  dataset: ReportDatasetKey;
  activityPreset: string;
  programFilter: string;
  cohortFilter: string;
  staffRoleFilter: string[];
  includePlatformAdminAccounts: boolean;
  search: string;
  stateFilter: string[];
  sortBy: string;
  sortDir: 'asc' | 'desc';
  columns: Record<string, boolean>;
  /** Column ids in left-to-right order. Omitted in older saved layouts; defaults to definition order. */
  columnOrder?: string[];
  /** Optional; older snapshots omit this. */
  columnFilters?: ColumnFilterRule[];
}

export interface SavedReportPreset {
  id: string;
  name: string;
  createdAt: string;
  snapshot: ReportStateSnapshot;
}

export type StaffReportScopeNav = 'admin' | 'manager' | 'mentor';

export function saveReportSnapshotForRestore(userId: string, snapshot: ReportStateSnapshot): void {
  try {
    sessionStorage.setItem(REPORT_RESTORE_STORAGE_KEY(userId), JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

export function readReportSnapshotRestore(userId: string): ReportStateSnapshot | null {
  try {
    const raw = sessionStorage.getItem(REPORT_RESTORE_STORAGE_KEY(userId));
    if (!raw) return null;
    return JSON.parse(raw) as ReportStateSnapshot;
  } catch {
    return null;
  }
}

export function clearReportSnapshotRestore(userId: string): void {
  try {
    sessionStorage.removeItem(REPORT_RESTORE_STORAGE_KEY(userId));
  } catch {
    /* ignore */
  }
}

export function loadSavedReportPresets(userId: string): SavedReportPreset[] {
  try {
    const raw = localStorage.getItem(SAVED_REPORTS_STORAGE_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedReportPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReportPreset(userId: string, preset: SavedReportPreset): void {
  const list = loadSavedReportPresets(userId).filter((p) => p.id !== preset.id);
  list.push(preset);
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  localStorage.setItem(SAVED_REPORTS_STORAGE_KEY(userId), JSON.stringify(list));
}

export function deleteSavedReportPreset(userId: string, presetId: string): void {
  const list = loadSavedReportPresets(userId).filter((p) => p.id !== presetId);
  localStorage.setItem(SAVED_REPORTS_STORAGE_KEY(userId), JSON.stringify(list));
}

/** Build in-app URL to open CRM / site detail from a report row. */
export function buildReportDetailHref(scope: StaffReportScopeNav, h: ReportRowLinkHints): string | null {
  const has = (s?: string) => s && s.length > 0;
  if (scope === 'admin') {
    if (has(h.crmContactId)) return `/admin/crm?openContact=${encodeURIComponent(h.crmContactId!)}`;
    if (has(h.userId)) return `/admin/crm?openUser=${encodeURIComponent(h.userId!)}`;
    if (has(h.hospitalContactId) && has(h.hospitalId)) {
      return `/admin/crm?openHospitalContact=${encodeURIComponent(h.hospitalContactId!)}&hospital=${encodeURIComponent(h.hospitalId!)}`;
    }
    if (has(h.hospitalId)) return `/admin/crm?openHospital=${encodeURIComponent(h.hospitalId!)}`;
    return null;
  }
  if (scope === 'manager') {
    if (has(h.hospitalContactId) && has(h.hospitalId)) {
      return `/manager/crm?hospital=${encodeURIComponent(h.hospitalId!)}&contact=${encodeURIComponent(h.hospitalContactId!)}`;
    }
    if (has(h.hospitalId)) return `/manager/crm?hospital=${encodeURIComponent(h.hospitalId!)}`;
    if (has(h.userId)) return `/manager/crm?openUser=${encodeURIComponent(h.userId!)}`;
    return null;
  }
  if (has(h.hospitalContactId) && has(h.hospitalId)) {
    return `/mentor/hospitals?hospital=${encodeURIComponent(h.hospitalId!)}&contact=${encodeURIComponent(h.hospitalContactId!)}`;
  }
  if (has(h.hospitalId)) return `/mentor/hospitals?hospital=${encodeURIComponent(h.hospitalId!)}`;
  if (has(h.userId)) return `/mentor/hospitals?user=${encodeURIComponent(h.userId!)}`;
  return null;
}
