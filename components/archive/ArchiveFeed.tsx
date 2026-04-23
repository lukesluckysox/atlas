"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Search, Music2, MapPin, Eye, HelpCircle } from "lucide-react";
import type { Trace, TraceKind } from "@/lib/trace";
import { AddToCollection } from "@/components/collections/AddToCollection";

// ─── Types ────────────────────────────────────────────────────────────────

type KindFilter = "all" | TraceKind;
type TimeFilter = "all" | "week" | "month" | "year";

interface Counts {
  tracks: number;
  path: number;
  notice: number;
  encounter: number;
  total: number;
}

interface TracesResponse {
  traces: Array<Omit<Trace, "when"> & { when: string }>;
  counts: Counts;
  nextBefore: string | null;
  hasMore: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function sinceFor(time: TimeFilter): string | null {
  if (time === "all") return null;
  const now = new Date();
  const d = new Date(now);
  if (time === "week") d.setDate(d.getDate() - 7);
  else if (time === "month") d.setMonth(d.getMonth() - 1);
  else if (time === "year") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function whenLabel(d: Date): string {
  const ms = Date.now() - d.getTime();
  const days = ms / 86_400_000;
  if (days < 7) return formatDistanceToNow(d, { addSuffix: true });
  return format(d, "MMM d, yyyy");
}

// ─── Card (shared shell per kind) ─────────────────────────────────────────

const KIND_META: Record<
  TraceKind,
  { label: string; Icon: typeof Music2 }
> = {
  tracks: { label: "Tracks", Icon: Music2 },
  path: { label: "Path", Icon: MapPin },
  notice: { label: "Moment", Icon: Eye },
  encounter: { label: "Encounter", Icon: HelpCircle },
};

function TraceCard({ trace, isPro }: { trace: Trace; isPro: boolean }) {
  const { Icon, label } = KIND_META[trace.kind];

  return (
    <Link
      href={trace.href}
      className="block border border-earth/10 bg-parchment hover:border-earth/30 transition-colors group relative"
    >
      {/* AddToCollection lives inside the Link — it stops propagation so
          clicks on the icon don't trigger the card navigation. */}
      {isPro && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <AddToCollection kind={trace.kind} refId={trace.id} isPro={isPro} />
        </div>
      )}
      <div className="flex">
        {/* Photo strip (if any) */}
        {trace.photoUrl && (
          <div className="relative w-24 md:w-32 flex-shrink-0 bg-earth/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trace.photoUrl}
              alt=""
              className="w-full h-full object-cover aspect-square"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 p-4 md:p-5 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={11} className="text-amber flex-shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
              {label}
            </span>
            <span className="font-mono text-[10px] text-earth/20">·</span>
            <span className="font-mono text-[10px] text-earth/40">
              {whenLabel(trace.when)}
            </span>
            {trace.where.label && (
              <>
                <span className="font-mono text-[10px] text-earth/20">·</span>
                <span className="font-mono text-[10px] text-earth/40 truncate">
                  {trace.where.label}
                </span>
              </>
            )}
          </div>

          <p
            className={`font-serif text-earth leading-snug ${
              trace.kind === "notice" || trace.kind === "encounter"
                ? "text-base md:text-lg"
                : "text-sm md:text-base"
            } line-clamp-2`}
          >
            {trace.title}
          </p>

          {trace.read && (
            <p className="font-mono text-xs text-earth/50 mt-2 italic line-clamp-1">
              {trace.kind === "notice" ? `#${trace.read}` : trace.read}
            </p>
          )}

          {trace.body && trace.kind !== "notice" && (
            <p className="font-mono text-xs text-earth/40 mt-2 line-clamp-2">
              {trace.body}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
        active
          ? "bg-earth text-parchment border-earth"
          : "bg-parchment text-earth/50 border-earth/15 hover:border-earth/40 hover:text-earth"
      }`}
    >
      {children}
      {typeof count === "number" && (
        <span className="ml-1.5 opacity-60">{count}</span>
      )}
    </button>
  );
}

// ─── Main feed ────────────────────────────────────────────────────────────

export function ArchiveFeed({ isPro = false }: { isPro?: boolean } = {}) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 250);

  const [traces, setTraces] = useState<Trace[]>([]);
  const [counts, setCounts] = useState<Counts>({
    tracks: 0,
    path: 0,
    notice: 0,
    encounter: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Build a URL for /api/traces given current filters and optional cursor.
  const buildUrl = (before: string | null): string => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    const since = sinceFor(time);
    if (since) params.set("since", since);
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (before) params.set("before", before);
    params.set("take", "50");
    return `/api/traces?${params.toString()}`;
  };

  // First page / filter change — resets the list.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(buildUrl(null))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as TracesResponse;
        if (cancelled) return;
        const parsed: Trace[] = data.traces.map((t) => ({
          ...t,
          when: new Date(t.when),
        }));
        setTraces(parsed);
        setCounts(data.counts);
        setNextBefore(data.nextBefore);
        setHasMore(data.hasMore);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load archive.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, time, debouncedQuery]);

  // Load the next page using the cursor. Appends to existing list.
  const loadMore = async () => {
    if (loadingMore || !hasMore || !nextBefore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(buildUrl(nextBefore));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as TracesResponse;
      const parsed: Trace[] = data.traces.map((t) => ({
        ...t,
        when: new Date(t.when),
      }));
      setTraces((prev) => [...prev, ...parsed]);
      setNextBefore(data.nextBefore);
      setHasMore(data.hasMore);
    } catch {
      // Silent — retain what we have, user can scroll again to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  // IntersectionObserver for infinite scroll.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, nextBefore, loadingMore]);

  // Group by day for timeline feel.
  const grouped = useMemo(() => {
    const map = new Map<string, Trace[]>();
    for (const t of traces) {
      const key = format(t.when, "yyyy-MM-dd");
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return Array.from(map.entries()); // insertion-ordered = already reverse-chrono
  }, [traces]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Filter bar */}
      <div className="space-y-4 mb-8">
        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-earth/30"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across everything you've captured..."
            className="input-field pl-9"
          />
        </div>

        {/* Kind chips */}
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={kind === "all"}
            onClick={() => setKind("all")}
            count={counts.total}
          >
            All
          </FilterChip>
          <FilterChip
            active={kind === "tracks"}
            onClick={() => setKind("tracks")}
            count={kind === "all" ? counts.tracks : undefined}
          >
            Tracks
          </FilterChip>
          <FilterChip
            active={kind === "path"}
            onClick={() => setKind("path")}
            count={kind === "all" ? counts.path : undefined}
          >
            Path
          </FilterChip>
          <FilterChip
            active={kind === "notice"}
            onClick={() => setKind("notice")}
            count={kind === "all" ? counts.notice : undefined}
          >
            Notice
          </FilterChip>
          <FilterChip
            active={kind === "encounter"}
            onClick={() => setKind("encounter")}
            count={kind === "all" ? counts.encounter : undefined}
          >
            Encounter
          </FilterChip>
        </div>

        {/* Time chips */}
        <div className="flex flex-wrap gap-2">
          <FilterChip active={time === "week"} onClick={() => setTime("week")}>
            This week
          </FilterChip>
          <FilterChip active={time === "month"} onClick={() => setTime("month")}>
            This month
          </FilterChip>
          <FilterChip active={time === "year"} onClick={() => setTime("year")}>
            This year
          </FilterChip>
          <FilterChip active={time === "all"} onClick={() => setTime("all")}>
            All time
          </FilterChip>
        </div>
      </div>

      {/* Results */}
      {loading && traces.length === 0 ? (
        <div className="border border-earth/10 p-16 text-center">
          <p className="font-mono text-xs text-earth/30">Loading...</p>
        </div>
      ) : error ? (
        <div className="border border-terracotta/30 bg-terracotta/5 p-8 text-center">
          <p className="font-mono text-xs text-terracotta">{error}</p>
        </div>
      ) : traces.length === 0 ? (
        <div className="border border-earth/10 p-16 text-center">
          <p className="font-mono text-sm text-earth/40">
            {debouncedQuery.trim()
              ? `Nothing matching "${debouncedQuery.trim()}".`
              : "Nothing here yet. Go somewhere. Hear something."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map(([day, items]) => (
            <section key={day}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-earth/30 mb-3 border-b border-earth/10 pb-2">
                {format(new Date(day), "EEEE, MMMM d, yyyy")}
              </p>
              <div className="space-y-2">
                {items.map((t) => (
                  <TraceCard key={`${t.kind}-${t.id}`} trace={t} isPro={isPro} />
                ))}
              </div>
            </section>
          ))}

          {/* Infinite-scroll sentinel + load-more fallback button */}
          {hasMore && (
            <div ref={sentinelRef} className="pt-6 pb-12 text-center">
              {loadingMore ? (
                <p className="font-mono text-[10px] uppercase tracking-widest text-earth/30">
                  Loading more...
                </p>
              ) : (
                <button
                  onClick={loadMore}
                  className="font-mono text-[10px] uppercase tracking-widest text-earth/40 hover:text-earth border border-earth/15 hover:border-earth/40 px-4 py-2 transition-colors"
                >
                  Load more
                </button>
              )}
            </div>
          )}
          {!hasMore && traces.length > 20 && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-earth/20 text-center pt-6 pb-12">
              End of archive.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
