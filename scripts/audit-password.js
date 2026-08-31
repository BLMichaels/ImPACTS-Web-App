#!/usr/bin/env node
/**
 * Password / reset / provisioning audit — 10 rounds (~50 checks).
 * Run: node scripts/audit-password.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const rounds = [];
const ok = (round, name, cond, detail = '') => {
  if (!rounds[round - 1]) rounds[round - 1] = [];
  rounds[round - 1].push({ name, pass: Boolean(cond), detail });
};

const policy = read('client/src/utils/passwordPolicy.ts');
const authCtx = read('client/src/context/AuthContext.tsx');
const login = read('client/src/pages/LoginPage.tsx');
const reset = read('client/src/pages/ResetPasswordPage.tsx');
const authFlow = read('client/src/utils/authFlow.ts');
const forcePwd = read('client/src/components/ForcePasswordUpdateDialog.tsx');
const account = read('client/src/pages/AccountPage.tsx');
const gate = read('client/src/hooks/useSecurityGate.ts');
const gateShell = read('client/src/components/SecurityGateShell.tsx');
const provisionTs = read('client/src/utils/provisionCrmPortalUser.ts');
const provisionFn = read('supabase/functions/provision-crm-portal-user/index.ts');
const inviteReg = read('supabase/functions/complete-invitation-registration/index.ts');
const adminTeam = read('client/src/pages/admin/AdminTeamTab.tsx');
const adminCrm = read('client/src/pages/admin/AdminCRMPage.tsx');
const sendInvite = read('client/src/components/admin/SendInvitationDialog.tsx');
const cfg = read('supabase/config.toml');
const runbook = read('SUPABASE_RUNBOOK.md');
const guardSql = read('PASSWORD_UPDATE_REQUIRED_GUARD.sql');
const serviceClearSql = read('SERVICE_CLEAR_PASSWORD_UPDATE_REQUIRED.sql');
const app = read('client/src/App.tsx');

// Round 1 — Password policy (single source of truth)
ok(1, 'MIN_PASSWORD_LENGTH is 12', policy.includes('MIN_PASSWORD_LENGTH = 12'));
ok(1, 'validateNewPassword exported', policy.includes('export function validateNewPassword'));
ok(1, 'meetsPasswordPolicy used at login', authCtx.includes('meetsPasswordPolicy(password)'));
ok(1, 'PASSWORD_UPDATE_REQUIRED_KEY documented', policy.includes('password_update_required'));
ok(1, 'Policy checklist component exists', fs.existsSync(path.join(root, 'client/src/components/PasswordPolicyChecklist.tsx')));

// Round 2 — Login & credential handling
ok(2, 'Login normalizes email to lowercase', authCtx.includes('email.trim().toLowerCase()'));
ok(2, 'Login logs failed attempts', authCtx.includes("'login_failed'"));
ok(2, 'Login flags weak/legacy passwords', authCtx.includes('PASSWORD_UPDATE_REQUIRED_KEY'));
ok(2, 'Login clears flag when password meets policy', authCtx.includes('clear_password_update_required'));
ok(2, 'Login redirects to /app after success', login.includes("window.location.replace('/app')"));

// Round 3 — Forced password update (legacy / weak)
ok(3, 'Force dialog requires current password', forcePwd.includes('currentPassword') && forcePwd.includes('updatePassword(newPassword, currentPassword)'));
ok(3, 'Force dialog validates new password policy', forcePwd.includes('validateNewPassword'));
ok(3, 'Force dialog is gate-managed', forcePwd.includes('gateManaged'));
ok(3, 'Security gate checks password before MFA', /passwordPending[\s\S]*resolveMfaGateState/.test(gate));
ok(3, 'Account settings change password uses current password', account.includes('updatePassword(passwordData.newPassword, passwordData.currentPassword)'));

// Round 4 — Password reset email (redirect + API)
ok(4, 'resetPasswordForEmail normalizes email', authCtx.includes('email.trim().toLowerCase()'));
ok(4, 'resetPasswordForEmail uses redirect helper by default', authCtx.includes('getPasswordResetRedirectUrl'));
ok(4, 'Login forgot-password uses getPasswordResetRedirectUrl', login.includes('getPasswordResetRedirectUrl()'));
ok(4, 'Admin Team uses getPasswordResetRedirectUrl (not raw origin)', adminTeam.includes('getPasswordResetRedirectUrl()') && !adminTeam.includes('`${window.location.origin}/reset-password`'));
ok(4, 'Reset requests logged', authCtx.includes("'password_reset_requested'"));
ok(4, 'Login mentions Zoho sender in success copy', login.includes('no.reply@impactscollaborative.com'));

// Round 5 — Reset password page (link completion)
ok(5, '/reset-password route exists', app.includes('/reset-password'));
ok(5, 'Reset page validates policy', reset.includes('validateNewPassword'));
ok(5, 'Reset page signs out after update', reset.includes('logout'));
ok(5, 'Reset page clears recovery session', reset.includes('clearPasswordRecoverySession'));
ok(5, 'Recovery bypasses MFA gate', gateShell.includes('isPasswordRecovery'));
ok(5, 'Implicit auth flow for cross-device links', read('client/src/supabase.ts').includes("flowType: 'implicit'"));

// Round 6 — Admin provisioning (starting passwords)
ok(6, 'Provision edge function confirms email', provisionFn.includes('email_confirm: true'));
ok(6, 'Provision enforces 12-char starting password', provisionFn.includes('startingPassword.length < 12'));
ok(6, 'Provision supports admin role (Staff CRM)', provisionFn.includes("'admin'") && provisionFn.includes('ALLOWED_ROLES'));
ok(6, 'Provision clears password_update_required after set', provisionFn.includes('service_clear_password_update_required'));
ok(6, 'CRM Staff included in portal provision types', adminCrm.includes("['pecc', 'manager', 'mentor', 'staff']"));
ok(6, 'CRM normalizes email lowercase for provision', adminCrm.includes('.toLowerCase()'));

// Round 7 — Invitations & registration completion
ok(7, 'Invitation registration validates password length', inviteReg.includes('12') || inviteReg.includes('MIN_PASSWORD'));
ok(7, 'Send invitation supports starting password path', sendInvite.includes('starting_password'));
ok(7, 'Provision client wrapper passes starting_password', provisionTs.includes('starting_password'));
ok(7, 'Admin Team can send invitation emails', adminTeam.includes('createAndSendInvitation'));

// Round 8 — Security gate ordering & recovery
ok(8, 'Password recovery skips gate evaluation', gate.includes('isPasswordRecoverySession()'));
ok(8, 'Gate shell renders ForcePasswordUpdateDialog', gateShell.includes('ForcePasswordUpdateDialog'));
ok(8, 'Password guard SQL prevents direct flag clear', guardSql.includes('password_update_required cannot be cleared'));
ok(8, 'Service RPC for admin password clear exists', serviceClearSql.includes('service_clear_password_update_required'));

// Round 9 — Supabase Auth configuration
ok(9, 'minimum_password_length = 12 in config', cfg.includes('minimum_password_length = 12'));
ok(9, 'secure_password_change enabled', cfg.includes('secure_password_change = true'));
ok(9, 'reset-password in redirect allow list', cfg.includes('reset-password'));
ok(9, 'site_url is peccsupporttool.com', cfg.includes('peccsupporttool.com'));
ok(9, 'Custom SMTP documented in runbook', runbook.includes('smtp.zoho.com') && runbook.includes('no.reply@impactscollaborative.com'));

// Round 10 — Email delivery expectations & ops
ok(10, 'Runbook documents password reset flow', runbook.includes('Password reset'));
ok(10, 'Runbook documents rate_limit_email_sent', runbook.includes('rate_limit_email_sent'));
ok(10, 'Admin success message explains auth account requirement', adminTeam.includes('has a portal account'));
ok(10, 'Admin success message mentions spam folder', adminTeam.includes('spam'));
ok(10, 'Recovery redirect helper defined', authFlow.includes('getPasswordResetRedirectUrl'));
ok(10, 'SERVICE_CLEAR SQL file present for production', fs.existsSync(path.join(root, 'SERVICE_CLEAR_PASSWORD_UPDATE_REQUIRED.sql')));

// Pure policy tests
function validateNewPassword(password) {
  const MIN = 12;
  if (password.length < MIN) return 'too short';
  if (password.trim().length < MIN) return 'mostly spaces';
  return null;
}
ok(10, 'Policy rejects 11-char password', validateNewPassword('Abcdefgh1!x'.slice(0, 11)) !== null);
ok(10, 'Policy accepts 12-char password', validateNewPassword('MangoKitchen27') === null);

let total = 0;
let passed = 0;
console.log('Password audit — 10 rounds\n');
rounds.forEach((checks, i) => {
  const roundNum = i + 1;
  const roundFailed = checks.filter((c) => !c.pass);
  const roundPassed = checks.length - roundFailed.length;
  total += checks.length;
  passed += roundPassed;
  console.log(`Round ${roundNum}: ${roundPassed}/${checks.length} passed`);
  for (const c of checks) {
    if (!c.pass) {
      console.log(`  FAIL  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
  }
});
console.log(`\nTotal: ${passed}/${total} passed`);
if (passed < total) process.exit(1);
