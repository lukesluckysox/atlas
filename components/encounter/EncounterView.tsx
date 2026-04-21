"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Pencil, Check } from "lucide-react";

interface Encounter {
  id: string;
  question: string;
  answer: string | null;
  landed: boolean | null;
  date: string;
}

export function EncounterView() {
  const [today, setToday] = useState<Encounter | null>(null);
  const [history, setHistory] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [answer, setAnswer] = useState("");
  const [editingAnswer, setEditingAnswer] = useState(false);

  useEffect(() => {
    async function load() {
      const [todayRes, historyRes] = await Promise.all([
        fetch("/api/encounter"),
        fetch("/api/encounter/history"),
      ]);
      const todayData = await todayRes.json();
      const historyData = await historyRes.json();
      setToday(todayData);
      setAnswer(todayData?.answer ?? "");
      setHistory(historyData);
      setLoading(false);
    }
    load();
  }, []);

  const patch = async (payload: {
    landed?: boolean | null;
    answer?: string | null;
  }) => {
    if (!today) return;
    setResponding(true);
    try {
      const res = await fetch("/api/encounter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: today.id, ...payload }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = await res.json();
      setToday(updated);
      return updated;
    } catch {
      toast.error("Could not save.");
    } finally {
      setResponding(false);
    }
  };

  const saveAnswer = async () => {
    const trimmed = answer.trim();
    const updated = await patch({ answer: trimmed });
    if (updated) {
      setEditingAnswer(false);
      toast.success("Response saved.");
    }
  };

  const markLanded = async (landed: boolean) => {
    // If they typed a response but haven't saved it, save both at once.
    const pendingAnswer = answer.trim();
    const currentAnswer = today?.answer ?? "";
    const payload: { landed: boolean; answer?: string } = { landed };
    if (pendingAnswer && pendingAnswer !== currentAnswer) {
      payload.answer = pendingAnswer;
    }
    await patch(payload);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading...</p>
      </div>
    );
  }

  const hasLanded = today?.landed === true || today?.landed === false;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-24">
        <div className="max-w-xl w-full text-center animate-fade-in">
          <p className="label mb-12">
            {format(new Date(), "EEEE, MMMM d")} — {new Date().getUTCHours() < 12 ? "Morning" : "Evening"} question.
            No answer required.
          </p>

          {today && (
            <>
              <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl text-earth leading-[1.15] mb-12">
                {today.question}
              </blockquote>

              {/* Response area */}
              <div className="mb-10 text-left">
                <div className="flex items-center justify-between mb-3">
                  <p className="label">Your response</p>
                  <span className="font-mono text-[10px] text-earth/30 tracking-wide">
                    Optional · stays private
                  </span>
                </div>

                {today.answer && !editingAnswer ? (
                  <div className="border-l-2 border-amber pl-5 py-3">
                    <p className="font-serif text-lg text-earth/90 leading-relaxed whitespace-pre-wrap">
                      {today.answer}
                    </p>
                    <button
                      onClick={() => {
                        setAnswer(today.answer ?? "");
                        setEditingAnswer(true);
                      }}
                      className="mt-3 flex items-center gap-2 font-mono text-xs text-earth/40 hover:text-earth"
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Write what comes up. A sentence. A paragraph. Nothing at all."
                      rows={4}
                      className="input-field resize-none leading-relaxed"
                    />
                    {(editingAnswer ||
                      (answer.trim().length > 0 && !today.answer)) && (
                      <div className="flex gap-3 mt-3 justify-end">
                        {editingAnswer && (
                          <button
                            onClick={() => {
                              setAnswer(today.answer ?? "");
                              setEditingAnswer(false);
                            }}
                            className="font-mono text-xs text-earth/40 hover:text-earth px-3 py-2"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          onClick={saveAnswer}
                          disabled={responding || answer.trim().length === 0}
                          className="btn-secondary text-xs flex items-center gap-2 disabled:opacity-40"
                        >
                          <Check size={12} />
                          {responding ? "Saving..." : "Save response"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Landed / Didn't land */}
              {!hasLanded ? (
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => markLanded(true)}
                    disabled={responding}
                    className="btn-primary disabled:opacity-40"
                  >
                    Landed
                  </button>
                  <button
                    onClick={() => markLanded(false)}
                    disabled={responding}
                    className="btn-secondary disabled:opacity-40"
                  >
                    Didn&rsquo;t land
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <p className="font-mono text-sm text-earth/50">
                    {today.landed ? "Landed." : "Didn't land."}
                  </p>
                  <button
                    onClick={() =>
                      patch({ landed: !today.landed })
                    }
                    disabled={responding}
                    className="font-mono text-xs text-earth/30 hover:text-earth underline"
                  >
                    change
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-earth/10 px-8 py-12 max-w-2xl mx-auto w-full">
          <p className="label mb-8">Past questions</p>
          <div className="space-y-8">
            {history.slice(0, 10).map((enc) => (
              <div key={enc.id} className="flex items-start gap-8">
                <div className="shrink-0 text-right w-16">
                  <p className="font-mono text-xs text-earth/30">
                    {format(new Date(enc.date), "MMM d")}
                  </p>
                  <span
                    className={`font-mono text-xs ${
                      enc.landed ? "text-amber" : "text-earth/20"
                    }`}
                  >
                    {enc.landed ? "✓" : "—"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-earth/60 leading-relaxed">
                    {enc.question}
                  </p>
                  {enc.answer && (
                    <p className="font-serif text-sm text-earth/80 italic leading-relaxed mt-2 pl-3 border-l border-amber/30">
                      {enc.answer}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
