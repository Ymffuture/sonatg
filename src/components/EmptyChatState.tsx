function EmptyChatState({ onStartChat }: { onStartChat: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[500px] p-8 text-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#E07A5F]/5 via-transparent to-[#F4A261]/5 dark:from-[#E07A5F]/10 dark:via-transparent dark:to-[#F4A261]/10" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#E07A5F]/5 via-transparent to-transparent dark:from-[#E07A5F]/10" />
      
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#E07A5F]/20 dark:bg-[#F4A261]/20"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animation: `float-particle ${3 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main SVG with enhanced styling */}
      <div className="relative w-56 h-56 mb-8 z-10">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
          <defs>
            <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#F4A261" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#E07A5F" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="strokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E07A5F" />
              <stop offset="100%" stopColor="#F4A261" />
            </linearGradient>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="shadow">
              <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#E07A5F" floodOpacity="0.15" />
            </filter>
          </defs>

          <style>{`
            @keyframes float { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.02)} }
            @keyframes float-d { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(5deg)} }
            @keyframes orbit { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
            @keyframes orbit-reverse { 0%{transform:rotate(360deg)} 100%{transform:rotate(0deg)} }
            @keyframes pulse-g { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.12);opacity:1} }
            @keyframes sparkle { 0%,100%{opacity:.2;transform:scale(.6) rotate(0deg)} 50%{opacity:.9;transform:scale(1.4) rotate(180deg)} }
            @keyframes draw { 0%{stroke-dasharray:0 120;opacity:0} 100%{stroke-dasharray:120 0;opacity:1} }
            @keyframes pulse-ring { 0%{r:16;opacity:0.8} 100%{r:30;opacity:0} }
            .mb{animation:float 4.5s ease-in-out infinite;transform-origin:center}
            .fb1{animation:float-d 3.8s ease-in-out infinite .5s}
            .fb2{animation:float-d 4.5s ease-in-out infinite 1.2s}
            .fb3{animation:float-d 4s ease-in-out infinite .8s}
            .or{animation:orbit 25s linear infinite;transform-origin:center}
            .or-rev{animation:orbit-reverse 20s linear infinite;transform-origin:center}
            .pi{animation:pulse-g 2.5s ease-in-out infinite;transform-origin:center;cursor:pointer;transition:transform 0.3s}
            .pi:hover{transform:scale(1.15)}
            .sp{animation:sparkle 3.5s ease-in-out infinite;transform-origin:center}
            .bl{stroke-dasharray:120;stroke-dashoffset:120;animation:draw 1.8s ease-out forwards}
            .bl:nth-child(2){animation-delay:.4s}
            .bl:nth-child(3){animation-delay:.8s}
            .pr{animation:pulse-ring 2s ease-out infinite;transform-origin:center}
          `}</style>

          {/* Orbiting rings */}
          <circle cx="100" cy="100" r="80" fill="none" stroke="url(#strokeGrad)" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.2" className="or" />
          <circle cx="100" cy="100" r="65" fill="none" stroke="url(#strokeGrad)" strokeWidth="1" strokeDasharray="4 6" opacity="0.15" className="or-rev" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="url(#strokeGrad)" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.1" className="or" />

          {/* Main chat bubble */}
          <g className="mb" filter="url(#shadow)">
            <rect x="40" y="50" width="120" height="85" rx="24" fill="url(#bubbleGrad)" stroke="url(#strokeGrad)" strokeWidth="2.5" />
            <path d="M62 135 L50 158 L82 138Z" fill="url(#bubbleGrad)" stroke="url(#strokeGrad)" strokeWidth="2.5" strokeLinejoin="round" />
            
            {/* Inner glow */}
            <rect x="44" y="54" width="112" height="77" rx="20" fill="none" stroke="#E07A5F" strokeWidth="0.5" opacity="0.2" />
            
            {/* Message lines */}
            <line x1="60" y1="75" x2="140" y2="75" stroke="url(#strokeGrad)" strokeWidth="3.5" strokeLinecap="round" opacity="0.6" className="bl" />
            <line x1="60" y1="95" x2="120" y2="95" stroke="url(#strokeGrad)" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" className="bl" />
            <line x1="60" y1="110" x2="100" y2="110" stroke="url(#strokeGrad)" strokeWidth="3.5" strokeLinecap="round" opacity="0.3" className="bl" />
          </g>

          {/* Floating dots */}
          <g className="fb1">
            <circle cx="160" cy="40" r="14" fill="#E07A5F" opacity="0.12" />
            <circle cx="160" cy="40" r="9" fill="none" stroke="#E07A5F" strokeWidth="1.5" opacity="0.4" />
            <circle cx="160" cy="40" r="4" fill="#E07A5F" opacity="0.6" />
          </g>
          <g className="fb2">
            <circle cx="30" cy="45" r="10" fill="#F4A261" opacity="0.15" />
            <circle cx="30" cy="45" r="6" fill="none" stroke="#F4A261" strokeWidth="1.5" opacity="0.5" />
            <circle cx="30" cy="45" r="3" fill="#F4A261" opacity="0.5" />
          </g>
          <g className="fb3">
            <circle cx="170" cy="145" r="12" fill="#E07A5F" opacity="0.08" />
            <circle cx="170" cy="145" r="7" fill="none" stroke="#E07A5F" strokeWidth="1.5" opacity="0.3" />
            <circle cx="170" cy="145" r="3.5" fill="#E07A5F" opacity="0.4" />
          </g>

          {/* Main action button with pulse ring */}
          <g className="pi" filter="url(#glow)" onClick={onStartChat}>
            <circle className="pr" cx="100" cy="100" r="16" fill="none" stroke="#E07A5F" strokeWidth="2" />
            <circle cx="100" cy="100" r="22" fill="#E07A5F" opacity="0.15" />
            <circle cx="100" cy="100" r="20" fill="#E07A5F" opacity="0.9" />
            <circle cx="100" cy="100" r="20" fill="none" stroke="white" strokeWidth="1" opacity="0.2" />
            <line x1="100" y1="90" x2="100" y2="110" stroke="white" strokeWidth="3" strokeLinecap="round" />
            <line x1="90" y1="100" x2="110" y2="100" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Sparkles */}
          <circle cx="25" cy="95" r="2.5" fill="#E07A5F" opacity="0.5" className="sp" />
          <circle cx="175" cy="75" r="3" fill="#F4A261" opacity="0.4" className="sp" style={{ animationDelay: '0.5s' }} />
          <circle cx="45" cy="165" r="2" fill="#E07A5F" opacity="0.6" className="sp" style={{ animationDelay: '1s' }} />
          <circle cx="155" cy="170" r="2.5" fill="#F4A261" opacity="0.5" className="sp" style={{ animationDelay: '1.5s' }} />
          <circle cx="175" cy="30" r="1.5" fill="#E07A5F" opacity="0.4" className="sp" style={{ animationDelay: '0.8s' }} />
          <circle cx="25" cy="160" r="1.5" fill="#F4A261" opacity="0.4" className="sp" style={{ animationDelay: '1.8s' }} />
        </svg>
      </div>

      {/* Text content with gradient */}
      <div className="relative z-10 space-y-3">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-[#E07A5F] to-[#F4A261] bg-clip-text text-transparent dark:from-[#F4A261] dark:to-[#E07A5F]">
          No conversations yet
        </h3>
        <p className="text-sm text-[#8C8C8C] dark:text-[#A0A0A0] max-w-[280px] leading-relaxed">
          Start your journey by creating a new chat
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#E07A5F]/30" />
          <span className="text-xs font-medium text-[#E07A5F] dark:text-[#F4A261] uppercase tracking-wider">
            Get Started
          </span>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#E07A5F]/30" />
        </div>
      </div>

      {/* Floating action hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-[#1E1E1E]/80 backdrop-blur-sm shadow-lg border border-[#E07A5F]/10 dark:border-[#F4A261]/10">
          <span className="text-xs text-[#8C8C8C] dark:text-[#A0A0A0]">Tap</span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-[#E07A5F] to-[#F4A261] text-white text-[14px] font-bold">+</span>
          <span className="text-xs text-[#8C8C8C] dark:text-[#A0A0A0]">to begin</span>
        </div>
      </div>
    </div>
  );
}
export {EmptyChatState} ;
