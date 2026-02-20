import { useState, useEffect, useCallback } from 'react';
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

/** Tab key used in view_tabs for Pediatric Readiness Scores section visibility (Dashboard + Snapshot). */
export const PRS_SECTION_TAB_KEY = 'snapshot_prs_section';

/**
 * Resolves whether the Pediatric Readiness Scores section is visible for the current user.
 * Uses view_tabs (same as Granular Permissions). Returns [visible, setVisible] so the dashboard
 * "Hide section" / "Show" and the admin toggle stay in sync.
 */
export const usePrsSectionVisible = (): [boolean, (visible: boolean) => Promise<void>] => {
  const { userProfile } = useUserProfile();
  const [isVisible, setIsVisible] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const userId = userProfile?.id;
  const primaryProgramId = (userProfile as { primary_program_id?: string | null })?.primary_program_id ?? null;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const resolve = async () => {
      try {
        const programId = primaryProgramId;
        let cohortId: string | null = null;
        const { data: cm } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .eq('user_id', userId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (cm && typeof (cm as { cohort_id?: string }).cohort_id === 'string') {
          cohortId = (cm as { cohort_id: string }).cohort_id;
        }

        const { data, error } = await supabase.rpc('is_tab_visible', {
          p_user_id: userId,
          p_tab_key: PRS_SECTION_TAB_KEY,
          p_cohort_id: cohortId,
          p_program_id: programId
        });

        if (cancelled) return;
        if (!error && data === false) {
          setIsVisible(false);
          return;
        }
        if (!error && data === true) {
          setIsVisible(true);
          return;
        }

        const { data: userTab } = await supabase
          .from('view_tabs')
          .select('is_visible')
          .eq('user_id', userId)
          .eq('tab_key', PRS_SECTION_TAB_KEY)
          .maybeSingle();
        if (cancelled) return;
        if (userTab != null) {
          setIsVisible(userTab.is_visible);
          return;
        }
        if (cohortId) {
          const { data: cohortTab } = await supabase
            .from('view_tabs')
            .select('is_visible')
            .eq('cohort_id', cohortId)
            .eq('tab_key', PRS_SECTION_TAB_KEY)
            .maybeSingle();
          if (cancelled) return;
          if (cohortTab != null) {
            setIsVisible(cohortTab.is_visible);
            return;
          }
        }
        if (programId) {
          const { data: programTab } = await supabase
            .from('view_tabs')
            .select('is_visible')
            .eq('program_id', programId)
            .eq('tab_key', PRS_SECTION_TAB_KEY)
            .maybeSingle();
          if (cancelled) return;
          if (programTab != null) {
            setIsVisible(programTab.is_visible);
            return;
          }
        }
        setIsVisible(true);
      } catch (err) {
        if (!cancelled) {
          console.error('Error resolving PRS section visibility:', err);
          setIsVisible(true);
        }
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [userId, primaryProgramId, refreshCounter]);

  const setPrsSectionVisible = useCallback(async (visible: boolean) => {
    if (!userId) return;
    const { error } = await supabase
      .from('view_tabs')
      .upsert(
        {
          user_id: userId,
          tab_key: PRS_SECTION_TAB_KEY,
          is_visible: visible,
          granted_by: userId,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,tab_key' }
      );
    if (!error) {
      setIsVisible(visible);
    } else {
      setRefreshCounter(c => c + 1);
    }
  }, [userId]);

  return [isVisible, setPrsSectionVisible];
};
