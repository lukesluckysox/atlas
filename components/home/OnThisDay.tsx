"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

// Home dashboard rail: traces from prior years on this calendar day.
// Renders nothing if the user has no matching history — silent by design.

type Item = {
  id: string;
  kind: "tracks" | "path" | "notice" | "encounter";
  createdAt: string;
  yearsAgo: number;
  preview: string;
  photoUrl: string | null;
  shareSlug: string | null;
};

const KIND_HREF: Record<Item["kind"], string> = {
  tracks: "/pair",
  path: "/map",
  notice: "/mark",
  encounter: "/encounter",
};

function kindLabel(kind: Item["kind"]): string {
  switch (kind) {
    case "tracks":
      return "Track";
    case "path":
      return "Path";
    case "notice":
      return "Moment";
    case "encounter":
      return "Encounter";
  }
}

export function OnThisDay() {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/on-this-day")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        if (!cancelled) setItems(j.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // While loading or when empty, render nothing. Silent on no-history.
  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl text-earth">On this day</h2>
        <p className="text-xs uppercase tracking-[0.2em] text-earth/50">
          {items.length} {items.length === 1 ? "trace" : "traces"}
        </p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {items.map((it) => (
          <Link
            key={`${it.kind}-${it.id}`}
            href={KIND_HREF[it.kind]}
            className="flex-shrink-0 w-64 snap-start border border-earth/15 bg-parchment hover:border-earth/40 transition-colors"
          >
            {it.photoUrl ? (
              <div className="relative w-full aspect-[4/3] bg-earth/5">
                <Image
                  src={it.photoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full aspect-[4/3] bg-earth/5 flex items-center justify-center">
                <p className="font-serif text-3xl text-earth/30">
                  {kindLabel(it.kind)}
                </p>
              </div>
            )}
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-earth/50">
                  {kindLabel(it.kind)}
                </p>
                <p className="text-xs text-amber font-mono">
                  {it.yearsAgo === 1 ? "1 year ago" : `${it.yearsAgo} years ago`}
                </p>
              </div>
              <p className="text-sm text-earth leading-snug line-clamp-2">
                {it.preview}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
