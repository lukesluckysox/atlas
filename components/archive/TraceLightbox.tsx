"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  X,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Music2,
  Eye,
  HelpCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import type { Trace, TraceKind } from "@/lib/trace";

// ─── Endpoints ────────────────────────────────────────────────────────────
// Same kind-to-REST mapping used by the card row. Encounters are time-bound
// questions and aren't deletable.
const DELETE_PATH: Record<TraceKind, ((id: string) => string) | null> = {
  tracks: (id) => `/api/pairings/${id}`,
  path: (id) => `/api/experiences/${id}`,
  notice: (id) => `/api/marks/${id}`,
  encounter: null,
};

const KIND_META: Record<TraceKind, { label: string; Icon: typeof Music2 }> = {
  tracks: { label: "Track", Icon: Music2 },
  path: { label: "Path", Icon: MapPin },
  notice: { label: "Moment", Icon: Eye },
  encounter: { label: "Encounter", Icon: HelpCircle },
};

/**
 * TraceLightbox — a pop-out viewer for any trace kind.
 *
 * Opens over the Archive feed so users can inspect an entry without leaving
 * the timeline. Supports prev/next navigation in chronological order, delete
 * with confirm, deep-link into the parent tool, and standard close (X /
 * ESC / backdrop click).
 */
export function TraceLightbox({
  traces,
  index,
  onClose,
  onNavigate,
  onDeleted,
}: {
  traces: Trace[];
  index: number;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onDeleted: (kind: TraceKind, id: string) => void;
}) {
  const trace = traces[index];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteUrl = trace ? DELETE_PATH[trace.kind]?.(trace.id) : null;
  const Icon = trace ? KIND_META[trace.kind].Icon : X;
  const kindLabel = trace ? KIND_META[trace.kind].label : "";

  // Reset confirm state when navigating between traces so a stale "Confirm
  // delete" doesn't carry across entries.
  useEffect(() => {
    setConfirmDelete(false);
    setDeleteBusy(false);
  }, [trace?.id]);

  // Keyboard: ESC closes, arrow keys navigate chrono-wise. Space intentionally
  // skipped so forms inside (e.g. future reply field) still work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && index > 0) {
        onNavigate(index - 1);
      } else if (e.key === "ArrowRight" && index < traces.length - 1) {
        onNavigate(index + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, traces.length, onClose, onNavigate]);

  // Body scroll lock while open. Restores on close so the feed scrolls
  // normally again.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!trace) return null;

  const doDelete = async () => {
    if (!deleteUrl) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(deleteUrl, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Removed.");
      onDeleted(trace.kind, trace.id);
      // Caller updates the traces array; we shift index if needed. If this
      // was the last entry, close. Otherwise clamp to the previous index so
      // the next card slides into view naturally.
      if (traces.length <= 1) {
        onClose();
      } else if (index >= traces.length - 1) {
        onNavigate(index - 1);
      }
      // Otherwise the array shrinks and the same index points to the next
      // entry — no navigate call needed.
    } catch {
      toast.error("Could not remove. Try again.");
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  };

  const hasPrev = index > 0;
  const hasNext = index < traces.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${kindLabel} detail`}
      className="fixed inset-0 z-50 bg-earth/92 flex items-start md:items-center justify-center p-0 md:p-10 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      {/* Close — always reachable, safe-area aware for notched phones */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed z-[60] w-11 h-11 rounded-full bg-earth/70 backdrop-blur-sm border border-parchment/20 text-parchment flex items-center justify-center hover:bg-earth/90 active:scale-95 transition-all"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        }}
      >
        <X size={20} />
      </button>

      {/* Prev / Next — hidden on mobile (use swipe-less tap-outside), visible
          on md+. They're anchored to viewport so they track as you scroll
          through a long entry. */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          aria-label="Previous entry"
          className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-[60] w-11 h-11 rounded-full bg-earth/70 backdrop-blur-sm border border-parchment/20 text-parchment items-center justify-center hover:bg-earth/90 active:scale-95 transition-all"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          aria-label="Next entry"
          className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-[60] w-11 h-11 rounded-full bg-earth/70 backdrop-blur-sm border border-parchment/20 text-parchment items-center justify-center hover:bg-earth/90 active:scale-95 transition-all"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Card — stopPropagation so interior clicks don't close */}
      <div
        className="w-full max-w-3xl bg-parchment my-0 md:my-4 min-h-[100dvh] md:min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: kind pill + chrono position + open-in-parent link */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 border-b border-earth/10"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Icon size={12} className="text-amber shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-earth/60">
              {kindLabel}
            </span>
            <span className="font-mono text-[10px] text-earth/20">·</span>
            <span className="font-mono text-[10px] text-earth/60 truncate">
              {format(trace.when, "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="font-mono text-[10px] text-earth/30 tabular-nums">
              {index + 1} / {traces.length}
            </span>
            <Link
              href={trace.href}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-earth/50 hover:text-earth transition-colors"
              title="Open in parent tool"
            >
              Open
              <ExternalLink size={10} />
            </Link>
          </div>
        </div>

        {/* Photo, if any. Tap to see full-res (future) */}
        {trace.photoUrl && (
          <div className="relative w-full bg-earth/10 aspect-square md:aspect-[4/3]">
            <Image
              src={trace.photoUrl}
              alt={trace.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        )}

        {/* Body — per-kind layout */}
        <div className="px-6 py-6 md:px-8 md:py-8 space-y-5">
          <h2 className="font-serif text-2xl md:text-3xl text-earth leading-tight">
            {trace.title}
          </h2>

          {trace.read && (
            <p
              className={`font-serif text-base text-earth/70 leading-relaxed italic ${
                trace.kind === "notice" ? "" : "border-l-2 border-amber/40 pl-3"
              }`}
            >
              {trace.kind === "notice" ? `#${trace.read}` : trace.read}
            </p>
          )}

          {trace.body && (
            <blockquote className="font-serif text-base md:text-lg text-earth/80 leading-relaxed whitespace-pre-wrap">
              {trace.body}
            </blockquote>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-5 border-t border-earth/10">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                When
              </p>
              <p className="font-mono text-xs text-earth/80 mt-1">
                {format(trace.when, "EEEE, MMM d, yyyy")}
              </p>
            </div>
            {trace.where.label && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                  Where
                </p>
                <p className="font-mono text-xs text-earth/80 mt-1 truncate">
                  {trace.where.label}
                </p>
              </div>
            )}
            {trace.tone && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                  Mood
                </p>
                <p className="font-mono text-xs text-earth/80 mt-1 capitalize">
                  {trace.tone}
                </p>
              </div>
            )}
          </div>

          {/* Delete */}
          {deleteUrl && (
            <div className="pt-5 border-t border-earth/10">
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={doDelete}
                    disabled={deleteBusy}
                    className="font-mono text-[11px] uppercase tracking-widest text-parchment bg-terracotta px-3 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {deleteBusy ? "Removing…" : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleteBusy}
                    className="font-mono text-[11px] uppercase tracking-widest text-earth/60 hover:text-earth transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-terracotta/80 hover:text-terracotta transition-colors"
                >
                  <Trash2 size={12} />
                  Delete {kindLabel.toLowerCase()}
                </button>
              )}
            </div>
          )}

          {/* Mobile prev/next — below the content so thumbs can reach without
              stretching across the screen */}
          <div className="md:hidden flex items-center justify-between pt-5 border-t border-earth/10">
            <button
              onClick={() => hasPrev && onNavigate(index - 1)}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-earth/60 hover:text-earth disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <button
              onClick={() => hasNext && onNavigate(index + 1)}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-earth/60 hover:text-earth disabled:opacity-30 transition-colors"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
