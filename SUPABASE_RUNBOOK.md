# Supabase operations runbook

Apply scripts in the **Supabase SQL editor** for production. Track what you ran and when (internal change log).

## Core schema & RLS (baseline)

1. `supabase-schema.sql` or incremental migrations your project already uses  
2. `USER_DATA_TABLE.sql` + `RUN_BEFORE_DEMO.sql` (if `user_data` not present)  
3. `USERS_RLS_FIX_500_SECURITY_DEFINER.sql` — avoids recursive `users` policies  
4. `INVITATIONS_AND_CRM_RLS_HARDENING.sql` — invitation + CRM write policies  
5. `CRITICAL_RLS_INVITATIONS_AND_MENTOR_HELPERS.sql` — SECURITY DEFINER helpers for invitations / mentor assignments  

## Security hardening (recommended for hospital/AMC deployments)

1. `HIPAA_AUDIT_LOG_MIGRATION.sql` — audit triggers on users, hospitals, contacts, CRM
2. `SECURITY_EVENTS_AND_AUDIT_HARDENING.sql` — `security_events` table (failed logins, password changes, idle timeouts) + makes `audit_log` append-only

Password policy is **15+ characters**, enforced at four layers:

1. **Supabase Auth** — `minimum_password_length = 15` in `supabase/config.toml`; push with  
   `npx supabase config push --project-ref ftpifgzzfwpujlvbqqhu --yes`  
   (keep production `site_url` / redirect URLs in that file; do not push local dev defaults).
2. **Client** — `client/src/utils/passwordPolicy.ts` on register, invite, account, and admin provision flows.
3. **Edge functions** — `complete-invitation-registration`, `provision-crm-portal-user`.
4. **Legacy users** — flagged at login (`password_update_required` in `user_data`); `ForcePasswordUpdateDialog` blocks the app until updated.  
   Apply `PASSWORD_UPDATE_REQUIRED_GUARD.sql` so users cannot clear the flag without `clear_password_update_required()` RPC (after a successful password change).

Idle sessions sign out after 30 minutes.

## Feature-specific (apply if you use the feature)

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

- `ALLOWED_ORIGINS`: comma-separated portal origins (e.g. `https://app.example.com`). If empty, functions fall back to `*` (dev only).  
- `RESEND_API_KEY`, `INVITATION_FROM_EMAIL`, `APP_BASE_URL` for invitation email.

## Vercel

- Production headers: `client/vercel.json` (CSP, X-Frame-Options, etc.).  
- Add any third-party `connect-src` / `frame-src` hosts to CSP when integrating new APIs or embeds.

### PECC hospital continuity (client cutover)

After `HOSPITAL_DATA_BACKFILL.sql` has been applied and verified, set on the **impacts** Vercel project (Production):

- `REACT_APP_DISABLE_LEGACY_USER_MIRROR=true` — stops dual-writing and legacy `user_data` reads for continuity keys (redeploy required). Rollup views (staff PECC report, manager mentors, admin snapshot) also skip batched `user_data` reads for those keys and rely on `hospital_data` when a site row exists.
- In Supabase, set `app_settings.disable_legacy_user_data_pecc_keys=true` (or run an update in SQL Editor) to enforce post-cutover write guardrails on deprecated PECC keys in `user_data`.

Optional in the browser: `localStorage` key `impacts_disable_legacy_user_mirror` (`true` / `false`) overrides for testing without a redeploy.
