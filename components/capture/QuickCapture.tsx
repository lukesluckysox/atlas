"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { Check, RefreshCw, Camera, Music2 } from "lucide-react";

interface Track {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
}

interface NowPlaying extends Track {
  playing: boolean;
}

interface RecentTrack extends Track {
  playedAt: string;
}

/**
 * Big-touch-target mobile capture. Always assumes thumb reach + one-handed use.
 * Primary action is a single Save button on the now-playing card. Recents are
 * there for when nothing is playing.
 */
export function QuickCapture() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [recents, setRecents] = useState<RecentTrack[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [npRes, lRes] = await Promise.all([
        fetch("/api/spotify/now-playing"),
        fetch("/api/spotify/listening"),
      ]);
      const np = await npRes.json();
      const l = await lRes.json();

      if (!np.connected) {
        setConnected(false);
        return;
      }
      setConnected(true);

      if (np.playing && np.track) {
        setNow({
          id: np.track.id,
          name: np.track.name,
          artist: np.track.artist,
          albumArt: np.track.albumArt,
          playing: true,
        });
      } else {
        setNow(null);
      }

      if (Array.isArray(l.recent)) {
        setRecents(l.recent.slice(0, 5));
      }
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function save(t: Track) {
    if (saved.has(t.id)) return;
    setSavingId(t.id);
    try {
      const res = await fetch("/api/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quick: true,
          spotifyTrackId: t.id,
          trackName: t.name,
          artistName: t.artist,
          albumArt: t.albumArt,
          // photoUrl omitted \u2014 API falls back to albumArt.
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(new Set(saved).add(t.id));
      toast.success("Saved.");
    } catch {
      toast.error("Could not save.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        <Music2 size={32} className="text-earth/30 mb-6" />
        <h1 className="font-serif text-2xl text-earth mb-3">Connect Spotify first.</h1>
        <p className="font-serif text-base text-earth/60 mb-8 max-w-xs">
          Quick capture reads what you&rsquo;re playing right now.
        </p>
        <Link href="/settings" className="btn-primary">
          Connect
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header \u2014 minimal, just enough to orient */}
      <div className="px-6 pt-8 pb-6 flex items-center justify-between">
        <div>
          <p className="label">Capture</p>
          <h1 className="font-serif text-2xl text-earth leading-tight">Save what&rsquo;s playing.</h1>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="p-3 -mr-3 text-earth/40 hover:text-earth disabled:opacity-40"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Now playing hero \u2014 big touch target */}
      <div className="px-6">
        {now ? (
          <NowPlayingCard
            track={now}
            onSave={() => save(now)}
            saving={savingId === now.id}
            isSaved={saved.has(now.id)}
          />
        ) : (
          <div className="border border-earth/15 bg-parchment p-8 text-center">
            <p className="font-serif text-lg text-earth/60 mb-2">Nothing playing.</p>
            <p className="font-mono text-xs text-earth/40">
              Press play on Spotify, then tap refresh.
            </p>
          </div>
        )}
      </div>

      {/* Recents list \u2014 tall rows, thumb-reach */}
      {recents.length > 0 && (
        <div className="px-6 mt-10 pb-10">
          <p className="label mb-4">Recent</p>
          <div className="space-y-2">
            {recents.map((r) => {
              const isSaved = saved.has(r.id);
              const isSaving = savingId === r.id;
              return (
                <button
                  key={r.playedAt + r.id}
                  onClick={() => save(r)}
                  disabled={isSaving || isSaved}
                  className="w-full flex items-center gap-4 border border-earth/10 bg-parchment p-3 min-h-[72px] text-left active:bg-earth/5 disabled:opacity-70"
                >
                  {r.albumArt ? (
                    <div className="relative w-14 h-14 shrink-0 overflow-hidden">
                      <Image src={r.albumArt} alt="" fill className="object-cover" sizes="56px" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 shrink-0 border border-earth/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-base text-earth truncate leading-tight">
                      {r.name}
                    </p>
                    <p className="font-mono text-xs text-earth/50 truncate mt-0.5">{r.artist}</p>
                  </div>
                  <div className="shrink-0 pr-1">
                    {isSaved ? (
                      <Check size={20} className="text-amber" />
                    ) : isSaving ? (
                      <div className="w-5 h-5 border-2 border-earth/20 border-t-earth animate-spin rounded-full" />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
                        Save
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Escape hatch to full /pair for richer capture (photo, note, location) */}
      <div className="px-6 pb-16 mt-auto">
        <Link
          href="/pair"
          className="w-full flex items-center justify-center gap-2 py-4 border border-earth/15 text-earth font-mono text-xs uppercase tracking-widest hover:border-earth/40"
        >
          <Camera size={14} />
          Full capture with photo
        </Link>
      </div>
    </div>
  );
}

function NowPlayingCard({
  track,
  onSave,
  saving,
  isSaved,
}: {
  track: NowPlaying;
  onSave: () => void;
  saving: boolean;
  isSaved: boolean;
}) {
  return (
    <div className="border border-earth/15 bg-parchment">
      <div className="flex items-center gap-2 px-4 pt-4">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber" />
        </span>
        <p className="label">Now playing</p>
      </div>
      <div className="px-4 pt-4 pb-5 flex gap-4 items-center">
        {track.albumArt ? (
          <div className="relative w-20 h-20 shrink-0 overflow-hidden">
            <Image src={track.albumArt} alt="" fill className="object-cover" sizes="80px" />
          </div>
        ) : (
          <div className="w-20 h-20 shrink-0 border border-earth/15 flex items-center justify-center">
            <Music2 size={22} className="text-earth/30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-serif text-xl text-earth leading-tight line-clamp-2">{track.name}</p>
          <p className="font-mono text-xs text-earth/60 truncate mt-1">{track.artist}</p>
        </div>
      </div>
      <button
        onClick={onSave}
        disabled={saving || isSaved}
        className={`w-full py-5 text-center font-mono text-sm uppercase tracking-widest transition-colors ${
          isSaved
            ? "bg-amber/30 text-earth"
            : "bg-earth text-parchment active:bg-earth/80 disabled:opacity-60"
        }`}
      >
        {isSaved ? (
          <span className="flex items-center justify-center gap-2">
            <Check size={16} /> Saved
          </span>
        ) : saving ? (
          "Saving..."
        ) : (
          "Save to Tracks"
        )}
      </button>
    </div>
  );
}
