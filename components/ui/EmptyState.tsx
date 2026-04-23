import type { ReactNode } from "react";

/**
 * EmptyState — shared shell for zero-data moments.
 *
 * Voice:
 *   - Plain. No therapy-speak, no "journey", no encouragement.
 *   - Concrete when possible. "Go somewhere. Hear something." beats
 *     "Get started by creating a track."
 *   - One line of headline, optional one-line hint below.
 *
 * Sizing:
 *   - default: generous vertical padding, centered, for page-level empties
 *   - compact: tight, for embedded empties inside cards/panels
 */
export function EmptyState({
  headline,
  hint,
  action,
  compact = false,
}: {
  headline: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`text-center ${compact ? "py-10 px-4" : "py-24 px-6"}`}
    >
      <p
        className={`font-serif text-earth/70 ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        {headline}
      </p>
      {hint && (
        <p
          className={`font-mono text-earth/40 mt-3 ${
            compact ? "text-[11px]" : "text-xs"
          }`}
        >
          {hint}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
