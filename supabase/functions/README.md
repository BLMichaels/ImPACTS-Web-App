# Supabase Edge Functions

## CORS / JWT (important)

If **JWT verification is enabled at the gateway** (Supabase default), **browser CORS preflight fails**: `OPTIONS` requests have **no** `Authorization` header, so the gateway returns 4xx before your function runs.

This repo includes **`supabase/config.toml`** with `verify_jwt = false` for these functions. Auth is still enforced **inside** the function code where needed.

Deploy from the repo root (so `config.toml` is picked up):

```bash
supabase functions deploy send-invitation-email
supabase functions deploy provision-crm-portal-user
supabase functions deploy complete-invitation-registration
```

Or pass the flag explicitly (same effect):

```bash
supabase functions deploy provision-crm-portal-user --no-verify-jwt
supabase functions deploy complete-invitation-registration --no-verify-jwt
supabase functions deploy send-invitation-email --no-verify-jwt
```

**Dashboard:** Edge Functions → select function → Details → disable “Enforce JWT verification” if you deploy without the CLI.

- **`provision-crm-portal-user`** — Verifies the caller is an **admin** via the `Authorization: Bearer` JWT on POST.
- **`complete-invitation-registration`** — Invoked by the invitee (no session); validates invitation in code.

After changing JWT settings, redeploy the function and retest **View as user** from production.
