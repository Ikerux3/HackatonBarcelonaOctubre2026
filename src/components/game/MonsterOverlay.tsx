interface MonsterOverlayProps {
  line?: string | null;
  children?: React.ReactNode;
}

/** Dark silhouette + dialogue. Appears during blackouts and questions. */
export function MonsterOverlay({ line, children }: MonsterOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end bg-black/85 pb-6">
      {/* shrinks first when space is short (keyboard open, small phones) */}
      <svg
        viewBox="0 0 200 260"
        className="game-monster mb-2 h-56 max-h-[38%] min-h-0 w-44 shrink"
        aria-label="A dark silhouette watches you"
        role="img"
      >
        <ellipse cx="100" cy="250" rx="70" ry="14" fill="#000" opacity="0.8" />
        <path
          d="M100 20 C55 20 45 80 48 130 C50 170 40 210 55 240 L145 240 C160 210 150 170 152 130 C155 80 145 20 100 20 Z"
          fill="#050505"
        />
        <circle cx="80" cy="90" r="6" fill="#e8e4d8" className="game-eyes" />
        <circle cx="120" cy="90" r="6" fill="#e8e4d8" className="game-eyes" />
      </svg>

      {line && (
        <p className="game-monster-line mx-4 max-w-sm text-center font-serif text-lg italic text-neutral-200">
          “{line}”
        </p>
      )}
      {children}
    </div>
  );
}
