// src/components/RadiatingLoader.tsx
// Radiating-lines loader, a 1:1 port of the supplied HTML/CSS design:
// a 100px SVG with a drawing outer circle, six lines that radiate in turn
// (three coral #E07A5F, three light grey) and a glowing centre hexagon.
// All class names and keyframes are prefixed "rl-" so they can't clash with
// other styles in the app. Colours are fixed (not theme-aware) to match the design.

export function RadiatingLoader({ size = 100 }: { size?: number }) {
  return (
    <div className="rl-box">
      <svg className="rl-svg" viewBox="0 0 200 200" width={size} height={size} role="status" aria-label="Loading">
        <circle className="rl-outer rl-circle-draw" cx="100" cy="100" r="90" />
        <g>
          <line className="rl-line rl-animate" x1="100" y1="20" x2="100" y2="50" />
          <line className="rl-line rl-animate" x1="100" y1="180" x2="100" y2="150" />
          <line className="rl-line rl-animate" x1="20" y1="100" x2="50" y2="100" />
          <line className="rl-line rl-animate" x1="180" y1="100" x2="150" y2="100" />
          <line className="rl-line rl-animate" x1="47" y1="47" x2="68" y2="68" />
          <line className="rl-line rl-animate" x1="153" y1="153" x2="132" y2="132" />
        </g>
        <polygon className="rl-hex" points="100,85 113,92.5 113,107.5 100,115 87,107.5 87,92.5" />
      </svg>

      <style>{`
        .rl-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .rl-svg {
          width: ${size}px;
          height: ${size}px;
          filter: drop-shadow(0 0 12px rgba(224, 122, 95, 0.25));
        }
        .rl-hex {
          fill: none;
          stroke: #f5f5f5;
          stroke-width: 3.5;
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.15));
        }
        .rl-line {
          stroke: #e0e0e0;
          stroke-width: 6;
          stroke-linecap: round;
          fill: none;
        }
        .rl-outer {
          fill: none;
          stroke: #202124;
          stroke-width: 1.5;
        }
        .rl-animate {
          animation: rl-radiate 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          transform-origin: center;
        }
        .rl-animate:nth-child(1) { animation-delay: 0s;    stroke: #E07A5F; stroke-width: 5; }
        .rl-animate:nth-child(2) { animation-delay: 0.12s; stroke-width: 5; }
        .rl-animate:nth-child(3) { animation-delay: 0.24s; stroke: #E07A5F; stroke-width: 5; }
        .rl-animate:nth-child(4) { animation-delay: 0.36s; stroke-width: 5; }
        .rl-animate:nth-child(5) { animation-delay: 0.48s; stroke-width: 5; }
        .rl-animate:nth-child(6) { animation-delay: 0.60s; stroke: #E07A5F; stroke-width: 5; }
        @keyframes rl-radiate {
          0%   { stroke-dasharray: 0, 100;   opacity: 0; }
          40%  { opacity: 1; }
          100% { stroke-dasharray: 100, 0;   opacity: 0.85; }
        }
        .rl-circle-draw {
          stroke-dasharray: 50;
          stroke-dashoffset: 100;
          animation: rl-draw-circle 4.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        @keyframes rl-draw-circle {
          0%   { stroke-dashoffset: 0;   opacity: 0.9; }
          50%  { opacity: 0.15; }
          100% { stroke-dashoffset: 600; opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
