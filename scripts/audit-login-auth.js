#!/usr/bin/env node
/**
 * Static login / password-reset audit (25+ checks).
 * Run: node scripts/audit-login-auth.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const checks = [];
const ok = (name, cond, detail = '') => {
  checks.push({ name, pass: Boolean(cond), detail });
};

const app = read('client/src/App.tsx');
const supabaseTs = read('client/src/supabase.ts');
const authFlow = read('client/src/utils/authFlow.ts');
const authCtx = read('client/src/context/AuthContext.tsx');
const gate = read('client/src/components/SecurityGateShell.tsx');
const idle = read('client/src/components/IdleTimeout.tsx');
const nav = read('client/src/components/Navbar.tsx');
const login = read('client/src/pages/LoginPage.tsx');
const reset = read('client/src/pages/ResetPasswordPage.tsx');
const landing = read('client/src/pages/LandingPage.tsx');
const admin = read('client/src/pages/admin/AdminTeamTab.tsx');
const cfg = read('supabase/config.toml');
const runbook = read('SUPABASE_RUNBOOK.md');
const policy = read('client/src/utils/passwordPolicy.ts');
const mfaGate = read('client/src/hooks/useSecurityGate.ts');

ok('1. /reset-password route registered', app.includes('ResetPasswordPage') && app.includes('/reset-password'));
ok('2. reset-password is full-bleed public shell', app.includes("pathname === '/reset-password'"));
ok('3. ProtectedRoute sends recovery to reset page', app.includes('isPasswordRecovery') && app.includes('Navigate to="/reset-password"'));
ok('4. RoleBasedRedirect respects recovery', /RoleBasedRedirect[\s\S]*isPasswordRecovery/.test(app));
ok('5. Client uses implicit flow (cross-device reset links)', supabaseTs.includes("flowType: 'implicit'"));
ok('6. detectSessionInUrl enabled', supabaseTs.includes('detectSessionInUrl: true'));
ok('7. Recovery markers captured before auth client init', /capturePasswordRecoveryFromUrl\(\);\s*\n[\s\S]*createClient\(/.test(supabaseTs));
ok('8. sessionStorage recovery flag helpers exist', authFlow.includes('PASSWORD_RECOVERY_STORAGE_KEY') && authFlow.includes('isPasswordRecoverySession'));
ok('9. Canonical redirect is /reset-password', authFlow.includes('/reset-password') && authFlow.includes('getPasswordResetRedirectUrl'));
ok('10. Auth listens for PASSWORD_RECOVERY event', authCtx.includes("event === 'PASSWORD_RECOVERY'"));
ok('11. Auth exposes isPasswordRecovery', /isPasswordRecovery:\s*boolean/.test(authCtx) && authCtx.includes('isPasswordRecovery,'));
ok('12. resetPasswordForEmail uses getPasswordResetRedirectUrl', authCtx.includes('getPasswordResetRedirectUrl'));
ok('13. Idle/absolute timeout skipped during recovery (auth)', authCtx.includes('isPasswordRecoverySession()') && authCtx.includes('Never idle-timeout'));
ok('14. SecurityGateShell bypasses MFA/terms during recovery', gate.includes('isPasswordRecovery'));
ok('15. useSecurityGate still has hash/session recovery check', mfaGate.includes('isPasswordRecoverySession'));
ok('16. IdleTimeout inactive during recovery', idle.includes('isPasswordRecovery'));
ok('17. Navbar hidden during reset/recovery', nav.includes("pathname === '/reset-password'") && nav.includes('isPasswordRecovery'));
ok('18. LoginPage redirects recovery sessions to reset page', login.includes("navigate('/reset-password'"));
ok('19. Forgot-password sends redirectTo reset page', login.includes('getPasswordResetRedirectUrl'));
ok('20. LoginPage no longer hosts set-password form', !login.includes('handleSetPasswordSubmit') && !login.includes('setPasswordSuccess'));
ok('21. Reset page updates password then signs out', reset.includes('updatePassword') && reset.includes('logout') && reset.includes('clearPasswordRecoverySession'));
ok('22. Reset page handles expired/missing link errors', reset.includes('getPasswordRecoveryError') && reset.includes('Request a new reset link'));
ok('23. Landing redirects recovery to reset page', landing.includes('isPasswordRecovery') && landing.includes('/reset-password'));
ok('24. Admin team reset emails target /reset-password', (admin.match(/\/reset-password/g) || []).length >= 2);
ok('25. Supabase config allows reset-password redirect + site_url', cfg.includes('peccsupporttool.com') && cfg.includes('reset-password') && cfg.includes('minimum_password_length = 12'));
ok('26. Runbook documents password reset + SMTP branding', runbook.includes('Password reset') && runbook.includes('Custom SMTP'));
ok('27. Password policy minimum is 12', policy.includes('MIN_PASSWORD_LENGTH = 12'));
ok('28. Reset page includes policy checklist', reset.includes('PasswordPolicyChecklist'));
ok('29. AuthClient clears recovery flag after normal sign-out off reset page', authCtx.includes("!window.location.pathname.startsWith('/reset-password')"));
ok('30. secure_password_change documented in config (recovery still uses updateUser)', cfg.includes('secure_password_change = true'));

const failed = checks.filter((c) => !c.pass);
console.log(`Login/auth audit: ${checks.length - failed.length}/${checks.length} passed\n`);
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail && !c.pass ? ` — ${c.detail}` : ''}`);
}
if (failed.length) {
  process.exit(1);
}
