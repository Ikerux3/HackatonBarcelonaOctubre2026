import { useEffect, useRef, useState } from "react";

interface QuestionInputProps {
  question: string;
  busy: boolean;
  /** monster line returned by the AI after submitting; shows a continue button */
  monsterLine: string | null;
  onSubmit: (answer: string) => void;
  onContinue: () => void;
}

export function QuestionInput({
  question,
  busy,
  monsterLine,
  onSubmit,
  onContinue,
}: QuestionInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // keep the field visible above the mobile keyboard
    inputRef.current?.focus({ preventScroll: false });
  }, []);

  const handleSubmit = () => {
    const answer = value.trim();
    if (!answer) {
      setError("Tell it something. Anything. It doesn't like silence.");
      return;
    }
    setError(null);
    onSubmit(answer);
  };

  if (monsterLine) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 px-4">
        <button
          type="button"
          onClick={onContinue}
          className="min-h-12 w-full rounded-xl border border-neutral-600 bg-neutral-900 px-6 py-3 text-base font-semibold text-neutral-100 active:scale-95"
        >
          Keep going…
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3 px-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <label htmlFor="monster-answer" className="text-center font-serif text-xl text-neutral-100">
        {question}
      </label>
      <input
        id="monster-answer"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        maxLength={60}
        enterKeyHint="send"
        onFocus={(e) => {
          // iOS/Android: wait for the keyboard, then keep the field above it
          const el = e.currentTarget;
          setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
        }}
        autoComplete="off"
        placeholder="Answer it…"
        className="min-h-12 w-full rounded-xl border border-neutral-600 bg-neutral-950 px-4 py-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-300 focus:outline-none"
      />
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-12 w-full rounded-xl bg-neutral-100 px-6 py-3 text-base font-bold text-neutral-950 active:scale-95 disabled:opacity-50"
      >
        {busy ? "It is listening…" : "Answer"}
      </button>
    </form>
  );
}
