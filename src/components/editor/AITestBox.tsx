import { useState } from "react";

import { interpretWithDiagnostics, type AIDiagnostics } from "@/ai/aiAdapter";
import type { AIResponse, QuestionType } from "@/ai/contracts";

/** Dev-only: send one answer through the current AI mode and show the raw response. */
export function AITestBox() {
  const [answer, setAnswer] = useState("a green dinosaur called Rex");
  const [q, setQ] = useState<QuestionType>("favorite_toy");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ response: AIResponse; diag: AIDiagnostics } | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      setOut(await interpretWithDiagnostics({ questionType: q, answer, memory: {} }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-4 flex flex-col gap-2 rounded border border-neutral-800 p-3">
      <p className="text-xs uppercase text-neutral-500">Test AI (uses the current mode)</p>
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Question type"
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value as QuestionType)}
        >
          <option value="favorite_color">favorite_color</option>
          <option value="favorite_toy">favorite_toy</option>
        </select>
        <input
          aria-label="Test answer"
          maxLength={60}
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && void run()}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded bg-amber-800 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
        >
          {busy ? "Asking…" : "Test AI"}
        </button>
      </div>
      {out && (
        <div className="grid gap-2 md:grid-cols-[220px_1fr]">
          <div className="font-mono text-xs text-neutral-300">
            <div>
              latency: <b className="text-lime-300">{out.diag.latencyMs} ms</b>
            </div>
            <div>adapter: {out.diag.adapterUsed}</div>
            <div>fallbackUsed: {String(out.response.fallbackUsed)}</div>
            {out.diag.error && <div className="text-red-300">error: {out.diag.error}</div>}
          </div>
          <pre
            aria-label="Raw AI response"
            className="overflow-x-auto rounded bg-neutral-900 p-2 text-xs text-neutral-200"
          >
            {JSON.stringify(out.response, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
