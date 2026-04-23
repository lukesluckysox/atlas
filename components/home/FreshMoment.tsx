"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Trace, TraceKind } from "@/lib/trace";

/**
 * FreshMoment — the "something new" signal at the top of Home.
 *
 * Pulls the most recent trace across all kinds and shows a single poetic line
 * referencing it. Makes Home feel like it changed since yesterday, because it
 * did. No buttons, no chrome — just "the app is paying attention."
 *
 * Hidden if user has no traces yet (empty state is handled by HomeDashboard).
 */

type FreshTrace = Omit<Trace, "when"> & { when: string };

const KIND_VERB: Record<TraceKind, string> = {
  tracks: "paired",
  path: "logged",
  notice: "noticed",
  encounter: "answered",
};

function composeLine(trace: Trace): string {
  const verb = KIND_VERB[trace.kind];
  const rel = formatDistanceToNow(trace.when, { addSuffix: true });

  // The trace's own "title" is the sharpest bit of content we have.
  // Truncate for the one-liner; the full thing is a tap away.
  const title =
    trace.title.length > 60
      ? trace.title.slice(0, 57).trimEnd() + "…"
      : trace.title;

  return `You ${verb} "${title}" · ${rel}`;
}

export function FreshMoment() {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/traces?take=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const raw: FreshTrace | undefined = data.traces?.[0];
        if (raw) {
          setTrace({ ...raw, when: new Date(raw.when) });
        }
      })
      .catch(() => {
        // Silent — FreshMoment simply doesn't render.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || !trace) return null;

  return (
    <Link
      href={trace.href}
      className="block border-l-2 border-amber/60 pl-4 py-2 mb-8 -mt-4 hover:border-amber transition-colors group"
    >
      <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40 mb-1">
        Most recent
      </p>
      <p className="font-mono text-xs text-earth/70 group-hover:text-earth transition-colors leading-relaxed">
        {composeLine(trace)}
      </p>
    </Link>
  );
}
