# send-invitation-email

Supabase Edge Function that sends invitation emails via [Resend](https://resend.com) so invitees receive the registration link by email.

## Deploy (required for emails to be sent)

1. **Resend account**: Sign up at [resend.com](https://resend.com), create an API key, and (for production) verify your domain so mail does not go to spam.

2. **Deploy the function** (from repo root):
   ```bash
   supabase functions deploy send-invitation-email --no-verify-jwt
   ```

3. **Set secrets** in Supabase Dashboard:
   - Project → Edge Functions → send-invitation-email → Secrets
   - Add `RESEND_API_KEY` = your Resend API key
   - Optional: `INVITATION_FROM_EMAIL` = e.g. `ImPACTS <noreply@yourdomain.com>` (defaults to `ImPACTS <onboarding@resend.dev>` which is for testing only)

Without this deployment and `RESEND_API_KEY`, invitations are still created and the app shows the registration link so you can copy and share it manually; the invitee will not receive an email automatically.
