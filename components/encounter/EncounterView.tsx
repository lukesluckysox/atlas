"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface Encounter {
  id: string;
  question: string;
  landed: boolean | null;
  date: string;
}

export function EncounterView() {
  const [today, setToday] = useState<Encounter | null>(null);
  const [history, setHistory] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    async function load() {
      const [todayRes, historyRes] = await Promise.all([
        fetch("/api/encounter"),
        fetch("/api/encounter/history"),
      ]);
      const todayData = await todayRes.json();
      const historyData = await historyRes.json();
      setToday(todayData);
      setHistory(historyData);
      setLoading(false);
    }
    load();
  }, []);

  const respond = async (landed: boolean) => {
    if (!today || today.landed !== null) return;
    setResponding(true);
    try {
      const res = await fetch("/api/encounter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: today.id, landed }),
      });
      const updated = await res.json();
      setToday(updated);
    } catch {
      toast.error("Could not save response.");
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-24">
        <div className="max-w-xl text-center animate-fade-in">
          <p className="label mb-12">
            {format(new Date(), "EEEE, MMMM d")} — Today&rsquo;s question.
            No answer required.
          </p>

          {today && (
            <>
              <blockquote className="font-serif text-2xl md:text-3xl lg:text-4xl text-earth leading-[1.15] mb-16">
                {today.question}
              </blockquote>

              {today.landed === null || today.landed === undefined ? (
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => respond(true)}
                    disabled={responding}
                    className="btn-primary disabled:opacity-40"
                  >
                    Landed
                  </button>
                  <button
                    onClick={() => respond(false)}
                    disabled={responding}
                    className="btn-secondary disabled:opacity-40"
                  >
                    Didn&rsquo;t land
                  </button>
                </div>
              ) : (
                <p className="font-mono text-sm text-earth/50">
                  {today.landed ? "Landed." : "Didn't land."}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="border-t border-earth/10 px-8 py-12 max-w-2xl mx-auto w-full">
          <p className="label mb-8">Past questions</p>
          <div className="space-y-6">
            {history.slice(0, 10).map((enc) => (
              <div key={enc.id} className="flex items-start gap-8">
                <div className="shrink-0 text-right">
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
                <p className="font-mono text-sm text-earth/60 leading-relaxed">
                  {enc.question}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
