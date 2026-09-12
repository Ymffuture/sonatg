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

      {/* ✦ Large sparkle - top right (≈70% of brain size, radius ~4.1) */}
      <g transform="translate(19.4, 4.1)" filter="url(#sparkle-glow)">
        <path
          d="M0,-4.1 L1.17,-1.17 L4.1,0 L1.17,1.17 L0,4.1 L-1.17,1.17 L-4.1,0 L-1.17,-1.17 Z"
          fill="currentColor"
          stroke="none"
        >
          <animateTransform
            attributeName="transform"
            type="scale"
            values="0.85;1.2;0.85"
            dur="1.8s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;1;0.6"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* ✦ Medium sparkle - bottom left (≈45% of brain size, radius ~2.5) */}
      <g transform="translate(4, 20.5)" filter="url(#sparkle-glow)">
        <path
          d="M0,-2.5 L0.7,-0.7 L2.5,0 L0.7,0.7 L0,2.5 L-0.7,0.7 L-2.5,0 L-0.7,-0.7 Z"
          fill="currentColor"
          stroke="none"
        >
          <animateTransform
            attributeName="transform"
            type="scale"
            values="1.15;0.8;1.15"
            dur="1.8s"
            begin="0.9s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0.55;1"
            dur="1.8s"
            begin="0.9s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* ✦ Tiny accent sparkle - top left (≈25% of brain size, radius ~1.3) */}
      <g transform="translate(3.5, 3.5)">
        <path
          d="M0,-1.3 L0.35,-0.35 L1.3,0 L0.35,0.35 L0,1.3 L-0.35,0.35 L-1.3,0 L-0.35,-0.35 Z"
          fill="currentColor"
          stroke="none"
          opacity="0.75"
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
            values="0.35;0.9;0.35"
            dur="3s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  );
};
