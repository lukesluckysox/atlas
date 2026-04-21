"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ZoomIn, ZoomOut } from "lucide-react";

/**
 * A photomosaic that arranges the user's uploaded photos into the shape of
 * the current year (or month). Zoomed in you see individual photos; zoomed
 * out the cluster of tiles reveals the glyph.
 *
 * The shape is computed by rendering text to an offscreen canvas and
 * sampling alpha at a grid. Any cell whose alpha is above a threshold gets
 * a photo tile; everything else is empty parchment.
 */

interface Tile {
  id: string;
  url: string;
  kind: "pairing" | "experience" | "mark";
  label: string;
  createdAt: string;
}

type Mode = "year" | "month";

const MONTH_LABELS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

export function PhotoMosaic() {
  const [tiles, setTiles] = useState<Tile[] | null>(null);
  const [mode, setMode] = useState<Mode>("year");
  const [zoom, setZoom] = useState(1);
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

  const now = new Date();
  const label = mode === "year"
    ? String(now.getFullYear())
    : MONTH_LABELS[now.getMonth()];

  // Grid dimensions — more cells = sharper glyph, but more tiles.
  const GRID_W = mode === "year" ? 60 : 48;
  const GRID_H = 24;

  const shapeCells = useMemo(() => computeShape(label, GRID_W, GRID_H), [label, GRID_W, GRID_H]);

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
          Pair a photo with a track, log an experience with an image, or leave a mark.
          Your collage will grow into the shape of the year.
        </p>
      </div>
    );
  }

  const tileSize = Math.max(6, Math.round(10 * zoom));

  return (
    <div className="border border-earth/10 bg-parchment">
      <div className="flex items-center justify-between border-b border-earth/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="label">Mosaic</p>
          <p className="font-mono text-xs text-earth/30">
            {tiles.length} photo{tiles.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("year")}
            className={`font-mono text-xs px-2 py-1 border transition-colors ${
              mode === "year"
                ? "border-amber bg-amber/10 text-earth"
                : "border-earth/10 text-earth/50 hover:border-earth/30"
            }`}
          >
            {now.getFullYear()}
          </button>
          <button
            onClick={() => setMode("month")}
            className={`font-mono text-xs px-2 py-1 border transition-colors ${
              mode === "month"
                ? "border-amber bg-amber/10 text-earth"
                : "border-earth/10 text-earth/50 hover:border-earth/30"
            }`}
          >
            {MONTH_LABELS[now.getMonth()]}
          </button>
          <div className="w-px h-4 bg-earth/10 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="text-earth/40 hover:text-earth"
            aria-label="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            className="text-earth/40 hover:text-earth"
            aria-label="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="overflow-auto p-6 bg-parchment">
        <div
          className="relative mx-auto"
          style={{
            width: GRID_W * tileSize,
            height: GRID_H * tileSize,
          }}
        >
          {shapeCells.map((cell, i) => {
            const tile = tiles[i % tiles.length];
            return (
              <div
                key={`${cell.x}-${cell.y}`}
                className="absolute overflow-hidden border border-parchment transition-transform hover:scale-150 hover:z-10 hover:border-amber hover:shadow-lg"
                style={{
                  left: cell.x * tileSize,
                  top: cell.y * tileSize,
                  width: tileSize,
                  height: tileSize,
                }}
                onMouseEnter={() => setHovered(tile)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  draggable={false}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-earth/10 px-4 py-3 h-14 flex items-center">
        {hovered ? (
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${
                hovered.kind === "pairing"
                  ? "bg-amber/20 text-earth"
                  : hovered.kind === "experience"
                  ? "bg-sage/20 text-earth"
                  : "bg-terracotta/20 text-earth"
              }`}
            >
              {hovered.kind}
            </span>
            <p className="font-mono text-xs text-earth/70 truncate">{hovered.label}</p>
          </div>
        ) : (
          <p className="font-mono text-xs text-earth/30">
            Hover a tile to see its source. Zoom out to see the shape of {label}.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Compute which grid cells fall inside the glyph for `text` by rendering
 * the text to an offscreen canvas at exactly the grid resolution and
 * reading back alpha.
 */
interface Cell {
  x: number;
  y: number;
}

function computeShape(text: string, gridW: number, gridH: number): Cell[] {
  if (typeof document === "undefined") return [];
  const canvas = document.createElement("canvas");
  canvas.width = gridW;
  canvas.height = gridH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  ctx.fillStyle = "#000";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  // Fit font to height — rough heuristic.
  const fontSize = Math.floor(gridH * 0.95);
  ctx.font = `900 ${fontSize}px "Playfair Display", Georgia, serif`;
  ctx.fillText(text, gridW / 2, gridH / 2 + 1);

  const { data } = ctx.getImageData(0, 0, gridW, gridH);
  const cells: Cell[] = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = (y * gridW + x) * 4 + 3; // alpha
      if (data[idx] > 80) cells.push({ x, y });
    }
  }
  return cells;
}
