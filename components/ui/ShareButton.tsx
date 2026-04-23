"use client";

import { useState } from "react";
import toast from "react-hot-toast";

// Quiet share button for a single trace. Uses Web Share API if available,
// falls back to clipboard copy. `kind` is the public share-route segment:
// "track" | "path" | "moment" | "encounter".

type Props = {
  kind: "track" | "path" | "moment" | "encounter";
  slug: string | null | undefined;
  label?: string;
  className?: string;
};

export default function ShareButton({ kind, slug, label, className }: Props) {
  const [busy, setBusy] = useState(false);
  if (!slug) return null;

  async function handle() {
    if (busy) return;
    setBusy(true);
    try {
      const url = `${window.location.origin}/s/${kind}/${slug}`;
      // Web Share API on mobile; clipboard fallback everywhere else.
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ url, title: "A trace" });
          return;
        } catch {
          // user cancelled or share failed — fall through to clipboard
        }
      }
      await navigator.clipboard.writeText(url);
      toast.success("link copied");
    } catch {
      toast.error("couldn't share");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className={
        className ??
        "text-xs uppercase tracking-[0.2em] text-earth/60 hover:text-earth disabled:opacity-40"
      }
    >
      {label ?? "Share"}
    </button>
  );
}
