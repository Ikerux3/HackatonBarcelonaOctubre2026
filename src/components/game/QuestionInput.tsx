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
    // the game shell follows the visible area, so focusing never needs to scroll
    inputRef.current?.focus({ preventScroll: true });
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
          className="g-btn g-btn-ink w-full px-6 py-3 text-lg"
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
      <label htmlFor="monster-answer" className="g-ink-text text-center text-2xl">
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
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="Answer it…"
        className="g-input min-h-12 w-full px-4 py-3 text-center"
      />
      {error && <p className="g-guest-line text-center text-base">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="g-btn g-btn-paper w-full px-6 py-3 text-lg"
      >
        {busy ? "It is listening…" : "Answer"}
      </button>
    </form>
  );
}
