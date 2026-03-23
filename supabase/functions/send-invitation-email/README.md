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
   - Add `INVITATION_FROM_EMAIL` = e.g. `ImPACTS <noreply@yourdomain.com>`
   - Add `APP_BASE_URL` = your production app origin, e.g. `https://impacts.example.org`

`INVITATION_FROM_EMAIL` and `APP_BASE_URL` are required in production. The function now returns a configuration error if either is missing/invalid.

Without this deployment and `RESEND_API_KEY`, invitations are still created and the app shows the registration link so you can copy and share it manually; the invitee will not receive an email automatically.

**If you see a CORS error** in the browser when sending an invitation (e.g. "blocked by CORS policy" or "Response to preflight request doesn't pass access control check"):
- Ensure the function is deployed: `supabase functions deploy send-invitation-email --no-verify-jwt`
- The `--no-verify-jwt` flag is required so the browser preflight (OPTIONS) request succeeds; otherwise the request may be rejected before the function runs and the response will not include CORS headers.
- After changing the function code, redeploy so the updated CORS handling is live.
