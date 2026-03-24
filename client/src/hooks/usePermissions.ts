import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from '../context/UserProfileContext';
import { UserRole, normalizeUserRole } from '../types/database';

/**
 * Hook to check if a tab is visible for the current user in a cohort or program
 */
export const useTabVisibility = (tabKey: string, cohortId?: string, programId?: string) => {
  const { userProfile } = useUserProfile();
  const [isVisible, setIsVisible] = useState(false);  // Fail closed while resolving
  
  useEffect(() => {
    if (!userProfile?.id) return;
    let cancelled = false;
    
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
          if (!cancelled) setIsVisible(userTab.is_visible);
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
            if (!cancelled) setIsVisible(cohortTab.is_visible);
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
            if (!cancelled) setIsVisible(programTab.is_visible);
            return;
          }
        }
        
        // Default: visible if no override exists
        if (!cancelled) setIsVisible(true);
      } catch (error) {
        console.error('Error checking tab visibility:', error);
        // Fail closed on lookup errors to avoid accidental overexposure.
        if (!cancelled) setIsVisible(false);
      }
    };
    
    checkVisibility();
    return () => { cancelled = true; };
  }, [userProfile?.id, tabKey, cohortId, programId]);
  
  return isVisible;
};

/**
 * Hook to check if user has a specific permission.
 * Uses user_has_permission RPC (role + user/cohort/program overrides) and fails closed on errors.
 */
export const usePermission = (permissionKey: string, cohortId?: string, programId?: string) => {
  const { userProfile, hasPermissionInScope } = useUserProfile();
  const [hasPermission, setHasPermission] = useState(false);
  const userId = userProfile?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const checkPermission = async () => {
      try {
        const allowed = await hasPermissionInScope(permissionKey, cohortId, programId);
        if (!cancelled) setHasPermission(allowed);
      } catch (err) {
        console.error('Error checking permission:', err);
        if (!cancelled) setHasPermission(false);
      }
    };

    checkPermission();
    return () => { cancelled = true; };
  }, [userId, permissionKey, cohortId, programId, hasPermissionInScope]);

  return hasPermission;
};

/** Tab key used in view_tabs for Pediatric Readiness Scores section visibility (Dashboard + Snapshot). */
export const PRS_SECTION_TAB_KEY = 'snapshot_prs_section';

/** Mentor, manager, or admin may restore the PRS section for a PECC; PECCs cannot self-restore from the app. */
export function canRestorePediatricReadinessSection(
  actualRole: UserRole,
  hasAdminAccess: boolean
): boolean {
  if (hasAdminAccess) return true;
  const r = normalizeUserRole(actualRole);
  return r === UserRole.MENTOR || r === UserRole.MANAGER || r === UserRole.ADMIN;
}

/**
 * Resolves whether the Pediatric Readiness Scores section is visible for the **effective** PECC user
 * (same id as Dashboard/Snapshot data: effectiveUserId). Dashboard and Snapshot stay in sync.
 */
export const usePrsSectionVisible = (): [boolean, (visible: boolean) => Promise<void>] => {
  const { currentUser } = useAuth();
  const { userProfile, effectiveUserId, actualRole, hasAdminAccess } = useUserProfile();
  const [isVisible, setIsVisible] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const primaryProgramId = (userProfile as { primary_program_id?: string | null })?.primary_program_id ?? null;
  const actorId =
    currentUser?.uid ?? (currentUser as { id?: string } | null)?.id ?? undefined;

  useEffect(() => {
    const subjectId = effectiveUserId;
    if (!subjectId) return;

    let cancelled = false;

    const resolve = async () => {
      try {
        const programId = primaryProgramId;
        let cohortId: string | null = null;
        const { data: cm } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .eq('user_id', subjectId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (cm && typeof (cm as { cohort_id?: string }).cohort_id === 'string') {
          cohortId = (cm as { cohort_id: string }).cohort_id;
        }

        try {
          const { data, error } = await supabase.rpc('is_tab_visible', {
            p_user_id: subjectId,
            p_tab_key: PRS_SECTION_TAB_KEY,
            p_cohort_id: cohortId,
            p_program_id: programId
          });
          if (!cancelled) {
            if (!error && data === false) {
              setIsVisible(false);
              return;
            }
            if (!error && data === true) {
              setIsVisible(true);
              return;
            }
          }
        } catch {
          // RPC may not exist (404); fall back to view_tabs below
        }

        if (cancelled) return;
        const { data: userTab } = await supabase
          .from('view_tabs')
          .select('is_visible')
          .eq('user_id', subjectId)
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
          // Fail open: avoid hiding PRS when RPC/tables error (better UX than a blank section).
          setIsVisible(true);
        }
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [effectiveUserId, primaryProgramId, refreshCounter]);

  const setPrsSectionVisible = useCallback(
    async (visible: boolean) => {
      const subjectId = effectiveUserId;
      if (!subjectId) return;
      if (visible && !canRestorePediatricReadinessSection(actualRole, hasAdminAccess)) {
        return;
      }
      const { error } = await supabase
        .from('view_tabs')
        .upsert(
          {
            user_id: subjectId,
            tab_key: PRS_SECTION_TAB_KEY,
            is_visible: visible,
            granted_by: actorId ?? subjectId,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id,tab_key' }
        );
      if (!error) {
        setIsVisible(visible);
      } else {
        setRefreshCounter(c => c + 1);
      }
    },
    [effectiveUserId, actualRole, hasAdminAccess, actorId]
  );

  return [isVisible, setPrsSectionVisible];
};
