import type { ReactNode } from "react";

/**
 * PageHeader — the shared structural header for every primary page.
 *
 * Grammar (applied consistently, in order):
 *   1. label    — uppercase mono chip (the trace kind or section)
 *   2. h1       — serif, largest on-screen text
 *   3. tagline  — one-line "what this does"
 *   4. right    — optional slot for actions / status chips
 *
 * Pages should not repeat these elements outside the header. Keep it at the
 * top of the page container; do not nest.
 */
export function PageHeader({
  label,
  h1,
  tagline,
  right,
}: {
  label: string;
  h1: string;
  tagline?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-12 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0">
        <p className="label mb-2">{label}</p>
        <h1 className="font-serif text-4xl text-earth leading-tight break-words">
          {h1}
        </h1>
        {tagline && (
          <p className="font-mono text-xs text-earth/40 mt-2 leading-relaxed">
            {tagline}
          </p>
        )}
      </div>
      {right && (
        <div className="flex flex-wrap gap-2 sm:pt-1 sm:shrink-0">{right}</div>
      )}
    </div>
  );
}
