import React from 'react';

interface PinDiamondProps {
  className?: string;
}

export const PinDiamond: React.FC<PinDiamondProps> = ({ className = 'h-4 w-4' }) => {
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
        {/* Subtle shimmer filter */}
        <filter id="diamond-shimmer" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 💎 Diamond head (faceted) */}
      <g filter="url(#diamond-shimmer)">
        {/* Diamond outline */}
        <path
          d="M12 2 L17 6 L12 12 L7 6 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        {/* Top facet line */}
        <path d="M7 6 L17 6" stroke="currentColor" strokeWidth="1.5" />
        {/* Inner facet lines */}
        <path d="M9.5 6 L12 2 L14.5 6" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M9.5 6 L12 12 L14.5 6" stroke="currentColor" strokeWidth="1.2" fill="none" />
        
        {/* Shimmer animation */}
        <animate
          attributeName="opacity"
          values="1;0.85;1"
          dur="2.5s"
          repeatCount="indefinite"
        />
      </g>

      {/* 📍 Pin needle */}
      <g>
        {/* Main shaft */}
        <path
          d="M12 12 L12 20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Needle point */}
        <path
          d="M12 20 L12 22"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Subtle sway animation */}
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="-2 12 12; 2 12 12; -2 12 12"
          dur="3s"
          repeatCount="indefinite"
        />
      </g>

      {/* ✨ Small sparkle accent (top-right of diamond) */}
      <g transform="translate(18, 3)">
        <path
          d="M0,-1 L0.3,-0.3 L1,0 L0.3,0.3 L0,1 L-0.3,0.3 L-1,0 L-0.3,-0.3 Z"
          fill="currentColor"
          stroke="none"
          opacity="0.8"
        >
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="1.5s"
            repeatCount="indefinite"
          />
          <animateTransform
            attributeName="transform"
            type="scale"
            values="0.8;1.2;0.8"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </path>
      </g>
    </svg>
  );
};
