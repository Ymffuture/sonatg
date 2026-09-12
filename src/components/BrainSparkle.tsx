import React from 'react';

interface BrainSparkleProps {
  className?: string;
}

export const BrainSparkle: React.FC<BrainSparkleProps> = ({ className = 'h-4 w-4' }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <defs>
        {/* Soft glow filter for the sparkles */}
        <filter id="sparkle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Brain - left hemisphere */}
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54" />
      {/* Brain - right hemisphere */}
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54" />

      {/* ✦ Large sparkle - top right (twinkles first) */}
      <g transform="translate(20.5, 2.5)" filter="url(#sparkle-glow)">
        <path
          d="M0,-1.3 L0.38,-0.38 L1.3,0 L0.38,0.38 L0,1.3 L-0.38,0.38 L-1.3,0 L-0.38,-0.38 Z"
          fill="currentColor"
          stroke="none"
        >
          {/* Scale pulse */}
          <animateTransform
            attributeName="transform"
            type="scale"
            values="0.85;1.25;0.85"
            dur="1.8s"
            repeatCount="indefinite"
          />
          {/* Opacity twinkle */}
          <animate
            attributeName="opacity"
            values="0.55;1;0.55"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* ✦ Small sparkle - bottom left (twinkles in counter-rhythm) */}
      <g transform="translate(3.5, 20.5)" filter="url(#sparkle-glow)">
        <path
          d="M0,-0.9 L0.26,-0.26 L0.9,0 L0.26,0.26 L0,0.9 L-0.26,0.26 L-0.9,0 L-0.26,-0.26 Z"
          fill="currentColor"
          stroke="none"
        >
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1.2;0.8;1.2"
            dur="1.8s"
            begin="0.9s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="1.8s"
            begin="0.9s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* ✦ Tiny accent sparkle - top left (slow drift) */}
      <g transform="translate(4, 3.5)">
        <path
          d="M0,-0.55 L0.16,-0.16 L0.55,0 L0.16,0.16 L0,0.55 L-0.16,0.16 L-0.55,0 L-0.16,-0.16 Z"
          fill="currentColor"
          stroke="none"
          opacity="0.7"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0;90;0"
            dur="3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.3;0.9;0.3"
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  );
};
