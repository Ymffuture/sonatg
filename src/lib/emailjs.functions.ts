// src/lib/emailjs.functions.ts
// Sends transactional emails via EmailJS's REST API from the server
// (not the browser SDK) — used for two things:
//   1. "You have a new message" when a recipient is offline.
//   2. "The app just got an update" when an admin posts an announcement
//      with notify_subscribers on.
//
// EmailJS's browser SDK relies on an Origin header for its free-tier
// abuse check, which a server request doesn't send — so server-side
// calls need the account's Private Key (accessToken) alongside the
// Public Key. Get both from EmailJS → Account → API Keys.

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

interface SendEmailInput {
  templateId: string;
  toEmail: string;
  toName?: string;
  templateParams: Record<string, string>;
}

async function sendViaEmailJS({ templateId, toEmail, toName, templateParams }: SendEmailInput): Promise<void> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !publicKey || !privateKey) {
    console.warn("[emailjs] Missing EMAILJS_SERVICE_ID/EMAILJS_PUBLIC_KEY/EMAILJS_PRIVATE_KEY — skipping email send.");
    return;
  }

  const res = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: { to_email: toEmail, to_name: toName ?? "there", ...templateParams },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`EmailJS send failed [${res.status}]: ${body}`);
  }
}

/** "You have a new message from {senderName}" — sent when the recipient is offline. */
export async function sendOfflineMessageEmail(params: {
  toEmail: string;
  toName: string;
  senderName: string;
  messagePreview: string;
  chatUrl?: string;
}): Promise<void> {
  const templateId = process.env.EMAILJS_OFFLINE_MESSAGE_TEMPLATE_ID;
  if (!templateId) { console.warn("[emailjs] Missing EMAILJS_OFFLINE_MESSAGE_TEMPLATE_ID — skipping."); return; }
  await sendViaEmailJS({
    templateId,
    toEmail: params.toEmail,
    toName: params.toName,
    templateParams: {
      sender_name: params.senderName,
      message_preview: params.messagePreview.slice(0, 200),
      chat_url: params.chatUrl ?? "",
    },
  });
}

/** "The app just got an update" — sent to subscribers when an admin posts an announcement with notify on. */
export async function sendAppUpdateEmail(params: {
  toEmail: string;
  toName: string;
  announcementMessage: string;
}): Promise<void> {
  const templateId = process.env.EMAILJS_APP_UPDATE_TEMPLATE_ID;
  if (!templateId) { console.warn("[emailjs] Missing EMAILJS_APP_UPDATE_TEMPLATE_ID — skipping."); return; }
  await sendViaEmailJS({
    templateId,
    toEmail: params.toEmail,
    toName: params.toName,
    templateParams: { announcement_message: params.announcementMessage },
  });
}
