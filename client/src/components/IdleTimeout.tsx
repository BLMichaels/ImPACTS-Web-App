import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { logSecurityEvent } from '../utils/securityEvents';
import { LAST_ACTIVITY_KEY, markSessionActive } from '../utils/sessionActivity';
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
 * Auto sign-out after inactivity. Mounted once inside the app shell; only
 * active while a user is signed in.
 */
const IdleTimeout = () => {
  const { currentUser } = useAuth();
  const lastWriteRef = useRef(0);
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!currentUser?.id) return;

    markSessionActive();
    lastWriteRef.current = Date.now();

    const markActivity = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      markSessionActive();
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
