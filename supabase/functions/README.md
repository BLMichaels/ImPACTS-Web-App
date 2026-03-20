# Supabase Edge Functions

Deploy from the repo root (with Supabase CLI linked to the project):

```bash
# Email invitations (existing)
supabase functions deploy send-invitation-email --no-verify-jwt

# CRM: create auth + users row for PECC / Manager / Mentor before invite (admin JWT required)
supabase functions deploy provision-crm-portal-user

# Invitation page: set password when account was pre-provisioned (signUp says "already registered")
supabase functions deploy complete-invitation-registration --no-verify-jwt
```

`provision-crm-portal-user` verifies the caller is an **admin** via the user JWT.

`complete-invitation-registration` is invoked **without** a logged-in user (invitee only has the invitation link), so deploy it with `--no-verify-jwt`.

After deploying new functions, test: save a PECC/Manager/Mentor contact in Admin CRM with an email → **View as this user** should appear; invitation link should still complete registration if an invite is sent later.
