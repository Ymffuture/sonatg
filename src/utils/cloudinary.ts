// Cloudinary integration for status media (images/videos). Uses an
// *unsigned* upload preset, which is the only safe way to upload directly
// from client-side code — a signed upload needs the account's API secret,
// which must never ship in a browser bundle.
//
// To enable: in your Cloudinary dashboard, create an unsigned upload preset
// (Settings -> Upload -> Upload presets -> Add upload preset -> Signing
// Mode: Unsigned), then set these env vars:
//   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
//   VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
//
// If these aren't set, isCloudinaryConfigured() returns false and callers
// should fall back to Supabase Storage instead.

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  );
}

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  duration?: number; // seconds, present for video uploads
  bytes: number;
};

export async function uploadToCloudinary(
  file: File,
  resourceType: "image" | "video"
): Promise<CloudinaryUploadResult> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !preset) {
    throw new Error("Cloudinary is not configured (missing VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET)");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", preset);

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
