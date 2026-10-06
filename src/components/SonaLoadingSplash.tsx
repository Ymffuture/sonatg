// SonaLoadingSplash.tsx
//
// Boot splash shown while the app is still loading, before the status page
// skeleton loader appears. Recreates the uploaded hexagon/radial loading
// animation, themed to Sona (accent #E07A5F) with light/dark support.

export function SonaLoadingSplash() {
  return (
    <div className="sona-splash grid min-h-dvh w-full place-items-center bg-[#F0EBE3] dark:bg-[#121212]">
      <svg
        className="sona-splash-svg h-[140px] w-[140px]"
        viewBox="0 0 200 200"
        role="img"
        aria-label="Loading Sona"
      >
        <style>{`
          .sona-splash-svg {
            filter: drop-shadow(0 0 12px rgba(224, 122, 95, 0.25));
          }
          .sona-splash-hex {
            fill: none;
            stroke: #2D3436;
            stroke-width: 3.5;
            filter: drop-shadow(0 0 6px rgba(45, 52, 54, 0.15));
          }
          .dark .sona-splash-hex {
            stroke: #f5f5f5;
            filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.15));
          }
          .sona-splash-ring {
            fill: none;
            stroke: #cfc8bc;
            stroke-width: 1.5;
            stroke-dasharray: 50;
            stroke-dashoffset: 100;
            animation: sonaSplashDraw 4.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
          }
          .dark .sona-splash-ring {
            stroke: #3a3a3a;
          }
          .sona-splash-ray {
            stroke: #cfc8bc;
            stroke-width: 6;
            stroke-linecap: round;
            fill: none;
            animation: sonaSplashRadiate 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            transform-origin: center;
          }
          .dark .sona-splash-ray {
            stroke: #e0e0e0;
          }
          .sona-splash-ray:nth-of-type(1) { animation-delay: 0s; stroke: #E07A5F; stroke-width: 5; }
          .sona-splash-ray:nth-of-type(2) { animation-delay: 0.12s; stroke-width: 5; }
          .sona-splash-ray:nth-of-type(3) { animation-delay: 0.24s; stroke: #E07A5F; stroke-width: 5; }
          .sona-splash-ray:nth-of-type(4) { animation-delay: 0.36s; stroke-width: 5; }
          .sona-splash-ray:nth-of-type(5) { animation-delay: 0.48s; stroke: #E07A5F; stroke-width: 5; }
          .sona-splash-ray:nth-of-type(6) { animation-delay: 0.6s; stroke-width: 5; }

          @keyframes sonaSplashRadiate {
            0% { stroke-dasharray: 0, 100; opacity: 0; }
            40% { opacity: 1; }
            100% { stroke-dasharray: 100, 0; opacity: 0.85; }
          }
          @keyframes sonaSplashDraw {
            0% { stroke-dashoffset: 0; opacity: 0.9; }
            50% { stroke-dashoffset: 300; opacity: 0.15; }
            100% { stroke-dashoffset: 600; opacity: 0.9; }
          }
        `}</style>

        <circle className="sona-splash-ring" cx="100" cy="100" r="90" />

        <g>
          <line className="sona-splash-ray" x1="100" y1="20" x2="100" y2="50" />
          <line className="sona-splash-ray" x1="100" y1="180" x2="100" y2="150" />
          <line className="sona-splash-ray" x1="20" y1="100" x2="50" y2="100" />
          <line className="sona-splash-ray" x1="180" y1="100" x2="150" y2="100" />
          <line className="sona-splash-ray" x1="47" y1="47" x2="68" y2="68" />
          <line className="sona-splash-ray" x1="153" y1="153" x2="132" y2="132" />
        </g>

        <polygon
          className="sona-splash-hex"
          points="100,85 113,92.5 113,107.5 100,115 87,107.5 87,92.5"
        />
      </svg>
    </div>
  );
}
