"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Ticket, Upload, X } from "lucide-react";

// Drop a ticket, poster, or flyer. We upload it, ask Claude to read it, and
// hand back {type, name, venue/city, date, note} that the Path form can
// prefill. The user confirms before anything saves — no magic-auto-save.

type Extracted = {
  venue: string | null;
  city: string | null;
  date: string | null;
  headliner: string | null;
  type: "Concert" | "Stadium" | "Landmark" | "Restaurant" | "Other" | null;
  confidence: "high" | "medium" | "low";
  lat: number | null;
  lng: number | null;
  resolvedPlace: string | null;
  imageUrl: string;
};

type Props = {
  onApply: (extracted: Extracted) => void;
};

export function ShareToTrace({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Extracted | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (busy) return;
    setBusy(true);
    setPreview(null);
    try {
      // Upload first (route expects base64 JSON, not FormData)
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("file read failed"));
        r.readAsDataURL(file);
      });
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, folder: "share-to-trace" }),
      });
      if (!up.ok) {
        const txt = await up.text().catch(() => "");
        throw new Error(`upload ${up.status}: ${txt.slice(0, 200)}`);
      }
      const upJson = (await up.json()) as { url?: string };
      if (!upJson.url) {
        throw new Error(`upload returned no url: ${JSON.stringify(upJson).slice(0, 200)}`);
      }
      const url = upJson.url;

      // Run OCR
      const res = await fetch("/api/share-to-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`ocr ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      // Show everything Claude returned so we can see what's happening
      setPreview({ ...data, imageUrl: url });
      if (data.lat != null && data.lng != null) {
        toast.success(`pinned: ${data.venue ?? data.resolvedPlace ?? "location"}`);
      } else if (data.venue || data.city) {
        toast("couldn't place it on the map — pin manually", { icon: "⚠", duration: 6000 });
      }
      if (data.confidence === "low") {
        toast("low confidence — double-check the fields", { icon: "⚠", duration: 6000 });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg, { duration: 10000 });
    } finally {
      setBusy(false);
    }
  }

  function applyAndClose() {
    if (!preview) return;
    onApply(preview);
    setOpen(false);
    setPreview(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-earth/60 border border-earth/20 hover:border-earth/50"
      >
        <Ticket size={12} />
        Share to Trace
      </button>
    );
  }

  return (
    <div className="border border-earth/20 bg-parchment p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="label">Drop a ticket or poster</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPreview(null);
          }}
          className="text-earth/40 hover:text-earth"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-xs text-earth/60 leading-relaxed">
        Snap a ticket stub, concert poster, or event flyer. We&apos;ll read the
        venue, date, and artist. You confirm before saving.
      </p>

      {!preview && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-6 border border-dashed border-earth/30 text-earth/60 hover:text-earth hover:border-earth/60 disabled:opacity-50"
        >
          <Upload size={14} />
          <span className="text-sm font-mono">
            {busy ? "reading…" : "upload image"}
          </span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {preview && (
        <div className="space-y-2 border-t border-earth/10 pt-3">
          <Row label="Type" value={preview.type} />
          <Row label="Venue" value={preview.venue} />
          <Row label="City" value={preview.city} />
          <Row label="Date" value={preview.date} />
          <Row label="Headliner" value={preview.headliner} />
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                fileRef.current?.click();
              }}
              className="text-xs uppercase tracking-[0.2em] text-earth/50 hover:text-earth"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={applyAndClose}
              className="btn-primary"
            >
              Use these
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-earth/50 flex-shrink-0">
        {label}
      </span>
      <span className="text-earth text-right truncate">
        {value || <em className="text-earth/40">not visible</em>}
      </span>
    </div>
  );
}
