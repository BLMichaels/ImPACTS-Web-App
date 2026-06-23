/** True when the user arrived via a password-reset email link (hash fragment). */
export function isPasswordRecoverySession(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  return hash.includes('type=recovery');
}
