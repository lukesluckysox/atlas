"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { Camera, Compass, Sparkles, Fingerprint as FingerprintIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { sampleUrlMood, moodReading } from "@/lib/photo-mood";

/**
 * Portrait photomosaic with three interchangeable shape modes:
 *   - Compass:      photos form an 8-pointed compass rose
 *   - Constellation: photos scatter as "stars" with faint connector lines
 *   - Fingerprint:   photos spiral from center outward, oldest to newest
 *
 * All three consume the same photo pool from /api/portrait/photos.
 * User choice persists in localStorage.
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

type Mode = "compass" | "constellation" | "fingerprint";
const STORAGE_KEY = "trace:mosaic-mode";

const KIND_COLORS: Record<Tile["kind"], string> = {
  pairing: "bg-amber/25",
  experience: "bg-sage/25",
  mark: "bg-terracotta/25",
};

export function PhotoMosaic() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [mode, setMode] = useState<Mode>("compass");
  const [hovered, setHovered] = useState<Tile | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate preferred mode on mount
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Mode | null;
      if (stored === "compass" || stored === "constellation" || stored === "fingerprint") {
        setMode(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist mode
  const pickMode = (m: Mode) => {
    setMode(m);
    try {
      window.localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

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
  // headers), then PATCHed to the server. Updates happen in small
  // batches so the UI stays responsive.
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

      // Cap per-session work so a large history doesn't hammer the tab.
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

      // Optimistic: patch tiles in state so the mood field renders immediately.
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
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading mosaic…</p>
      </div>
    );
  }

  if (!tiles || tiles.length === 0) {
    return (
      <div className="border border-earth/10 p-16 text-center">
        <Camera size={24} className="text-amber/60 mx-auto mb-6" />
        <p className="font-mono text-sm text-earth/60 mb-2">No photos yet.</p>
        <p className="font-mono text-xs text-earth/40 leading-relaxed max-w-sm mx-auto">
          Pair a photo with a track, log an experience with an image, or leave a notice.
          Your mosaic takes shape as you add.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-earth/10 bg-parchment">
      <div className="flex items-center justify-between border-b border-earth/10 px-4 py-3 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <p className="label">Photomosaic</p>
          <p className="font-mono text-xs text-earth/30">
            {tiles.length} photo{tiles.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeButton current={mode} value="compass" onPick={pickMode} label="Compass" Icon={Compass} />
          <ModeButton current={mode} value="constellation" onPick={pickMode} label="Constellation" Icon={Sparkles} />
          <ModeButton current={mode} value="fingerprint" onPick={pickMode} label="Fingerprint" Icon={FingerprintIcon} />
        </div>
      </div>

      <div className="relative p-6 overflow-hidden">
        {mode === "compass" && <CompassMode tiles={tiles} onHover={setHovered} />}
        {mode === "constellation" && <ConstellationMode tiles={tiles} onHover={setHovered} />}
        {mode === "fingerprint" && <FingerprintMode tiles={tiles} onHover={setHovered} />}
      </div>

      <div className="border-t border-earth/10 px-4 py-3 h-14 flex items-center">
        {hovered ? (
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${KIND_COLORS[hovered.kind]} text-earth`}
            >
              {hovered.kind === "mark" ? "notice" : hovered.kind}
            </span>
            <p className="font-mono text-xs text-earth/70 truncate">{hovered.label}</p>
            {mode === "compass" && hovered.lum != null && hovered.warmth != null && (
              <span className="font-mono text-[10px] text-earth/40 whitespace-nowrap hidden sm:inline">
                · {moodReading({ lum: hovered.lum, warmth: hovered.warmth })}
              </span>
            )}
          </div>
        ) : (
          <p className="font-mono text-xs text-earth/30">
            {mode === "compass" && "Hover a tile. Warm → east, bright → north."}
            {mode === "constellation" && "Hover a tile. Photos from the same week are connected."}
            {mode === "fingerprint" && "Hover a tile. Oldest at the center, newest on the rim."}
          </p>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  current,
  value,
  label,
  Icon,
  onPick,
}: {
  current: Mode;
  value: Mode;
  label: string;
  Icon: LucideIcon;
  onPick: (m: Mode) => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onPick(value)}
      className={`flex items-center gap-1.5 font-mono text-xs px-2 py-1 border transition-colors ${
        active
          ? "border-amber bg-amber/10 text-earth"
          : "border-earth/10 text-earth/50 hover:border-earth/30"
      }`}
    >
      <Icon size={11} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ------------------------------------------------------------------
// Shared tile renderer
// ------------------------------------------------------------------

interface PositionedTile {
  tile: Tile;
  // Percentage positions — makes the whole thing responsive.
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
// Mode A — Mood field (compass)
// Each photo is placed by its own pixels:
//   x-axis: warmth  (W = cool ← → E = warm)
//   y-axis: luminance (S = dark ← → N = bright)
// Corner readings: NE golden hour, NW noon, SE ember, SW midnight.
// Photos awaiting mood analysis park faintly at the center.
// ------------------------------------------------------------------

function CompassMode({
  tiles,
  onHover,
}: {
  tiles: Tile[];
  onHover: (t: Tile | null) => void;
}) {
  const positioned = useMemo(() => moodFieldLayout(tiles), [tiles]);
  return (
    <div className="relative mx-auto" style={{ aspectRatio: "1 / 1", maxWidth: 640 }}>
      <MoodFieldGuides />

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
        { text: "golden hour", x: 88, y: 8, align: "right" as const },
        { text: "noon", x: 12, y: 8, align: "left" as const },
        { text: "ember", x: 88, y: 92, align: "right" as const },
        { text: "midnight", x: 12, y: 92, align: "left" as const },
      ].map((c) => (
        <span
          key={c.text}
          className="absolute font-mono text-[9px] uppercase tracking-wider text-earth/30 pointer-events-none"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {c.text}
        </span>
      ))}
    </div>
  );
}

function MoodFieldGuides() {
  // Warm-to-cool horizontal gradient (E warm → W cool) with a light-to-dark
  // vertical wash (N bright → S dark) at low opacity. Parchment-safe.
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
        {/* Crosshairs (true cardinal lines) */}
        <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" strokeWidth="0.12" className="text-earth/15" strokeDasharray="0.6 0.8" />
        <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="0.12" className="text-earth/15" strokeDasharray="0.6 0.8" />
        {/* Outer frame */}
        <rect x="8" y="8" width="84" height="84" fill="none" stroke="currentColor" strokeWidth="0.15" className="text-earth/15" />
      </svg>
    </>
  );
}

/**
 * Place each tile by its (warmth, lum). Tiles without mood yet land near
 * the center at reduced opacity so they're still present but deprioritized.
 *
 * Jitter: multiple photos with near-identical mood would stack. We apply a
 * small deterministic offset (derived from tile id) so the cluster breathes.
 */
function moodFieldLayout(tiles: Tile[]): PositionedTile[] {
  const SIZE = 6.5;
  const MARGIN = 10; // leave room for cardinal letters + corner labels
  const SPAN = 100 - MARGIN * 2;
  const JITTER = 3.2; // % container

  return tiles.map((tile) => {
    const hasMood = tile.lum != null && tile.warmth != null;
    const warmth = hasMood ? (tile.warmth as number) : 0.5;
    const lum = hasMood ? (tile.lum as number) : 0.5;

    // warmth 0..1 → xPct  (0 = W / left, 1 = E / right)
    // lum    0..1 → yPct  (0 = S / bottom, 1 = N / top) — invert y
    let x = MARGIN + warmth * SPAN;
    let y = MARGIN + (1 - lum) * SPAN;

    if (hasMood) {
      const [jx, jy] = hashJitter(tile.id, JITTER);
      x = clamp(x + jx, MARGIN, 100 - MARGIN);
      y = clamp(y + jy, MARGIN, 100 - MARGIN);
    } else {
      // Spiral un-moodified tiles softly around center.
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
  // Two pseudo-random components in [-1, 1]
  const a = (((h >>> 0) % 1000) / 1000) * 2 - 1;
  const b = ((((h >>> 10) >>> 0) % 1000) / 1000) * 2 - 1;
  return [a * amp, b * amp];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ------------------------------------------------------------------
// Mode B — Constellation
// ------------------------------------------------------------------

function ConstellationMode({
  tiles,
  onHover,
}: {
  tiles: Tile[];
  onHover: (t: Tile | null) => void;
}) {
  const { positioned, links } = useMemo(() => constellationLayout(tiles), [tiles]);
  return (
    <div
      className="relative mx-auto bg-earth/5 dark:bg-earth/20"
      style={{ aspectRatio: "3 / 2", maxWidth: 720 }}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 66.67"
        preserveAspectRatio="none"
      >
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1 * 0.6667}
            x2={l.x2}
            y2={l.y2 * 0.6667}
            stroke="currentColor"
            strokeWidth="0.08"
            className="text-amber/60"
          />
        ))}
      </svg>

      {positioned.map((p) => (
        <TileImg
          key={p.tile.id}
          item={p}
          onHover={onHover}
          extraClass="ring-1 ring-amber/40 shadow-[0_0_6px_rgba(212,168,67,0.35)]"
        />
      ))}
    </div>
  );
}

function constellationLayout(tiles: Tile[]): {
  positioned: PositionedTile[];
  links: { x1: number; y1: number; x2: number; y2: number }[];
} {
  // Deterministic pseudo-random scatter so positions stay stable across renders.
  const SIZE = 5;
  const positioned: PositionedTile[] = tiles.map((tile) => {
    const seed = hashString(tile.id);
    return {
      tile,
      xPct: 8 + seededRand(seed) * 84,
      yPct: 8 + seededRand(seed + 1) * 84,
      sizePct: SIZE + seededRand(seed + 2) * 2,
    };
  });

  // Link tiles whose createdAt is within the same week.
  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < positioned.length; i++) {
    const a = positioned[i];
    const aTime = new Date(a.tile.createdAt).getTime();
    for (let j = i + 1; j < positioned.length; j++) {
      const b = positioned[j];
      const bTime = new Date(b.tile.createdAt).getTime();
      const daysApart = Math.abs(aTime - bTime) / (1000 * 60 * 60 * 24);
      // Only link if within 7 days AND within 30% of canvas diagonal
      const dx = a.xPct - b.xPct;
      const dy = a.yPct - b.yPct;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (daysApart < 7 && dist < 28) {
        links.push({ x1: a.xPct, y1: a.yPct, x2: b.xPct, y2: b.yPct });
      }
    }
  }
  return { positioned, links };
}

// ------------------------------------------------------------------
// Mode C — Fingerprint spiral
// ------------------------------------------------------------------

function FingerprintMode({
  tiles,
  onHover,
}: {
  tiles: Tile[];
  onHover: (t: Tile | null) => void;
}) {
  const positioned = useMemo(() => fingerprintLayout(tiles), [tiles]);
  return (
    <div className="relative mx-auto" style={{ aspectRatio: "1 / 1", maxWidth: 640 }}>
      <FingerprintGuides />
      {positioned.map((p) => (
        <TileImg key={p.tile.id} item={p} onHover={onHover} />
      ))}
    </div>
  );
}

function FingerprintGuides() {
  // Three concentric arcs suggesting fingerprint ridges, offset slightly.
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {[18, 28, 38, 46].map((r, i) => (
        <ellipse
          key={r}
          cx={50 + (i % 2 === 0 ? 0 : 1)}
          cy="50"
          rx={r}
          ry={r * 0.95}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.12"
          className="text-earth/10"
        />
      ))}
    </svg>
  );
}

function fingerprintLayout(tiles: Tile[]): PositionedTile[] {
  // Sort by createdAt ascending (oldest first = center)
  const sorted = [...tiles].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const SIZE = 6;
  // Archimedean spiral: r = a + b * theta. Scale so last tile lands near rim.
  const N = sorted.length;
  const maxRadius = 42; // % of container
  const minRadius = 6;
  return sorted.map((tile, i) => {
    const t = N === 1 ? 0 : i / (N - 1); // 0..1
    const radius = minRadius + t * (maxRadius - minRadius);
    // Golden-angle sweep for even coverage
    const angle = i * 137.5 * (Math.PI / 180);
    return {
      tile,
      xPct: 50 + radius * Math.cos(angle),
      yPct: 50 + radius * Math.sin(angle),
      sizePct: SIZE,
    };
  });
}

// ------------------------------------------------------------------
// Deterministic pseudo-random helpers
// ------------------------------------------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRand(seed: number): number {
  // Mulberry32
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
