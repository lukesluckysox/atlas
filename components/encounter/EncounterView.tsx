"use client";
import { useEffect, useMemo, useState } from "react";
import { format, differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import toast from "react-hot-toast";
import { Pencil, Check } from "lucide-react";
import { submitWithQueue } from "@/lib/offline-submit";

interface EchoRef {
  id: string;
  question: string;
  answer: string | null;
  date: string;
}

interface Encounter {
  id: string;
  question: string;
  answer: string | null;
  landed: boolean | null;
  sittingWith: boolean;
  echoOfId: string | null;
  echo?: EchoRef | null;
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
    sittingWith?: boolean;
  }) => {
    if (!today) return;
    setResponding(true);
    try {
      const res = await submitWithQueue({
        kind: "encounter",
        endpoint: "/api/encounter",
        method: "PATCH",
        payload: { id: today.id, ...payload },
      });
      if (res.ok && !res.offline) {
        const updated = (res as { data: Encounter }).data;
        setToday(updated);
        return updated;
      }
      if (res.ok && res.offline) {
        // Optimistically update the UI so the user sees their answer,
        // even though it hasn't synced yet.
        const optimistic = { ...today, ...payload } as Encounter;
        setToday(optimistic);
        toast("saved offline — syncing when back online", { icon: "☁" });
        return optimistic;
      }
      toast.error(res.error || "Could not save.");
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

  const markSittingWith = async () => {
    const pendingAnswer = answer.trim();
    const currentAnswer = today?.answer ?? "";
    const payload: { sittingWith: true; answer?: string } = { sittingWith: true };
    if (pendingAnswer && pendingAnswer !== currentAnswer) {
      payload.answer = pendingAnswer;
    }
    await patch(payload);
  };

  const clearResolution = async () => {
    // Used by the "change" link under any resolution status. Resets to
    // unresolved so they can pick again.
    await patch({ landed: null, sittingWith: false });
  };

  // Past encounters by age bucket + calendar-day match
  const { rail, onThisDay } = useMemo(() => {
    const now = new Date();
    const todayMD = `${now.getMonth()}-${now.getDate()}`;
    const byAge: Record<string, Encounter | undefined> = {};
    const sameDay: Encounter[] = [];
    for (const enc of history) {
      const d = new Date(enc.date);
      const days = differenceInCalendarDays(now, d);
      if (days >= 6 && days <= 8 && !byAge["7"]) byAge["7"] = enc;
      if (days >= 28 && days <= 32 && !byAge["30"]) byAge["30"] = enc;
      if (days >= 85 && days <= 95 && !byAge["90"]) byAge["90"] = enc;
      if (days >= 350 && days <= 380 && !byAge["365"]) byAge["365"] = enc;
      if (days >= 1 && `${d.getMonth()}-${d.getDate()}` === todayMD) sameDay.push(enc);
    }
    const railItems = [
      { label: "7 days ago", enc: byAge["7"] },
      { label: "30 days ago", enc: byAge["30"] },
      { label: "90 days ago", enc: byAge["90"] },
      { label: "A year ago", enc: byAge["365"] },
    ].filter((r) => r.enc);
    return { rail: railItems, onThisDay: sameDay };
  }, [history]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading...</p>
      </div>
    );
  }

  const landedSet = today?.landed === true || today?.landed === false;
  const isSitting = today?.sittingWith === true;
  const isResolved = landedSet || isSitting;

  let statusLabel = "";
  if (today?.landed === true) statusLabel = "Landed.";
  else if (today?.landed === false) statusLabel = "Didn't land.";
  else if (isSitting) statusLabel = "Sitting with it.";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-24">
        <div className="max-w-xl w-full text-center animate-fade-in">
          <p className="label mb-3">Encounter</p>
          <h1 className="font-serif text-4xl md:text-5xl text-earth mb-2 leading-tight">One question.</h1>
          <p className="font-mono text-xs text-earth/40 mb-12 leading-relaxed">
            Every day. Yours to sit with. Mark whether it landed.
          </p>
          <p className="label mb-12">
            {format(new Date(), "EEEE, MMMM d")} — {new Date().getUTCHours() < 12 ? "Morning" : "Evening"} question.
            No answer required.
          </p>

          {today && (
            <>
              <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl text-earth leading-[1.15] mb-8">
                {today.question}
              </blockquote>

              {/* Echo surface — when this question rhymes with a past one. */}
              {today.echo && (
                <div className="mb-12 text-left border-l-2 border-amber/60 pl-5 py-3 bg-amber/5">
                  <p className="font-mono text-[11px] text-earth/40 uppercase tracking-wider mb-2">
                    Echoes a question from {formatDistanceToNowStrict(new Date(today.echo.date), { addSuffix: true })}
                  </p>
                  <p className="font-serif text-base text-earth/85 leading-snug mb-2">
                    {today.echo.question}
                  </p>
                  {today.echo.answer && (
                    <p className="font-serif text-sm text-earth/60 italic leading-relaxed">
                      {today.echo.answer}
                    </p>
                  )}
                </div>
              )}

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

              {/* Resolution: Landed / Didn't land / Sit with it */}
              {!isResolved ? (
                <div className="flex flex-wrap gap-3 justify-center">
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
                  <button
                    onClick={markSittingWith}
                    disabled={responding}
                    className="btn-secondary disabled:opacity-40"
                  >
                    Sit with it
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <p className="font-mono text-sm text-earth/50">{statusLabel}</p>
                  <button
                    onClick={clearResolution}
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

      {rail.length > 0 && (
        <div className="border-t border-earth/10 px-8 py-10 max-w-3xl mx-auto w-full">
          <p className="label mb-6">Where you were</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rail.map(({ label, enc }) => enc && (
              <div key={label} className="border border-earth/10 p-5 bg-parchment">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-[11px] text-earth/40 uppercase tracking-wider">{label}</p>
                  <p className="font-mono text-[10px] text-earth/30">{format(new Date(enc.date), "MMM d")}</p>
                </div>
                <p className="font-serif text-base text-earth/85 leading-snug mb-2">{enc.question}</p>
                {enc.answer && (
                  <p className="font-serif text-sm text-earth/60 italic leading-relaxed border-l border-amber/30 pl-3">
                    {enc.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {onThisDay.length > 0 && today && (
        <div className="border-t border-earth/10 px-8 py-10 max-w-3xl mx-auto w-full">
          <p className="label mb-6">On this day</p>
          <div className="space-y-6">
            {onThisDay.map((enc) => (
              <div key={enc.id} className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-earth/10 p-5 bg-parchment">
                <div>
                  <p className="font-mono text-[10px] text-earth/30 uppercase tracking-wider mb-2">{format(new Date(enc.date), "yyyy")} — then</p>
                  <p className="font-serif text-sm text-earth/85 leading-snug mb-2">{enc.question}</p>
                  {enc.answer && <p className="font-serif text-sm text-earth/70 italic border-l border-amber/30 pl-3">{enc.answer}</p>}
                </div>
                <div>
                  <p className="font-mono text-[10px] text-earth/30 uppercase tracking-wider mb-2">Today — now</p>
                  <p className="font-serif text-sm text-earth/85 leading-snug mb-2">{today.question}</p>
                  {today.answer && <p className="font-serif text-sm text-earth/70 italic border-l border-amber/30 pl-3">{today.answer}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="border-t border-earth/10 px-8 py-12 max-w-2xl mx-auto w-full">
          <p className="label mb-8">Past questions</p>
          <div className="space-y-8">
            {history.slice(0, 10).map((enc) => {
              const mark = enc.landed
                ? "✓"
                : enc.sittingWith
                  ? "~"
                  : enc.landed === false
                    ? "—"
                    : "·";
              const markClass = enc.landed
                ? "text-amber"
                : enc.sittingWith
                  ? "text-sage"
                  : "text-earth/20";
              return (
                <div key={enc.id} className="flex items-start gap-8">
                  <div className="shrink-0 text-right w-16">
                    <p className="font-mono text-xs text-earth/30">
                      {format(new Date(enc.date), "MMM d")}
                    </p>
                    <span className={`font-mono text-xs ${markClass}`}>{mark}</span>
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
