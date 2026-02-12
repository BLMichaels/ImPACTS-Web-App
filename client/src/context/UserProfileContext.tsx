import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';
import { UserRole, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, PECC_TAB_KEYS } from '../types/database';
import { normalizeHospitalOrOrgName } from '../utils/displayName';

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
}

interface UserProfileContextType {
  userProfile: UserProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  isLoading: boolean;
  userRole: UserRole;
  actualRole: UserRole; // The user's real role (for admins using "View As")
  hasPermission: (permission: string) => boolean;
  permissions: string[];
  refreshProfile: () => Promise<void>;
  // Admin "View As" feature
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  isViewingAs: boolean;
  // PECC site and tab visibility (page = hospital/site; tabs toggled in CRM)
  siteId: string | null;
  visibleTabs: string[];  // Tab keys that are visible for this PECC's site; empty = all visible
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
  const [siteId, setSiteId] = useState<string | null>(null);
  const [visibleTabs, setVisibleTabs] = useState<string[]>([]);

  // Fetch user profile from Supabase
  const fetchUserProfile = useCallback(async () => {
    if (!currentUser) {
      setUserProfile(null);
      setPermissions([]);
      setSiteId(null);
      setVisibleTabs([]);
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
        // If no profile exists yet (new user), check localStorage for legacy data
        const savedProfile = localStorage.getItem(`userProfile_${currentUser.uid || currentUser.id}`);
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
        const prof = profile as UserProfile & { hospital_facility_id?: string | null };
        setUserProfile(prof);

        // Fetch permissions from database
        const { data: perms } = await supabase
          .from('role_permissions')
          .select('permission_key')
          .eq('role', profile.role)
          .eq('is_enabled', true);

        if (perms) {
          setPermissions(perms.map(p => p.permission_key));
        } else {
          // Fall back to default permissions
          setPermissions(DEFAULT_ROLE_PERMISSIONS[profile.role as UserRole] || []);
        }

        // PECC: resolve site and visible tabs (page = hospital/site; tabs set in CRM)
        let sid: string | null = null;
        if (profile.role === 'pecc') {
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
          setSiteId(sid);
          if (sid) {
            const { data: tabRows, error: tabErr } = await supabase
              .from('site_tab_visibility')
              .select('tab_key, visible')
              .eq('site_id', sid);
            if (!tabErr && tabRows && tabRows.length > 0) {
              setVisibleTabs((tabRows as { tab_key: string; visible: boolean }[])
                .filter(r => r.visible).map(r => r.tab_key));
            } else {
              setVisibleTabs([...PECC_TAB_KEYS]);
            }
          } else {
            setVisibleTabs([...PECC_TAB_KEYS]);
          }
        } else {
          setSiteId(null);
          setVisibleTabs([]);
        }

        // Resolve hospital/site name from CRM (hospitals table) so tabs and UI show current name after CRM updates
        const siteIdToResolve = prof.hospital_facility_id ?? (profile.role === 'pecc' ? sid : null);
        if (siteIdToResolve) {
          const { data: hospitalRow } = await supabase
            .from('hospitals')
            .select('name')
            .or(`id.eq.${siteIdToResolve},facility_id.eq.${siteIdToResolve}`)
            .limit(1)
            .maybeSingle();
          const hospitalName = (hospitalRow as { name?: string } | null)?.name;
          setUserProfile({ ...prof, hospital_name: hospitalName != null ? normalizeHospitalOrOrgName(hospitalName) : prof.hospital_name });
        } else {
          setUserProfile(prof);
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
  }, [currentUser]);

  const createDefaultProfile = () => {
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
    setSiteId(null);
    setVisibleTabs([...PECC_TAB_KEYS]);
  };

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

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
        // Fall back to localStorage
        const updatedProfile = { ...userProfile, ...updates };
        setUserProfile(updatedProfile);
        localStorage.setItem(`userProfile_${currentUser.uid || currentUser.id}`, JSON.stringify({
          firstName: updatedProfile.first_name,
          lastName: updatedProfile.last_name,
          phone: updatedProfile.phone,
          tier: updatedProfile.role === UserRole.MENTOR ? 'PRISM' : 'PECC',
          email: updatedProfile.email
        }));
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

  const hasPermission = (permission: string): boolean => {
    // If viewing as a different role, check permissions for that role
    if (viewAsRole && (userProfile?.role === UserRole.ADMIN || userProfile?.is_admin)) {
      // Admin viewing as another role - use that role's permissions
      return DEFAULT_ROLE_PERMISSIONS[viewAsRole]?.includes(permission) || false;
    }
    // Admins (role or is_admin) always have all permissions when not viewing as another role
    if (userProfile?.role === UserRole.ADMIN || userProfile?.is_admin) {
      return true;
    }
    return permissions.includes(permission);
  };

  const refreshProfile = async () => {
    setIsLoading(true);
    await fetchUserProfile();
  };

  // Get the effective role (either viewAsRole or actual role). Anyone with admin access (role or is_admin) can use admin.
  const hasAdminAccess = userProfile?.role === UserRole.ADMIN || userProfile?.is_admin === true;
  const effectiveRole = (viewAsRole && hasAdminAccess)
    ? viewAsRole
    : (hasAdminAccess ? UserRole.ADMIN : (userProfile?.role || UserRole.PECC));

  const value = {
    userProfile,
    updateUserProfile,
    isLoading,
    userRole: effectiveRole,
    actualRole: userProfile?.role || UserRole.PECC,
    hasPermission,
    permissions,
    refreshProfile,
    viewAsRole,
    setViewAsRole,
    isViewingAs: viewAsRole !== null && (userProfile?.role === UserRole.ADMIN || userProfile?.is_admin === true),
    siteId,
    visibleTabs
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};
