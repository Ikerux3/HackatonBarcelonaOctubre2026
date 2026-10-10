interface MonsterOverlayProps {
  line?: string | null;
  children?: React.ReactNode;
}

/**
 * The Guest during blackouts and questions: not a creature but a stain of ink
 * that rewrites the scene — a wobbling silhouette, smears, more eyes than it
 * should have. Different visual language from the cozy room on purpose.
 */
export function MonsterOverlay({ line, children }: MonsterOverlayProps) {
  return (
    <div className="g-ink-veil g-blackout-in absolute inset-0 z-20 flex flex-col items-center justify-end overflow-hidden pb-6">
      <div className="g-grain-dark" />
      {/* smears crossing the dark */}
      <span className="g-smear left-[-10%] top-[18%] w-[70%]" aria-hidden />
      <span className="g-smear right-[-15%] top-[32%] w-[60%]" style={{ animationDelay: "1.7s" }} aria-hidden />
      {/* far eyes that come and go */}
      <svg className="absolute left-[8%] top-[10%] h-5 w-12" viewBox="0 0 40 14" aria-hidden>
        <g className="g-eyes-far">
          <ellipse cx="10" cy="7" rx="3" ry="1.8" className="g-eye g-eye-red" />
          <ellipse cx="28" cy="7" rx="3" ry="1.8" className="g-eye g-eye-red" />
        </g>
      </svg>
      <svg className="absolute right-[10%] top-[22%] h-4 w-10" viewBox="0 0 40 14" aria-hidden>
        <g className="g-eyes-far" style={{ animationDelay: "4s" }}>
          <ellipse cx="10" cy="7" rx="2.6" ry="1.5" className="g-eye" />
          <ellipse cx="28" cy="7" rx="2.6" ry="1.5" className="g-eye" />
        </g>
      </svg>

      {/* shrinks first when space is short (keyboard open, small phones) */}
      <svg
        viewBox="0 0 200 260"
        className="g-guest-in relative mb-2 h-60 max-h-[40%] min-h-0 w-48 shrink"
        aria-label="A dark silhouette watches you"
        role="img"
      >
        <defs>
          <radialGradient id="g-guest-fill" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#1a0f0c" />
            <stop offset="70%" stopColor="#050302" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="250" rx="80" ry="12" fill="#000" opacity="0.9" />
        <g className="g-guest-body">
          {/* tall head, long neck, shoulders melting downward like wet ink */}
          <path
            d="M100 14 C70 14 60 46 62 78 C63 98 74 110 82 116 C58 124 40 150 38 190 C36 214 30 232 22 248 L58 244 L66 226 L76 248 L92 236 L100 252 L110 236 L124 248 L134 226 L142 244 L178 248 C170 232 164 214 162 190 C160 150 142 124 118 116 C126 110 137 98 138 78 C140 46 130 14 100 14 Z"
            fill="url(#g-guest-fill)"
          />
          <ellipse cx="84" cy="70" rx="7" ry="4.5" className="g-eye" />
          <ellipse cx="116" cy="70" rx="7" ry="4.5" className="g-eye" style={{ animationDelay: "0.12s" }} />
          {/* a third eye that shouldn't be there */}
          <ellipse cx="100" cy="52" rx="3.2" ry="2" className="g-eye g-eye-red" style={{ animationDelay: "2s" }} />
          {/* faint smile */}
          <path d="M86 92 Q100 100 114 92" stroke="#2a1a14" strokeWidth="1.6" fill="none" opacity="0.7" />
        </g>
      </svg>

      {line && (
        <p className="g-guest-line game-monster-line relative mx-5 max-w-sm text-center text-xl leading-snug">
          “{line}”
        </p>
      )}
      <div className="relative flex w-full flex-col items-center">{children}</div>
    </div>
  );
}
