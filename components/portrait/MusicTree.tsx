"use client";
import { useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";

/**
 * Radial music tree:
 *   - Center: "You"
 *   - Branches (top artists by pairing count) radiate outward
 *   - Each branch carries a small cluster of tracks as leaves
 *   - Node size scales with pairing count; album art shown on leaves when
 *     available
 *   - Hovering a branch dims the others so the selected lineage stands out
 */

interface TrackLeaf {
  id: string;
  name: string;
  albumArt: string | null;
  createdAt: string;
}

interface ArtistBranch {
  name: string;
  count: number;
  tracks: TrackLeaf[];
}

interface TreeData {
  totalPairings: number;
  totalArtists: number;
  branches: ArtistBranch[];
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
          Pair a photo with a track to start your tree. Branches grow around
          the artists you return to.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...data.branches.map((b) => b.count));

  return (
    <div className="border border-earth/10 bg-parchment">
      <div className="flex items-center justify-between border-b border-earth/10 px-4 py-3">
        <p className="label">Music tree</p>
        <p className="font-mono text-xs text-earth/30">
          {data.totalArtists} artist{data.totalArtists === 1 ? "" : "s"} · {data.totalPairings} pairing{data.totalPairings === 1 ? "" : "s"}
        </p>
      </div>

      <div className="relative overflow-hidden">
        <TreeCanvas
          branches={data.branches}
          maxCount={maxCount}
          focused={focused}
          onFocus={setFocused}
        />
      </div>

      {focused && (
        <div className="border-t border-earth/10 px-4 py-3">
          <p className="font-mono text-xs text-earth/50">
            <span className="text-earth/80">{focused}</span> — hover away to dim.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Radial tree layout
// ------------------------------------------------------------------

interface Positioned {
  branch: ArtistBranch;
  angle: number;    // degrees, 0 = right, 90 = down
  trunkEnd: { x: number; y: number };
  leaves: { track: TrackLeaf; x: number; y: number }[];
  nodeRadius: number;
}

const VIEW = 100;   // SVG viewBox (square)
const CENTER = 50;
const TRUNK = 24;   // length from center to artist node
const LEAF_OFFSET = 10; // further from the artist node
const LEAF_ARC = 55; // degrees the leaf fan spans

function layoutTree(branches: ArtistBranch[], maxCount: number): Positioned[] {
  const N = branches.length;
  return branches.map((branch, i) => {
    // Evenly spaced around the circle, start at top (-90deg)
    const angle = -90 + (i / N) * 360;
    const rad = (angle * Math.PI) / 180;
    const trunkEnd = {
      x: CENTER + TRUNK * Math.cos(rad),
      y: CENTER + TRUNK * Math.sin(rad),
    };

    // Node radius scales with pairing count, clamped.
    const rel = branch.count / Math.max(maxCount, 1);
    const nodeRadius = 2.5 + rel * 2.5; // 2.5 .. 5

    // Leaves fan out in an arc beyond the artist node
    const leaves = branch.tracks.map((track, j) => {
      const tracks = branch.tracks.length;
      const t = tracks === 1 ? 0.5 : j / (tracks - 1); // 0..1
      const fanOffset = (t - 0.5) * LEAF_ARC;
      const leafAngle = angle + fanOffset;
      const leafRad = (leafAngle * Math.PI) / 180;
      const dist = TRUNK + LEAF_OFFSET + (tracks > 3 ? Math.abs(t - 0.5) * 4 : 0);
      return {
        track,
        x: CENTER + dist * Math.cos(leafRad),
        y: CENTER + dist * Math.sin(leafRad),
      };
    });

    return { branch, angle, trunkEnd, leaves, nodeRadius };
  });
}

function TreeCanvas({
  branches,
  maxCount,
  focused,
  onFocus,
}: {
  branches: ArtistBranch[];
  maxCount: number;
  focused: string | null;
  onFocus: (name: string | null) => void;
}) {
  const positioned = useMemo(() => layoutTree(branches, maxCount), [branches, maxCount]);

  return (
    <svg
      className="w-full h-auto"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      style={{ aspectRatio: "1 / 1", maxWidth: 640, margin: "0 auto", display: "block" }}
    >
      {/* Trunks (center -> artist) */}
      {positioned.map((p) => {
        const dim = focused && focused !== p.branch.name ? 0.12 : 0.45;
        return (
          <line
            key={`trunk-${p.branch.name}`}
            x1={CENTER}
            y1={CENTER}
            x2={p.trunkEnd.x}
            y2={p.trunkEnd.y}
            stroke="currentColor"
            strokeWidth="0.35"
            className="text-sage"
            style={{ opacity: dim }}
          />
        );
      })}

      {/* Leaf stems (artist -> track) */}
      {positioned.map((p) => {
        const dim = focused && focused !== p.branch.name ? 0.08 : 0.3;
        return p.leaves.map((leaf, i) => (
          <line
            key={`stem-${p.branch.name}-${i}`}
            x1={p.trunkEnd.x}
            y1={p.trunkEnd.y}
            x2={leaf.x}
            y2={leaf.y}
            stroke="currentColor"
            strokeWidth="0.22"
            className="text-amber"
            style={{ opacity: dim }}
          />
        ));
      })}

      {/* Leaves (tracks) */}
      {positioned.map((p) =>
        p.leaves.map((leaf, i) => {
          const dim = focused && focused !== p.branch.name ? 0.25 : 1;
          return (
            <g key={`leaf-${p.branch.name}-${i}`} style={{ opacity: dim }}>
              {leaf.track.albumArt ? (
                <>
                  <defs>
                    <clipPath id={`clip-${p.branch.name}-${i}`}>
                      <circle cx={leaf.x} cy={leaf.y} r="2.2" />
                    </clipPath>
                  </defs>
                  <image
                    href={leaf.track.albumArt}
                    x={leaf.x - 2.2}
                    y={leaf.y - 2.2}
                    width="4.4"
                    height="4.4"
                    clipPath={`url(#clip-${p.branch.name}-${i})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  <circle
                    cx={leaf.x}
                    cy={leaf.y}
                    r="2.2"
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
                  r="1.6"
                  fill="currentColor"
                  className="text-amber"
                />
              )}
              <title>{`${leaf.track.name} — ${p.branch.name}`}</title>
            </g>
          );
        })
      )}

      {/* Artist nodes */}
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
              cx={p.trunkEnd.x}
              cy={p.trunkEnd.y}
              r={p.nodeRadius}
              className="fill-earth"
            />
            <circle
              cx={p.trunkEnd.x}
              cy={p.trunkEnd.y}
              r={p.nodeRadius - 0.8}
              className="fill-parchment"
            />
            <ArtistLabel
              x={p.trunkEnd.x}
              y={p.trunkEnd.y}
              angle={p.angle}
              name={p.branch.name}
              count={p.branch.count}
              nodeRadius={p.nodeRadius}
            />
          </g>
        );
      })}

      {/* Root "You" node */}
      <circle cx={CENTER} cy={CENTER} r="4.5" className="fill-earth" />
      <text
        x={CENTER}
        y={CENTER + 1.2}
        textAnchor="middle"
        className="fill-parchment"
        style={{ fontSize: "3px", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em" }}
      >
        YOU
      </text>
    </svg>
  );
}

function ArtistLabel({
  x,
  y,
  angle,
  name,
  count,
  nodeRadius,
}: {
  x: number;
  y: number;
  angle: number;
  name: string;
  count: number;
  nodeRadius: number;
}) {
  // Push label radially outward from the node so it doesn't overlap the center.
  const rad = (angle * Math.PI) / 180;
  const offset = nodeRadius + 2.2;
  const lx = x + offset * Math.cos(rad);
  const ly = y + offset * Math.sin(rad);
  // Flip anchor based on which side of center we're on
  const anchor = Math.cos(rad) < -0.2 ? "end" : Math.cos(rad) > 0.2 ? "start" : "middle";
  // Truncate long names
  const display = name.length > 18 ? `${name.slice(0, 16)}…` : name;
  return (
    <>
      <text
        x={lx}
        y={ly}
        textAnchor={anchor}
        className="fill-earth"
        style={{
          fontSize: "2.8px",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 500,
        }}
      >
        {display}
      </text>
      <text
        x={lx}
        y={ly + 2.6}
        textAnchor={anchor}
        className="fill-earth/50"
        style={{
          fontSize: "1.9px",
          fontFamily: "IBM Plex Mono, monospace",
          letterSpacing: "0.05em",
        }}
      >
        {count} track{count === 1 ? "" : "s"}
      </text>
    </>
  );
}
