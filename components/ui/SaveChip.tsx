"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Check, AlertCircle, Loader2, Pencil, FileText, RefreshCw } from "lucide-react";

/**
 * Unified save grammar used everywhere:
 *   idle    - nothing to say
 *   draft   - user has edits not yet persisted
 *   saving  - request in flight
 *   saved   - succeeded; auto-fades to idle after ~2s
 *   edited  - already-saved record has new local edits
 *   failed  - request errored; surfaces a retry button
 *
 * Usage:
 *   const save = useSaveState();
 *   save.markDraft();
 *   await save.run(async () => { await fetch(...) });
 *   <SaveChip state={save.state} onRetry={save.retry} />
 */

export type SaveStatus =
  | "idle"
  | "draft"
  | "saving"
  | "saved"
  | "edited"
  | "failed";

export interface SaveChipProps {
  state: SaveStatus;
  onRetry?: () => void;
  className?: string;
}

const LABELS: Record<SaveStatus, string> = {
  idle: "",
  draft: "Draft",
  saving: "Saving\u2026",
  saved: "Saved",
  edited: "Edited",
  failed: "Failed",
};

export function SaveChip({ state, onRetry, className }: SaveChipProps) {
  if (state === "idle") return null;

  const base =
    "inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest border transition-colors";

  if (state === "draft") {
    return (
      <span
        className={`${base} border-earth/15 text-earth/50 ${className ?? ""}`}
        aria-live="polite"
      >
        <FileText size={10} /> {LABELS.draft}
      </span>
    );
  }

  if (state === "edited") {
    return (
      <span
        className={`${base} border-earth/15 text-earth/50 ${className ?? ""}`}
        aria-live="polite"
      >
        <Pencil size={10} /> {LABELS.edited}
      </span>
    );
  }

  if (state === "saving") {
    return (
      <span
        className={`${base} border-earth/20 text-earth/70 ${className ?? ""}`}
        aria-live="polite"
      >
        <Loader2 size={10} className="animate-spin" /> {LABELS.saving}
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span
        className={`${base} border-sage/40 text-sage ${className ?? ""}`}
        aria-live="polite"
      >
        <Check size={10} /> {LABELS.saved}
      </span>
    );
  }

  // failed
  return (
    <span
      className={`${base} border-terracotta/40 text-terracotta ${className ?? ""}`}
      role="alert"
    >
      <AlertCircle size={10} /> {LABELS.failed}
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 inline-flex items-center gap-1 text-terracotta hover:text-earth"
          aria-label="Retry save"
        >
          <RefreshCw size={10} /> Retry
        </button>
      )}
    </span>
  );
}

export function useSaveState(autoClearMs: number = 2000) {
  const [state, setState] = useState<SaveStatus>("idle");
  const lastRun = useRef<(() => Promise<unknown>) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const markDraft = useCallback(() => {
    setState((s) => (s === "saved" || s === "idle" ? "draft" : s));
  }, []);

  const markEdited = useCallback(() => {
    setState("edited");
  }, []);

  const run = useCallback(
    async <T,>(op: () => Promise<T>): Promise<T | null> => {
      lastRun.current = op as () => Promise<unknown>;
      clearTimer();
      setState("saving");
      try {
        const result = await op();
        setState("saved");
        timerRef.current = setTimeout(() => setState("idle"), autoClearMs);
        return result;
      } catch (err) {
        console.error("[useSaveState]", err);
        setState("failed");
        return null;
      }
    },
    [autoClearMs]
  );

  const retry = useCallback(() => {
    if (!lastRun.current) return;
    void run(lastRun.current);
  }, [run]);

  const reset = useCallback(() => {
    clearTimer();
    setState("idle");
  }, []);

  return { state, markDraft, markEdited, run, retry, reset };
}
