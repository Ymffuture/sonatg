# Send verification emails through EmailJS

This Edge Function hooks into Supabase Auth's **Send Email** hook so that
signup confirmation emails go out through EmailJS using
`verification-email.html` instead of Supabase's default template. Your
client code (`supabase.auth.signUp(...)` in `src/routes/auth.tsx`) does
not change at all — Supabase still owns the token, just not the delivery.

## 1. Get your EmailJS credentials

- Service ID, Template ID, Public Key: EmailJS dashboard → Email Services / Email Templates.
- Private Key: EmailJS dashboard → **Account → API Keys**. Required because
  this call happens server-side, not from a browser origin EmailJS trusts.
- Paste `verification-email.html` in as the template body. Set the
  template's "To email" field to `{{to_email}}`.

## 2. Set function secrets

```bash
supabase login
supabase link --project-ref bdwmprepivmqthwipihb

supabase secrets set EMAILJS_SERVICE_ID=service_xxx
supabase secrets set EMAILJS_TEMPLATE_ID=template_xxx
supabase secrets set EMAILJS_PUBLIC_KEY=xxxxxxxx
supabase secrets set EMAILJS_PRIVATE_KEY=xxxxxxxx
supabase secrets set APP_URL=https://sonatg.vercel.app
```

`SEND_EMAIL_HOOK_SECRET` comes from step 4 below — set it after you create
the hook in the dashboard, since Supabase generates that secret for you.

## 3. Deploy the function

```bash
supabase functions deploy send-verification-email --no-verify-jwt
```

`--no-verify-jwt` is required — this endpoint is called by Supabase Auth
itself, not by a logged-in user, so it has no user JWT to check. The
function verifies the request is genuinely from Supabase using the
Standard Webhooks signature instead.

## 4. Wire up the hook in the Supabase Dashboard

1. Go to **Authentication → Hooks**.
2. Enable **Send Email hook**.
3. Point it at:
   `https://<project-ref>.supabase.co/functions/v1/send-verification-email`
4. Supabase shows you a signing secret (starts with `v1,whsec_...`) —
   copy it and set it as a function secret:
   ```bash
   supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxxxxxxxxxx"
   ```
5. Redeploy so the new secret is picked up:
   ```bash
   supabase functions deploy send-verification-email --no-verify-jwt
   ```

## 5. Test it

```bash
supabase functions logs send-verification-email --follow
```

Then sign up with a fresh test email from your app. You should see the
function invoked in the logs, and the styled `verification-email.html`
email should land in the inbox instead of Supabase's plain default.

## Notes

- This hook currently only intercepts `email_action_type === "signup"`.
  Password recovery, magic links, and email-change confirmations fall
  through to Supabase's normal mailer (the function returns a 4xx for
  those cases on purpose) — build separate EmailJS templates for those
  if you want the same treatment, or extend the `if` branch in
  `index.ts`.
- If EmailJS's send call fails (bad credentials, rate limit, etc.), the
  function returns a 500 and the user will simply not receive a signup
  email. Watch the function logs after deploying.
