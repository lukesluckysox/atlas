"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { MapPin, X, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useEffect, useMemo, useState } from "react";

interface Pairing {
  id: string;
  spotifyTrackId?: string | null;
  photoUrl: string;
  trackName: string;
  artistName: string;
  albumArt?: string | null;
  note?: string | null;
  location?: string | null;
  createdAt: Date;
  photoLum?: number | null;
  photoWarmth?: number | null;
  caption?: string | null;
  captionDismissed?: boolean;
}

// Mood quadrants — matches the portrait mood field sun-path metaphor.
type Mood = "all" | "golden" | "noon" | "ember" | "midnight" | "balanced";

const MOOD_CHIPS: { value: Mood; label: string; hint: string }[] = [
  { value: "all", label: "All", hint: "" },
  { value: "golden", label: "Golden hour", hint: "bright + warm" },
  { value: "noon", label: "Noon", hint: "bright + cool" },
  { value: "ember", label: "Ember", hint: "dark + warm" },
  { value: "midnight", label: "Midnight", hint: "dark + cool" },
  { value: "balanced", label: "Balanced", hint: "mid" },
];

function moodOf(p: Pairing): Mood | null {
  if (p.photoLum == null || p.photoWarmth == null) return null;
  const high = 0.62;
  const low = 0.38;
  const lumBand = p.photoLum >= high ? "bright" : p.photoLum <= low ? "dark" : "mid";
  const warmBand =
    p.photoWarmth >= high ? "warm" : p.photoWarmth <= low ? "cool" : "neutral";
  if (lumBand === "bright" && warmBand === "warm") return "golden";
  if (lumBand === "bright" && warmBand === "cool") return "noon";
  if (lumBand === "dark" && warmBand === "warm") return "ember";
  if (lumBand === "dark" && warmBand === "cool") return "midnight";
  return "balanced";
}

export function ExploreGrid({ pairings: initialPairings }: { pairings: Pairing[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pairings, setPairings] = useState<Pairing[]>(initialPairings);
  const [mood, setMood] = useState<Mood>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // Honor ?open={id} so the Archive's "view this track" links (which route
  // to /explore?open=...) actually open the Lightbox on arrival. Clearing
  // the param after opening keeps the URL clean when the user closes.
  useEffect(() => {
    const want = searchParams?.get("open");
    if (want && pairings.some((p) => p.id === want)) {
      setOpenId(want);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updatePairing = (id: string, patch: Partial<Pairing>) =>
    setPairings((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const removePairing = (id: string) =>
    setPairings((ps) => ps.filter((p) => p.id !== id));

  const handleClose = () => {
    setOpenId(null);
    // Strip ?open= if present so refreshing doesn't re-open.
    if (searchParams?.get("open")) {
      router.replace("/explore", { scroll: false });
    }
  };

  // Count per mood (for chip badges). Only shows chips that actually have
  // entries — no point offering empty filters.
  const moodCounts = useMemo(() => {
    const counts: Record<Mood, number> = {
      all: pairings.length,
      golden: 0,
      noon: 0,
      ember: 0,
      midnight: 0,
      balanced: 0,
    };
    for (const p of pairings) {
      const m = moodOf(p);
      if (m) counts[m]++;
    }
    return counts;
  }, [pairings]);

  const filtered = useMemo(() => {
    if (mood === "all") return pairings;
    return pairings.filter((p) => moodOf(p) === mood);
  }, [pairings, mood]);

  const openPairing = openId ? pairings.find((p) => p.id === openId) ?? null : null;

  // Close lightbox on ESC
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  if (pairings.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="label mb-2">Tracks</p>
        <h1 className="font-serif text-4xl text-earth">Archive</h1>
        <p className="font-mono text-xs text-earth/40 mt-2 mb-16">
          Every track you&rsquo;ve made. Nothing curated.
        </p>
        <div className="border border-earth/10 p-16 text-center">
          <p className="font-mono text-sm text-earth/40">
            Nothing here yet. Go somewhere. Hear something.
          </p>
          <Link href="/pair" className="btn-primary inline-block mt-8">
            First track
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-page-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label mb-2">Tracks</p>
          <h1 className="font-serif text-4xl text-earth">Archive</h1>
          <p className="font-mono text-xs text-earth/40 mt-2">
            Every track you&rsquo;ve made. Nothing curated.
          </p>
        </div>
        <p className="font-mono text-xs text-earth/40">
          {filtered.length}
          {mood !== "all" && ` of ${pairings.length}`}
        </p>
      </div>

      {/* Mood chip row — filters by dominant light/warmth quadrant */}
      <div className="flex flex-wrap gap-1.5 mb-10">
        {MOOD_CHIPS.map((chip) => {
          const count = moodCounts[chip.value];
          // Hide mood chips with zero entries (keeps "All" always)
          if (chip.value !== "all" && count === 0) return null;
          const active = mood === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setMood(chip.value)}
              className={`px-2.5 py-1 border font-mono text-[10px] uppercase tracking-widest transition-all ${
                active
                  ? "border-earth text-earth bg-earth/5"
                  : "border-earth/20 text-earth/60 hover:border-earth/50 hover:text-earth"
              }`}
              title={chip.hint}
            >
              {chip.label}
              <span
                className={`ml-1.5 ${active ? "text-earth/60" : "text-earth/30"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-earth/10 p-16 text-center">
          <p className="font-mono text-sm text-earth/40">
            No tracks in this mood yet.
          </p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-px space-y-px">
          {filtered.map((pairing) => (
            <button
              key={pairing.id}
              onClick={() => setOpenId(pairing.id)}
              className="break-inside-avoid group relative overflow-hidden bg-earth/5 w-full text-left"
            >
              <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                <Image
                  src={pairing.photoUrl}
                  alt={pairing.trackName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-earth/90 via-earth/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {pairing.albumArt && (
                      <Image
                        src={pairing.albumArt}
                        alt={pairing.trackName}
                        width={28}
                        height={28}
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-parchment truncate">
                        {pairing.trackName}
                      </p>
                      <p className="font-mono text-xs text-parchment/60 truncate">
                        {pairing.artistName}
                      </p>
                    </div>
                  </div>
                  {pairing.note && (
                    <p className="font-mono text-xs text-parchment/70 line-clamp-2 mt-1">
                      {pairing.note}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {pairing.location && (
                      <div className="flex items-center gap-1">
                        <MapPin size={10} className="text-amber" />
                        <span className="font-mono text-xs text-parchment/60">
                          {pairing.location}
                        </span>
                      </div>
                    )}
                    <span className="font-mono text-xs text-parchment/40 ml-auto">
                      {format(new Date(pairing.createdAt), "MMM d")}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox: photo + Spotify embed + meta. ESC or backdrop to close. */}
      {openPairing && (
        <Lightbox
          pairing={openPairing}
          onClose={handleClose}
          onUpdate={(patch) => updatePairing(openPairing.id, patch)}
          onDeleted={(id) => {
            removePairing(id);
            handleClose();
          }}
        />
      )}
    </div>
  );
}

function Lightbox({
  pairing,
  onClose,
  onUpdate,
  onDeleted,
}: {
  pairing: Pairing;
  onClose: () => void;
  onUpdate: (patch: Partial<Pairing>) => void;
  onDeleted: (id: string) => void;
}) {
  const m = moodOf(pairing);
  const moodLabel = m
    ? MOOD_CHIPS.find((c) => c.value === m)?.label
    : null;
  const [captionBusy, setCaptionBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const showCaption =
    pairing.caption && !pairing.captionDismissed;

  const deletePairing = async () => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/pairings/${pairing.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Removed.");
      onDeleted(pairing.id);
    } catch {
      toast.error("Could not remove. Try again.");
      setDeleteBusy(false);
      setConfirmDelete(false);
    }
  };

  const refreshCaption = async () => {
    setCaptionBusy(true);
    try {
      const res = await fetch(`/api/pairings/${pairing.id}/caption`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("caption failed");
      const data: { caption: string | null } = await res.json();
      onUpdate({ caption: data.caption, captionDismissed: false });
    } catch {
      toast.error("Could not refresh caption.");
    } finally {
      setCaptionBusy(false);
    }
  };

  const dismissCaption = async () => {
    onUpdate({ captionDismissed: true });
    try {
      await fetch(`/api/pairings/${pairing.id}/caption`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissed: true }),
      });
    } catch {
      /* silent — already hidden locally */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-earth/92 flex items-center justify-center p-4 md:p-10 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      {/* Close: sticky in the top-right, sized for thumbs, clear of notches */}
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

      <div
        className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-px bg-parchment/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo */}
        <div className="relative bg-earth/20 aspect-square md:aspect-auto">
          <Image
            src={pairing.photoUrl}
            alt={pairing.trackName}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>

        {/* Track side */}
        <div className="bg-parchment p-6 md:p-8 flex flex-col gap-5">
          <div>
            <p className="label mb-2">Pairing</p>
            <p className="font-serif text-2xl text-earth leading-tight">
              {pairing.trackName}
            </p>
            <p className="font-mono text-sm text-earth/60 mt-1">
              {pairing.artistName}
            </p>
          </div>

          {pairing.spotifyTrackId && (
            <iframe
              src={`https://open.spotify.com/embed/track/${pairing.spotifyTrackId}?utm_source=trace`}
              width="100%"
              height="80"
              frameBorder={0}
              allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
              loading="lazy"
              className="border border-earth/10"
              title={pairing.trackName}
            />
          )}

          {pairing.note && (
            <blockquote className="font-serif text-base text-earth/80 italic leading-relaxed border-l-2 border-amber/40 pl-3">
              {pairing.note}
            </blockquote>
          )}

          {showCaption && (
            <div className="group flex items-start gap-2">
              <p className="font-serif text-sm text-earth/70 italic leading-relaxed flex-1">
                {pairing.caption}
              </p>
              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={refreshCaption}
                  disabled={captionBusy}
                  aria-label="Refresh caption"
                  className="text-earth/40 hover:text-earth transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={12} className={captionBusy ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={dismissCaption}
                  aria-label="Dismiss caption"
                  className="text-earth/40 hover:text-terracotta transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Meta strip: when / where / mood */}
          <div className="mt-auto pt-4 border-t border-earth/10 grid grid-cols-2 gap-y-3 gap-x-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                When
              </p>
              <p className="font-mono text-xs text-earth/80 mt-1">
                {format(new Date(pairing.createdAt), "MMM d, yyyy")}
              </p>
            </div>
            {pairing.location && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                  Where
                </p>
                <p className="font-mono text-xs text-earth/80 mt-1 truncate">
                  {pairing.location}
                </p>
              </div>
            )}
            {moodLabel && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                  Mood at the time
                </p>
                <p className="font-mono text-xs text-earth/80 mt-1">
                  {moodLabel}
                </p>
              </div>
            )}
          </div>

          {/* Delete — two-tap confirm. Removes from Tracks and Archive alike. */}
          <div className="pt-4 border-t border-earth/10">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={deletePairing}
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
                Delete pairing
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
