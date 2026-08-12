import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { logSecurityEvent } from '../utils/securityEvents';
import {
  getLastActivityAt,
  getSessionExpiryReason,
  markSessionActive,
  type SessionExpiryReason,
} from '../utils/sessionActivity';
import { IDLE_TIMEOUT_MS } from '../utils/sessionPolicy';

/** How often activity writes/checks run; keeps event handlers cheap. */
const ACTIVITY_THROTTLE_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Auto sign-out after inactivity or absolute session max.
 * Mounted once inside the app shell; only active while a user is signed in.
 *
 * Important: do NOT reset the activity timestamp on mount/refresh — that was
 * wiping overnight idle and keeping users logged in after a refresh.
 */
const IdleTimeout = () => {
  const { currentUser, isPasswordRecovery } = useAuth();
  const lastWriteRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id || isPasswordRecovery) return;

    signingOutRef.current = false;
    lastWriteRef.current = getLastActivityAt() || Date.now();

    const signOutForExpiry = async (reason: SessionExpiryReason) => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      void logSecurityEvent('idle_timeout_logout', {
        email: currentUser.email,
        userId: currentUser.id,
        metadata: { idleMs: IDLE_TIMEOUT_MS, reason },
      });
      try {
        await supabase.auth.signOut();
      } finally {
        // Full reload clears in-memory state (important on shared workstations).
        window.location.replace('/login?timeout=1');
      }
    };

    const checkExpiry = () => {
      const reason = getSessionExpiryReason(Date.now());
      if (reason) void signOutForExpiry(reason);
    };

    // Check immediately on mount / user change — before any activity reset.
    const mountReason = getSessionExpiryReason(Date.now(), { requireActivityStamp: true });
    if (mountReason) {
      void signOutForExpiry(mountReason);
      return;
    }

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      markSessionActive();
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
    const interval = window.setInterval(checkExpiry, CHECK_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkExpiry();
    };
    const onPageShow = () => checkExpiry();
    const onFocus = () => checkExpiry();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'impacts_last_activity_at' || e.key === 'impacts_session_started_at') {
        checkExpiry();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentUser?.id, currentUser?.email, isPasswordRecovery]);

  return null;
};

export default IdleTimeout;
