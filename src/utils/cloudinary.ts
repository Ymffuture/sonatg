// Cloudinary integration for status media (images/videos). Uses a *signed*
// upload: the browser asks our server for a one-time signature (server
// function in src/lib/cloudinary.functions.ts), then uploads directly to
// Cloudinary with that signature. The API secret never reaches the client.
//
// To enable, set these in your deployment environment (e.g. Vercel ->
// Project Settings -> Environment Variables — no VITE_ prefix, these must
// stay server-side):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// If these aren't set, getCloudinaryUploadSignature() throws and callers
// should fall back to Supabase Storage instead.

import { useServerFn } from "@tanstack/react-start";
import { getCloudinaryUploadSignature } from "@/lib/cloudinary.functions";

// There's no reliable client-side way to know whether the server-side
// Cloudinary env vars are set (they're intentionally invisible to the
// browser), so "is Cloudinary configured" is answered by attempting a
// signature request and seeing if it succeeds — see uploadToCloudinary,
// which callers should wrap in try/catch and fall back to Supabase Storage.
export function isCloudinaryConfigured(): boolean {
  return true;
}

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  duration?: number; // seconds, present for video uploads
  bytes: number;
};

// Call this from a component with:
//   const signUpload = useServerFn(getCloudinaryUploadSignature);
//   await uploadToCloudinary(file, "image", signUpload);
export async function uploadToCloudinary(
  file: File,
  resourceType: "image" | "video",
  signUpload: ReturnType<typeof useServerFn<typeof getCloudinaryUploadSignature>>
): Promise<CloudinaryUploadResult> {
  const { cloudName, apiKey, timestamp, signature, folder } = (await signUpload({
    data: { folder: "statuses" },
  })) as { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string | null };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  if (folder) form.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed [${res.status}]: ${body}`);
  }

  const data = await res.json();
  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
    duration: data.duration,
    bytes: data.bytes,
  };
}

// Reads a video file's duration client-side (in ms) before uploading, so we
// can enforce the 60s status limit without waiting on a round trip.
export function readVideoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration * 1000);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Couldn't read video metadata"));
    };
    video.src = URL.createObjectURL(file);
  });
}
