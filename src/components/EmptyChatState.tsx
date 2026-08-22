function EmptyChatState({ onStartChat }: { onStartChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      {/* Animated SVG */}
      <div className="relative w-48 h-48 mb-6">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <defs>
            <linearGradient id="bubbleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E07A5F" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#F4A261" stopOpacity="0.1" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <style>{`
            @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
            @keyframes float-d { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
            @keyframes orbit { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }
            @keyframes pulse-g { 0%,100%{transform:scale(1);opacity:.9} 50%{transform:scale(1.08);opacity:1} }
            @keyframes sparkle { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:.8;transform:scale(1.2)} }
            @keyframes draw { 0%{stroke-dasharray:0 80} 100%{stroke-dasharray:80 0} }
            .mb{animation:float 4s ease-in-out infinite;transform-origin:center}
            .fb1{animation:float-d 3.5s ease-in-out infinite .5s}
            .fb2{animation:float-d 4.2s ease-in-out infinite 1.2s}
            .fb3{animation:float-d 3.8s ease-in-out infinite .8s}
            .or{animation:orbit 20s linear infinite;transform-origin:center}
            .pi{animation:pulse-g 2.5s ease-in-out infinite;transform-origin:center}
            .sp{animation:sparkle 3s ease-in-out infinite;transform-origin:center}
            .bl{stroke-dasharray:80;stroke-dashoffset:80;animation:draw 1.5s ease-out forwards}
            .bl:nth-child(2){animation-delay:.3s}
            .bl:nth-child(3){animation-delay:.6s}
          `}</style>

          <circle cx="100" cy="100" r="70" fill="none" stroke="#E07A5F" strokeWidth="1" strokeDasharray="8 6" opacity="0.3" className="or" />

          <g className="mb">
            <rect x="45" y="55" width="110" height="80" rx="20" fill="url(#bubbleGrad)" stroke="#E07A5F" strokeWidth="2" />
            <path d="M65 135 L55 155 L85 135Z" fill="url(#bubbleGrad)" stroke="#E07A5F" strokeWidth="2" strokeLinejoin="round" />
            <rect x="45" y="55" width="110" height="80" rx="20" fill="url(#bubbleGrad)" />
            <line x1="65" y1="80" x2="135" y2="80" stroke="#E07A5F" strokeWidth="3" strokeLinecap="round" opacity="0.6" className="bl" />
            <line x1="65" y1="100" x2="115" y2="100" stroke="#E07A5F" strokeWidth="3" strokeLinecap="round" opacity="0.4" className="bl" />
            <line x1="65" y1="115" x2="95" y2="115" stroke="#E07A5F" strokeWidth="3" strokeLinecap="round" opacity="0.3" className="bl" />
          </g>

          <g className="fb1"><circle cx="155" cy="45" r="12" fill="#E07A5F" opacity="0.15" /><circle cx="155" cy="45" r="8" fill="none" stroke="#E07A5F" strokeWidth="1.5" opacity="0.4" /></g>
          <g className="fb2"><circle cx="35" cy="50" r="8" fill="#F4A261" opacity="0.2" /><circle cx="35" cy="50" r="5" fill="none" stroke="#F4A261" strokeWidth="1.5" opacity="0.5" /></g>
          <g className="fb3"><circle cx="165" cy="140" r="10" fill="#E07A5F" opacity="0.1" /><circle cx="165" cy="140" r="6" fill="none" stroke="#E07A5F" strokeWidth="1.5" opacity="0.3" /></g>

          <g className="pi" filter="url(#glow)" style={{ cursor: 'pointer' }} onClick={onStartChat}>
            <circle cx="100" cy="100" r="18" fill="#E07A5F" opacity="0.9" />
            <line x1="100" y1="92" x2="100" y2="108" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="92" y1="100" x2="108" y2="100" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          <circle cx="30" cy="100" r="2" fill="#E07A5F" opacity="0.5" className="sp" />
          <circle cx="170" cy="80" r="2.5" fill="#F4A261" opacity="0.4" className="sp" style={{ animationDelay: '0.5s' }} />
          <circle cx="50" cy="160" r="1.5" fill="#E07A5F" opacity="0.6" className="sp" style={{ animationDelay: '1s' }} />
          <circle cx="150" cy="165" r="2" fill="#F4A261" opacity="0.5" className="sp" style={{ animationDelay: '1.5s' }} />
        </svg>
      </div>

      <h3 className="text-xl font-bold text-[#2D3436] dark:text-[#E8E8E8] mb-2">No chats yet</h3>
      <p className="text-sm text-[#8C8C8C] max-w-[240px] leading-relaxed">
        Tap the <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#E07A5F]/15 text-[#E07A5F] text-xs font-bold mx-0.5">+</span> button to start a new conversation
      </p>

      <button
        onClick={onStartChat}
        className="mt-6 flex items-center gap-2 text-xs text-[#E07A5F] font-medium opacity-70 hover:opacity-100 transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Start chatting
      </button>
    </div>
  );
}
