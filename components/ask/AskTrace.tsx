"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface Citation {
  kind: "tracks" | "path" | "notice" | "encounter";
  hint: string;
}

interface AskResult {
  answer: string;
  citations: Citation[];
}

const KIND_LABEL: Record<Citation["kind"], string> = {
  tracks: "Tracks",
  path: "Path",
  notice: "Moment",
  encounter: "Encounter",
};

const EXAMPLES = [
  "What have I been listening to when I'm near the water?",
  "What questions keep coming back?",
  "Which artists show up the most?",
  "What have I noticed lately?",
];

export function AskTrace() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (trimmed.length > 500) {
      toast.error("Keep it under 500 characters.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not ask.");
      }
      const data = (await res.json()) as AskResult;
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not ask.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(question);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="ask-input" className="label block">
          Your question
        </label>
        <textarea
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your traces..."
          rows={3}
          maxLength={500}
          disabled={loading}
          className="input-field resize-none w-full"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] text-earth/40 uppercase tracking-widest">
            {question.length}/500
          </p>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-40"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Thinking" : "Ask"}
          </button>
        </div>
      </form>

      {!result && !loading && (
        <div className="space-y-2">
          <p className="label">Try</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuestion(ex);
                  submit(ex);
                }}
                className="font-mono text-xs text-earth/60 hover:text-earth border border-earth/15 hover:border-earth/40 px-3 py-1.5 transition-colors text-left"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="animate-fade-in space-y-5">
          <div className="border-l-2 border-amber pl-5 py-2">
            <p className="font-serif text-lg text-earth leading-relaxed whitespace-pre-wrap">
              {result.answer}
            </p>
          </div>
          {result.citations.length > 0 && (
            <div className="space-y-2">
              <p className="label">Drawn from</p>
              <div className="flex flex-wrap gap-2">
                {result.citations.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 font-mono text-[11px] text-earth/70 border border-earth/15 px-2.5 py-1"
                  >
                    <span className="text-amber uppercase tracking-widest text-[10px]">
                      {KIND_LABEL[c.kind]}
                    </span>
                    <span className="text-earth/60">{c.hint}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              setResult(null);
              setQuestion("");
            }}
            className="font-mono text-xs text-earth/50 hover:text-earth uppercase tracking-widest"
          >
            Ask another
          </button>
        </div>
      )}
    </div>
  );
}
