import { createClient } from '@supabase/supabase-js';
import { capturePasswordRecoveryFromUrl } from './utils/authFlow';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and Anon Key must be set in environment variables');
}

// Capture recovery markers from the URL *before* the auth client strips the hash/query.
capturePasswordRecoveryFromUrl();

/**
 * Implicit flow keeps recovery tokens in the URL hash so the reset link works even when
 * the email is opened on a different device/browser than the one that requested the reset.
 * (PKCE requires the same browser's code verifier and commonly breaks password resets.)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
  },
});

export default supabase;
