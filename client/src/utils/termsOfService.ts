import { setUserData } from './userData';

/** Bump when Terms content changes materially; triggers re-acceptance for existing users. */
export const CURRENT_TERMS_VERSION = '2026-06-12';

export const TERMS_LAST_UPDATED_LABEL = 'June 12, 2026';

export const TERMS_ACCEPTED_AT_KEY = 'terms_accepted_at';
export const TERMS_VERSION_KEY = 'terms_accepted_version';

export function needsTermsReacceptance(acceptedVersion: string | null | undefined): boolean {
  if (!acceptedVersion) return true;
  return acceptedVersion !== CURRENT_TERMS_VERSION;
}

export async function recordTermsAcceptance(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await setUserData(userId, TERMS_ACCEPTED_AT_KEY, now);
  await setUserData(userId, TERMS_VERSION_KEY, CURRENT_TERMS_VERSION);
}
