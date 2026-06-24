import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../supabase';
import { logSecurityEvent } from '../utils/securityEvents';
import {
  meetsPasswordPolicy,
  PASSWORD_UPDATE_REQUIRED_KEY,
  validateNewPassword,
} from '../utils/passwordPolicy';
import { setUserData } from '../utils/userData';
import { clearSessionActivity, markSessionActive } from '../utils/sessionActivity';

export type LoginResult = 'complete' | 'mfa_required';

// Extended User type with uid for backward compatibility
interface ExtendedUser extends User {
  uid: string;
}

interface AuthContextType {
  currentUser: ExtendedUser | null;
  session: Session | null;
  loading: boolean;
  /** Last auth lifecycle note (e.g. token refresh) for debugging; not shown in UI by default. */
  authLifecycleNote: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPasswordForEmail: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (newPassword: string, currentPassword?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to extend user with uid property
const extendUser = (user: User | null): ExtendedUser | null => {
  if (!user) return null;
  return { ...user, uid: user.id };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<ExtendedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLifecycleNote, setAuthLifecycleNote] = useState<string | null>(null);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      void logSecurityEvent('login_failed', { email, metadata: { reason: error.message } });
      throw error;
    }
    if (data.user) setCurrentUser(extendUser(data.user));
    if (data.session) setSession(data.session);
    markSessionActive();
    // Legacy / weak passwords: flag before navigation so ForcePasswordUpdateDialog opens.
    const weakReasons = (data as { weakPassword?: { reasons?: string[] } })?.weakPassword?.reasons;
    const needsPasswordUpdate =
      !!data.user && (!meetsPasswordPolicy(password) || (weakReasons?.length ?? 0) > 0);
    if (needsPasswordUpdate && data.user) {
      await setUserData(data.user.id, PASSWORD_UPDATE_REQUIRED_KEY, true);
      void logSecurityEvent('password_update_required', {
        email,
        userId: data.user.id,
        metadata: {
          source: weakReasons?.length ? 'supabase_weak_password' : 'legacy_length',
          reasons: weakReasons,
        },
      });
    }

    // MFA challenge/enrollment is handled by MfaGateDialog after navigation.
    return 'complete';
  };

  const signup = async (email: string, password: string) => {
    const policyError = validateNewPassword(password);
    if (policyError) throw new Error(policyError);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    // Note: User may need to confirm email before session is active
    if (data.user) setCurrentUser(extendUser(data.user));
    if (data.session) setSession(data.session);
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearSessionActivity();
    setCurrentUser(null);
    setSession(null);
  };

  const resetPasswordForEmail = async (email: string, redirectTo?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined)
    });
    if (error) throw error;
    void logSecurityEvent('password_reset_requested', { email });
  };

  const updatePassword = async (newPassword: string, currentPassword?: string) => {
    const policyError = validateNewPassword(newPassword);
    if (policyError) throw new Error(policyError);
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      ...(currentPassword ? { current_password: currentPassword } : {}),
    });
    if (error) throw error;
    const userId = data.user?.id ?? currentUser?.id;
    if (userId) {
      const { error: clearError } = await supabase.rpc('clear_password_update_required');
      if (clearError) {
        console.warn('[Auth] failed to clear password update flag', clearError.message);
      }
      void logSecurityEvent('password_updated', {
        email: data.user?.email ?? currentUser?.email,
        userId,
      });
    }
    markSessionActive();
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[Auth] getSession failed:', error.message);
        setAuthLifecycleNote(`session_error:${error.message}`);
      }
      setSession(session);
      setCurrentUser(extendUser(session?.user ?? null));
      setLoading(false);
    });

    // Listen for auth changes (refresh, sign-out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        setAuthLifecycleNote(null);
      } else if (event === 'SIGNED_OUT') {
        setAuthLifecycleNote(null);
        clearSessionActivity();
      } else if (event === 'SIGNED_IN') {
        markSessionActive();
      } else if (event === 'USER_UPDATED') {
        setAuthLifecycleNote(null);
      }
      setSession(session);
      setCurrentUser(extendUser(session?.user ?? null));
      setLoading(false);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void supabase.auth.getSession().then(({ data: { session: s }, error }) => {
        if (error) console.warn('[Auth] refresh on visibility failed:', error.message);
        else if (s) {
          setSession(s);
          setCurrentUser(extendUser(s.user));
        }
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const value = {
    currentUser,
    session,
    loading,
    authLifecycleNote,
    login,
    signup,
    logout,
    resetPasswordForEmail,
    updatePassword,
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress aria-label="Loading session" />
        <Typography variant="body2" color="text.secondary">
          Signing you in…
        </Typography>
      </Box>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
