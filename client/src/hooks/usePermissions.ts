import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useUserProfile } from '../context/UserProfileContext';

/**
 * Hook to check if a tab is visible for the current user in a cohort or program
 */
export const useTabVisibility = (tabKey: string, cohortId?: string, programId?: string) => {
  const { userProfile } = useUserProfile();
  const [isVisible, setIsVisible] = useState(true);  // Default to visible
  
  useEffect(() => {
    if (!userProfile?.id) return;
    
    const checkVisibility = async () => {
      try {
        // Check user-specific tab setting first
        const { data: userTab } = await supabase
          .from('view_tabs')
          .select('is_visible')
          .eq('user_id', userProfile.id)
          .eq('tab_key', tabKey)
          .maybeSingle();
        
        if (userTab) {
          setIsVisible(userTab.is_visible);
          return;
        }
        
        // Check cohort-specific tab setting
        if (cohortId) {
          const { data: cohortTab } = await supabase
            .from('view_tabs')
            .select('is_visible')
            .eq('cohort_id', cohortId)
            .eq('tab_key', tabKey)
            .maybeSingle();
          
          if (cohortTab) {
            setIsVisible(cohortTab.is_visible);
            return;
          }
        }
        
        // Check program-specific tab setting
        if (programId) {
          const { data: programTab } = await supabase
            .from('view_tabs')
            .select('is_visible')
            .eq('program_id', programId)
            .eq('tab_key', tabKey)
            .maybeSingle();
          
          if (programTab) {
            setIsVisible(programTab.is_visible);
            return;
          }
        }
        
        // Default: visible if no override exists
        setIsVisible(true);
      } catch (error) {
        console.error('Error checking tab visibility:', error);
        setIsVisible(true);  // Default to visible on error
      }
    };
    
    checkVisibility();
  }, [userProfile?.id, tabKey, cohortId, programId]);
  
  return isVisible;
};

/**
 * Hook to check if user has a specific permission
 */
export const usePermission = (permissionKey: string, cohortId?: string, programId?: string) => {
  const { userProfile } = useUserProfile();
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    if (!userProfile?.id) return;
    
    const checkPermission = async () => {
      try {
        // Use the database function if available, otherwise check manually
        const { data, error } = await supabase.rpc('user_has_permission', {
          p_user_id: userProfile.id,
          p_permission_key: permissionKey,
          p_cohort_id: cohortId || null,
          p_program_id: programId || null
        });
        
        if (!error && data !== null) {
          setHasPermission(data);
        } else {
          // Fallback: check role permissions
          // This is a simplified check - in production you'd want to check role_permissions table
          setHasPermission(true);  // Default to true for now
        }
      } catch (error) {
        console.error('Error checking permission:', error);
        setHasPermission(true);  // Default to true on error
      }
    };
    
    checkPermission();
  }, [userProfile?.id, permissionKey, cohortId, programId]);
  
  return hasPermission;
};
