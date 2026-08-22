// supabase/functions/send-verification-email/index.ts
//
// Supabase Auth "Send Email" hook.
// Supabase calls this function instead of its own mailer whenever it
// needs to send an auth email (signup confirmation, magic link,
// recovery, etc). We only special-case "signup" here and forward
// everything else back to Supabase's default behavior by returning
// an error, which makes Supabase fall back to Auth's SMTP config
// (leave your SMTP off if you want *only* EmailJS to ever send).
//
// Setup:
//   1. supabase secrets set SEND_EMAIL_HOOK_SECRET=v1,whsec_xxx  (from Dashboard)
//   2. supabase secrets set EMAILJS_SERVICE_ID=service_xxx
//   3. supabase secrets set EMAILJS_TEMPLATE_ID=template_xxx
//   4. supabase secrets set EMAILJS_PUBLIC_KEY=xxxx
//   5. supabase secrets set EMAILJS_PRIVATE_KEY=xxxx   (EmailJS Account > API Keys — required for server-side calls)
//   6. supabase secrets set APP_URL=https://sonatg.vercel.app
//   7. supabase functions deploy send-verification-email --no-verify-jwt
//   8. In Supabase Dashboard: Authentication > Hooks > "Send Email hook"
//      -> point it at this function and paste the same secret from step 1.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID") ?? "";
const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID") ?? "";
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY") ?? "";
const EMAILJS_PRIVATE_KEY = Deno.env.get("EMAILJS_PRIVATE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://sonatg.vercel.app";

interface SendEmailHookPayload {
  user: {
    email: string;
    user_metadata?: { display_name?: string };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: "signup" | "magiclink" | "recovery" | "invite" | "email_change";
    site_url: string;
  };
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify the request really came from Supabase Auth.
  let verified: SendEmailHookPayload;
  try {
    const wh = new Webhook(HOOK_SECRET);
    verified = wh.verify(payload, headers) as SendEmailHookPayload;
  } catch (err) {
    console.error("Hook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, email_data } = verified;

  // Only handle the signup confirmation case with EmailJS.
  // Everything else (recovery, magic link, ...) falls through to
  // Supabase's own mailer by returning a non-2xx response.
  if (email_data.email_action_type !== "signup") {
    return new Response(JSON.stringify({ error: "not handled, falling back" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const verificationLink =
    `${email_data.site_url}/auth/v1/verify` +
    `?token=${email_data.token_hash}` +
    `&type=signup` +
    `&redirect_to=${encodeURIComponent(email_data.redirect_to || APP_URL)}`;

  const toName = user.user_metadata?.display_name || user.email.split("@")[0];

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        accessToken: EMAILJS_PRIVATE_KEY,
        template_params: {
          to_name: toName,
          to_email: user.email,
          verification_link: verificationLink,
          expiry_hours: 24,
          app_url: APP_URL,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("EmailJS send failed:", res.status, text);
      return new Response(JSON.stringify({ error: "EmailJS send failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error sending verification email:", err);
    return new Response(JSON.stringify({ error: "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
