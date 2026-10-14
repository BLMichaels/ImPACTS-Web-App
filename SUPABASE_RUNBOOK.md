# Supabase operations runbook

Apply scripts in the **Supabase SQL editor** for production. Track what you ran and when (internal change log).

**Project:** `ImPACTS_Tracker` · ref `ftpifgzzfwpujlvbqqhu` · org plan **Team**

## Platform (Management API / dashboard)

| Item | Status / how |
| --- | --- |
| Compute | **Micro** (`ci_micro`) — upgraded from Nano (same price on Team; ~1–2 min downtime) |
| Leaked password protection (HIBP) | **Enabled** via Auth config `password_hibp_enabled` |
| SAML 2.0 SSO engine | **Enabled** (`saml_enabled`); add each hospital IdP with CLI below |
| Cursor MCP | Root `.mcp.json` → `https://mcp.supabase.com/mcp?project_ref=ftpifgzzfwpujlvbqqhu` (authenticate once in Cursor) |
| HIPAA / BAA | Deferred until a hospital requires it (Team Plan add-on) |

SP metadata for hospital IT (share when onboarding an IdP):

- EntityID / Metadata: `https://ftpifgzzfwpujlvbqqhu.supabase.co/auth/v1/sso/saml/metadata`
- ACS: `https://ftpifgzzfwpujlvbqqhu.supabase.co/auth/v1/sso/saml/acs`
- CLI: `npx supabase sso info --project-ref ftpifgzzfwpujlvbqqhu`

Add a hospital IdP (after they provide metadata URL or XML):

```bash
npx supabase sso add --project-ref ftpifgzzfwpujlvbqqhu \
  --type saml \
  --metadata-url 'https://idp.example.com/metadata.xml' \
  --domains hospital.org
```

Then insert a row in `hospital_sso_providers` (`email_domain`, `sso_provider_id` from `supabase sso list`, `display_name`). Login uses `signInWithSSO({ domain })`.

Management API (PAT from Dashboard → Account → Access Tokens, or CLI keychain):

```bash
# Example: list compute addons
curl -s "https://api.supabase.com/v1/projects/ftpifgzzfwpujlvbqqhu/billing/addons" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

## Security Advisor hardening

Applied migration `security_advisor_hardening_and_hospital_sso` (see also `SECURITY_ADVISOR_HARDENING_AND_HOSPITAL_SSO.sql`):

- All public tables already had RLS (no `rls_disabled_in_public` findings)
- Pinned `search_path` on SECURITY DEFINER / helper functions
- Revoked `anon` EXECUTE on SECURITY DEFINER RPCs; locked trigger/service helpers to `service_role`
- Moved `fuzzystrmatch` to `extensions` schema
- Created `hospital_sso_providers` for per-hospital SAML domain routing

Re-check: Dashboard → Advisors → Security, or MCP `get_advisors`.

## Core schema & RLS (baseline)

1. `supabase-schema.sql` or incremental migrations your project already uses  
2. `USER_DATA_TABLE.sql` + `RUN_BEFORE_DEMO.sql` (if `user_data` not present)  
3. `USERS_RLS_FIX_500_SECURITY_DEFINER.sql` — avoids recursive `users` policies  
4. `INVITATIONS_AND_CRM_RLS_HARDENING.sql` — invitation + CRM write policies  
5. `CRITICAL_RLS_INVITATIONS_AND_MENTOR_HELPERS.sql` — SECURITY DEFINER helpers for invitations / mentor assignments  

## Security hardening (recommended for hospital/AMC deployments)

1. `HIPAA_AUDIT_LOG_MIGRATION.sql` — audit triggers on users, hospitals, contacts, CRM
2. `SECURITY_EVENTS_AND_AUDIT_HARDENING.sql` — `security_events` table (failed logins, password changes, idle timeouts) + makes `audit_log` append-only

## Password reset (critical)

1. App redirect target is **`/reset-password`** (`getPasswordResetRedirectUrl()`).
2. Supabase Auth → URL Configuration must allow:
   - Site URL: `https://peccsupporttool.com/`
   - Redirect URLs including `https://peccsupporttool.com/reset-password` (and `/**` wildcards).
3. Push auth settings when needed:  
   `npx supabase config push --project-ref ftpifgzzfwpujlvbqqhu --yes`
4. Client uses **implicit** auth flow so recovery links work when the email is opened on a different device than the one that requested the reset.
5. Recovery intent is stored in `sessionStorage` before Supabase strips `#type=recovery` from the URL; MFA/terms/idle gates are skipped until the new password is saved.
6. **Custom SMTP (production):** Zoho Mail for `no.reply@impactscollaborative.com`
   - Host `smtp.zoho.com`, port `587`, sender name `PECC Support Tool`
   - Use a Zoho **Application-Specific Password** (not the mailbox login password)
   - `rate_limit_email_sent` raised to 30/hour while custom SMTP is enabled
   - Auth email templates: Authentication → Email Templates (reset-password branded)

Password policy is **12+ characters**, enforced at four layers:

1. **Supabase Auth** — `minimum_password_length = 12` in `supabase/config.toml`; push with  
   `npx supabase config push --project-ref ftpifgzzfwpujlvbqqhu --yes`  
   (keep production `site_url` / redirect URLs in that file; do not push local dev defaults).
2. **Client** — `client/src/utils/passwordPolicy.ts` on register, invite, account, and admin provision flows.
3. **Edge functions** — `complete-invitation-registration`, `provision-crm-portal-user`.
4. **Legacy users** — flagged at login (`password_update_required` in `user_data`); `ForcePasswordUpdateDialog` blocks the app until updated (requires current + new password when `secure_password_change` is on).  
   Apply `PASSWORD_UPDATE_REQUIRED_GUARD.sql` so users cannot clear the flag without `clear_password_update_required()` RPC (after a successful password change).  
   Apply `SERVICE_CLEAR_PASSWORD_UPDATE_REQUIRED.sql` so admin provisioning can clear stale flags when setting a starting password.

Idle sessions sign out after 30 minutes.

## Manager tier RLS (required after Manager audits)

1. `MANAGER_TIER_HARDENING.sql` — team-scoped hospitals (primary + secondary managers), permissions/tab_visibility limited to supervised mentors + PECCs (`is_manager_permissions_target`), manager cohort create, manager-scoped invitation reads. Re-run this file in the SQL Editor whenever it changes.  
   Replaces optional `HOSPITALS_RLS_MANAGER_SCOPED.sql` (that file now only points here).
2. `USER_DATA_MANAGER_TEAM_REPORT_READ.sql` — managers can SELECT team `user_data` keys used by reports/snapshot (`mentorActivities`, hierarchy ids, legacy activity/gap mirrors). Required for non-empty Mentor hours exports and secondary-manager scope. Apply after `MANAGER_TIER_HARDENING.sql`.

## Multi-factor authentication (MFA)

ImPACTS uses **Supabase TOTP MFA** (free; authenticator apps such as Google Authenticator, 1Password, Authy).

- All users must enroll MFA on first use (full-screen gate via `SecurityGateShell` before any app content loads).
- Returning users with MFA enrolled must enter a code at login and when resuming a session at AAL1.
- Account Settings → Security includes MFA status and optional backup authenticator enrollment.
- Password reset (`Forgot password?` → email → `/reset-password`) skips MFA until the new password is saved; MFA applies again on the next normal sign-in.
- Terms version `2026-06-22` includes mandatory MFA disclosure; existing users must re-accept before the MFA gate runs.

Supabase Auth MFA TOTP is enabled in `supabase/config.toml` (`[auth.mfa.totp]`). Apply `MFA_SECURITY_EVENTS.sql` for MFA audit event types.

- CRM email lists: `CRM_EMAIL_LISTS.sql` — Admin CRM **Lists** tab (named audiences for Staff/PECC/etc. outreach).

- Checklists / mentors: `COMPLETE_CHECKLIST_MIGRATION.sql`  
- Edge rate table: `EDGE_FUNCTION_RATE_LIMITS.sql` (for durable limits on `complete-invitation-registration`)  
- PECC hospital continuity (run in order):  
  1. `HOSPITAL_DATA_TABLE.sql`  
  2. `HOSPITAL_DATA_RLS_POLICIES.sql`  
  3. `HOSPITAL_DATA_BACKFILL.sql`  
  4. `PECC_REPLACEMENT_WORKFLOW.sql`  
  5. `PECC_ACTIVITIES_CONTINUITY_ALIGNMENT.sql`  
  6. `SITE_VISIBILITY_HOSPITAL_DEFAULTS.sql`  
  7. `USER_DATA_PECC_KEYS_DEPRECATION.sql`  
- Other root `*.sql` files: match name to feature; avoid applying duplicates.

## Edge functions

Deploy from repo root (adjust names as needed):

```bash
supabase functions deploy send-invitation-email --no-verify-jwt
supabase functions deploy complete-invitation-registration --no-verify-jwt
supabase functions deploy provision-crm-portal-user
```

`complete-invitation-registration` bootstraps `hospital_data` placeholders for new PECCs **only when a key has no row yet** (it does not overwrite existing site continuity). Redeploy after changes to that function.

**Secrets**

- `ALLOWED_ORIGINS`: comma-separated portal origins (e.g. `https://peccsupporttool.com,https://www.peccsupporttool.com,https://impacts-tau.vercel.app`). If empty, functions fall back to `*` (dev only).
- `APP_BASE_URL`: `https://peccsupporttool.com` (invitation email links).

## Vercel

- Production project: **impacts** (canonical URL: `https://peccsupporttool.com`).
- Legacy `impacts-tau.vercel.app` redirects to `peccsupporttool.com` (same path) via root `vercel.json`.
- Production headers: root `vercel.json` (CSP, X-Frame-Options, etc.).
- Add any third-party `connect-src` / `frame-src` hosts to CSP when integrating new APIs or embeds.

### PECC hospital continuity (client cutover)

After `HOSPITAL_DATA_BACKFILL.sql` has been applied and verified, set on the **impacts** Vercel project (Production):

- `REACT_APP_DISABLE_LEGACY_USER_MIRROR=true` — stops dual-writing and legacy `user_data` reads for continuity keys (redeploy required). Rollup views (staff PECC report, manager mentors, admin snapshot) also skip batched `user_data` reads for those keys and rely on `hospital_data` when a site row exists.
- In Supabase, set `app_settings.disable_legacy_user_data_pecc_keys=true` (or run an update in SQL Editor) to enforce post-cutover write guardrails on deprecated PECC keys in `user_data`.

Optional in the browser: `localStorage` key `impacts_disable_legacy_user_mirror` (`true` / `false`) overrides for testing without a redeploy.
