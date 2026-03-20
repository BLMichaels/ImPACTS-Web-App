#!/usr/bin/env bash
# Deploy all Edge Functions in supabase/functions/ using supabase/config.toml (verify_jwt, etc.).
#
# Option A — local (recommended once):
#   npx supabase@latest login
#   ./scripts/deploy-supabase-functions.sh
#
# Option B — CI token (no interactive login):
#   export SUPABASE_ACCESS_TOKEN="sbp_..."   # Dashboard → Account → Access Tokens
#   export SUPABASE_PROJECT_REF="ftpifgzzfwpujlvbqqhu"   # optional; default below
#   ./scripts/deploy-supabase-functions.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f supabase/config.toml ]]; then
  echo "Expected supabase/config.toml at repo root." >&2
  exit 1
fi

SUPABASE_CLI=(npx --yes supabase@latest)
PROJECT_REF="${SUPABASE_PROJECT_REF:-ftpifgzzfwpujlvbqqhu}"

echo "Deploying Edge Functions to project: $PROJECT_REF"
"${SUPABASE_CLI[@]}" functions deploy --project-ref "$PROJECT_REF"

echo "Done. Functions: provision-crm-portal-user, complete-invitation-registration, send-invitation-email (per supabase/functions/)."
