import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';
import { UserRole, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../types/database';

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
  created_at: string;
  updated_at: string;
  last_login: string | null;
  manager_id: string | null;
  mentor_id: string | null;
  
  // Computed/joined fields
  hospital_name?: string;
  mentor_name?: string;
  manager_name?: string;
}

interface UserProfileContextType {
  userProfile: UserProfile | null;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  isLoading: boolean;
  userRole: UserRole;
  hasPermission: (permission: string) => boolean;
  permissions: string[];
  refreshProfile: () => Promise<void>;
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

  // Fetch user profile from Supabase
  const fetchUserProfile = useCallback(async () => {
    if (!currentUser) {
      setUserProfile(null);
      setPermissions([]);
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
        // If no profile exists yet (new user), check localStorage for legacy data
        const savedProfile = localStorage.getItem(`userProfile_${currentUser.uid || currentUser.id}`);
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            // Convert legacy profile to new format
            const legacyProfile: UserProfile = {
              id: currentUser.id,
              email: currentUser.email || '',
              first_name: parsed.firstName || 'User',
              last_name: parsed.lastName || '',
              phone: parsed.phone || null,
              role: parsed.tier === 'PRISM' ? UserRole.MENTOR : UserRole.PECC,
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
        setUserProfile(profile as UserProfile);
        
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
  };

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile || !currentUser) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
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
        setUserProfile({ ...userProfile, ...updates });
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const hasPermission = (permission: string): boolean => {
    // Admins always have all permissions
    if (userProfile?.role === UserRole.ADMIN) {
      return true;
    }
    return permissions.includes(permission);
  };

  const refreshProfile = async () => {
    setIsLoading(true);
    await fetchUserProfile();
  };

  const value = {
    userProfile,
    updateUserProfile,
    isLoading,
    userRole: userProfile?.role || UserRole.PECC,
    hasPermission,
    permissions,
    refreshProfile
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};
