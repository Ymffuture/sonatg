import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Signed Cloudinary uploads. Unlike the old unsigned-preset approach, this
// keeps CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET server-side only (set
// them in Vercel's Project Settings -> Environment Variables, no VITE_
// prefix — that prefix would bundle them into client JS, which is exactly
// what we don't want for a secret).
//
// Required env vars (server-side, set in Vercel):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const getCloudinaryUploadSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { folder?: string }) => input)
  .handler(async ({ data }) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      const missing = [
        ...(!cloudName ? ["CLOUDINARY_CLOUD_NAME"] : []),
        ...(!apiKey ? ["CLOUDINARY_API_KEY"] : []),
        ...(!apiSecret ? ["CLOUDINARY_API_SECRET"] : []),
      ];
      throw new Error(
        `Cloudinary is not configured on the server. Missing env var(s): ${missing.join(", ")}. Add them in Vercel -> Project Settings -> Environment Variables, then redeploy.`
      );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = { timestamp };
    if (data.folder) paramsToSign.folder = data.folder;

    // Cloudinary signature = sha1(sorted "key=value&..." params + api_secret)
    const toSign = Object.keys(paramsToSign)
      .sort()
      .map((k) => `${k}=${paramsToSign[k]}`)
      .join("&");
    const signature = await sha1Hex(`${toSign}${apiSecret}`);

    return {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: data.folder ?? null,
    };
  });
