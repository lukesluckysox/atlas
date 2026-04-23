"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  isPro: boolean;
}

/**
 * High-res map export. Pro-only \u2014 renders nothing for free users (gating
 * is duplicated on the server). Downloads a PNG straight from the API.
 */
export function MapPrintButton({ isPro }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState("outdoors");
  const [size, setSize] = useState<"letter" | "square" | "wide">("letter");

  if (!isPro) return null;

  async function download() {
    setBusy(true);
    try {
      const dims = DIMS[size];
      const res = await fetch(
        `/api/map/print?width=${dims.w}&height=${dims.h}&style=${style}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        toast.error(err.error ?? "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-map-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded.");
      setOpen(false);
    } catch {
      toast.error("Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary text-xs flex items-center gap-2"
        title="Export map as high-res image"
      >
        <Printer size={13} />
        Print
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-parchment border border-earth/20 shadow-lg p-4">
            <p className="label mb-3">Export map</p>

            <p className="font-mono text-[10px] text-earth/40 uppercase tracking-wider mb-2">Style</p>
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border ${
                    style === s.value
                      ? "bg-earth text-parchment border-earth"
                      : "bg-parchment text-earth/60 border-earth/20 hover:border-earth/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <p className="font-mono text-[10px] text-earth/40 uppercase tracking-wider mb-2">Size</p>
            <div className="grid grid-cols-3 gap-1.5 mb-5">
              {(Object.keys(DIMS) as Array<keyof typeof DIMS>).map((k) => (
                <button
                  key={k}
                  onClick={() => setSize(k)}
                  className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 border ${
                    size === k
                      ? "bg-earth text-parchment border-earth"
                      : "bg-parchment text-earth/60 border-earth/20 hover:border-earth/40"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <button
              onClick={download}
              disabled={busy}
              className="btn-primary text-xs w-full disabled:opacity-40"
            >
              {busy ? "Rendering..." : "Download PNG"}
            </button>
            <p className="font-mono text-[10px] text-earth/30 mt-3 leading-relaxed">
              2x resolution. Up to 80 most recent pins. Private.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const STYLE_OPTIONS = [
  { value: "outdoors", label: "Outdoors" },
  { value: "streets", label: "Streets" },
  { value: "satellite", label: "Satellite" },
  { value: "light", label: "Light" },
];

const DIMS: Record<"letter" | "square" | "wide", { w: number; h: number }> = {
  letter: { w: 960, h: 1240 },
  square: { w: 1100, h: 1100 },
  wide: { w: 1280, h: 720 },
};
