import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useUserProfile } from './UserProfileContext';
import { supabase } from '../supabase';

export type UsageEventType = 'login' | 'page_view' | 'click' | 'link_click' | 'checklist' | 'activity';

export interface UsageMetadata {
  time_spent_seconds?: number;
  target?: string;
  /** link_click */
  url?: string;
  label?: string;
  link_context?: string;
  /** checklist */
  action?: string;
  checklist_id?: string;
  item_id?: string;
  stage_id?: string;
  name?: string;
  /** activity */
  activity_id?: string;
  [key: string]: unknown;
}

interface UsageAnalyticsContextType {
  trackLogin: () => void;
  trackPageView: (path: string, timeSpentSeconds?: number) => void;
  trackClick: (target: string, path?: string) => void;
  trackLinkClick: (url: string, label?: string, linkContext?: string) => void;
  trackChecklist: (action: string, meta?: { checklist_id?: string; item_id?: string; stage_id?: string; name?: string }) => void;
  trackActivity: (action: string, meta?: { activity_id?: string; name?: string }) => void;
}

const noopAnalytics: UsageAnalyticsContextType = {
  trackLogin: () => {},
  trackPageView: () => {},
  trackClick: () => {},
  trackLinkClick: () => {},
  trackChecklist: () => {},
  trackActivity: () => {},
};

const UsageAnalyticsContext = createContext<UsageAnalyticsContextType | undefined>(undefined);

export const useUsageAnalytics = (): UsageAnalyticsContextType => {
  const context = useContext(UsageAnalyticsContext);
  return context ?? noopAnalytics;
};

function useUsageTracker() {
  const { currentUser } = useAuth();
  const { actualRole, userProfile, siteId } = useUserProfile();
  const location = useLocation();
  const pathEnteredAt = useRef<number>(Date.now());
  const previousPath = useRef<string>('');
  const shouldTrackLoginRef = useRef(false);
  const hospitalIdRef = useRef<string | null>(null);

  // Resolve site/facility id to hospital UUID so we can attribute usage to hospital on CRM
  useEffect(() => {
    const siteOrFacilityId = siteId ?? userProfile?.hospital_facility_id ?? null;
    if (!siteOrFacilityId) {
      hospitalIdRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      // Only include id.eq if value looks like a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(siteOrFacilityId);
      const filterClause = isUuid ? `facility_id.eq.${siteOrFacilityId},id.eq.${siteOrFacilityId}` : `facility_id.eq.${siteOrFacilityId}`;
      const { data } = await supabase
        .from('hospitals')
        .select('id')
        .or(filterClause)
        .limit(1)
        .maybeSingle();
      if (!cancelled && data && typeof (data as { id?: string }).id === 'string') {
        hospitalIdRef.current = (data as { id: string }).id;
      } else {
        hospitalIdRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, userProfile?.hospital_facility_id]);

  const track = useCallback(
    async (eventType: UsageEventType, path: string, metadata: UsageMetadata | Record<string, unknown> = {}) => {
      if (!currentUser?.id || !actualRole) return;
      try {
        const payload: Record<string, unknown> = {
          user_id: currentUser.id,
          role: actualRole,
          event_type: eventType,
          path: path || '/',
          metadata: metadata && typeof metadata === 'object' ? metadata : {},
        };
        if (hospitalIdRef.current) payload.hospital_id = hospitalIdRef.current;
        await supabase.from('usage_events').insert(payload);
      } catch {
        // Fire-and-forget; don't block UI or surface errors
      }
    },
    [currentUser?.id, actualRole]
  );

  const trackLogin = useCallback(() => {
    if (!currentUser?.id || !actualRole) return;
    track('login', window.location.pathname || '/', {}).catch(() => {});
  }, [currentUser?.id, actualRole, track]);

  const trackPageView = useCallback(
    (path: string, timeSpentSeconds?: number) => {
      if (!currentUser?.id || !actualRole) return;
      const meta: Record<string, unknown> = {};
      if (timeSpentSeconds != null && timeSpentSeconds >= 0) meta.time_spent_seconds = Math.round(timeSpentSeconds);
      track('page_view', path || '/', meta).catch(() => {});
    },
    [currentUser?.id, actualRole, track]
  );

  const trackClick = useCallback(
    (target: string, path?: string) => {
      if (!currentUser?.id || !actualRole) return;
      track('click', path || window.location.pathname || '/', { target }).catch(() => {});
    },
    [currentUser?.id, actualRole, track]
  );

  const trackLinkClick = useCallback(
    (url: string, label?: string, linkContext?: string) => {
      if (!currentUser?.id || !actualRole) return;
      const path = window.location.pathname || '/';
      const meta: UsageMetadata = { url: url || path, target: label || url };
      if (linkContext) meta.link_context = linkContext;
      if (label) meta.label = label;
      track('link_click', path, meta).catch(() => {});
    },
    [currentUser?.id, actualRole, track]
  );

  const trackChecklist = useCallback(
    (action: string, meta?: { checklist_id?: string; item_id?: string; stage_id?: string; name?: string }) => {
      if (!currentUser?.id || !actualRole) return;
      track('checklist', window.location.pathname || '/', { action, ...meta }).catch(() => {});
    },
    [currentUser?.id, actualRole, track]
  );

  const trackActivity = useCallback(
    (action: string, meta?: { activity_id?: string; name?: string }) => {
      if (!currentUser?.id || !actualRole) return;
      track('activity', window.location.pathname || '/', { action, ...meta }).catch(() => {});
    },
    [currentUser?.id, actualRole, track]
  );

  // Record login only on actual sign-in (SIGNED_IN), not on session restore (INITIAL_SESSION)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') shouldTrackLoginRef.current = true;
    });
    return () => subscription.unsubscribe();
  }, []);

  // When we have user and role and flagged sign-in, track login once
  useEffect(() => {
    if (!currentUser?.id || !actualRole || !shouldTrackLoginRef.current) return;
    shouldTrackLoginRef.current = false;
    trackLogin();
  }, [currentUser?.id, actualRole, trackLogin]);

  // On route change: send previous page with time spent, then send new page view (only when path actually changes)
  useEffect(() => {
    if (!currentUser?.id || !actualRole) return;
    const now = Date.now();
    const currentPath = location.pathname || '/';
    if (previousPath.current !== currentPath) {
      if (previousPath.current) {
        const timeSpent = (now - pathEnteredAt.current) / 1000;
        trackPageView(previousPath.current, timeSpent);
      }
      previousPath.current = currentPath;
      pathEnteredAt.current = now;
      trackPageView(currentPath);
    }
  }, [location.pathname, currentUser?.id, actualRole, trackPageView]);

  return { trackLogin, trackPageView, trackClick, trackLinkClick, trackChecklist, trackActivity };
}

export const UsageAnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { trackLogin, trackPageView, trackClick, trackLinkClick, trackChecklist, trackActivity } = useUsageTracker();
  const value = { trackLogin, trackPageView, trackClick, trackLinkClick, trackChecklist, trackActivity };
  return (
    <UsageAnalyticsContext.Provider value={value}>
      {children}
    </UsageAnalyticsContext.Provider>
  );
};
