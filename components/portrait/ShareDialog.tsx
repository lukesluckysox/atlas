"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Share2, Download, X, Copy } from "lucide-react";

type Size = "portrait" | "square" | "story";

const SIZE_META: Record<Size, { label: string; subtitle: string; ratio: string }> = {
  portrait: { label: "Portrait", subtitle: "Instagram feed, threads", ratio: "aspect-[4/5]" },
  square: { label: "Square", subtitle: "Twitter, LinkedIn", ratio: "aspect-square" },
  story: { label: "Story", subtitle: "Instagram, TikTok stories", ratio: "aspect-[9/16]" },
};

/**
 * Portrait share flow. Renders a modal with size-picker + live preview, plus
 * download and native-share (where supported). Preview uses the same API
 * endpoint that serves downloads \u2014 single source of truth. Each size change
 * re-fetches with a cache-buster so we always see fresh content.
 */
export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [size, setSize] = useState<Size>("portrait");
  const [downloading, setDownloading] = useState(false);
  // Cache-buster lives on the preview URL so changing size forces a fresh
  // fetch without us needing to manage blob URLs.
  const [cacheKey] = useState(() => Date.now());

  if (!open) return null;

  const previewSrc = `/api/portrait/share?size=${size}&_=${cacheKey}`;

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/portrait/share?size=${size}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        toast.error(err.error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-portrait-${size}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Downloaded.");
    } catch {
      toast.error("Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  async function nativeShare() {
    // Navigator.share with files isn't universal, so try it then fall back
    // to download. iOS Safari and Chrome Android support file sharing;
    // desktop Firefox doesn't.
    try {
      const res = await fetch(`/api/portrait/share?size=${size}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const file = new File([blob], `trace-portrait-${size}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: { files?: File[] }) => boolean;
        share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "My Trace portrait",
          text: "What Trace sees.",
        });
        return;
      }
      // Fallback: download.
      await download();
    } catch {
      toast.error("Share not supported here. Try Download.");
    }
  }

  async function copyLink() {
    // We don't expose public links yet; copy the portrait page URL so the
    // viewer can come see it themselves (they'll auth with their own account).
    // Named differently from "share image" so intent is clear.
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/portrait`);
      toast.success("Link copied.");
    } catch {
      toast.error("Copy failed.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-earth/60 p-4 md:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-parchment border border-earth/20 shadow-xl animate-fade-in my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-earth/10">
          <div>
            <p className="label">Share portrait</p>
            <h2 className="font-serif text-xl text-earth mt-1">Your image, your way.</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-earth/40 hover:text-earth"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
          {/* Size picker */}
          <div className="md:col-span-2 p-6 md:border-r border-earth/10">
            <p className="font-mono text-[10px] text-earth/40 uppercase tracking-wider mb-4">
              Format
            </p>
            <div className="space-y-2 mb-8">
              {(Object.keys(SIZE_META) as Size[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setSize(k)}
                  className={`w-full text-left px-4 py-3 border transition-colors ${
                    size === k
                      ? "border-earth bg-earth text-parchment"
                      : "border-earth/15 hover:border-earth/40 text-earth"
                  }`}
                >
                  <p className="font-serif text-base leading-tight">{SIZE_META[k].label}</p>
                  <p
                    className={`font-mono text-[10px] mt-0.5 ${
                      size === k ? "text-parchment/60" : "text-earth/50"
                    }`}
                  >
                    {SIZE_META[k].subtitle}
                  </p>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={download}
                disabled={downloading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Download size={14} />
                {downloading ? "Rendering..." : "Download PNG"}
              </button>
              <button
                onClick={nativeShare}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Share2 size={14} />
                Share
              </button>
              <button
                onClick={copyLink}
                className="w-full flex items-center justify-center gap-2 py-2 font-mono text-xs text-earth/50 hover:text-earth"
              >
                <Copy size={12} />
                Copy link to portrait
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="md:col-span-3 p-6 bg-earth/5 flex items-center justify-center min-h-[400px]">
            <div className={`w-full max-w-xs ${SIZE_META[size].ratio} relative shadow-lg`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={size}
                src={previewSrc}
                alt="Portrait preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
