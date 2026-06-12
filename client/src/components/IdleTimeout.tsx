import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { logSecurityEvent } from '../utils/securityEvents';

/** Sign out after this much inactivity (shared-workstation safeguard). */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** How often activity writes/checks run; keeps event handlers cheap. */
const ACTIVITY_THROTTLE_MS = 15 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
/** localStorage key so activity in any tab keeps every tab alive. */
const LAST_ACTIVITY_KEY = 'impacts_last_activity_at';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/**
 * Auto sign-out after inactivity. Mounted once inside the app shell; only
 * active while a user is signed in.
 */
const IdleTimeout = () => {
  const { currentUser } = useAuth();
  const lastWriteRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id) return;

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        /* storage unavailable; interval fallback below still works */
      }
    };

    const readLastActivity = (): number => {
      try {
        const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : lastWriteRef.current;
      } catch {
        return lastWriteRef.current;
      }
    };

    const signOutForIdle = async () => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      void logSecurityEvent('idle_timeout_logout', {
        email: currentUser.email,
        userId: currentUser.id,
        metadata: { idleMs: IDLE_TIMEOUT_MS },
      });
      try {
        await supabase.auth.signOut();
      } finally {
        // Full reload clears in-memory state (important on shared workstations).
        window.location.replace('/login?timeout=1');
      }
    };

    const checkIdle = () => {
      const last = readLastActivity();
      if (last > 0 && Date.now() - last >= IDLE_TIMEOUT_MS) {
        void signOutForIdle();
      }
    };

    markActivity();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
    const interval = window.setInterval(checkIdle, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUser?.id, currentUser?.email]);

  return null;
};

export default IdleTimeout;
