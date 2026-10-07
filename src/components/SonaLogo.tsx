import mark from "@/assets/sona-mark.png.asset.json";
import lightMark from "@/assets/sona-mark-light.png.asset.json";
import wordmark from "@/assets/sona-wordmark.png.asset.json";
import lightWordmark from "@/assets/sona-wordmark-light.png.asset.json";

export function SonaLogo({ className = "", wordmark: full = false, alt = "Sona" }: { className?: string; wordmark?: boolean; alt?: string }) {
  return (
    <>
      <img src={(full ? lightWordmark : lightMark).url} alt={alt} className={`object-contain dark:hidden ${className}`} />
      <img src={(full ? wordmark : mark).url} alt={alt} className={`hidden object-contain dark:block ${className}`} />
    </>
  );
}