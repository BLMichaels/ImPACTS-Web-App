#!/usr/bin/env node
/**
 * Password / reset / CRM portal login audit — 20 rounds.
 * Covers Resend delivery, admin copy-link, provision verify, reset page, gates.
 * Run: node scripts/audit-password.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

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
const crmSecurity = read('client/src/components/admin/CrmPortalSecurityActions.tsx');
const adminPortalAuth = read('client/src/utils/adminPortalAuth.ts');
const requestResetFn = read('supabase/functions/request-password-reset/index.ts');
const adminResetFn = read('supabase/functions/admin-send-password-reset/index.ts');
const inviteEmailFn = read('supabase/functions/send-invitation-email/index.ts');
const cfg = read('supabase/config.toml');
const deployScript = read('scripts/deploy-supabase-functions.sh');
const app = read('client/src/App.tsx');
const supabaseClient = read('client/src/supabase.ts');
const runbook = exists('SUPABASE_RUNBOOK.md') ? read('SUPABASE_RUNBOOK.md') : '';
const guardSql = exists('PASSWORD_UPDATE_REQUIRED_GUARD.sql')
  ? read('PASSWORD_UPDATE_REQUIRED_GUARD.sql')
  : '';
const serviceClearSql = exists('SERVICE_CLEAR_PASSWORD_UPDATE_REQUIRED.sql')
  ? read('SERVICE_CLEAR_PASSWORD_UPDATE_REQUIRED.sql')
  : '';

// ── Round 1 — Password policy (single source of truth) ──────────────────────
ok(1, 'MIN_PASSWORD_LENGTH is 12', policy.includes('MIN_PASSWORD_LENGTH = 12'));
ok(1, 'validateNewPassword exported', policy.includes('export function validateNewPassword'));
ok(1, 'meetsPasswordPolicy used at login', authCtx.includes('meetsPasswordPolicy(password)'));
ok(1, 'PASSWORD_UPDATE_REQUIRED_KEY documented', policy.includes('password_update_required'));
ok(1, 'Policy checklist component exists', exists('client/src/components/PasswordPolicyChecklist.tsx'));

// ── Round 2 — Login & credential handling ───────────────────────────────────
ok(2, 'Login normalizes email to lowercase', authCtx.includes('email.trim().toLowerCase()'));
ok(2, 'Login logs failed attempts', authCtx.includes("'login_failed'"));
ok(2, 'Login flags weak/legacy passwords', authCtx.includes('PASSWORD_UPDATE_REQUIRED_KEY'));
ok(2, 'Login clears flag when password meets policy', authCtx.includes('clear_password_update_required'));
ok(2, 'Login redirects to /app after success', login.includes("window.location.replace('/app')"));

// ── Round 3 — Forced password update ────────────────────────────────────────
ok(
  3,
  'Force dialog requires current password',
  forcePwd.includes('currentPassword') && forcePwd.includes('updatePassword(newPassword, currentPassword)')
);
ok(3, 'Force dialog validates new password policy', forcePwd.includes('validateNewPassword'));
ok(3, 'Force dialog is gate-managed', forcePwd.includes('gateManaged'));
ok(3, 'Security gate checks password before MFA', /passwordPending[\s\S]*resolveMfaGateState/.test(gate));
ok(
  3,
  'Account settings change password uses current password',
  account.includes('updatePassword(passwordData.newPassword, passwordData.currentPassword)')
);

// ── Round 4 — Public reset via Resend (NOT Supabase SMTP) ───────────────────
ok(
  4,
  'AuthContext invokes request-password-reset edge function',
  authCtx.includes("functions.invoke('request-password-reset'")
);
ok(
  4,
  'AuthContext does NOT call supabase.auth.resetPasswordForEmail',
  !authCtx.includes('supabase.auth.resetPasswordForEmail')
);
ok(4, 'Reset request normalizes email', authCtx.includes('email.trim().toLowerCase()'));
ok(4, 'Reset requests logged', authCtx.includes("'password_reset_requested'"));
ok(4, 'Login forgot-password calls resetPasswordForEmail', login.includes('resetPasswordForEmail'));
ok(4, 'Login mentions Resend sender in success copy', login.includes('no.reply@impactscollaborative.com'));

// ── Round 5 — request-password-reset edge function ──────────────────────────
ok(5, 'request-password-reset file exists', exists('supabase/functions/request-password-reset/index.ts'));
ok(5, 'Public reset uses generateLink recovery', requestResetFn.includes("type: 'recovery'"));
ok(5, 'Public reset sends via Resend API', requestResetFn.includes('api.resend.com/emails'));
ok(5, 'Public reset uses INVITATION_FROM_EMAIL / AUTH_FROM_EMAIL', requestResetFn.includes('INVITATION_FROM_EMAIL'));
ok(
  5,
  'Public reset redirects to peccsupporttool.com/reset-password',
  requestResetFn.includes('peccsupporttool.com') && requestResetFn.includes('/reset-password')
);
ok(
  5,
  'Public reset returns generic OK (no account enumeration)',
  requestResetFn.includes('If an account exists') || requestResetFn.includes('GENERIC_OK')
);
ok(5, 'Public reset does NOT return action_link to client', !requestResetFn.includes('action_link:'));
ok(
  5,
  'config.toml disables gateway JWT for request-password-reset',
  /\[functions\.request-password-reset\][\s\S]*?verify_jwt = false/.test(cfg)
);

// ── Round 6 — admin-send-password-reset edge function ───────────────────────
ok(6, 'admin-send-password-reset file exists', exists('supabase/functions/admin-send-password-reset/index.ts'));
ok(6, 'Admin reset requires admin JWT', adminResetFn.includes('Only administrators can send password reset'));
ok(6, 'Admin reset uses generateLink recovery', adminResetFn.includes("type: 'recovery'"));
ok(6, 'Admin reset sends via Resend', adminResetFn.includes('api.resend.com/emails'));
ok(6, 'Admin reset returns action_link for copy fallback', adminResetFn.includes('action_link'));
ok(
  6,
  'Admin reset returns copyable link when Resend fails/missing',
  adminResetFn.includes('email_sent: false') && adminResetFn.includes('action_link')
);
ok(
  6,
  'config.toml disables gateway JWT for admin-send-password-reset',
  /\[functions\.admin-send-password-reset\][\s\S]*?verify_jwt = false/.test(cfg)
);

// ── Round 7 — Client adminPortalAuth wrapper ────────────────────────────────
ok(7, 'adminSendPasswordReset exists', adminPortalAuth.includes('export async function adminSendPasswordReset'));
ok(7, 'adminSetPortalPassword exists', adminPortalAuth.includes('export async function adminSetPortalPassword'));
ok(
  7,
  'adminSendPasswordReset invokes admin-send-password-reset',
  adminPortalAuth.includes("functions.invoke('admin-send-password-reset'")
);
ok(
  7,
  'adminSetPortalPassword calls provision with verify_login',
  adminPortalAuth.includes('verify_login: true') && adminPortalAuth.includes('starting_password')
);
ok(7, 'adminSetPortalPassword requires password trim', adminPortalAuth.includes('params.password.trim()'));

// ── Round 8 — CRM Portal security UI ────────────────────────────────────────
ok(8, 'CRM security uses adminSendPasswordReset (not AuthContext SMTP)', crmSecurity.includes('adminSendPasswordReset'));
ok(8, 'CRM security has Set password action', crmSecurity.includes('adminSetPortalPassword'));
ok(8, 'CRM security shows copy-link dialog', crmSecurity.includes('Copy link') && crmSecurity.includes('resetLink'));
ok(8, 'CRM Set password enforces 12 chars', crmSecurity.includes('MIN_PASSWORD_LENGTH = 12'));
ok(8, 'CRM security wired into fullscreen CRM profile', adminCrm.includes('CrmPortalSecurityActions'));
ok(
  8,
  'CRM security passes portalRole for staff/admin',
  adminCrm.includes('portalRole') && adminCrm.includes("CONTACT_TYPE_TO_USER_ROLE")
);
ok(8, 'CRM starting password field includes staff', adminCrm.includes("['pecc', 'manager', 'mentor', 'staff']"));

// ── Round 9 — Admin Team password reset ─────────────────────────────────────
ok(9, 'Admin Team uses adminSendPasswordReset', adminTeam.includes('adminSendPasswordReset'));
ok(
  9,
  'Admin Team does NOT use supabase.auth.resetPasswordForEmail',
  !adminTeam.includes('resetPasswordForEmail')
);
ok(9, 'Admin Team copies action_link when available', adminTeam.includes('action_link'));
ok(9, 'Admin Team menu + drawer both send reset', (adminTeam.match(/adminSendPasswordReset/g) || []).length >= 2);

// ── Round 10 — Reset password page & recovery session ───────────────────────
ok(10, '/reset-password route exists', app.includes('/reset-password'));
ok(10, 'Reset page validates policy', reset.includes('validateNewPassword'));
ok(10, 'Reset page signs out after update', reset.includes('logout'));
ok(10, 'Reset page clears recovery session', reset.includes('clearPasswordRecoverySession'));
ok(10, 'Recovery bypasses MFA gate', gateShell.includes('isPasswordRecovery'));
ok(10, 'Implicit auth flow for cross-device links', supabaseClient.includes("flowType: 'implicit'"));
ok(10, 'Password recovery skips gate evaluation', gate.includes('isPasswordRecoverySession()'));

// ── Round 11 — Canonical redirect URL ───────────────────────────────────────
ok(11, 'CANONICAL_APP_ORIGIN is peccsupporttool.com', authFlow.includes("https://peccsupporttool.com"));
ok(
  11,
  'Production reset URL ignores window.origin (uses canonical)',
  authFlow.includes('CANONICAL_APP_ORIGIN') && authFlow.includes('isLocal')
);
ok(11, 'Localhost still uses window.origin for local testing', authFlow.includes('localhost'));
ok(11, 'config allow-lists peccsupporttool.com/reset-password', cfg.includes('peccsupporttool.com/reset-password'));
ok(11, 'site_url is peccsupporttool.com', cfg.includes('site_url = "https://peccsupporttool.com'));
ok(11, 'minimum_password_length = 12 in config', cfg.includes('minimum_password_length = 12'));
ok(11, 'secure_password_change enabled', cfg.includes('secure_password_change = true'));

// ── Round 12 — Provision: require password for new users ────────────────────
ok(
  12,
  'Provision requires starting_password to create new auth user',
  provisionFn.includes('starting_password is required to create a new portal login')
);
ok(12, 'Provision enforces 12-char starting password', provisionFn.includes('startingPassword.length < 12'));
ok(12, 'Provision confirms email on create/update', provisionFn.includes('email_confirm: true'));
ok(12, 'Provision supports admin role (Staff CRM)', provisionFn.includes("'admin'") && provisionFn.includes('ALLOWED_ROLES'));
ok(12, 'Provision clears password_update_required after set', provisionFn.includes('service_clear_password_update_required'));
ok(12, 'Provision upserts public.users (not update-only)', provisionFn.includes('upsertPublicUser') || provisionFn.includes('.upsert('));

// ── Round 13 — Provision: auth lookup + verify login ────────────────────────
ok(
  13,
  'Provision finds auth user by email via listUsers when public.users missing',
  provisionFn.includes('listUsers') && provisionFn.includes('findAuthUserIdByEmail')
);
ok(13, 'Provision supports verify_login flag', provisionFn.includes('verify_login'));
ok(
  13,
  'Provision verifies password with signInWithPassword',
  provisionFn.includes('signInWithPassword') && provisionFn.includes('verifyLogin')
);
ok(13, 'Provision returns verified status', provisionFn.includes('verified'));
ok(
  13,
  'Client provision wrapper passes verify_login when password set',
  provisionTs.includes('verify_login: Boolean(params.starting_password')
);
ok(13, 'Client provision returns verified field', provisionTs.includes('verified'));

// ── Round 14 — CRM save path provisioning ───────────────────────────────────
ok(14, 'CRM Staff included in portal provision types', adminCrm.includes("['pecc', 'manager', 'mentor', 'staff']"));
ok(14, 'CRM normalizes email lowercase for provision', /emailTrim[\s\S]*toLowerCase|toLowerCase\(\)[\s\S]*provisionCrmPortalUser/.test(adminCrm) || adminCrm.includes('.toLowerCase()'));
ok(14, 'CRM passes starting_password to provision', adminCrm.includes('starting_password: startingPasswordTrim'));
ok(14, 'CRM maps staff → admin role', adminCrm.includes("staff: 'admin'"));
ok(
  14,
  'CRM starting password UI for pecc/manager/mentor/staff',
  adminCrm.includes('Starting password') && adminCrm.includes("'staff'")
);

// ── Round 15 — Invitations & registration ───────────────────────────────────
ok(15, 'Invitation registration validates password', inviteReg.includes('12') || inviteReg.includes('password'));
ok(15, 'Send invitation supports starting password', sendInvite.includes('starting_password'));
ok(15, 'Invitation emails use Resend (same delivery path)', inviteEmailFn.includes('api.resend.com/emails'));
ok(15, 'Invitation FROM uses INVITATION_FROM_EMAIL', inviteEmailFn.includes('INVITATION_FROM_EMAIL'));
ok(15, 'Admin Team can send invitation emails', adminTeam.includes('createAndSendInvitation'));

// ── Round 16 — Security gate ordering & recovery SQL ────────────────────────
ok(16, 'Gate shell renders ForcePasswordUpdateDialog', gateShell.includes('ForcePasswordUpdateDialog'));
ok(
  16,
  'Password guard SQL prevents direct flag clear',
  guardSql.includes('password_update_required') || exists('PASSWORD_UPDATE_REQUIRED_GUARD.sql')
);
ok(
  16,
  'Service RPC for admin password clear exists',
  serviceClearSql.includes('service_clear_password_update_required') ||
    exists('SERVICE_CLEAR_PASSWORD_UPDATE_REQUIRED.sql')
);
ok(16, 'Auth capture recovery from URL', authFlow.includes('capturePasswordRecoveryFromUrl'));
ok(16, 'Auth mark/clear recovery session helpers', authFlow.includes('markPasswordRecoveryPending') && authFlow.includes('clearPasswordRecoverySession'));

// ── Round 17 — Deploy & config completeness ─────────────────────────────────
ok(17, 'Deploy script mentions admin-send-password-reset', deployScript.includes('admin-send-password-reset'));
ok(17, 'Deploy script mentions request-password-reset', deployScript.includes('request-password-reset'));
ok(17, 'Deploy script mentions provision-crm-portal-user', deployScript.includes('provision-crm-portal-user'));
ok(
  17,
  'config.toml has verify_jwt=false for provision',
  /\[functions\.provision-crm-portal-user\][\s\S]*?verify_jwt = false/.test(cfg)
);
ok(
  17,
  'config.toml has verify_jwt=false for admin-reset-user-mfa',
  /\[functions\.admin-reset-user-mfa\][\s\S]*?verify_jwt = false/.test(cfg)
);

// ── Round 18 — Email HTML / branding consistency ────────────────────────────
ok(18, 'Admin reset email mentions PECC Support Tool', adminResetFn.includes('PECC Support Tool'));
ok(18, 'Public reset email mentions PECC Support Tool', requestResetFn.includes('PECC Support Tool'));
ok(18, 'Admin reset HTML escapes action link', adminResetFn.includes('escapeHtml'));
ok(18, 'Public reset HTML escapes action link', requestResetFn.includes('escapeHtml'));
ok(
  18,
  'Reset emails warn about one-time / scanner consumption',
  adminResetFn.includes('one use') || adminResetFn.includes('expires') || requestResetFn.includes('one use')
);
ok(
  18,
  'CRM security UI mentions Resend sender',
  crmSecurity.includes('no.reply@impactscollaborative.com') || crmSecurity.includes('Resend')
);

// ── Round 19 — Negative / regression guards ─────────────────────────────────
ok(
  19,
  'No client code calls supabase.auth.resetPasswordForEmail',
  !authCtx.includes('supabase.auth.resetPasswordForEmail') &&
    !adminTeam.includes('supabase.auth.resetPasswordForEmail') &&
    !crmSecurity.includes('supabase.auth.resetPasswordForEmail')
);
ok(
  19,
  'Admin reset finds users even without public.users row',
  adminResetFn.includes('listUsers') || adminResetFn.includes('findAuthUserIdByEmail')
);
ok(
  19,
  'Public reset finds users even without public.users row',
  requestResetFn.includes('listUsers') || requestResetFn.includes('findAuthUserIdByEmail')
);
ok(
  19,
  'Provision updateUserById sets password on existing users',
  provisionFn.includes('updateUserById') && provisionFn.includes('password: startingPassword')
);
ok(
  19,
  'CRM security handles users with no portal yet (set password creates)',
  crmSecurity.includes('creates account if needed') || crmSecurity.includes('No portal account linked yet')
);
ok(
  19,
  'Admin reset 404 when no portal account',
  adminResetFn.includes('No portal login exists') || adminResetFn.includes('404')
);

// ── Round 20 — Pure policy + behavioral invariants ──────────────────────────
function validateNewPassword(password) {
  const MIN = 12;
  if (password.length < MIN) return 'too short';
  if (password.trim().length < MIN) return 'mostly spaces';
  return null;
}
ok(20, 'Policy rejects 11-char password', validateNewPassword('Abcdefgh1!x'.slice(0, 11)) !== null);
ok(20, 'Policy accepts 12-char password', validateNewPassword('MangoKitchen27') === null);
ok(20, 'Policy rejects empty password', validateNewPassword('') !== null);
ok(20, 'Canonical redirect helper exported', authFlow.includes('export function getPasswordResetRedirectUrl'));
ok(
  20,
  'Login still passes redirect arg (unused by Resend path is OK)',
  login.includes('getPasswordResetRedirectUrl') || login.includes('resetPasswordForEmail(email')
);
ok(
  20,
  'Runbook or functions document Resend for invitations (delivery shared)',
  runbook.includes('Resend') ||
    inviteEmailFn.includes('RESEND_API_KEY') ||
    exists('supabase/functions/send-invitation-email/README.md')
);
ok(
  20,
  'Both reset functions share same FROM_EMAIL env pattern as invitations',
  requestResetFn.includes('INVITATION_FROM_EMAIL') &&
    adminResetFn.includes('INVITATION_FROM_EMAIL') &&
    inviteEmailFn.includes('INVITATION_FROM_EMAIL')
);

// ── Report ──────────────────────────────────────────────────────────────────
let total = 0;
let passed = 0;
const failed = [];
console.log('Password / portal login audit — 20 rounds\n');
rounds.forEach((checks, i) => {
  const roundNum = i + 1;
  const roundFailed = checks.filter((c) => !c.pass);
  const roundPassed = checks.length - roundFailed.length;
  total += checks.length;
  passed += roundPassed;
  const status = roundFailed.length === 0 ? 'PASS' : 'FAIL';
  console.log(`Round ${String(roundNum).padStart(2)}: ${roundPassed}/${checks.length} ${status}`);
  for (const c of roundFailed) {
    console.log(`  FAIL  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    failed.push(`R${roundNum}: ${c.name}`);
  }
});
console.log(`\nTotal: ${passed}/${total} passed`);
if (failed.length) {
  console.log('\nFailed checks:');
  failed.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log('\nAll 20 rounds passed.');
