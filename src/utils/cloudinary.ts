// Cloudinary support was removed for STATUS media (which now uploads to
// Supabase Storage directly, see Status.tsx) but is used here for VIDEO
// MESSAGES in regular chats — a video attachment can legitimately be
// 50MB+, and Cloudinary's free tier comfortably handles that (100MB per
// file) with proper streaming/transcoding, which isn't what Supabase
// Storage is built for at that size.

import { useServerFn } from "@tanstack/react-start";
import { getCloudinaryUploadSignature } from "@/lib/cloudinary.functions";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  duration?: number; // seconds, present for video uploads
  bytes: number;
};

// Call from a component with:
//   const signUpload = useServerFn(getCloudinaryUploadSignature);
//   await uploadToCloudinary(file, "video", signUpload, (pct) => setProgress(pct));
export async function uploadToCloudinary(
  file: File,
  resourceType: "image" | "video",
  signUpload: ReturnType<typeof useServerFn<typeof getCloudinaryUploadSignature>>,
  onProgress?: (pct: number) => void
): Promise<CloudinaryUploadResult> {
  const { cloudName, apiKey, timestamp, signature, folder } = (await signUpload({
    data: { folder: "chat-videos" },
  })) as { cloudName: string; apiKey: string; timestamp: number; signature: string; folder: string | null };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  if (folder) form.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ secure_url: data.secure_url, public_id: data.public_id, duration: data.duration, bytes: data.bytes });
      } else {
        reject(new Error(`Cloudinary upload failed [${xhr.status}]: ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Video upload failed — check your connection."));
    xhr.send(form);
  });
}

// Reads a video file's duration client-side (in ms) before uploading.
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
