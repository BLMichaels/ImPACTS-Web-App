# Supabase Edge Functions

## CORS / JWT (important)

If **JWT verification is enabled at the gateway** (Supabase default), **browser CORS preflight fails**: `OPTIONS` requests have **no** `Authorization` header, so the gateway returns 4xx before your function runs.

This repo includes **`supabase/config.toml`** with `verify_jwt = false` for these functions. Auth is still enforced **inside** the function code where needed.

Deploy from the repo root (so `config.toml` is picked up):

```bash
cd "/path/to/ImPACTS-Web-App"   # use your real clone path (must contain supabase/functions/)
supabase functions deploy
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

## Redeploy from your machine (one command)

**You must `cd` into the ImPACTS-Web-App repo root first** (where `supabase/functions` exists). If you run deploy from `~`, you’ll get “No Functions found”.

```bash
cd "/Volumes/4TB Ext HD/BenjaminMichaels-EXT/Documents/GitHub/ImPACTS-Web-App"
./scripts/deploy-supabase-functions.sh
```

Requires either `npx supabase@latest login` once, or:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."   # Dashboard → Account → Access Tokens
export SUPABASE_PROJECT_REF="ftpifgzzfwpujlvbqqhu"
./scripts/deploy-supabase-functions.sh
```

## Redeploy from GitHub

1. Repo → **Settings → Secrets and variables → Actions**
2. Add **`SUPABASE_ACCESS_TOKEN`** (access token) and **`SUPABASE_PROJECT_REF`** (e.g. `ftpifgzzfwpujlvbqqhu`)
3. **Actions → Deploy Supabase Edge Functions → Run workflow**

That deploys all functions in `supabase/functions/` using `supabase/config.toml`.
