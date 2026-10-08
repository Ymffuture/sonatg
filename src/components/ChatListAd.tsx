// src/components/ChatListAd.tsx
// One sponsored card in the chat list. Counts an impression the first time at
// least half of it is on screen, and a click when its button is opened.

import { useEffect, useRef } from "react";
import { AdCard } from "@/components/AdCard";
import { recordAdEvent, type ListAd } from "@/features/ads/useListAds";

export function ChatListAd({ ad }: { ad: ListAd }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          recordAdEvent(ad.id, "impression"); // deduped per session inside
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ad.id]);

  return (
    <div ref={ref} className="px-3 py-2">
      <AdCard
        ad={{ id: ad.id, media_url: ad.media_url, title: ad.title, cta_label: ad.cta_label, cta_url: ad.cta_url }}
        sender={ad.sponsor}
        onCtaClick={() => recordAdEvent(ad.id, "click")}
      />
    </div>
  );
}
