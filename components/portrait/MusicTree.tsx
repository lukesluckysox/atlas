"use client";
import { useEffect, useMemo, useState } from "react";
import { Music2 } from "lucide-react";

/**
 * Trace-native music tree.
 *
 * Only shows music the user has actually paired with a photo inside Traces.
 * Vertical layout:
 *   - Trunk rises from "YOU" at the bottom.
 *   - Primary branches are GENRES (strongest near the top of the trunk).
 *   - Each genre branch forks into artist twigs.
 *   - Each artist twig ends in album-art leaves (one per paired track).
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
  genres: string[];
  tracks: TrackLeaf[];
}

interface GenreGroup {
  genre: string;
  artists: ArtistBranch[];
}

interface TreeData {
  totalPairings: number;
  totalArtists: number;
  groups: GenreGroup[];
}

export function MusicTree() {
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedGenre, setFocusedGenre] = useState<string | null>(null);

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

  if (!data || data.groups.length === 0 || data.totalArtists === 0) {
    return (
      <div className="border border-earth/10 p-12 text-center">
        <Music2 size={24} className="text-sage/60 mx-auto mb-5" />
        <p className="font-mono text-sm text-earth/60 mb-2">No paired music yet.</p>
        <p className="font-mono text-xs text-earth/40 leading-relaxed max-w-sm mx-auto">
          Your tree grows from photos you pair with songs. Each pairing becomes
          a leaf; artists branch; genres become the canopy.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-earth/10 bg-parchment">
      <div className="flex items-center justify-between border-b border-earth/10 px-4 py-3">
        <p className="label">Music tree</p>
        <p className="font-mono text-xs text-earth/30">
          {data.totalPairings} pairing{data.totalPairings === 1 ? "" : "s"} ·{" "}
          {data.totalArtists} artist{data.totalArtists === 1 ? "" : "s"}
        </p>
      </div>

      <div className="relative overflow-hidden">
        <TreeCanvas
          groups={data.groups}
          focusedGenre={focusedGenre}
          onFocusGenre={setFocusedGenre}
        />
      </div>

      <div className="border-t border-earth/10 px-4 py-3">
        <p className="font-mono text-[10px] text-earth/40">
          {focusedGenre
            ? focusedGenre
            : "Branches = genres. Twigs = artists. Leaves = songs you paired with a photo."}
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Vertical tree layout (pairings-only)
// ------------------------------------------------------------------

const VW = 160;
const VH = 130;
const TRUNK_X = VW / 2;
const ROOT_Y = VH - 6;
const TRUNK_TOP = 30;

interface PositionedGenre {
  group: GenreGroup;
  side: "L" | "R";
  attachX: number;
  attachY: number;
  tipX: number;
  tipY: number;
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  artists: PositionedArtist[];
}

interface PositionedArtist {
  artist: ArtistBranch;
  startX: number;
  startY: number;
  tipX: number;
  tipY: number;
  leaves: Array<{ track: TrackLeaf; x: number; y: number }>;
}

function layoutTree(groups: GenreGroup[]): PositionedGenre[] {
  const maxCount = Math.max(
    ...groups.flatMap((g) => g.artists.map((a) => a.count)),
    1
  );
  const N = groups.length;

  // Sort by total count so strongest genres attach high on the trunk.
  const ordered = groups
    .map((g) => ({ g, total: g.artists.reduce((s, a) => s + a.count, 0) }))
    .sort((a, b) => b.total - a.total);

  return ordered.map((entry, rank) => {
    const { g: group } = entry;
    const side: "L" | "R" = rank % 2 === 0 ? "R" : "L";
    const sideSign = side === "R" ? 1 : -1;

    const attachT = rank / Math.max(N - 1, 1);
    const attachY = TRUNK_TOP + attachT * (ROOT_Y - TRUNK_TOP - 22);
    const attachX = TRUNK_X;

    const reach = 30 + (1 - rank / Math.max(N, 1)) * 20; // 30..50
    const lift = 8 + (1 - attachT) * 6;
    const tipX = attachX + sideSign * reach;
    const tipY = attachY - lift;

    const cp1 = { x: attachX + sideSign * 3, y: attachY - 2 };
    const cp2 = { x: attachX + sideSign * reach * 0.6, y: tipY + 5 };

    // Position artist twigs around the branch tip in a small fan.
    const artists = group.artists.map((artist, i) => {
      const count = group.artists.length;
      const tNorm = count === 1 ? 0.5 : i / (count - 1);
      const baseAngle = side === "R" ? -20 : -160;
      const fanSpan = 70;
      const angleDeg = baseAngle + (tNorm - 0.5) * fanSpan;
      const angleRad = (angleDeg * Math.PI) / 180;
      const twigLen = 8 + (artist.count / maxCount) * 6;
      const aTipX = tipX + twigLen * Math.cos(angleRad);
      const aTipY = tipY + twigLen * Math.sin(angleRad);

      // Leaves cluster around artist twig tip
      const leaves = artist.tracks.map((track, j) => {
        const trackCount = artist.tracks.length;
        const lNorm = trackCount === 1 ? 0.5 : j / (trackCount - 1);
        const leafAngle = angleDeg + (lNorm - 0.5) * 60;
        const leafRad = (leafAngle * Math.PI) / 180;
        const leafDist = 3 + (lNorm - 0.5) ** 2 * 1.5 + 1.5;
        return {
          track,
          x: aTipX + leafDist * Math.cos(leafRad),
          y: aTipY + leafDist * Math.sin(leafRad),
        };
      });

      return {
        artist,
        startX: tipX,
        startY: tipY,
        tipX: aTipX,
        tipY: aTipY,
        leaves,
      };
    });

    return {
      group,
      side,
      attachX,
      attachY,
      tipX,
      tipY,
      cp1,
      cp2,
      artists,
    };
  });
}

function TreeCanvas({
  groups,
  focusedGenre,
  onFocusGenre,
}: {
  groups: GenreGroup[];
  focusedGenre: string | null;
  onFocusGenre: (g: string | null) => void;
}) {
  const positioned = useMemo(() => layoutTree(groups), [groups]);

  return (
    <svg
      className="w-full h-auto"
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ display: "block", maxWidth: 720, margin: "0 auto" }}
    >
      {/* Ground shadow */}
      <ellipse
        cx={TRUNK_X}
        cy={ROOT_Y + 2}
        rx="22"
        ry="1.5"
        className="fill-earth"
        style={{ opacity: 0.08 }}
      />

      {/* Trunk */}
      <path
        d={`M ${TRUNK_X - 1.8} ${ROOT_Y}
            L ${TRUNK_X + 1.8} ${ROOT_Y}
            L ${TRUNK_X + 0.9} ${TRUNK_TOP}
            L ${TRUNK_X - 0.9} ${TRUNK_TOP}
            Z`}
        className="fill-earth"
        style={{ opacity: 0.55 }}
      />
      <circle cx={TRUNK_X} cy={TRUNK_TOP} r="1.2" className="fill-earth" style={{ opacity: 0.55 }} />

      {/* Genre branches */}
      {positioned.map((p) => {
        const dim = focusedGenre && focusedGenre !== p.group.genre ? 0.14 : 0.72;
        return (
          <path
            key={`genre-${p.group.genre}`}
            d={`M ${p.attachX} ${p.attachY}
                C ${p.cp1.x} ${p.cp1.y},
                  ${p.cp2.x} ${p.cp2.y},
                  ${p.tipX} ${p.tipY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.1}
            strokeLinecap="round"
            className="text-earth"
            style={{ opacity: dim, cursor: "pointer" }}
            onMouseEnter={() => onFocusGenre(p.group.genre)}
            onMouseLeave={() => onFocusGenre(null)}
          />
        );
      })}

      {/* Artist twigs */}
      {positioned.map((p) => {
        const dim = focusedGenre && focusedGenre !== p.group.genre ? 0.08 : 0.55;
        return p.artists.map((a) => (
          <line
            key={`twig-${p.group.genre}-${a.artist.name}`}
            x1={a.startX}
            y1={a.startY}
            x2={a.tipX}
            y2={a.tipY}
            stroke="currentColor"
            strokeWidth="0.4"
            strokeLinecap="round"
            className="text-earth"
            style={{ opacity: dim }}
          />
        ));
      })}

      {/* Leaf stems */}
      {positioned.map((p) => {
        const dim = focusedGenre && focusedGenre !== p.group.genre ? 0.05 : 0.3;
        return p.artists.flatMap((a) =>
          a.leaves.map((leaf, i) => (
            <line
              key={`stem-${p.group.genre}-${a.artist.name}-${i}`}
              x1={a.tipX}
              y1={a.tipY}
              x2={leaf.x}
              y2={leaf.y}
              stroke="currentColor"
              strokeWidth="0.2"
              className="text-sage"
              style={{ opacity: dim }}
            />
          ))
        );
      })}

      {/* Leaves — album art */}
      {positioned.map((p) =>
        p.artists.flatMap((a) =>
          a.leaves.map((leaf, i) => {
            const dim = focusedGenre && focusedGenre !== p.group.genre ? 0.2 : 1;
            const clipId = `leafclip-${p.group.genre}-${a.artist.name}-${i}`.replace(
              /\W+/g,
              "_"
            );
            return (
              <g key={`leaf-${clipId}`} style={{ opacity: dim }}>
                {leaf.track.albumArt ? (
                  <>
                    <defs>
                      <clipPath id={clipId}>
                        <circle cx={leaf.x} cy={leaf.y} r="2.1" />
                      </clipPath>
                    </defs>
                    <image
                      href={leaf.track.albumArt}
                      x={leaf.x - 2.1}
                      y={leaf.y - 2.1}
                      width="4.2"
                      height="4.2"
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <circle
                      cx={leaf.x}
                      cy={leaf.y}
                      r="2.1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.22"
                      className="text-earth/40"
                    />
                  </>
                ) : (
                  <circle
                    cx={leaf.x}
                    cy={leaf.y}
                    r="1.5"
                    fill="currentColor"
                    className="text-amber"
                  />
                )}
                <title>{`${leaf.track.name} — ${a.artist.name}`}</title>
              </g>
            );
          })
        )
      )}

      {/* Artist labels at twig tips */}
      {positioned.map((p) =>
        p.artists.map((a) => {
          const dim = focusedGenre && focusedGenre !== p.group.genre ? 0.3 : 1;
          const labelSide: "L" | "R" = a.tipX >= TRUNK_X ? "R" : "L";
          const offset = 2.6;
          const lx = a.tipX + (labelSide === "R" ? offset : -offset);
          const anchor = labelSide === "R" ? "start" : "end";
          const display =
            a.artist.name.length > 18
              ? `${a.artist.name.slice(0, 16)}…`
              : a.artist.name;
          return (
            <text
              key={`artist-${p.group.genre}-${a.artist.name}`}
              x={lx}
              y={a.tipY + 0.7}
              textAnchor={anchor}
              className="fill-earth"
              style={{
                fontSize: "2.6px",
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 500,
                opacity: dim,
              }}
            >
              {display}
            </text>
          );
        })
      )}

      {/* Genre labels at branch tips */}
      {positioned.map((p) => {
        const dim = focusedGenre && focusedGenre !== p.group.genre ? 0.4 : 1;
        const lx = p.attachX + (p.side === "R" ? 4 : -4);
        const ly = p.attachY - 1;
        const anchor = p.side === "R" ? "start" : "end";
        return (
          <text
            key={`gtext-${p.group.genre}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            className="fill-earth"
            style={{
              fontSize: "2.4px",
              fontFamily: "IBM Plex Mono, monospace",
              letterSpacing: "0.12em",
              opacity: dim * 0.6,
              textTransform: "uppercase",
            }}
          >
            {p.group.genre}
          </text>
        );
      })}

      {/* Root YOU */}
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
