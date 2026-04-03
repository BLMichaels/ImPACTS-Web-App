import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { supabase } from '../supabase';

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
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPasswordForEmail: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
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

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) setCurrentUser(extendUser(data.user));
    if (data.session) setSession(data.session);
  };

  const signup = async (email: string, password: string) => {
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
    setCurrentUser(null);
    setSession(null);
  };

  const resetPasswordForEmail = async (email: string, redirectTo?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined)
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
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
