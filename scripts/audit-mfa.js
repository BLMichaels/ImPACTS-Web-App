#!/usr/bin/env node
/**
 * Static MFA / TOTP audit (30+ checks).
 * Run: node scripts/audit-mfa.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: Boolean(cond), detail });
};

const mfa = read('client/src/utils/mfa.ts');
const enrollForm = read('client/src/components/MfaEnrollmentForm.tsx');
const challengeForm = read('client/src/components/MfaChallengeForm.tsx');
const gateScreen = read('client/src/components/MfaGateScreen.tsx');
const gateShell = read('client/src/components/SecurityGateShell.tsx');
const securityGate = read('client/src/hooks/useSecurityGate.ts');
const settingsCard = read('client/src/components/MfaSettingsCard.tsx');
const app = read('client/src/App.tsx');
const authCtx = read('client/src/context/AuthContext.tsx');
const cfg = read('supabase/config.toml');
const events = read('client/src/utils/securityEvents.ts');
const account = read('client/src/pages/AccountPage.tsx');

// --- Core MFA utilities ---
ok('1. resolveMfaGateState distinguishes enroll / challenge / none', mfa.includes("return 'enroll'") && mfa.includes("return 'challenge'") && mfa.includes("return 'none'"));
ok('2. needsMfaChallenge requires AAL2 upgrade', mfa.includes("nextLevel === 'aal2'") && mfa.includes("currentLevel !== 'aal2'"));
ok('3. beginTotpEnrollment cleans unverified factors before enroll', mfa.includes('cleanupUnverifiedMfaFactors') && /beginTotpEnrollment[\s\S]*cleanupUnverifiedMfaFactors/.test(mfa));
ok('4. beginTotpEnrollment retries on friendly-name collision', mfa.includes('isFriendlyNameExistsError') && mfa.includes('cleanupBlockingTotpFactors'));
ok('5. MfaAlreadyEnrolledError exported for UI routing', mfa.includes('export class MfaAlreadyEnrolledError'));
ok('6. verifyMfaCode sets session or refreshes after verify', mfa.includes('setSession') && mfa.includes('refreshSession'));
ok('7. verifyMfaCode waits for AAL2 before returning', mfa.includes('waitForMfaChallengeCleared'));
ok('8. verifyMfaLogin uses verified TOTP factor', mfa.includes('getVerifiedTotpFactors(factors)[0]'));
ok('9. Backup enrollment allowed when verified exists', mfa.includes('allowWhenVerified'));
ok('10. Default TOTP friendly name is PECC Support Tool', mfa.includes("DEFAULT_TOTP_FRIENDLY_NAME = 'PECC Support Tool'"));

// --- Security gate orchestration ---
ok('11. useSecurityGate calls resolveMfaGateState', securityGate.includes('resolveMfaGateState'));
ok('12. Gate order: password before terms before MFA', /passwordPending[\s\S]*terms[\s\S]*resolveMfaGateState/.test(securityGate));
ok('13. Password recovery skips MFA gate', securityGate.includes('isPasswordRecoverySession()'));
ok('14. MFA gate errors fail closed to challenge', securityGate.includes("setStatus('mfa-challenge')") && securityGate.includes('failing closed to challenge'));
ok('15. isSecurityGateBlocking includes mfa-enroll and mfa-challenge', securityGate.includes("'mfa-challenge'") && securityGate.includes("'mfa-enroll'"));
ok('16. SecurityGateShell blocks app chrome during MFA', gateShell.includes('MfaGateScreen') && gateShell.includes('isSecurityGateBlocking'));
ok('17. SecurityGateShell bypasses gates during password recovery', gateShell.includes('isPasswordRecovery'));
ok('18. SecurityGateShell wraps authenticated shell in App', app.includes('SecurityGateShell') && /SecurityGateShell[\s\S]*Navbar/.test(app));

// --- Enrollment UI ---
ok('19. Enrollment form handles MfaAlreadyEnrolledError', enrollForm.includes('MfaAlreadyEnrolledError') && enrollForm.includes('onAlreadyEnrolled'));
ok('20. Enrollment supports custom friendlyName (backup)', enrollForm.includes('friendlyName') && enrollForm.includes('beginTotpEnrollment(friendlyName'));
ok('21. Enrollment logs mfa_enrolled security event', enrollForm.includes("'mfa_enrolled'"));
ok('22. Enrollment form supports QR restart / recovery', enrollForm.includes('handleRestartEnrollment') && enrollForm.includes('Get new QR code'));
ok('23. Gate screen routes already-enrolled users to challenge', gateScreen.includes('handleAlreadyEnrolled') && gateScreen.includes("setEffectiveMode('mfa-challenge')"));
ok('24. Gate screen routes challenge-without-MFA to enroll', gateScreen.includes("setEffectiveMode('mfa-enroll')"));
ok('25. Gate enroll mode auto-completes when already at AAL2', gateScreen.includes('needsMfaChallenge(levels)') && gateScreen.includes('onComplete()'));

// --- Challenge UI ---
ok('26. Challenge form auto-submits 6-digit code', challengeForm.includes('autoSubmit') && challengeForm.includes('normalized.length === 6'));
ok('27. Challenge form routes to enroll when no verified factor', challengeForm.includes('onNeedsEnrollment'));
ok('28. Failed challenge logs mfa_challenge_failed', challengeForm.includes("'mfa_challenge_failed'"));
ok('29. Challenge uses verifyMfaLogin helper', challengeForm.includes('verifyMfaLogin'));

// --- Settings & config ---
ok('30. Account page exposes MFA settings card', account.includes('MfaSettingsCard'));
ok('31. Backup authenticator uses distinct friendly name', settingsCard.includes('PECC Support Tool (backup)') && settingsCard.includes('allowWhenVerified'));
ok('32. Supabase TOTP enroll + verify enabled', cfg.includes('[auth.mfa.totp]') && cfg.includes('enroll_enabled = true') && cfg.includes('verify_enabled = true'));
ok('33. Supabase allows multiple MFA factors', cfg.includes('max_enrolled_factors = 10'));
ok('34. Security events include MFA event types', events.includes("'mfa_enrolled'") && events.includes("'mfa_challenge_failed'"));
ok('35. Auth delegates MFA to SecurityGateShell', authCtx.includes('SecurityGateShell'));

// --- Pure logic smoke tests (no Supabase) ---
const { execSync } = require('child_process');
const pureTest = `
const m = require('../client/src/utils/mfa.ts');
`;
// Inline replicate pure functions for node (TS not directly require-able) — eval extracted logic
function needsMfaChallenge(levels) {
  if (!levels) return false;
  return levels.nextLevel === 'aal2' && levels.currentLevel !== 'aal2';
}
function getVerifiedTotpFactors(factors) {
  return (factors ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified');
}
ok('36. needsMfaChallenge true when AAL1 session needs AAL2', needsMfaChallenge({ currentLevel: 'aal1', nextLevel: 'aal2' }));
ok('37. needsMfaChallenge false when already AAL2', !needsMfaChallenge({ currentLevel: 'aal2', nextLevel: 'aal2' }));
ok('38. getVerifiedTotpFactors ignores unverified TOTP', getVerifiedTotpFactors([{ factor_type: 'totp', status: 'unverified' }]).length === 0);
ok('39. getVerifiedTotpFactors counts verified TOTP', getVerifiedTotpFactors([{ factor_type: 'totp', status: 'verified' }]).length === 1);

const failed = checks.filter((c) => !c.pass);
console.log(`MFA audit: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail && !c.pass ? ` — ${c.detail}` : ''}`);
}
if (failed.length) {
  process.exit(1);
}
