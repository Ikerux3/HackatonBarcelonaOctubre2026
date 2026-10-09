import { useEffect, useState } from "react";

import { getLastAIDiagnostics, onAIDiagnostics, type AIDiagnostics } from "@/ai/aiAdapter";
import { getAIMode, type AIMode } from "@/ai/aiMode";

/** Hidden dev badge: only rendered with ?debug=1. Shows the last AI answer's diagnostics. */
export function AIDebugBadge() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<AIMode>("live");
  const [diag, setDiag] = useState<AIDiagnostics | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("debug") !== "1") return;
    setEnabled(true);
    setMode(getAIMode());
    setDiag(getLastAIDiagnostics());
    return onAIDiagnostics(setDiag);
  }, []);

  if (!enabled) return null;
  return (
    <div
      className="pointer-events-none fixed left-1 top-1 z-[100] rounded bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-lime-300"
      aria-hidden
    >
      <div>mode: {mode}</div>
      <div>adapter: {diag?.adapterUsed ?? "—"}</div>
      <div>fallback: {diag ? String(diag.fallbackUsed) : "—"}</div>
      <div>latency: {diag ? `${diag.latencyMs} ms` : "—"}</div>
      {diag?.detail && <div>{diag.detail}</div>}
      {diag?.error && <div className="max-w-[60vw] truncate text-red-300">err: {diag.error}</div>}
    </div>
  );
}
