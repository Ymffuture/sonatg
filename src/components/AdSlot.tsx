import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

/**
 * Renders a Google AdSense display ad unit and pushes it once mounted.
 *
 * `slot` is a placeholder until you create real ad units in your AdSense
 * dashboard (Ads → By ad unit → Display ads) — that's only possible once
 * your site is approved. Auto ads (enabled via the script tag in
 * __root.tsx) work immediately without needing a slot id at all, so this
 * component is optional extra placement, not required for approval.
 */
export function AdSlot({
  slot,
  format = "auto",
  className = "",
}: {
  slot: string;
  format?: string;
  className?: string;
}) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
    } catch {
      return <p className="text-red-300" >blocked by an ad blocker</p>
      // AdSense script not loaded yet (e.g. blocked by an ad blocker) — fail silently.
    }
  }, []);

  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className}`}
      style={{ display: "block" }}
      data-ad-client="ca-pub-2722864790738174"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
