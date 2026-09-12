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
      {/* Left hemisphere */}
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54" />
      {/* Right hemisphere */}
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54" />

      {/* ✦ Sparkle – top right */}
      <path
        d="M21 1l.4 1.2L22.6 2.6l-1.2.4L21 4.2l-.4-1.2-1.2-.4 1.2-.4Z"
        fill="currentColor"
        stroke="none"
      />
      {/* ✦ Sparkle – bottom left (smaller) */}
      <path
        d="M3 19l.3.8.8.3-.8.3-.3.8-.3-.8-.8-.3.8-.3Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
};
