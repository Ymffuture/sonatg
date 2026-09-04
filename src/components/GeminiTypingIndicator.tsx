// GeminiTypingIndicator.tsx — Organic Blob Merge (Variant 04)
// A gooey, halftone-inspired typing indicator with SVG filter-based blob merging

function GeminiTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#FBBC05]/10 bg-white px-3.5 py-3 shadow-sm dark:bg-[#2A2A2A]">
        <svg width="44" height="16" viewBox="0 0 44 16" aria-label="AI is composing a reply">
          <defs>
            {/* Gooey blob filter — merges overlapping circles organically */}
            <filter id="blob" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>

          <style>{`
            @keyframes blobMoveLeft {
              0%, 100% { cx: 6; opacity: 0.4; }
              25% { cx: 10; opacity: 1; }
              50% { cx: 16; opacity: 0.4; }
              75% { cx: 22; opacity: 1; }
            }
            @keyframes blobMoveRight {
              0%, 100% { cx: 36; opacity: 0.4; }
              25% { cx: 32; opacity: 1; }
              50% { cx: 26; opacity: 0.4; }
              75% { cx: 20; opacity: 1; }
            }
            @keyframes blobCenter {
              0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
              30% { transform: translateY(-4px) scale(1.2); opacity: 1; }
              60% { transform: translateY(0) scale(1); opacity: 0.6; }
            }
            .blob-left {
              animation: blobMoveLeft 2s ease-in-out infinite;
            }
            .blob-right {
              animation: blobMoveRight 2s ease-in-out infinite;
            }
            .blob-center {
              animation: blobCenter 2s ease-in-out infinite;
              animation-delay: 0.3s;
              transform-origin: center;
            }
          `}</style>

          <g filter="url(#blob)">
            <circle cy="8" r="3.5" fill="#FBBC05" className="blob-left" />
            <circle cx="21" cy="8" r="3.5" fill="#EA4335" className="blob-center" />
            <circle cy="8" r="3.5" fill="#4285F4" className="blob-right" />
          </g>
        </svg>
      </div>
    </div>
  );
}

export { GeminiTypingIndicator };
