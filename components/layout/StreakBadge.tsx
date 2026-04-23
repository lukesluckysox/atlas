"use client";

import { useEffect, useState } from "react";

/**
 * StreakBadge — a quiet day-count chip in the nav.
 *
 * Principles:
 *   - Never shames. No "you broke it" screen.
 *   - Never loud. No emoji, no color, no animation.
 *   - Hidden entirely if streak is 0 or API fails.
 *   - Dims when today hasn't been traced yet (subtle pull, not nag).
 */
export function StreakBadge() {
  const [days, setDays] = useState<number | null>(null);
  const [tracedToday, setTracedToday] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/streak")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.current === "number" && data.current > 0) {
          setDays(data.current);
          setTracedToday(Boolean(data.tracedToday));
        }
      })
      .catch(() => {
        // Silent.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!days) return null;

  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-widest transition-opacity ${
        tracedToday ? "text-earth/50" : "text-earth/30"
      }`}
      title={
        tracedToday
          ? `${days} day streak`
          : `${days} day streak — trace something today to keep it`
      }
    >
      {days}d
    </span>
  );
}
