// Shown in the Sona AI chat while askAI() is in flight (see sonaTyping in
// SonaChat.tsx). An SVG dot-wave instead of the site-wide CSS `animate-bounce`
// dots used for human typing — deliberately distinct so it reads as "the AI
// is composing", not "a person is typing".

function SonaTypingIndicator() {
  return (
    <div className="mt-3 flex items-end gap-2">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--sona-accent,#E07A5F)]/10 bg-white px-3.5 py-3 shadow-sm dark:bg-[#2A2A2A]">
        <svg width="34" height="14" viewBox="0 0 34 14" aria-label="Sona AI is composing a reply">
          <style>{`
            @keyframes sona-type-wave {
              0%, 60%, 100% { transform: translateY(0); opacity: .45; }
              30% { transform: translateY(-4px); opacity: 1; }
            }
            .sona-type-dot { animation: sona-type-wave 1.1s ease-in-out infinite; transform-origin: center; }
          `}</style>
          <circle cx="7" cy="7" r="3" fill="#E07A5F" className="sona-type-dot" style={{ animationDelay: "0s" }} />
          <circle cx="17" cy="7" r="3" fill="#E07A5F" className="sona-type-dot" style={{ animationDelay: "0.15s" }} />
          <circle cx="27" cy="7" r="3" fill="#E07A5F" className="sona-type-dot" style={{ animationDelay: "0.3s" }} />
        </svg>
      </div>
    </div>
  );
}

export { SonaTypingIndicator };
