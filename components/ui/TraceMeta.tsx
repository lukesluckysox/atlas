"use client";
import { MapPin, Calendar, Tag, Link2, History } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

/**
 * Unified metadata rhythm: every entry card across Trace (map entries,
 * notices, pairings, portrait items) renders date, location, tags, related
 * traces, and edit history through this single component so they always sit
 * in the same visual order and typography.
 *
 * Ordering is deliberate: when, where, what-kind, what-it-connects-to, last-touched.
 */

export interface RelatedTrace {
  id: string;
  label: string;
  href?: string;
}

export interface TraceMetaProps {
  date?: string | Date | null;
  location?: string | null;
  tags?: string[];
  related?: RelatedTrace[];
  updatedAt?: string | Date | null;
  /** Hide any field by leaving it undefined. Also allows compact mode. */
  size?: "sm" | "md";
  className?: string;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? null : d;
}

export function TraceMeta({
  date,
  location,
  tags,
  related,
  updatedAt,
  size = "md",
  className,
}: TraceMetaProps) {
  const d = toDate(date);
  const u = toDate(updatedAt);
  const iconSize = size === "sm" ? 10 : 11;
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  const hasAny =
    d || location || (tags && tags.length > 0) || (related && related.length > 0) || u;
  if (!hasAny) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono ${textSize} text-earth/50 ${className ?? ""}`}
    >
      {d && (
        <span className="inline-flex items-center gap-1">
          <Calendar size={iconSize} className="text-earth/35" />
          {format(d, "MMM d, yyyy")}
        </span>
      )}

      {location && (
        <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
          <MapPin size={iconSize} className="text-earth/35" />
          <span className="truncate">{location}</span>
        </span>
      )}

      {tags && tags.length > 0 && (
        <span className="inline-flex items-center gap-1 flex-wrap">
          <Tag size={iconSize} className="text-earth/35" />
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="px-1.5 py-0.5 border border-sage/30 text-sage/80 uppercase tracking-widest text-[9px]"
            >
              {t}
            </span>
          ))}
          {tags.length > 4 && (
            <span className="text-earth/30">+{tags.length - 4}</span>
          )}
        </span>
      )}

      {related && related.length > 0 && (
        <span className="inline-flex items-center gap-1 flex-wrap">
          <Link2 size={iconSize} className="text-earth/35" />
          {related.slice(0, 3).map((r) =>
            r.href ? (
              <a
                key={r.id}
                href={r.href}
                className="px-1.5 py-0.5 border border-earth/20 text-earth/70 hover:border-earth/50 hover:text-earth uppercase tracking-widest text-[9px] transition-colors"
              >
                {r.label}
              </a>
            ) : (
              <span
                key={r.id}
                className="px-1.5 py-0.5 border border-earth/20 text-earth/70 uppercase tracking-widest text-[9px]"
              >
                {r.label}
              </span>
            )
          )}
          {related.length > 3 && (
            <span className="text-earth/30">+{related.length - 3}</span>
          )}
        </span>
      )}

      {u && (
        <span
          className="inline-flex items-center gap-1 text-earth/35"
          title={format(u, "MMM d, yyyy 'at' h:mm a")}
        >
          <History size={iconSize} className="text-earth/25" />
          edited {formatDistanceToNow(u, { addSuffix: true })}
        </span>
      )}
    </div>
  );
}
