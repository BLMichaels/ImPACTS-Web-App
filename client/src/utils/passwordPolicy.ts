/**
 * Central password policy. AMC security reviews expect a documented, enforced
 * minimum; we use length-first guidance (NIST 800-63B style): 15+ characters.
 */
export const MIN_PASSWORD_LENGTH = 15;

export const PASSWORD_REQUIREMENT_TEXT = `At least ${MIN_PASSWORD_LENGTH} characters. A long passphrase (e.g. several unrelated words) is easier to remember and stronger than a short complex password.`;

/** user_data key set when a user signs in with a password below the current policy. */
export const PASSWORD_UPDATE_REQUIRED_KEY = 'password_update_required';

/** Returns an error message, or null when the password satisfies policy. */
export function validateNewPassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[^\s]/.test(password) || password.trim().length < MIN_PASSWORD_LENGTH) {
    return 'Password cannot be mostly spaces.';
  }
  return null;
}

export function meetsPasswordPolicy(password: string): boolean {
  return validateNewPassword(password) === null;
}
