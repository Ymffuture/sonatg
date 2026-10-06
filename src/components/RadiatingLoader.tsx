export function RadiatingLoader() {
  return (
    <div className="w-16 h-16 relative">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <circle className="fill-none stroke-zinc-200 dark:stroke-zinc-800 stroke-2" cx="50" cy="50" r="45" />
        <circle 
          className="fill-none stroke-[#222] dark:stroke-white stroke-[2.5] stroke-linecap-round animate-[spin_1.5s_linear_infinite]" 
          style={{ strokeDasharray: 180, strokeDashoffset: 180, transformOrigin: '50px 50px' }}
          cx="50" cy="50" r="45" 
        />
        <g>
          {[
            { x1: 53, y1: 44.8, x2: 83, y2: 27.5 },
            { x1: 56, y1: 50, x2: 95, y2: 50 },
            { x1: 53, y1: 55.2, x2: 83, y2: 72.5 },
            { x1: 47, y1: 55.2, x2: 17, y2: 72.5 },
            { x1: 44, y1: 50, x2: 5, y2: 50 },
            { x1: 47, y1: 44.8, x2: 17, y2: 27.5 },
          ].map((line, i) => (
            <line
              key={i}
              className="stroke-[#222] dark:stroke-white stroke-[3] stroke-linecap-round animate-[radiate_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]"
              style={{ 
                transformOrigin: '50px 50px', 
                animationDelay: `${i * 0.1}s` 
              }}
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            />
          ))}
        </g>
        <polygon 
          className="fill-[#222] dark:fill-white animate-[pulse_1.5s_ease-in-out_infinite]" 
          style={{ transformOrigin: '50px 50px' }}
          points="50,44 55.2,47 55.2,53 50,56 44.8,53 44.8,47" 
        />
      </svg>
      
      {/* Add these keyframes to your global CSS or tailwind config */}
      <style>{`
        @keyframes radiate {
          0% { transform: scale(0.4); opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 1; transform: scale(1); }
          100% { transform: scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
