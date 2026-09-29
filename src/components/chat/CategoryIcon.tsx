import { Briefcase, Gamepad2, GraduationCap, Heart, Music, Plane, Newspaper, HelpCircle, Users } from "lucide-react";

/* ─── Category Icons (no emojis) ─── */
export function CategoryIcon({ category, className = "h-3.5 w-3.5" }: { category?: string; className?: string }) {
  switch (category) {
    case "business": return <Briefcase className={className} />;
    case "gaming": return <Gamepad2 className={className} />;
    case "education": return <GraduationCap className={className} />;
    case "lifestyle": return <Heart className={className} />;
    case "entertainment": return <Music className={className} />;
    case "travel": return <Plane className={className} />;
    case "news": return <Newspaper className={className} />;
    case "support": return <HelpCircle className={className} />;
    default: return <Users className={className} />;
  }
}
