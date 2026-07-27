// Cloudinary support was removed — status media (images/videos) now
// uploads directly to Supabase Storage (see Status.tsx). This file only
// keeps the video-duration helper, since it's plain browser API code with
// nothing Cloudinary-specific about it.

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
