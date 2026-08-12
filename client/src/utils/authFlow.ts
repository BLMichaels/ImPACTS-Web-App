/**
 * Password-recovery session helpers.
 *
 * Supabase clears `#type=recovery` from the URL as soon as it establishes a
 * session, so UI must persist recovery intent in sessionStorage (and listen for
 * the PASSWORD_RECOVERY auth event).
 */

export const PASSWORD_RECOVERY_STORAGE_KEY = 'impacts_password_recovery';
export const PASSWORD_RECOVERY_ERROR_KEY = 'impacts_password_recovery_error';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Capture recovery markers from the current URL before Supabase strips them. */
export function capturePasswordRecoveryFromUrl(): boolean {
  const store = storage();
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const queryParams = new URLSearchParams(search);

  const type = hashParams.get('type') || queryParams.get('type');
  const errorDescription =
    hashParams.get('error_description') ||
    queryParams.get('error_description') ||
    hashParams.get('error') ||
    queryParams.get('error');
  const errorCode = hashParams.get('error_code') || queryParams.get('error_code');

  if (errorDescription || errorCode) {
    const message = decodeURIComponent(
      (errorDescription || errorCode || 'Password reset link is invalid or expired.').replace(/\+/g, ' ')
    );
    store?.setItem(PASSWORD_RECOVERY_ERROR_KEY, message);
    // Still treat as recovery attempt so the reset page can show the error.
    store?.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
    return true;
  }

  if (type === 'recovery' || hash.includes('type=recovery') || search.includes('type=recovery')) {
    store?.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
    store?.removeItem(PASSWORD_RECOVERY_ERROR_KEY);
    return true;
  }

  return isPasswordRecoverySession();
}

/** Mark an in-progress recovery after the user requests a reset email. */
export function markPasswordRecoveryPending(): void {
  storage()?.setItem(PASSWORD_RECOVERY_STORAGE_KEY, '1');
  storage()?.removeItem(PASSWORD_RECOVERY_ERROR_KEY);
}

/** True when this browser tab is in a password-recovery flow. */
export function isPasswordRecoverySession(): boolean {
  return storage()?.getItem(PASSWORD_RECOVERY_STORAGE_KEY) === '1';
}

export function getPasswordRecoveryError(): string | null {
  return storage()?.getItem(PASSWORD_RECOVERY_ERROR_KEY) || null;
}

export function clearPasswordRecoverySession(): void {
  const store = storage();
  store?.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
  store?.removeItem(PASSWORD_RECOVERY_ERROR_KEY);
}

/** Canonical redirect target for reset emails (must be allow-listed in Supabase Auth). */
export function getPasswordResetRedirectUrl(): string {
  if (typeof window === 'undefined') return 'https://peccsupporttool.com/reset-password';
  return `${window.location.origin}/reset-password`;
}
