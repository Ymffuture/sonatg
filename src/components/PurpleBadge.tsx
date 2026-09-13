// components/PurpleBadge.tsx
export function PurpleBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 76 24"
      width="76"
      height="24"
      className={className}
      style={{ background: "transparent" }}
    >
      <defs>
        <linearGradient id="pill-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FAF5FF" /> {/* purple-50 */}
          <stop offset="100%" stopColor="#F3E8FF" /> {/* purple-100 */}
        </linearGradient>
        <linearGradient id="pill-text" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
        <filter id="pill-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#6D28D9" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Background Pill */}
      <rect
        x="0.5"
        y="0.5"
        width="75"
        height="23"
        rx="11.5"
        fill="url(#pill-bg)"
        stroke="#E9D5FF"
        strokeWidth="1"
      />

      {/* Text */}
      <text
        x="50%"
        y="55%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="600"
        fontSize="11"
        letterSpacing="0.05em"
        fill="url(#pill-text)"
        filter="url(#pill-shadow)"
      >
        Purple
      </text>
    </svg>
  );
}
