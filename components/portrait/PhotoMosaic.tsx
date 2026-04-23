"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { Camera } from "lucide-react";
import { sampleUrlMood, moodReading, narrateMoods } from "@/lib/photo-mood";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Compass portrait — a single, authored view of your photo pool.
 *
 * Each photo is placed by its own pixels:
 *   x-axis: warmth     (W = cool ← → E = warm)
 *   y-axis: luminance  (S = dark ← → N = bright)
 *
 * Corner readings: NE golden hour, NW noon, SE ember, SW midnight.
 * Photos awaiting mood analysis park faintly at the center.
 *
 * Photos come from /api/portrait/photos (pairings + experiences + marks).
 */

interface Tile {
  id: string;
  url: string;
  kind: "pairing" | "experience" | "mark";
  label: string;
  createdAt: string;
  lum: number | null;
  warmth: number | null;
}

const KIND_COLORS: Record<Tile["kind"], string> = {
  pairing: "bg-amber/25",
  experience: "bg-sage/25",
  mark: "bg-terracotta/25",
};

export function PhotoMosaic() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [hovered, setHovered] = useState<Tile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portrait/photos");
        if (!res.ok) return;
        const data: { tiles: Tile[] } = await res.json();
        if (!cancelled) setTiles(data.tiles);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // One-shot backfill: any tile missing mood is sampled client-side
  // (photos load with crossOrigin="anonymous" — Cloudinary serves CORS
  // headers), then PATCHed to the server.
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (backfilledRef.current) return;
    if (!tiles || tiles.length === 0) return;
    const pending = tiles.filter((t) => t.lum == null || t.warmth == null);
    if (pending.length === 0) return;
    backfilledRef.current = true;

    let cancelled = false;
    (async () => {
      const updates: Array<{ kind: Tile["kind"]; id: string; lum: number; warmth: number }> = [];
      const localPatches = new Map<string, { lum: number; warmth: number }>();

      const subset = pending.slice(0, 80);
      for (const tile of subset) {
        if (cancelled) return;
        const mood = await sampleUrlMood(tile.url);
        if (!mood) continue;
        const rawId = tile.id.slice(2); // strip "p_" / "e_" / "m_"
        updates.push({ kind: tile.kind, id: rawId, lum: mood.lum, warmth: mood.warmth });
        localPatches.set(tile.id, mood);
      }
      if (cancelled || updates.length === 0) return;

      setTiles((prev) =>
        prev
          ? prev.map((t) => {
              const m = localPatches.get(t.id);
              return m ? { ...t, lum: m.lum, warmth: m.warmth } : t;
            })
          : prev
      );

      try {
        await fetch("/api/portrait/mood-backfill", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates }),
        });
      } catch {
        /* silent — UI already has the values */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tiles]);

  if (loading) {
    return (
      <div className="border border-earth/10 p-16 text-center">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading compass…</p>
      </div>
    );
  }

  if (!tiles || tiles.length === 0) {
    return (
      <div className="border border-earth/10 text-center">
        <Camera size={24} className="text-amber/60 mx-auto mt-10 mb-2" />
        <EmptyState
          headline="No photos yet."
          hint="Pair a photo with a track, log a path, or mark a moment."
          compact
        />
      </div>
    );
  }

  return (
    <div className="border border-earth/10 bg-parchment">
      <div className="flex items-center justify-between border-b border-earth/10 px-4 py-3 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <p className="label">Compass</p>
          <p className="font-mono text-xs text-earth/30">
            {tiles.length} photo{tiles.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="relative p-6 overflow-hidden">
        <CompassMode tiles={tiles} onHover={setHovered} />
      </div>

      <div className="border-t border-earth/10 px-4 py-3 h-14 flex items-center">
        {hovered ? (
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${KIND_COLORS[hovered.kind]} text-earth`}
            >
              {hovered.kind === "mark" ? "notice" : hovered.kind === "pairing" ? "tracks" : "path"}
            </span>
            <p className="font-mono text-xs text-earth/70 truncate">{hovered.label}</p>
            {hovered.lum != null && hovered.warmth != null && (
              <span className="font-mono text-[10px] text-earth/40 whitespace-nowrap hidden sm:inline">
                · {moodReading({ lum: hovered.lum, warmth: hovered.warmth })}
              </span>
            )}
          </div>
        ) : (
          <p className="font-mono text-xs text-earth/30">
            Hover a tile. Warm → east, bright → north.
          </p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Shared tile renderer
// ------------------------------------------------------------------

interface PositionedTile {
  tile: Tile;
  xPct: number;
  yPct: number;
  sizePct: number;
}

function TileImg({
  item,
  onHover,
  extraClass = "",
  style,
}: {
  item: PositionedTile;
  onHover: (t: Tile | null) => void;
  extraClass?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`absolute overflow-hidden border border-parchment transition-transform hover:scale-[1.6] hover:z-20 hover:border-amber hover:shadow-lg ${extraClass}`}
      style={{
        left: `${item.xPct}%`,
        top: `${item.yPct}%`,
        width: `${item.sizePct}%`,
        aspectRatio: "1 / 1",
        transform: "translate(-50%, -50%)",
        ...style,
      }}
      onMouseEnter={() => onHover(item.tile)}
      onMouseLeave={() => onHover(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.tile.url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}

// ------------------------------------------------------------------
// Compass — the mood field
// ------------------------------------------------------------------

function CompassMode({
  tiles,
  onHover,
}: {
  tiles: Tile[];
  onHover: (t: Tile | null) => void;
}) {
  const positioned = useMemo(() => moodFieldLayout(tiles), [tiles]);
  const narration = useMemo(() => {
    const moods = tiles
      .filter((t) => t.lum != null && t.warmth != null)
      .map((t) => ({ lum: t.lum as number, warmth: t.warmth as number }));
    return narrateMoods(moods);
  }, [tiles]);

  const heat = useMemo(() => buildHeat(tiles), [tiles]);

  const centroidXY = narration
    ? {
        x: 10 + narration.centroid.warmth * 80,
        y: 10 + (1 - narration.centroid.lum) * 80,
      }
    : null;

  return (
    <div className="relative">
      {narration && (
        <div className="mb-3 text-center">
          <p className="font-serif text-lg text-earth leading-tight">
            {narration.headline}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40 mt-1">
            {narration.detail} · {narration.sampleSize} photo{narration.sampleSize === 1 ? "" : "s"} read
          </p>
        </div>
      )}
      <div className="relative mx-auto" style={{ aspectRatio: "1 / 1", maxWidth: 640 }}>
        <MoodFieldGuides heat={heat} />

        {positioned.map((p) => (
          <TileImg
            key={p.tile.id}
            item={p}
            onHover={onHover}
            extraClass={p.tile.lum == null ? "opacity-40" : ""}
          />
        ))}

        {/* Cardinal letters + corner readings */}
        {[
          { label: "N", x: 50, y: 3 },
          { label: "E", x: 97, y: 50 },
          { label: "S", x: 50, y: 97 },
          { label: "W", x: 3, y: 50 },
        ].map((d) => (
          <span
            key={d.label}
            className="absolute font-serif text-sm text-earth/50 pointer-events-none"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {d.label}
          </span>
        ))}
        {[
          { text: "golden hour", x: 86, y: 7 },
          { text: "noon", x: 14, y: 7 },
          { text: "ember", x: 86, y: 93 },
          { text: "midnight", x: 14, y: 93 },
        ].map((c) => (
          <span
            key={c.text}
            className="absolute font-mono text-[10px] uppercase tracking-[0.12em] text-earth/45 pointer-events-none hidden sm:inline"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {c.text}
          </span>
        ))}

        {/* Centroid marker — a small ring at the mean mood. */}
        {centroidXY && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${centroidXY.x}%`,
              top: `${centroidXY.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            title="Centroid of your mood field"
          >
            <div className="w-4 h-4 rounded-full border border-amber/60 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

interface HeatCell {
  xPct: number;
  yPct: number;
  intensity: number;
}

function MoodFieldGuides({ heat }: { heat: HeatCell[] }) {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(58,90,122,0.06), rgba(0,0,0,0) 50%, rgba(212,168,67,0.07))",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(245,240,232,0.35), rgba(0,0,0,0) 40%, rgba(44,24,16,0.10))",
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="mood-heat" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#D4A843" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
          </radialGradient>
        </defs>
        {heat.map((h, i) => (
          <circle
            key={i}
            cx={h.xPct}
            cy={h.yPct}
            r={4 + h.intensity * 11}
            fill="url(#mood-heat)"
            opacity={0.35 + h.intensity * 0.5}
          />
        ))}
        <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" strokeWidth="0.12" className="text-earth/15" strokeDasharray="0.6 0.8" />
        <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="0.12" className="text-earth/15" strokeDasharray="0.6 0.8" />
        <rect x="8" y="8" width="84" height="84" fill="none" stroke="currentColor" strokeWidth="0.15" className="text-earth/15" />
      </svg>
    </>
  );
}

function buildHeat(tiles: Tile[]): HeatCell[] {
  const GRID = 7;
  const MARGIN = 10;
  const SPAN = 100 - MARGIN * 2;

  const counts = new Map<string, number>();
  for (const t of tiles) {
    if (t.lum == null || t.warmth == null) continue;
    const gx = Math.min(GRID - 1, Math.floor(t.warmth * GRID));
    const gy = Math.min(GRID - 1, Math.floor((1 - t.lum) * GRID));
    const key = `${gx},${gy}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return [];

  const max = Math.max(...Array.from(counts.values()));
  const cells: HeatCell[] = [];
  for (const [key, count] of Array.from(counts.entries())) {
    const [gxStr, gyStr] = key.split(",");
    const gx = Number(gxStr);
    const gy = Number(gyStr);
    cells.push({
      xPct: MARGIN + ((gx + 0.5) / GRID) * SPAN,
      yPct: MARGIN + ((gy + 0.5) / GRID) * SPAN,
      intensity: count / max,
    });
  }
  return cells;
}

function moodFieldLayout(tiles: Tile[]): PositionedTile[] {
  const SIZE = 6.5;
  const MARGIN = 10;
  const SPAN = 100 - MARGIN * 2;
  const JITTER = 3.2;

  return tiles.map((tile) => {
    const hasMood = tile.lum != null && tile.warmth != null;
    const warmth = hasMood ? (tile.warmth as number) : 0.5;
    const lum = hasMood ? (tile.lum as number) : 0.5;

    let x = MARGIN + warmth * SPAN;
    let y = MARGIN + (1 - lum) * SPAN;

    if (hasMood) {
      const [jx, jy] = hashJitter(tile.id, JITTER);
      x = clamp(x + jx, MARGIN, 100 - MARGIN);
      y = clamp(y + jy, MARGIN, 100 - MARGIN);
    } else {
      const [jx, jy] = hashJitter(tile.id, JITTER * 1.5);
      x = 50 + jx;
      y = 50 + jy;
    }

    return { tile, xPct: x, yPct: y, sizePct: SIZE };
  });
}

function hashJitter(id: string, amp: number): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (((h >>> 0) % 1000) / 1000) * 2 - 1;
  const b = ((((h >>> 10) >>> 0) % 1000) / 1000) * 2 - 1;
  return [a * amp, b * amp];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
