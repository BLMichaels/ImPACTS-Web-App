// Database types for Supabase

// ============================================
// ENUMS
// ============================================

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  MENTOR = 'mentor',  // Previously PRISM
  PECC = 'pecc',
  HOSPITAL_SYSTEM = 'hospital_system',
  HIRING_GROUP = 'hiring_group'
}

const USER_ROLE_VALUES = Object.values(UserRole) as string[];

/** Normalize role from DB (may be mixed case or invalid) to UserRole. Use for display and comparisons. */
export function normalizeUserRole(role: unknown): UserRole {
  if (role == null) return UserRole.PECC;
  const s = String(role).trim().toLowerCase();
  if (USER_ROLE_VALUES.includes(s)) return s as UserRole;
  if (s === 'prism') return UserRole.MENTOR;
  return UserRole.PECC;
}

export enum TraumaLevel {
  LEVEL_I = 'Level I',
  LEVEL_II = 'Level II',
  LEVEL_III = 'Level III',
  LEVEL_IV = 'Level IV',
  CRITICAL_ACCESS = 'Critical Access',
  NON_DESIGNATED = 'Non-Designated',
  FREESTANDING_ED = 'Free-Standing ED'
}

export enum ContactStatus {
  ED_EMPLOYEE = 'ED Employee (general contact)',
  PEDIATRIC_CHAMPION = 'Pediatric Champion (NOT A PECC)',
  NEW_PECC = 'New PECC',
  ALREADY_PECC = 'Already a PECC'
}

export enum ActivityCategory {
  PE = 'PE - PRISM Education & Training',
  TR = 'TR - Training with PECC',
  AD = 'AD - General Administration Tasks',
  RA = 'RA - Readiness Assessment',
  SC = 'SC - Simulation Case Facilitation',
  DM = 'DM - Domain Implementation'
}

/** Default activity categories for mentor/PECC logging (single source from ActivityCategory) */
export const DEFAULT_ACTIVITY_CATEGORIES = Object.entries(ActivityCategory).map(([value, label]) => ({ value, label }));

export enum SimulationCase {
  BRONCHIOLITIS = 'Bronchiolitis/Respiratory Distress',
  SEVERE_HEAD_TRAUMA = 'Severe Head Trauma',
  ASTHMA = 'Asthma/Child with a Wheeze',
  NEWBORN_RESUSCITATION = 'Newborn Resuscitation',
  POSTPARTUM_HEMORRHAGE = 'Postpartum Hemorrhage',
  SCALD_BURN = 'Scald Burn',
  AGITATION = 'Agitation',
  VOMITING_INFANT = 'Vomiting Infant',
  FUSSY_BABY = 'Fussy Baby',
  PEDIATRIC_TRAUMA = 'Pediatric Trauma/Abdominal',
  SICK_NEONATE = 'Sick Neonate',
  SEIZING_INFANT = 'Seizing Infant',
  SEIZING_CHILD = 'Seizing Child',
  ANAPHYLAXIS = 'Anaphylaxis',
  ALTERED_MENTAL_STATUS = 'Altered Mental Status',
  OTHER = 'Other'
}

/** Simulation case display strings for activity logging dropdowns (single source from SimulationCase) */
export const SIMULATION_CASE_OPTIONS = Object.values(SimulationCase);

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

// ============================================
// CORE TABLES
// ============================================

// Users table - extends Supabase auth.users
export interface User {
  id: string;  // UUID from auth.users
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_admin?: boolean;  // If true, user has admin access in addition to their role (multiple roles)
  created_at: string;
  updated_at: string;
  last_login: string | null;

  // Role-specific foreign keys
  manager_id: string | null;  // For mentors - who manages them
  mentor_id: string | null;   // For PECCs - who mentors them
  manager_id_for_pecc?: string | null;  // For PECCs - direct manager assignment (bypasses mentor)
  primary_program_id?: string | null;   // Which program's logo to show in navbar (user can be in multiple programs)
}

// Hospitals/Organizations table
export interface Hospital {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  trauma_level: TraumaLevel;
  ed_size: string | null;
  region: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes: string | null;
}

// Hospital Contacts - CRM for all contacts at hospitals
export interface HospitalContact {
  id: string;
  hospital_id: string;
  user_id: string | null;  // Link to users table if they have an account
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  contact_status: ContactStatus;
  role_at_hospital: string | null;  // Their job title
  is_primary_contact: boolean;
  is_actively_engaged: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Mentor-Hospital assignments (which hospitals each mentor works with)
export interface MentorHospitalAssignment {
  id: string;
  mentor_id: string;
  hospital_id: string;
  assigned_at: string;
  assigned_by: string;  // Manager or Admin who assigned
  is_active: boolean;
}

// Invitations - for sending registration links
export interface Invitation {
  id: string;
  code: string;  // Unique invitation code
  email: string;
  role: UserRole;
  status: InvitationStatus;
  
  // Context for the invitation
  hospital_id: string | null;  // For PECC invitations
  mentor_id: string | null;    // For PECC invitations - who will mentor them
  manager_id: string | null;   // For Mentor invitations - who will manage them
  
  invited_by: string;  // User ID of who sent the invite
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;  // User ID of who accepted
}

// ============================================
// ACTIVITY TRACKING
// ============================================

// Mentor Activities
export interface MentorActivity {
  id: string;
  mentor_id: string;
  date: string;
  activity_name: string;
  category: ActivityCategory;
  hours: number;  // In quarter-hour increments (0.25, 0.5, 0.75, 1, etc.)
  description: string | null;  // Required for activities with PECCs
  hospital_ids: string[];  // Which hospitals this activity was with
  
  // Simulation-specific fields (only for SC category)
  simulation_case: SimulationCase | null;
  sim_participants: number | null;
  facilitator_feedback_submitted: boolean;
  participant_feedback_submitted: boolean;
  
  created_at: string;
  updated_at: string;
}

// PECC nav tab keys (for per-site visibility and shared page)
export const PECC_TAB_KEYS = ['activities', 'snapshot', 'milestones', 'education', 'gap-plan', 'simulation'] as const;
export type PeccTabKey = typeof PECC_TAB_KEYS[number];

// Site tab visibility: which PECC tabs are shown for a given hospital/site
export interface SiteTabVisibility {
  site_id: string;
  tab_key: string;
  visible: boolean;
  updated_at: string;
}

// Site members: users who share access to one site (hospital) PECC page
export interface SiteMember {
  site_id: string;
  user_id: string;
  added_at: string;
}

// PECC Activities (existing structure + attribution for shared sites)
export interface PeccActivity {
  id: string;
  pecc_id: string;
  hospital_id: string;
  date: string;
  activity_type: string;
  hours: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  submitted_by?: string | null;  // User who submitted (for per-person hours when multiple people share site)
}

// ============================================
// ROLE PERMISSIONS (Admin-controlled)
// ============================================

export interface RolePermission {
  id: string;
  role: UserRole;
  permission_key: string;  // e.g., 'view_activities', 'manage_hospitals'
  is_enabled: boolean;
  updated_by: string;  // Admin who last changed this
  updated_at: string;
}

// Available permissions
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_AGGREGATED_DATA: 'view_aggregated_data',
  
  // Activities
  VIEW_OWN_ACTIVITIES: 'view_own_activities',
  VIEW_TEAM_ACTIVITIES: 'view_team_activities',
  VIEW_ALL_ACTIVITIES: 'view_all_activities',
  MANAGE_OWN_ACTIVITIES: 'manage_own_activities',
  
  // Hospitals
  VIEW_OWN_HOSPITALS: 'view_own_hospitals',
  VIEW_ALL_HOSPITALS: 'view_all_hospitals',
  MANAGE_HOSPITALS: 'manage_hospitals',
  
  // Contacts (CRM)
  VIEW_CONTACTS: 'view_contacts',
  MANAGE_CONTACTS: 'manage_contacts',
  
  // User Management
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  SEND_INVITATIONS: 'send_invitations',
  
  // PRS & Gap Plans
  VIEW_PRS: 'view_prs',
  VIEW_GAP_PLANS: 'view_gap_plans',
  
  // Milestones & Simulations
  VIEW_MILESTONES: 'view_milestones',
  VIEW_SIMULATIONS: 'view_simulations',
  
  // Wages & Expenses
  VIEW_OWN_WAGES: 'view_own_wages',
  VIEW_TEAM_WAGES: 'view_team_wages',
  MANAGE_WAGES: 'manage_wages',
  
  // Snapshots & Reports
  VIEW_SNAPSHOT: 'view_snapshot',
  EXPORT_DATA: 'export_data',
  
  // Admin
  MANAGE_PERMISSIONS: 'manage_permissions',
  SYSTEM_SETTINGS: 'system_settings',
  
  // Cohorts
  VIEW_COHORTS: 'view_cohorts',
  MANAGE_COHORTS: 'manage_cohorts',
  COHORT_INVITE: 'cohort_invite',
  COHORT_ANNOUNCE: 'cohort_announce',
  COHORT_MODERATE: 'cohort_moderate',
  
  // Programs
  VIEW_PROGRAMS: 'view_programs',
  MANAGE_PROGRAMS: 'manage_programs',
  PROGRAM_ANNOUNCE: 'program_announce'
} as const;

// Default permissions by role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: Object.values(PERMISSIONS),  // All permissions
  
  [UserRole.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_AGGREGATED_DATA,
    PERMISSIONS.VIEW_OWN_ACTIVITIES,
    PERMISSIONS.VIEW_TEAM_ACTIVITIES,
    PERMISSIONS.MANAGE_OWN_ACTIVITIES,
    PERMISSIONS.VIEW_OWN_HOSPITALS,
    PERMISSIONS.VIEW_ALL_HOSPITALS,
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.MANAGE_CONTACTS,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.SEND_INVITATIONS,
    PERMISSIONS.VIEW_PRS,
    PERMISSIONS.VIEW_GAP_PLANS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_SIMULATIONS,
    PERMISSIONS.VIEW_OWN_WAGES,
    PERMISSIONS.VIEW_TEAM_WAGES,
    PERMISSIONS.MANAGE_WAGES,
    PERMISSIONS.VIEW_SNAPSHOT,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_COHORTS,
    PERMISSIONS.MANAGE_COHORTS,
    PERMISSIONS.COHORT_INVITE,
    PERMISSIONS.COHORT_ANNOUNCE,
    PERMISSIONS.COHORT_MODERATE,
    PERMISSIONS.VIEW_PROGRAMS,
    PERMISSIONS.MANAGE_PROGRAMS,
    PERMISSIONS.PROGRAM_ANNOUNCE
  ],
  
  [UserRole.MENTOR]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_AGGREGATED_DATA,
    PERMISSIONS.VIEW_OWN_ACTIVITIES,
    PERMISSIONS.VIEW_TEAM_ACTIVITIES,
    PERMISSIONS.MANAGE_OWN_ACTIVITIES,
    PERMISSIONS.VIEW_OWN_HOSPITALS,
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.MANAGE_CONTACTS,
    PERMISSIONS.SEND_INVITATIONS,
    PERMISSIONS.VIEW_PRS,
    PERMISSIONS.VIEW_GAP_PLANS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_SIMULATIONS,
    PERMISSIONS.VIEW_OWN_WAGES,
    PERMISSIONS.VIEW_SNAPSHOT,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.VIEW_COHORTS,
    PERMISSIONS.COHORT_INVITE,  // Can invite PECCs (needs approval)
    PERMISSIONS.VIEW_PROGRAMS
  ],
  
  [UserRole.PECC]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_OWN_ACTIVITIES,
    PERMISSIONS.MANAGE_OWN_ACTIVITIES,
    PERMISSIONS.VIEW_OWN_HOSPITALS,
    PERMISSIONS.VIEW_PRS,
    PERMISSIONS.VIEW_GAP_PLANS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_SIMULATIONS,
    PERMISSIONS.VIEW_SNAPSHOT,
    PERMISSIONS.VIEW_COHORTS,
    PERMISSIONS.VIEW_PROGRAMS
  ],

  [UserRole.HOSPITAL_SYSTEM]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_OWN_HOSPITALS,
    PERMISSIONS.VIEW_PRS,
    PERMISSIONS.VIEW_GAP_PLANS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_SIMULATIONS,
    PERMISSIONS.VIEW_SNAPSHOT,
    PERMISSIONS.VIEW_AGGREGATED_DATA,
    PERMISSIONS.VIEW_COHORTS,
    PERMISSIONS.VIEW_PROGRAMS
  ],

  [UserRole.HIRING_GROUP]: [
    PERMISSIONS.VIEW_SNAPSHOT,
    PERMISSIONS.VIEW_OWN_HOSPITALS
  ]
};

// ============================================
// WAGES & EXPENSES (placeholder for later)
// ============================================

export interface WageEntry {
  id: string;
  user_id: string;
  pay_period_start: string;
  pay_period_end: string;
  hours_worked: number;
  hourly_rate: number;
  stipend_amount: number;
  total_amount: number;
  status: 'pending' | 'approved' | 'paid';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// SITE MILESTONES (placeholder for later)
// ============================================

export interface SiteMilestone {
  id: string;
  hospital_id: string;
  milestone_name: string;
  description: string | null;
  target_date: string | null;
  completed_date: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  assigned_to: string | null;  // User ID
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Admin-configurable PECC registration questions
export type RegistrationQuestionType =
  | 'short_answer'
  | 'paragraph'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'select'
  | 'number'
  | 'email'
  | 'phone';

/** "Show only when" logic: show this question when another answer matches. */
export interface RegistrationQuestionDisplayCondition {
  question_id: string;
  operator: 'equals' | 'not_empty' | 'in';
  value?: string | string[];  // for "in", use string[]; for "equals", use string
}

export interface RegistrationQuestion {
  id: string;
  label: string;
  question_type: RegistrationQuestionType;
  required: boolean;
  options: string[];
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  /** Which roles see this question: ['pecc','mentor','manager']. Empty/null = all. */
  target_roles?: string[] | null;
  /** Show only when the referenced question's answer satisfies the operator/value. */
  display_condition?: RegistrationQuestionDisplayCondition | null;
  /** If set, answer is written to users / CRM: first_name, last_name, phone, email, job_title, department, hospital_system, nprqi_participant, additional_contact_*, or hospital (CRM picker). */
  linked_crm_field?: string | null;
  /** Show this question only when invite/context includes one of these program IDs. Null/empty = show for all. */
  target_program_ids?: string[] | null;
  /** Show this question only when invite/context includes one of these cohort IDs. Null/empty = show for all. */
  target_cohort_ids?: string[] | null;
  /** When true, show this question's answer in CRM contact view (from registration_answers). Used for "Create new CRM field". */
  display_in_crm?: boolean;
}

// ============================================
// COHORTS
// ============================================

export enum CohortMemberStatus {
  ACTIVE = 'active',
  PENDING_APPROVAL = 'pending_approval',
  REMOVED = 'removed'
}

export enum CohortInvitationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// Main cohort entity
export interface Cohort {
  id: string;
  name: string;
  description: string | null;
  program_id: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Cohort membership
export interface CohortMember {
  id: string;
  cohort_id: string;
  user_id: string;
  added_by: string | null;
  status: CohortMemberStatus;
  added_at: string;
  // Joined fields from users table
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
  };
}

// Manager assignment to cohort
export interface CohortManager {
  id: string;
  cohort_id: string;
  manager_id: string;
  assigned_by: string | null;
  assigned_at: string;
  // Joined fields from users table
  manager?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

// Announcement in a cohort
export interface CohortAnnouncement {
  id: string;
  cohort_id: string;
  title: string;
  content: string;
  created_by: string | null;
  is_pinned: boolean;
  visible_until?: string | null; // DATE: hide after this date; null = show until removed
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Resource/education item in a cohort (managers and admins can add; everyone sees below discussions)
export interface CohortResource {
  id: string;
  cohort_id: string;
  title: string;
  content: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Discussion topic in a cohort
export interface CohortDiscussionTopic {
  id: string;
  cohort_id: string;
  title: string;
  content: string | null;
  draft_content?: string | null;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
  created_by: string | null;
  is_locked: boolean;
  is_pinned: boolean;
  reply_count: number;
  last_reply_at: string | null;
  last_reply_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    id: string;
    first_name: string;
    last_name: string;
    role: UserRole;
  };
  last_replier?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Reply to a discussion topic
export interface CohortDiscussionReply {
  id: string;
  topic_id: string;
  content: string;
  draft_content?: string | null;
  attachments?: Array<{ name: string; url: string; type: string; size?: number }>;
  created_by: string | null;
  edited_at: string | null;
  created_at: string;
  // Joined fields
  author?: {
    id: string;
    first_name: string;
    last_name: string;
    role: UserRole;
  };
}

// Invitation for mentor-initiated PECC invites
export interface CohortInvitation {
  id: string;
  cohort_id: string;
  user_id: string;
  invited_by: string | null;
  status: CohortInvitationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  invited_at: string;
  // Joined fields
  cohort?: {
    id: string;
    name: string;
  };
  invitee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
  };
  inviter?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Read status tracking for unread indicators
export interface CohortReadStatus {
  id: string;
  user_id: string;
  cohort_id: string;
  last_read_announcements: string | null;
  last_read_discussions: string | null;
  updated_at: string;
}

// Extended cohort with computed fields for UI
export interface CohortWithStats extends Cohort {
  member_count: number;
  announcement_count: number;
  topic_count: number;
  unread_announcements?: number;
  unread_discussions?: number;
  last_activity_at?: string;
  is_manager?: boolean;  // Whether current user manages this cohort
}

// ============================================
// GRANULAR PERMISSIONS
// ============================================

// User-specific permission override
export interface UserPermission {
  id: string;
  user_id: string;
  permission_key: string;
  is_enabled: boolean;
  granted_by: string | null;
  granted_at: string;
  updated_at: string;
}

// Cohort-specific permission (applies to user or role)
export interface CohortPermission {
  id: string;
  cohort_id: string;
  user_id: string | null;
  role: UserRole | null;
  permission_key: string;
  is_enabled: boolean;
  granted_by: string | null;
  granted_at: string;
  updated_at: string;
}

// Program-specific permission (applies to user or role)
export interface ProgramPermission {
  id: string;
  program_id: string;
  user_id: string | null;
  role: UserRole | null;
  permission_key: string;
  is_enabled: boolean;
  granted_by: string | null;
  granted_at: string;
  updated_at: string;
}

// Tab/view visibility control
export interface ViewTab {
  id: string;
  user_id: string | null;
  cohort_id: string | null;
  program_id: string | null;
  tab_key: string;
  is_visible: boolean;
  granted_by: string | null;
  granted_at: string;
  updated_at: string;
}

// ============================================
// PROGRAMS
// ============================================

export enum ProgramMemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REMOVED = 'removed'
}

// Main program entity
export interface Program {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  logo_url?: string | null;  // Public URL of program logo (navbar branding)
}

// Program membership
export interface ProgramMember {
  id: string;
  program_id: string;
  user_id: string;
  added_by: string | null;
  status: ProgramMemberStatus;
  added_at: string;
  // Joined fields from users table
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
  };
}

// Manager assignment to program
export interface ProgramManager {
  id: string;
  program_id: string;
  manager_id: string;
  assigned_by: string | null;
  assigned_at: string;
  // Joined fields
  manager?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: UserRole;
  };
}

// Program announcements
export interface ProgramAnnouncement {
  id: string;
  program_id: string;
  title: string;
  content: string;
  created_by: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: {
    id: string;
    first_name: string;
    last_name: string;
    role: UserRole;
  };
}

// Extended program with computed fields for UI
export interface ProgramWithStats extends Program {
  member_count: number;
  announcement_count: number;
  cohort_count?: number;
  last_activity_at?: string;
  is_manager?: boolean;  // Whether current user manages this program
}
