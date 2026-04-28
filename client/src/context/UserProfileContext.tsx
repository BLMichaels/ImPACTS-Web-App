import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';
import { UserRole, normalizeUserRole, DEFAULT_ROLE_PERMISSIONS, PECC_TAB_KEYS } from '../types/database';
import { normalizeHospitalOrOrgName } from '../utils/displayName';
import { getUserData } from '../utils/userData';
import { resolveNavbarProgramLogo } from '../utils/resolveNavbarProgramLogo';

// Re-export UserRole as UserTier for backward compatibility
export { UserRole as UserTier } from '../types/database';

// User profile from database
export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  is_admin?: boolean;  // If true, user has admin access in addition to their primary role
  created_at: string;
  updated_at: string;
  last_login: string | null;
  manager_id: string | null;
  mentor_id: string | null;

  // Computed/joined fields
  hospital_name?: string;
  mentor_name?: string;
  manager_name?: string;
  hospital_facility_id?: string | null;  // PECC's site (hospital); matches CRM contact id
  
  // Mentor-specific fields
  wages_enabled?: boolean;  // If true, mentor can see wages tab (admin-controlled)
  primary_program_id?: string | null;  // Which program's logo to show in navbar
  // From user_data (Account page): gap plan reminder preferences for PECCs
  gapPlanReminders?: { enabled?: boolean; emailNotifications?: boolean; reminderDays?: number; emailFrequency?: string };
}

interface UserProfileContextType {
  userProfile: UserProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  isLoading: boolean;
  userRole: UserRole;
  actualRole: UserRole; // The user's real role (for admins using "View As")
  /** True when the signed-in user has platform admin privileges (role admin or is_admin). Not affected by "view as" profile swap. */
  hasAdminAccess: boolean;
  hasPermission: (permission: string) => boolean;
  hasPermissionInScope: (permission: string, cohortId?: string, programId?: string) => Promise<boolean>;
  permissions: string[];
  refreshProfile: () => Promise<void>;
  // Admin "View As" feature
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  isViewingAs: boolean;
  // View as specific user (Admin, Manager, or Mentor) – see app and data as that user
  viewAsUserId: string | null;
  viewAsUserProfile: UserProfile | null;
  enterViewAsUser: (userId: string) => Promise<{ ok: boolean; dashboardPath?: string }>;
  clearViewAsUser: () => void;
  isViewingAsUser: boolean;
  /** When viewing as another user, use this for data load/save; otherwise current user id. */
  effectiveUserId: string | undefined;
  // PECC site and tab visibility (page = hospital/site; tabs toggled in CRM)
  siteId: string | null;
  visibleTabs: string[];  // Tab keys that are visible for this PECC's site; empty = all visible
  /** Logo URL for the user's primary program (for navbar). Null = use default ImPACTS logo. */
  primaryProgramLogoUrl: string | null;
  /** Program id used for navbar logo + dashboard branding (resolved primary or membership). */
  navbarBrandProgramId: string | null;
  mentorWorkMode: 'mentor' | 'pecc';
  canToggleMentorWorkMode: boolean;
  setMentorWorkMode: (mode: 'mentor' | 'pecc') => void;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};

interface UserProfileProviderProps {
  children: ReactNode;
}

export const UserProfileProvider: React.FC<UserProfileProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsUserProfile, setViewAsUserProfile] = useState<UserProfile | null>(null);
  const [viewAsSiteId, setViewAsSiteId] = useState<string | null>(null);
  const [viewAsVisibleTabs, setViewAsVisibleTabs] = useState<string[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [visibleTabs, setVisibleTabs] = useState<string[]>([]);
  const [primaryProgramLogoUrl, setPrimaryProgramLogoUrl] = useState<string | null>(null);
  const [navbarBrandProgramId, setNavbarBrandProgramId] = useState<string | null>(null);
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>({});
  const [viewAsPermissionOverrides, setViewAsPermissionOverrides] = useState<Record<string, boolean>>({});
  const [mentorWorkMode, setMentorWorkModeState] = useState<'mentor' | 'pecc'>(() => {
    try {
      const saved = localStorage.getItem('impacts_mentor_work_mode');
      return saved === 'pecc' ? 'pecc' : 'mentor';
    } catch {
      return 'mentor';
    }
  });
  const [mentorPeccSiteId, setMentorPeccSiteId] = useState<string | null>(null);
  const [mentorPeccVisibleTabs, setMentorPeccVisibleTabs] = useState<string[]>([...PECC_TAB_KEYS]);
  // Guard against out-of-order async updates when rapidly switching "view as" users.
  const latestViewAsUserIdRef = useRef<string | null>(null);
  const logoFetchSeqRef = useRef(0);
  const userProfileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const createDefaultProfile = useCallback(() => {
    if (!currentUser) return;

    const defaultProfile: UserProfile = {
      id: currentUser.id,
      email: currentUser.email || '',
      first_name: 'User',
      last_name: '',
      phone: null,
      role: UserRole.PECC,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      manager_id: null,
      mentor_id: null
    };

    setUserProfile(defaultProfile);
    setPermissions(DEFAULT_ROLE_PERMISSIONS[UserRole.PECC]);
    setPermissionOverrides({});
    setSiteId(null);
    setVisibleTabs([...PECC_TAB_KEYS]);
    setMentorPeccSiteId(null);
    setMentorPeccVisibleTabs([...PECC_TAB_KEYS]);
  }, [currentUser]);

  const setMentorWorkMode = useCallback((mode: 'mentor' | 'pecc') => {
    setMentorWorkModeState(mode);
    try {
      localStorage.setItem('impacts_mentor_work_mode', mode);
    } catch {
      // Ignore localStorage failures
    }
  }, []);

  // Fetch user profile from Supabase
  const fetchUserProfile = useCallback(async () => {
    if (!currentUser) {
      setUserProfile(null);
      setPermissions([]);
      setPermissionOverrides({});
      setViewAsPermissionOverrides({});
      setSiteId(null);
      setVisibleTabs([]);
      setPrimaryProgramLogoUrl(null);
      setNavbarBrandProgramId(null);
      setMentorPeccSiteId(null);
      setMentorPeccVisibleTabs([...PECC_TAB_KEYS]);
      setIsLoading(false);
      return;
    }

    try {
      // First try to get from Supabase
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        console.error(
          '[UserProfile] Profile fetch failed. You may see PECC instead of your real role. Error:',
          error.code,
          error.message,
          '— Ensure public.users has a row where id = your Auth User UID (Supabase → Authentication → Users).'
        );
        // If no profile exists yet (new user), check user_data then localStorage for legacy data
        const { getUserData } = await import('../utils/userData');
        let savedProfile: string | null = null;
        const cached = await getUserData<Record<string, unknown>>(currentUser.uid || currentUser.id, 'userProfile_cache');
        if (cached && typeof cached === 'object') savedProfile = JSON.stringify(cached);
        if (!savedProfile) savedProfile = localStorage.getItem(`userProfile_${currentUser.uid || currentUser.id}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            // Convert legacy profile to new format
            const legacyRole =
              parsed.role === 'admin' || parsed.tier === 'admin'
                ? UserRole.ADMIN
                : parsed.tier === 'PRISM'
                  ? UserRole.MENTOR
                  : UserRole.PECC;
            const legacyProfile: UserProfile = {
              id: currentUser.id,
              email: currentUser.email || '',
              first_name: parsed.firstName || 'User',
              last_name: parsed.lastName || '',
              phone: parsed.phone || null,
              role: legacyRole,
              is_active: true,
              created_at: parsed.createdAt || new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_login: new Date().toISOString(),
              manager_id: null,
              mentor_id: null,
              hospital_name: parsed.hospitalName
            };
            setUserProfile(legacyProfile);
            
            // Set permissions based on role
            const rolePermissions = DEFAULT_ROLE_PERMISSIONS[legacyProfile.role] || [];
            setPermissions(rolePermissions);
          } catch {
            // Create default profile
            createDefaultProfile();
          }
        } else {
          // Create default profile
          createDefaultProfile();
        }
      } else if (profile) {
        const prof = profile as UserProfile & { hospital_facility_id?: string | null; primary_program_id?: string | null };
        const normalizedRole = normalizeUserRole(prof.role);
        setUserProfile({ ...prof, role: normalizedRole });

        // Fetch permissions from database
        const { data: perms } = await supabase
          .from('role_permissions')
          .select('permission_key')
          .eq('role', normalizedRole)
          .eq('is_enabled', true);

        if (perms) {
          setPermissions(perms.map(p => p.permission_key));
        } else {
          // Fall back to default permissions
          setPermissions(DEFAULT_ROLE_PERMISSIONS[normalizedRole] || []);
        }
        const { data: overrideRows } = await supabase
          .from('user_permissions')
          .select('permission_key, is_enabled')
          .eq('user_id', currentUser.id);
        if (overrideRows) {
          const mapped = (overrideRows as { permission_key: string; is_enabled: boolean }[]).reduce((acc, row) => {
            acc[row.permission_key] = row.is_enabled;
            return acc;
          }, {} as Record<string, boolean>);
          setPermissionOverrides(mapped);
        } else {
          setPermissionOverrides({});
        }

        // Resolve PECC-style site and visible tabs. Granular Permissions (view_tabs by user_id) is source of truth.
        // Only PECC_TAB_KEYS are used for nav; other keys (e.g. snapshot_prs_section) do not affect visibleTabs. Empty array = all tabs hidden.
        let sid: string | null = null;
        sid = prof.hospital_facility_id ?? null;
        if (!sid) {
          const { data: memberRow, error: memErr } = await supabase
            .from('site_members')
            .select('site_id')
            .eq('user_id', currentUser.id)
            .limit(1)
            .maybeSingle();
          if (!memErr && memberRow && typeof (memberRow as { site_id?: string }).site_id === 'string') {
            sid = (memberRow as { site_id: string }).site_id;
          }
        }
        const { data: userTabRows } = await supabase
          .from('view_tabs')
          .select('tab_key, is_visible')
          .eq('user_id', currentUser.id);
        let resolvedTabs: string[] = [...PECC_TAB_KEYS];
        if (userTabRows && userTabRows.length > 0) {
          const byKey = (userTabRows as { tab_key: string; is_visible: boolean }[]).reduce((acc, r) => {
            acc[r.tab_key] = r.is_visible;
            return acc;
          }, {} as Record<string, boolean>);
          resolvedTabs = PECC_TAB_KEYS.filter(tab => (byKey[tab] ?? true));
        } else if (sid) {
          const { data: tabRows, error: tabErr } = await supabase
            .from('site_tab_visibility')
            .select('tab_key, visible')
            .eq('site_id', sid);
          if (!tabErr && tabRows && tabRows.length > 0) {
            resolvedTabs = (tabRows as { tab_key: string; visible: boolean }[])
              .filter(r => r.visible).map(r => r.tab_key);
          }
        }
        if (normalizedRole === UserRole.PECC) {
          setSiteId(sid);
          setVisibleTabs(resolvedTabs);
        } else {
          setSiteId(null);
          setVisibleTabs([]);
        }
        setMentorPeccSiteId(sid);
        setMentorPeccVisibleTabs(resolvedTabs);

        // Load from user_data: gap plan reminders (Account page), wages_enabled (mentors, admin-controlled)
        const [gapPlanReminders, wagesEnabled] = await Promise.all([
          getUserData<{ enabled?: boolean; emailNotifications?: boolean; reminderDays?: number; emailFrequency?: string }>(currentUser.id, 'gap_plan_reminders'),
          normalizedRole === UserRole.MENTOR ? getUserData<boolean>(currentUser.id, 'wages_enabled') : Promise.resolve(null)
        ]);
        const profWithUserData = {
          ...prof,
          ...(gapPlanReminders != null ? { gapPlanReminders } : {}),
          ...(wagesEnabled !== undefined && wagesEnabled !== null ? { wages_enabled: !!wagesEnabled } : {})
        };

        // Resolve hospital/site name from CRM (hospitals table) so tabs and UI show current name after CRM updates
        const siteIdToResolve = prof.hospital_facility_id ?? (normalizedRole === UserRole.PECC ? sid : null);
        if (siteIdToResolve) {
          const { data: hospitalRow } = await supabase
            .from('hospitals')
            .select('name')
            .or(`id.eq.${siteIdToResolve},facility_id.eq.${siteIdToResolve}`)
            .limit(1)
            .maybeSingle();
          const hospitalName = (hospitalRow as { name?: string } | null)?.name;
          setUserProfile({ ...profWithUserData, hospital_name: hospitalName != null ? normalizeHospitalOrOrgName(hospitalName) : prof.hospital_name });
        } else {
          setUserProfile(profWithUserData);
        }

        // Update last login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', currentUser.id);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      createDefaultProfile();
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, createDefaultProfile]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Avoid infinite spinner if Supabase profile fetch hangs (network/tab sleep).
  useEffect(() => {
    if (!currentUser || !isLoading) return;
    const timeoutMs = 25000;
    const id = window.setTimeout(() => {
      setIsLoading(false);
      if (!userProfileRef.current) {
        console.warn('[UserProfile] Profile load exceeded 25s; applying default profile so routing can proceed.');
        createDefaultProfile();
      }
    }, timeoutMs);
    return () => window.clearTimeout(id);
  }, [currentUser, isLoading, createDefaultProfile]);

  const getDefaultDashboardForRole = useCallback((role: UserRole): string => {
    switch (role) {
      case UserRole.ADMIN: return '/admin/dashboard';
      case UserRole.MANAGER: return '/manager/overview';
      case UserRole.MENTOR: return '/mentor/dashboard';
      case UserRole.PECC: return '/dashboard';
      case UserRole.HOSPITAL_SYSTEM: return '/hospital-system/dashboard';
      case UserRole.HIRING_GROUP: return '/hiring-group/snapshot';
      default: return '/dashboard';
    }
  }, []);

  const currentUserUid = (currentUser as { uid?: string })?.uid;

  const enterViewAsUser = useCallback(async (userId: string): Promise<{ ok: boolean; dashboardPath?: string }> => {
    latestViewAsUserIdRef.current = userId;
    const me = userProfile;
    const isAdmin = me?.role === UserRole.ADMIN || me?.is_admin === true;
    const isManager = me?.role === UserRole.MANAGER;
    const isMentor = me?.role === UserRole.MENTOR;
    if (!isAdmin && !isManager && !isMentor) return { ok: false };
    if (userId === currentUser?.id || userId === currentUserUid) return { ok: false };
    try {
      // Always fetch fresh from DB so recategorized role (e.g. PECC → staff) is correct; select role and is_admin explicitly
      const { data: profile, error } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, phone, role, is_admin, is_active, created_at, updated_at, last_login, manager_id, mentor_id, hospital_facility_id, primary_program_id')
        .eq('id', userId)
        .single();
      if (error || !profile) return { ok: false };
      const prof = profile as UserProfile & { hospital_facility_id?: string | null };
      const normalizedRole = normalizeUserRole(prof.role);
      const profWithRole = { ...prof, role: normalizedRole };
      let sid: string | null = prof.hospital_facility_id ?? null;
      let tabs: string[] = [...PECC_TAB_KEYS];
      const isPeccOrAdmin = normalizedRole === UserRole.PECC || normalizedRole === UserRole.ADMIN;
      if (isPeccOrAdmin) {
        if (!sid) {
          const { data: memberRow } = await supabase
            .from('site_members')
            .select('site_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();
          if (memberRow && typeof (memberRow as { site_id?: string }).site_id === 'string') {
            sid = (memberRow as { site_id: string }).site_id;
          }
        }
        const { data: userTabRows, error: viewTabsError } = await supabase
          .from('view_tabs')
          .select('tab_key, is_visible')
          .eq('user_id', userId);
        if (!viewTabsError && userTabRows && userTabRows.length > 0) {
          const byKey = (userTabRows as { tab_key: string; is_visible: boolean }[]).reduce((acc, r) => {
            acc[r.tab_key] = r.is_visible;
            return acc;
          }, {} as Record<string, boolean>);
          tabs = PECC_TAB_KEYS.filter(tab => (byKey[tab] ?? true));
        } else if (sid && !viewTabsError) {
          const { data: tabRows } = await supabase
            .from('site_tab_visibility')
            .select('tab_key, visible')
            .eq('site_id', sid);
          if (tabRows && tabRows.length > 0) {
            tabs = (tabRows as { tab_key: string; visible: boolean }[])
              .filter(r => r.visible).map(r => r.tab_key);
          }
        }
        if (normalizedRole === UserRole.ADMIN) sid = null;
      } else {
        sid = null;
        tabs = [];
      }
      setViewAsRole(null);
      setViewAsUserId(userId);
      setViewAsUserProfile(profWithRole);
      setViewAsSiteId(sid);
      setViewAsVisibleTabs(tabs);
      const { data: viewAsOverrides } = await supabase
        .from('user_permissions')
        .select('permission_key, is_enabled')
        .eq('user_id', userId);
      if (viewAsOverrides) {
        const mapped = (viewAsOverrides as { permission_key: string; is_enabled: boolean }[]).reduce((acc, row) => {
          acc[row.permission_key] = row.is_enabled;
          return acc;
        }, {} as Record<string, boolean>);
        setViewAsPermissionOverrides(mapped);
      } else {
        setViewAsPermissionOverrides({});
      }
      // Navbar logo + branding id (same resolution as main logo effect; avoids stale/wrong logo during view-as)
      const { logoUrl, brandProgramId } = await resolveNavbarProgramLogo(
        supabase,
        userId,
        prof.primary_program_id ?? null
      );
      if (latestViewAsUserIdRef.current !== userId) return { ok: true, dashboardPath: getDefaultDashboardForRole(normalizedRole) };
      setPrimaryProgramLogoUrl(logoUrl);
      setNavbarBrandProgramId(brandProgramId);
      const dashboardPath = getDefaultDashboardForRole(normalizedRole);
      return { ok: true, dashboardPath };
    } catch {
      return { ok: false };
    }
  }, [userProfile, currentUser?.id, currentUserUid, getDefaultDashboardForRole]);

  const clearViewAsUser = useCallback(() => {
    setViewAsUserId(null);
    setViewAsUserProfile(null);
    setViewAsSiteId(null);
    setViewAsVisibleTabs([]);
    setViewAsPermissionOverrides({});
  }, []);

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile || !currentUser) return;

    try {
      // When updating own profile, never persist role/tier so the user cannot demote themselves from Account page
      const isSelfUpdate = !updates.id || updates.id === currentUser.id;
      const safeUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
      if (isSelfUpdate) {
        delete safeUpdates.role;
        delete safeUpdates.tier;
      }

      const { error } = await supabase
        .from('users')
        .update(safeUpdates)
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error updating profile in Supabase:', error);
        // Fall back to user_data cache
        const updatedProfile = { ...userProfile, ...updates };
        setUserProfile(updatedProfile);
        const { setUserData } = await import('../utils/userData');
        const tier = updatedProfile.role === UserRole.MENTOR ? 'PRISM'
          : updatedProfile.role === UserRole.HOSPITAL_SYSTEM ? 'Hospital System'
          : updatedProfile.role === UserRole.HIRING_GROUP ? 'Hiring Group'
          : 'PECC';
        await setUserData(currentUser.uid || currentUser.id, 'userProfile_cache', {
          firstName: updatedProfile.first_name,
          lastName: updatedProfile.last_name,
          phone: updatedProfile.phone,
          tier,
          email: updatedProfile.email
        });
      } else {
        // For self-update, preserve role and is_admin so we never overwrite admin with PECC in local state
        const merged = { ...userProfile, ...updates };
        if (isSelfUpdate) {
          merged.role = userProfile.role;
          merged.is_admin = userProfile.is_admin;
        }
        setUserProfile(merged);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const hasPermission = useCallback((permission: string): boolean => {
    // If viewing as a specific user, use that user's role permissions
    if (viewAsUserId && viewAsUserProfile) {
      const base = DEFAULT_ROLE_PERMISSIONS[viewAsUserProfile.role]?.includes(permission) ?? false;
      return (permission in viewAsPermissionOverrides) ? !!viewAsPermissionOverrides[permission] : base;
    }
    // If viewing as a different role (no specific user), check permissions for that role
    if (viewAsRole && (userProfile?.role === UserRole.ADMIN || userProfile?.is_admin)) {
      return DEFAULT_ROLE_PERMISSIONS[viewAsRole]?.includes(permission) || false;
    }
    if (userProfile?.role === UserRole.ADMIN || userProfile?.is_admin) {
      return true;
    }
    return (permission in permissionOverrides) ? !!permissionOverrides[permission] : permissions.includes(permission);
  }, [viewAsUserId, viewAsUserProfile, viewAsRole, userProfile, viewAsPermissionOverrides, permissionOverrides, permissions]);

  const hasPermissionInScope = useCallback(async (permission: string, cohortId?: string, programId?: string): Promise<boolean> => {
    const scopedUserId = viewAsUserId ?? currentUser?.id;
    if (!scopedUserId) return false;
    try {
      const { data, error } = await supabase.rpc('user_has_permission', {
        p_user_id: scopedUserId,
        p_permission_key: permission,
        p_cohort_id: cohortId || null,
        p_program_id: programId || null
      });
      if (!error && typeof data === 'boolean') return data;
      return hasPermission(permission);
    } catch {
      return hasPermission(permission);
    }
  }, [viewAsUserId, currentUser?.id, hasPermission]);

  const refreshProfile = async () => {
    setIsLoading(true);
    await fetchUserProfile();
  };

  // Keep navbar logo in sync with whichever profile is currently effective:
  // - normal logged-in user
  // - or "view as" user (when enabled)
  const effectivePrimaryProgramId = (viewAsUserId && viewAsUserProfile)
    ? (viewAsUserProfile.primary_program_id ?? null)
    : (userProfile?.primary_program_id ?? null);
  const effectiveLogoUserId = viewAsUserId ?? currentUser?.id;

  useEffect(() => {
    let cancelled = false;
    const fetchSeq = ++logoFetchSeqRef.current;
    (async () => {
      if (!effectiveLogoUserId) {
        if (!cancelled) {
          setPrimaryProgramLogoUrl(null);
          setNavbarBrandProgramId(null);
        }
        return;
      }

      const { logoUrl, brandProgramId } = await resolveNavbarProgramLogo(
        supabase,
        effectiveLogoUserId,
        effectivePrimaryProgramId
      );

      if (cancelled || fetchSeq !== logoFetchSeqRef.current) return;
      setPrimaryProgramLogoUrl(logoUrl);
      setNavbarBrandProgramId(brandProgramId);
    })();

    return () => { cancelled = true; };
  }, [effectiveLogoUserId, effectivePrimaryProgramId, viewAsUserId, viewAsUserProfile, userProfile?.primary_program_id]);

  const hasAdminAccess = userProfile?.role === UserRole.ADMIN || userProfile?.is_admin === true;
  const canToggleMentorWorkMode = Boolean(
    !viewAsUserId &&
    !viewAsRole &&
    userProfile?.role === UserRole.MENTOR &&
    (mentorPeccSiteId || (userProfile as UserProfile & { has_hospital_assignments?: boolean })?.has_hospital_assignments)
  );
  const canViewAsUser = hasAdminAccess || userProfile?.role === UserRole.MANAGER || userProfile?.role === UserRole.MENTOR;
  // When viewing as another user: if Admin View-As is active, use that role; otherwise show Admin if they have is_admin, else their normalized role.
  const mentorEffectiveRole = canToggleMentorWorkMode && mentorWorkMode === 'pecc' ? UserRole.PECC : (userProfile?.role || UserRole.PECC);
  const effectiveRole = viewAsUserId && viewAsUserProfile
    ? (viewAsRole && hasAdminAccess
        ? viewAsRole
        : (viewAsUserProfile.is_admin === true ? UserRole.ADMIN : viewAsUserProfile.role))
    : (viewAsRole && hasAdminAccess)
      ? viewAsRole
      : (hasAdminAccess ? UserRole.ADMIN : mentorEffectiveRole);
  const effectiveSiteId = viewAsUserId
    ? viewAsSiteId
    : (effectiveRole === UserRole.PECC ? (userProfile?.role === UserRole.PECC ? siteId : mentorPeccSiteId) : siteId);
  const effectiveVisibleTabs = viewAsUserId
    ? viewAsVisibleTabs
    : (effectiveRole === UserRole.PECC ? (userProfile?.role === UserRole.PECC ? visibleTabs : mentorPeccVisibleTabs) : visibleTabs);
  const effectiveUserId = viewAsUserId ?? (currentUser?.uid ?? (currentUser as { id?: string })?.id) ?? undefined;
  const isViewingAsUser = viewAsUserId != null && canViewAsUser;

  const value = {
    userProfile: viewAsUserId ? viewAsUserProfile : userProfile,
    updateUserProfile,
    isLoading,
    userRole: effectiveRole,
    actualRole: userProfile?.role || UserRole.PECC,
    hasAdminAccess,
    hasPermission,
    hasPermissionInScope,
    permissions,
    refreshProfile,
    viewAsRole,
    setViewAsRole,
    isViewingAs: viewAsRole !== null && hasAdminAccess,
    viewAsUserId,
    viewAsUserProfile,
    enterViewAsUser,
    clearViewAsUser,
    isViewingAsUser,
    effectiveUserId,
    siteId: effectiveSiteId,
    visibleTabs: effectiveVisibleTabs,
    primaryProgramLogoUrl,
    navbarBrandProgramId,
    mentorWorkMode,
    canToggleMentorWorkMode,
    setMentorWorkMode
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};
