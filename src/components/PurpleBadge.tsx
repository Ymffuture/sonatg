// components/PurpleBadge.tsx
export function PurpleBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 44 12"
      width="44"
      height="12"
      className={className}
      style={{ background: "transparent" }}
    >
      <defs>
        <linearGradient 
          id="pg" 
          x1="0%" 
          y1="0%" 
          x2="100%" 
          y2="0%" 
          spreadMethod="repeat"
        >
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="50%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#9333EA" />
          
          {/* Smooth, seamless horizontal shimmer animation */}
          <animate
            attributeName="x1"
            values="0%; 100%; 0%"
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          />
          <animate
            attributeName="x2"
            values="100%; 200%; 100%"
            dur="3s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
          />
        </linearGradient>
      </defs>
      <text
        x="50%"
        y="55%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="'Brush Script MT','Segoe Script','Apple Chancery',cursive"
        fontSize="16"
        fontStyle="italic"
        fill="url(#pg)"
        stroke="#581C87"
        strokeWidth="0.5"
      >
        Purple
      </text>
    </svg>
  );
}
