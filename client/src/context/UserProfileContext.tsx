import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// User tier definitions
export enum UserTier {
  PECC = 'PECC',
  PRISM = 'PRISM'
}

// Base user profile interface
interface BaseUserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tier: UserTier;
  department: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
}

// PECC user profile interface
interface PECCProfile extends BaseUserProfile {
  tier: UserTier.PECC;
  hospitalName: string;
  traumaLevel: string;
  edSize: string;
  region: string;
  gapPlanReminders: {
    enabled: boolean;
    emailNotifications: boolean;
    reminderDays: number; // Days before due date to show reminder
    emailFrequency: 'daily' | 'weekly' | 'monthly';
  };
  prsTabVisible: boolean;
}

// PRISM user profile interface
interface PRISMProfile extends BaseUserProfile {
  tier: UserTier.PRISM;
  region: string;
  specialties: string[];
  maxHospitals: number;
  currentHospitals: string[];
  hourlyRate: number;
  stipendRate: number;
}

// Union type for all user profiles
export type UserProfile = PECCProfile | PRISMProfile;

interface UserProfileContextType {
  userProfile: UserProfile;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  isLoading: boolean;
  userTier: UserTier;
  hasPermission: (permission: string) => boolean;
}

const defaultPECCProfile: PECCProfile = {
  firstName: 'User',
  lastName: '',
  email: '',
  phone: '',
  tier: UserTier.PECC,
  department: 'Emergency Department',
  isActive: true,
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  hospitalName: '',
  traumaLevel: '',
  edSize: '',
  region: '',
  gapPlanReminders: {
    enabled: true,
    emailNotifications: false,
    reminderDays: 7,
    emailFrequency: 'weekly'
  },
  prsTabVisible: true
};

const defaultPRISMProfile: PRISMProfile = {
  firstName: 'PRISM',
  lastName: 'User',
  email: '',
  phone: '',
  tier: UserTier.PRISM,
  department: 'Pediatric Readiness',
  isActive: true,
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  region: '',
  specialties: [],
  maxHospitals: 10,
  currentHospitals: [],
  hourlyRate: 0,
  stipendRate: 0
};

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
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultPECCProfile);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      // Try to load existing profile
      const savedProfile = localStorage.getItem(`userProfile_${currentUser.uid}`);
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          // Ensure the profile has the correct tier structure
          if (parsed.tier && Object.values(UserTier).includes(parsed.tier)) {
            setUserProfile({ ...parsed, email: currentUser.email || '' });
          } else {
            // Default to PECC if no valid tier
            setUserProfile({ ...defaultPECCProfile, email: currentUser.email || '' });
          }
        } catch (error) {
          setUserProfile({ ...defaultPECCProfile, email: currentUser.email || '' });
        }
      } else {
        // Default to PECC for new users
        setUserProfile({ ...defaultPECCProfile, email: currentUser.email || '' });
      }
      setIsLoading(false);
    } else {
      // If no currentUser, use default profile and stop loading
      setUserProfile(defaultPECCProfile);
      setIsLoading(false);
    }
  }, [currentUser]);

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    let newProfile: UserProfile;
    
    // If switching tiers, create a new profile with the appropriate structure
    if (updates.tier && updates.tier !== userProfile.tier) {
      if (updates.tier === UserTier.PRISM) {
        // Switch to PRISM profile
        newProfile = {
          ...defaultPRISMProfile,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          phone: userProfile.phone,
          ...updates
        };
      } else if (updates.tier === UserTier.PECC) {
        // Switch to PECC profile
        newProfile = {
          ...defaultPECCProfile,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          phone: userProfile.phone,
          ...updates
        };
      } else {
        // Fallback to merging updates
        newProfile = { ...userProfile, ...updates } as UserProfile;
      }
    } else {
      // Regular update - merge the updates
      newProfile = { ...userProfile, ...updates } as UserProfile;
    }
    
    setUserProfile(newProfile);
    
    // Save to localStorage
    if (currentUser) {
      localStorage.setItem(`userProfile_${currentUser.uid}`, JSON.stringify(newProfile));
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (userProfile.tier === UserTier.PRISM) {
      return ['view_hospitals', 'manage_activities', 'view_reports', 'manage_peccs'].includes(permission);
    }
    if (userProfile.tier === UserTier.PECC) {
      return ['view_own_data', 'manage_activities'].includes(permission);
    }
    return false;
  };

  const value = {
    userProfile,
    updateUserProfile,
    isLoading,
    userTier: userProfile.tier,
    hasPermission
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

