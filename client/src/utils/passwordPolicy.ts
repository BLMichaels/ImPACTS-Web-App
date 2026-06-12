/**
 * Central password policy. AMC security reviews expect a documented, enforced
 * minimum; we use length-first guidance (NIST 800-63B style): 15+ characters.
 */
export const MIN_PASSWORD_LENGTH = 15;

export const PASSWORD_REQUIREMENT_TEXT =
  `At least ${MIN_PASSWORD_LENGTH} characters. Include uppercase (e.g. M), lowercase (e.g. k), a number (e.g. 7), and a symbol (e.g. !). Example: Mango-Kitchen-27!`;

/** user_data key set when a user signs in with a password below the current policy. */
export const PASSWORD_UPDATE_REQUIRED_KEY = 'password_update_required';

export type PasswordPolicyCheckId =
  | 'length'
  | 'uppercase'
  | 'lowercase'
  | 'number'
  | 'symbol'
  | 'not_whitespace';

export interface PasswordPolicyCheck {
  id: PasswordPolicyCheckId;
  label: string;
  example: string;
  met: boolean;
  /** When true, submit is blocked until this check passes. */
  required: boolean;
}

export function getPasswordPolicyChecks(password: string): PasswordPolicyCheck[] {
  const length = password.length;
  return [
    {
      id: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      example: length > 0 ? `${length} / ${MIN_PASSWORD_LENGTH}` : `e.g. ${MIN_PASSWORD_LENGTH}+ characters`,
      met: length >= MIN_PASSWORD_LENGTH,
      required: true,
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter',
      example: 'A–Z (e.g. M)',
      met: /[A-Z]/.test(password),
      required: false,
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter',
      example: 'a–z (e.g. k)',
      met: /[a-z]/.test(password),
      required: false,
    },
    {
      id: 'number',
      label: 'One number',
      example: '0–9 (e.g. 7)',
      met: /\d/.test(password),
      required: false,
    },
    {
      id: 'symbol',
      label: 'One symbol',
      example: '! @ # $ % & *',
      met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password),
      required: false,
    },
    {
      id: 'not_whitespace',
      label: 'Not mostly spaces',
      example: 'Use real characters',
      met: password.length === 0 || (/\S/.test(password) && password.trim().length >= MIN_PASSWORD_LENGTH),
      required: true,
    },
  ];
}

/** Returns an error message, or null when the password satisfies policy. */
export function validateNewPassword(password: string): string | null {
  const checks = getPasswordPolicyChecks(password);
  const failedRequired = checks.filter((check) => check.required && !check.met);
  if (failedRequired.length === 0) return null;

  const lengthCheck = failedRequired.find((check) => check.id === 'length');
  if (lengthCheck) {
    const remaining = MIN_PASSWORD_LENGTH - password.length;
    if (password.length === 0) {
      return `Enter a password with at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (remaining > 0) {
      return `Password is too short — add ${remaining} more character${remaining === 1 ? '' : 's'} (${password.length} of ${MIN_PASSWORD_LENGTH}).`;
    }
  }

  const whitespaceCheck = failedRequired.find((check) => check.id === 'not_whitespace');
  if (whitespaceCheck) {
    return 'Password cannot be mostly spaces.';
  }

  return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
}

export function meetsPasswordPolicy(password: string): boolean {
  return validateNewPassword(password) === null;
}

export function passwordPolicyBlocksSubmit(password: string): boolean {
  return validateNewPassword(password) !== null;
}
