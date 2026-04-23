"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Upload, Search, Sparkles, X, Check, Music2 } from "lucide-react";
import { NowPlaying, type NowPlayingTrack } from "@/components/spotify/NowPlaying";
import { SaveChip, useSaveState } from "@/components/ui/SaveChip";
import { sampleFileMood } from "@/lib/photo-mood";
import { submitWithQueue } from "@/lib/offline-submit";
import { PageHeader } from "@/components/layout/PageHeader";

interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  reasoning?: string;
}

interface PairStudioProps {
  isPro: boolean;
  recentPairings: Array<{
    id: string;
    photoUrl: string;
    albumArt?: string | null;
    trackName: string;
  }>;
}

interface JustSaved {
  photoUrl: string;
  albumArt?: string | null;
  trackName: string;
  artistName: string;
}

export function PairStudio({ isPro, recentPairings }: PairStudioProps) {
  const router = useRouter();
  const [justSaved, setJustSaved] = useState<JustSaved | null>(null);
  const [blooming, setBlooming] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoMood, setPhotoMood] = useState<{ lum: number; warmth: number } | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = useSaveState();
  const [mode, setMode] = useState<"search" | "recommend">("search");

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    // Sample mood in parallel with upload — never blocks.
    sampleFileMood(file).then((mood) => setPhotoMood(mood));

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoUrl(base64);
      if (navigator.onLine === false) return;
      setUploading(true);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, folder: "atlas/pairings" }),
        });
        const data = await res.json();
        if (data.url) setUploadedPhotoUrl(data.url);
      } catch {
        // Silent — blob will queue on save.
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/pair/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.tracks ?? []);
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced auto-search: fires 300ms after user stops typing.
  useEffect(() => {
    if (mode !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => handleSearch(q), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, mode, handleSearch]);

  const handleRecommend = async () => {
    if (!uploadedPhotoUrl) {
      toast.error("Upload a photo first.");
      return;
    }
    setRecommending(true);
    try {
      const res = await fetch("/api/pair/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: uploadedPhotoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecommendations(data.tracks ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Recommendation failed.";
      toast.error(msg);
    } finally {
      setRecommending(false);
    }
  };

  const handleSave = async () => {
    if ((!uploadedPhotoUrl && !photoFile) || !selectedTrack) {
      toast.error("Need a photo and a track.");
      return;
    }
    setSaving(true);
    const res = await submitWithQueue({
      kind: "track",
      endpoint: "/api/pairings",
      payload: {
        photoUrl: uploadedPhotoUrl ?? undefined,
        spotifyTrackId: selectedTrack.id,
        trackName: selectedTrack.name,
        artistName: selectedTrack.artist,
        albumArt: selectedTrack.albumArt,
        note: note || undefined,
        location: location || undefined,
        photoLum: photoMood?.lum,
        photoWarmth: photoMood?.warmth,
      },
      images:
        !uploadedPhotoUrl && photoFile
          ? [{ payloadField: "photoUrl", folder: "atlas/pairings", blob: photoFile }]
          : [],
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Could not save track.");
      return;
    }
    if (res.offline) {
      toast.success("saved offline — syncing when back online");
      setPhotoUrl(null);
      setUploadedPhotoUrl(null);
      setPhotoFile(null);
      setPhotoMood(null);
      setSelectedTrack(null);
      setSearchQuery("");
      setSearchResults([]);
      setNote("");
      setLocation("");
      return;
    }
    // Lands-in-archive sequence: bloom the pair, then park it on the ribbon
    // and reset the form so you can log another one.
    setJustSaved({
      photoUrl: uploadedPhotoUrl ?? "",
      albumArt: selectedTrack.albumArt,
      trackName: selectedTrack.name,
      artistName: selectedTrack.artist,
    });
    setBlooming(true);
    window.setTimeout(() => setBlooming(false), 1100);
    // Reset the form but keep the ribbon visible.
    setPhotoUrl(null);
    setUploadedPhotoUrl(null);
    setPhotoFile(null);
    setPhotoMood(null);
    setSelectedTrack(null);
    setSearchQuery("");
    setSearchResults([]);
    setRecommendations([]);
    setNote("");
    setLocation("");
    // Make sure server components (e.g. Home today-strip) pick up the new count.
    router.refresh();
  };

  const displayTracks = mode === "recommend" ? recommendations : searchResults;

  // Ribbon shows: just-saved (if any) + up to 2 prior from server.
  const ribbonItems = [
    ...(justSaved
      ? [{
          id: "just",
          photoUrl: justSaved.photoUrl,
          albumArt: justSaved.albumArt,
          trackName: justSaved.trackName,
          fresh: true,
        }]
      : []),
    ...recentPairings.slice(0, justSaved ? 2 : 3).map((p) => ({
      id: p.id,
      photoUrl: p.photoUrl,
      albumArt: p.albumArt,
      trackName: p.trackName,
      fresh: false,
    })),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 animate-page-in relative">
      {/* Save bloom — photo + album art briefly center-stage */}
      {blooming && justSaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-parchment/80 pointer-events-none">
          <div className="flex items-center gap-px bg-earth/10 animate-bloom">
            <div className="relative w-48 h-48 bg-earth/10">
              <Image
                src={justSaved.photoUrl}
                alt="Just paired"
                fill
                className="object-cover"
                sizes="192px"
              />
            </div>
            {justSaved.albumArt && (
              <div className="relative w-48 h-48 bg-earth/10">
                <Image
                  src={justSaved.albumArt}
                  alt={justSaved.trackName}
                  fill
                  className="object-cover"
                  sizes="192px"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <PageHeader
        label="Tracks"
        h1="A photo. A track."
        tagline="Pure instinct. The app reads it back as a caption."
        right={<SaveChip state={save.state} onRetry={save.retry} />}
      />

      {/* Lands-in-archive ribbon — shows the new pairing riding on top of the archive */}
      {ribbonItems.length > 0 && (
        <div className="mb-10 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="label">
              {justSaved ? "Landed in archive" : "Recent"}
            </p>
            <Link
              href="/explore"
              className="font-mono text-[10px] uppercase tracking-widest text-earth/40 hover:text-earth transition-colors"
            >
              Archive →
            </Link>
          </div>
          <div className="flex gap-px">
            {ribbonItems.map((p) => (
              <div
                key={p.id}
                className={`relative w-20 h-20 bg-earth/5 overflow-hidden shrink-0 ${
                  p.fresh ? "ring-2 ring-amber animate-fade-in" : ""
                }`}
              >
                <Image
                  src={p.photoUrl}
                  alt={p.trackName}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                {p.albumArt && (
                  <div className="absolute bottom-1 right-1 w-6 h-6 border border-parchment/60">
                    <Image
                      src={p.albumArt}
                      alt={p.trackName}
                      fill
                      className="object-cover"
                      sizes="24px"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-12">
        <NowPlaying
          onUseTrack={(t: NowPlayingTrack) => {
            setSelectedTrack({
              id: t.id,
              name: t.name,
              artist: t.artist,
              albumArt: t.albumArt ?? undefined,
            });
            setMode("search");
            setSearchResults([]);
            setSearchQuery("");
            toast.success(`Paired with ${t.name}`);
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <p className="label mb-4">Photo</p>
          {!photoUrl ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full aspect-square border border-earth/20 border-dashed flex flex-col items-center justify-center gap-4 hover:border-amber transition-colors group"
            >
              <Upload size={24} className="text-earth/30 group-hover:text-amber transition-colors" />
              <span className="font-mono text-xs text-earth/40 group-hover:text-earth transition-colors">
                Upload photo
              </span>
            </button>
          ) : (
            <div className="relative aspect-square">
              <Image
                src={photoUrl}
                alt="Selected photo"
                fill
                className="object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 bg-earth/50 flex items-center justify-center">
                  <p className="font-mono text-xs text-parchment">Uploading...</p>
                </div>
              )}
              <button
                onClick={() => {
                  setPhotoUrl(null);
                  setUploadedPhotoUrl(null);
                  setPhotoFile(null);
                  setPhotoMood(null);
                  setRecommendations([]);
                }}
                className="absolute top-3 right-3 bg-earth text-parchment p-1 hover:bg-earth-light"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />

          <div className="mt-6 space-y-4">
            <input
              type="text"
              placeholder="Location (optional)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input-field"
            />
            <textarea
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="input-field resize-none"
            />
          </div>
        </div>

        <div>
          <p className="label mb-4">Track</p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode("search")}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs transition-colors ${
                mode === "search"
                  ? "bg-earth text-parchment"
                  : "border border-earth/20 text-earth/60 hover:border-earth hover:text-earth"
              }`}
            >
              <Search size={12} />
              Search
            </button>
            {isPro && (
              <button
                onClick={() => setMode("recommend")}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs transition-colors ${
                  mode === "recommend"
                    ? "bg-amber text-earth"
                    : "border border-earth/20 text-earth/60 hover:border-amber hover:text-amber"
                }`}
              >
                <Sparkles size={12} />
                AI Recommend
              </button>
            )}
          </div>

          {mode === "search" && (
            <div className="mb-6">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-earth/30 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search Spotify — song title, artist, or both"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
                  className="input-field pl-6 pr-16"
                  autoFocus
                />
                {searching && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[10px] text-earth/40 tracking-widest uppercase">
                    Searching
                  </span>
                )}
                {!searching && searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-earth/40 hover:text-earth"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <p className="font-mono text-[10px] text-earth/30 mt-2 tracking-wide">
                Results update as you type — pulled from the full Spotify catalog.
              </p>
            </div>
          )}

          {mode === "recommend" && (
            <button
              onClick={handleRecommend}
              disabled={recommending || !uploadedPhotoUrl}
              className="btn-amber w-full mb-6 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Sparkles size={14} />
              {recommending ? "Reading the photo..." : "Recommend tracks for this photo"}
            </button>
          )}

          <div className="space-y-2">
            {displayTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => setSelectedTrack(selectedTrack?.id === track.id ? null : track)}
                className={`w-full flex items-center gap-4 p-4 border transition-colors text-left ${
                  selectedTrack?.id === track.id
                    ? "border-amber bg-amber/5"
                    : "border-earth/10 hover:border-earth/30"
                }`}
              >
                {track.albumArt ? (
                  <Image
                    src={track.albumArt}
                    alt={track.name}
                    width={40}
                    height={40}
                    className="shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 bg-earth/10 flex items-center justify-center shrink-0">
                    <Music2 size={16} className="text-earth/30" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-earth truncate">{track.name}</p>
                  <p className="font-mono text-xs text-earth/50 truncate">{track.artist}</p>
                  {track.reasoning && (
                    <p className="font-mono text-xs text-amber/70 mt-1 leading-relaxed">
                      {track.reasoning}
                    </p>
                  )}
                </div>
                {selectedTrack?.id === track.id && (
                  <Check size={14} className="text-amber shrink-0" />
                )}
              </button>
            ))}

            {displayTracks.length === 0 && mode === "search" && searchQuery && !searching && (
              <p className="font-mono text-xs text-earth/40 py-8 text-center">
                No results. Try a different query.
              </p>
            )}
          </div>

          {selectedTrack && (
            <div className="mt-8 p-4 bg-amber/10 border border-amber/20">
              <p className="font-mono text-xs text-earth/50 mb-1">Selected</p>
              <p className="font-mono text-sm text-earth">
                {selectedTrack.name} — {selectedTrack.artist}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-earth/10 pt-8">
        <p className="font-mono text-xs text-earth/30">
          {photoUrl && selectedTrack ? "Ready to save." : "Select a photo and a track."}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || !uploadedPhotoUrl || !selectedTrack}
          className="btn-primary disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save track"}
        </button>
      </div>
    </div>
  );
}
