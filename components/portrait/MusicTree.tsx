"use client";
import { useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";

/**
 * Vertical music tree.
 *   - Trunk rises from "YOU" at the bottom of the canvas.
 *   - Branches fan up and out, alternating left/right. Strongest artists
 *     sit closer to the trunk top; weaker ones lower and more to the side.
 *   - Each branch ends in a cluster of leaves (album art).
 *   - Artists that share genres are connected by thin dashed vines, so
 *     musically-similar branches visually reach toward each other.
 */

interface TrackLeaf {
  id: string;
  name: string;
  albumArt: string | null;
  createdAt: string;
}

interface ArtistBranch {
  name: string;
  count: number;           // internal weight
  rank?: number | null;    // 1-based rank in Spotify's top-artists list
  recentPlays?: number;    // actual plays in the recently-played window
  genres?: string[];
  tracks: TrackLeaf[];
}

interface SimilarityLink {
  a: string;
  b: string;
  shared: string[];
}

interface TreeData {
  totalPairings: number;
  totalArtists: number;
  branches: ArtistBranch[];
  links: SimilarityLink[];
  timeRange?: string;
  source?: string;
}

export function MusicTree() {
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portrait/music-tree");
        if (!res.ok) return;
        const json: TreeData = await res.json();
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="border border-earth/10 p-12 text-center">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Growing tree…</p>
      </div>
    );
  }

  if (!data || data.branches.length === 0) {
    return (
      <div className="border border-earth/10 p-12 text-center">
        <Music2 size={24} className="text-sage/60 mx-auto mb-5" />
        <p className="font-mono text-sm text-earth/60 mb-2">No music yet.</p>
        <p className="font-mono text-xs text-earth/40 leading-relaxed max-w-sm mx-auto">
          Connect Spotify or pair a photo with a track to start your tree.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-earth/10 bg-parchment">
      <div className="flex items-center justify-between border-b border-earth/10 px-4 py-3">
        <p className="label">Music tree</p>
        <p className="font-mono text-xs text-earth/30">
          {data.source === "spotify"
            ? `Last 4 weeks · top ${data.totalArtists}`
            : `${data.totalArtists} artist${data.totalArtists === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="relative overflow-hidden">
        <TreeCanvas
          branches={data.branches}
          links={data.links ?? []}
          focused={focused}
          onFocus={setFocused}
        />
      </div>

      {focused ? (
        <div className="border-t border-earth/10 px-4 py-3">
          <p className="font-mono text-xs text-earth/50">
            <span className="text-earth/80">{focused}</span>
            {(() => {
              const b = data.branches.find((x) => x.name === focused);
              if (!b?.genres || b.genres.length === 0) return null;
              return <> — {b.genres.slice(0, 3).join(" · ")}</>;
            })()}
          </p>
        </div>
      ) : (
        data.links.length > 0 && (
          <div className="border-t border-earth/10 px-4 py-3">
            <p className="font-mono text-[10px] text-earth/40">
              Dashed vines connect artists that share a genre. Hover a branch to isolate.
            </p>
          </div>
        )
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Vertical tree layout
// ------------------------------------------------------------------

// Canvas is wider than tall so branches have room to spread.
const VW = 160;
const VH = 110;
const TRUNK_X = VW / 2;
const ROOT_Y = VH - 6; // "YOU" sits near the bottom
const TRUNK_TOP = 40;   // top of the main trunk

interface Positioned {
  branch: ArtistBranch;
  index: number;
  // Where this branch attaches to the trunk
  attachX: number;
  attachY: number;
  // Tip of the branch (artist node position)
  tipX: number;
  tipY: number;
  // Cubic bezier control points
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  leaves: Array<{ track: TrackLeaf; x: number; y: number }>;
  nodeRadius: number;
  side: "L" | "R";
}

function layoutTree(branches: ArtistBranch[]): Positioned[] {
  const maxCount = Math.max(...branches.map((b) => b.count), 1);
  const N = branches.length;

  // Sort by count so strongest branches attach highest on the trunk.
  const ordered = branches
    .map((b, i) => ({ b, i, count: b.count }))
    .sort((a, b) => b.count - a.count);

  return ordered.map((entry, rank) => {
    const { b: branch, i: originalIndex } = entry;

    // Alternate sides; strongest goes to the right, next left, etc.
    const side: "L" | "R" = rank % 2 === 0 ? "R" : "L";
    const sideSign = side === "R" ? 1 : -1;

    // Strongest branches attach near the top of the trunk, weakest near bottom
    // (but not below the root).
    const attachT = rank / Math.max(N - 1, 1); // 0 at strongest, 1 at weakest
    const attachY = TRUNK_TOP + attachT * (ROOT_Y - TRUNK_TOP - 18);
    const attachX = TRUNK_X;

    // Branch reach grows with count relative to max. Strong = longer branch.
    const rel = branch.count / maxCount;
    const reach = 32 + rel * 28; // 32..60

    // Tip of the branch: horizontally out, and slightly upward for lift.
    // Upper branches lift less (they're already high); lower branches lift more.
    const lift = 6 + (1 - attachT) * 6 + rel * 4; // 6..16
    const tipX = attachX + sideSign * reach;
    const tipY = attachY - lift;

    // Cubic bezier for a natural curve: first control hugs the trunk briefly,
    // second control aims at the tip but from below for an arcing feel.
    const cp1 = { x: attachX + sideSign * 4, y: attachY - 2 };
    const cp2 = { x: attachX + sideSign * reach * 0.65, y: tipY + 6 };

    // Node radius scales with count
    const nodeRadius = 2.8 + rel * 2.4; // 2.8..5.2

    // Leaves cluster around the tip in a small fan.
    const leaves = branch.tracks.map((track, j) => {
      const tracks = branch.tracks.length;
      const tNorm = tracks === 1 ? 0.5 : j / (tracks - 1);
      // Angle fan centered on a vector pointing "up-and-out" from the tip
      const baseAngle = side === "R" ? -30 : -150; // degrees; -90 is straight up
      const fanSpan = 90;
      const angleDeg = baseAngle + (tNorm - 0.5) * fanSpan;
      const angleRad = (angleDeg * Math.PI) / 180;
      const dist = 5 + (tNorm - 0.5) ** 2 * 2 + 2; // slight bow
      return {
        track,
        x: tipX + dist * Math.cos(angleRad),
        y: tipY + dist * Math.sin(angleRad),
      };
    });

    return {
      branch,
      index: originalIndex,
      attachX,
      attachY,
      tipX,
      tipY,
      cp1,
      cp2,
      leaves,
      nodeRadius,
      side,
    };
  });
}

function TreeCanvas({
  branches,
  links,
  focused,
  onFocus,
}: {
  branches: ArtistBranch[];
  links: SimilarityLink[];
  focused: string | null;
  onFocus: (name: string | null) => void;
}) {
  const positioned = useMemo(() => layoutTree(branches), [branches]);
  const byName = useMemo(() => {
    const m = new Map<string, Positioned>();
    positioned.forEach((p) => m.set(p.branch.name, p));
    return m;
  }, [positioned]);

  return (
    <svg
      className="w-full h-auto"
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ display: "block", maxWidth: 720, margin: "0 auto" }}
    >
      {/* Soft ground shadow under root */}
      <ellipse
        cx={TRUNK_X}
        cy={ROOT_Y + 2}
        rx="22"
        ry="1.5"
        className="fill-earth"
        style={{ opacity: 0.08 }}
      />

      {/* Trunk — tapered rectangle */}
      <path
        d={`M ${TRUNK_X - 1.8} ${ROOT_Y}
            L ${TRUNK_X + 1.8} ${ROOT_Y}
            L ${TRUNK_X + 0.9} ${TRUNK_TOP}
            L ${TRUNK_X - 0.9} ${TRUNK_TOP}
            Z`}
        className="fill-earth"
        style={{ opacity: 0.55 }}
      />

      {/* Trunk top crown — tiny rounded bump so branches feel rooted */}
      <circle
        cx={TRUNK_X}
        cy={TRUNK_TOP}
        r="1.2"
        className="fill-earth"
        style={{ opacity: 0.55 }}
      />

      {/* Similarity vines — dashed lines between branch tips that share genres */}
      {links.map((link, i) => {
        const A = byName.get(link.a);
        const B = byName.get(link.b);
        if (!A || !B) return null;
        const dim =
          focused && focused !== link.a && focused !== link.b ? 0.06 : 0.25;
        // Curve through the midpoint shifted slightly up for a natural arc
        const midX = (A.tipX + B.tipX) / 2;
        const midY = Math.min(A.tipY, B.tipY) - 8;
        return (
          <path
            key={`sim-${i}`}
            d={`M ${A.tipX} ${A.tipY} Q ${midX} ${midY} ${B.tipX} ${B.tipY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.28"
            strokeDasharray="0.8 1.1"
            className="text-sage"
            style={{ opacity: dim }}
          />
        );
      })}

      {/* Branches — cubic bezier curves from trunk to each tip */}
      {positioned.map((p) => {
        const dim = focused && focused !== p.branch.name ? 0.14 : 0.7;
        const rel = p.nodeRadius / 5.2; // 0..1
        const width = 0.55 + rel * 0.7; // thicker branches for stronger artists
        return (
          <path
            key={`branch-${p.branch.name}`}
            d={`M ${p.attachX} ${p.attachY}
                C ${p.cp1.x} ${p.cp1.y},
                  ${p.cp2.x} ${p.cp2.y},
                  ${p.tipX} ${p.tipY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={width}
            strokeLinecap="round"
            className="text-earth"
            style={{ opacity: dim }}
          />
        );
      })}

      {/* Leaf stems: tiny line from tip to each leaf */}
      {positioned.map((p) => {
        const dim = focused && focused !== p.branch.name ? 0.06 : 0.35;
        return p.leaves.map((leaf, i) => (
          <line
            key={`stem-${p.branch.name}-${i}`}
            x1={p.tipX}
            y1={p.tipY}
            x2={leaf.x}
            y2={leaf.y}
            stroke="currentColor"
            strokeWidth="0.22"
            className="text-sage"
            style={{ opacity: dim }}
          />
        ));
      })}

      {/* Leaves — album art circles */}
      {positioned.map((p) =>
        p.leaves.map((leaf, i) => {
          const dim = focused && focused !== p.branch.name ? 0.22 : 1;
          const clipId = `leafclip-${p.branch.name.replace(/\W+/g, "_")}-${i}`;
          return (
            <g key={`leaf-${p.branch.name}-${i}`} style={{ opacity: dim }}>
              {leaf.track.albumArt ? (
                <>
                  <defs>
                    <clipPath id={clipId}>
                      <circle cx={leaf.x} cy={leaf.y} r="2.4" />
                    </clipPath>
                  </defs>
                  <image
                    href={leaf.track.albumArt}
                    x={leaf.x - 2.4}
                    y={leaf.y - 2.4}
                    width="4.8"
                    height="4.8"
                    clipPath={`url(#${clipId})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  <circle
                    cx={leaf.x}
                    cy={leaf.y}
                    r="2.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.25"
                    className="text-earth/40"
                  />
                </>
              ) : (
                <circle
                  cx={leaf.x}
                  cy={leaf.y}
                  r="1.7"
                  fill="currentColor"
                  className="text-amber"
                />
              )}
              <title>{`${leaf.track.name} — ${p.branch.name}`}</title>
            </g>
          );
        })
      )}

      {/* Artist nodes + labels at branch tips */}
      {positioned.map((p) => {
        const isFocused = focused === p.branch.name;
        const dim = focused && !isFocused ? 0.35 : 1;
        return (
          <g
            key={`node-${p.branch.name}`}
            style={{ cursor: "pointer", opacity: dim }}
            onMouseEnter={() => onFocus(p.branch.name)}
            onMouseLeave={() => onFocus(null)}
          >
            <circle
              cx={p.tipX}
              cy={p.tipY}
              r={p.nodeRadius}
              className="fill-earth"
            />
            <circle
              cx={p.tipX}
              cy={p.tipY}
              r={p.nodeRadius - 0.9}
              className="fill-parchment"
            />
            <ArtistLabel
              x={p.tipX}
              y={p.tipY}
              side={p.side}
              name={p.branch.name}
              rank={p.branch.rank}
              recentPlays={p.branch.recentPlays}
              nodeRadius={p.nodeRadius}
            />
          </g>
        );
      })}

      {/* Root "YOU" marker */}
      <circle cx={TRUNK_X} cy={ROOT_Y} r="5" className="fill-earth" />
      <text
        x={TRUNK_X}
        y={ROOT_Y + 1.3}
        textAnchor="middle"
        className="fill-parchment"
        style={{
          fontSize: "3.2px",
          fontFamily: "IBM Plex Mono, monospace",
          letterSpacing: "0.12em",
        }}
      >
        YOU
      </text>
    </svg>
  );
}

function ArtistLabel({
  x,
  y,
  side,
  name,
  rank,
  recentPlays,
  nodeRadius,
}: {
  x: number;
  y: number;
  side: "L" | "R";
  name: string;
  rank: number | null | undefined;
  recentPlays: number | undefined;
  nodeRadius: number;
}) {
  const sideSign = side === "R" ? 1 : -1;
  const offset = nodeRadius + 2.2;
  const lx = x + sideSign * offset;
  const ly = y + 0.6;
  const anchor = side === "R" ? "start" : "end";
  const display = name.length > 22 ? `${name.slice(0, 20)}…` : name;

  // Build an honest meta string. Spotify Web API does not expose true play
  // counts, so we show rank (#1, #2, ...) and — if any — real plays from the
  // recently-played window.
  const parts: string[] = [];
  if (rank && rank > 0) parts.push(`#${rank}`);
  if (recentPlays && recentPlays > 0) {
    parts.push(`${recentPlays} recent play${recentPlays === 1 ? "" : "s"}`);
  }
  const meta = parts.join(" · ");

  return (
    <>
      <text
        x={lx}
        y={ly}
        textAnchor={anchor}
        className="fill-earth"
        style={{
          fontSize: "3.2px",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 500,
        }}
      >
        {display}
      </text>
      {meta && (
        <text
          x={lx}
          y={ly + 3}
          textAnchor={anchor}
          className="fill-earth/50"
          style={{
            fontSize: "2.1px",
            fontFamily: "IBM Plex Mono, monospace",
            letterSpacing: "0.05em",
          }}
        >
          {meta}
        </text>
      )}
    </>
  );
}
