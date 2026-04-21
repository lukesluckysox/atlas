"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Music2, ExternalLink, Link2, Link2Off } from "lucide-react";
import toast from "react-hot-toast";

interface NowPlayingData {
  connected: boolean;
  playing?: boolean;
  progressMs?: number;
  track?: {
    id: string;
    name: string;
    durationMs: number;
    artist: string;
    album: string;
    albumArt: string | null;
    url: string;
  };
}

export function NowPlaying() {
  const [data, setData] = useState<NowPlayingData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      setData({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handle = setInterval(load, 15_000); // poll every 15s
    return () => clearInterval(handle);
  }, []);

  // Handle OAuth return banner
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("spotify");
    if (!flag) return;
    if (flag === "connected") toast.success("Spotify connected.");
    else if (flag === "denied") toast.error("Spotify connection denied.");
    else if (flag === "invalid" || flag === "error") toast.error("Spotify connection failed.");
    // clean URL
    const cleaned = window.location.pathname;
    window.history.replaceState({}, "", cleaned);
  }, []);

  const connect = () => {
    window.location.href = "/api/spotify/connect";
  };

  const disconnect = async () => {
    await fetch("/api/spotify/disconnect", { method: "POST" });
    toast.success("Spotify disconnected.");
    load();
  };

  if (loading) {
    return (
      <div className="border border-earth/10 p-4 h-24 flex items-center">
        <p className="font-mono text-xs text-earth/30">Loading...</p>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="border border-earth/10 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Music2 size={16} className="text-sage" />
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-earth/50">Now playing</p>
            <p className="font-serif text-sm text-earth mt-0.5">Connect Spotify to see what you&apos;re playing.</p>
          </div>
        </div>
        <button onClick={connect} className="btn-primary text-xs flex items-center gap-2">
          <Link2 size={12} /> Connect Spotify
        </button>
      </div>
    );
  }

  if (!data.playing || !data.track) {
    return (
      <div className="border border-earth/10 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 border border-earth/10 flex items-center justify-center text-earth/30">
            <Music2 size={18} />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-earth/50">Now playing</p>
            <p className="font-serif text-sm text-earth mt-0.5">Nothing playing right now.</p>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="font-mono text-[10px] uppercase tracking-widest text-earth/40 hover:text-earth/70 flex items-center gap-1"
        >
          <Link2Off size={10} /> Disconnect
        </button>
      </div>
    );
  }

  const t = data.track;
  const pct =
    data.progressMs && t.durationMs
      ? Math.min(100, Math.round((data.progressMs / t.durationMs) * 100))
      : 0;

  return (
    <div className="border border-earth/10 p-4 relative overflow-hidden">
      <div className="flex items-center gap-4">
        {t.albumArt ? (
          <Image
            src={t.albumArt}
            alt=""
            width={64}
            height={64}
            className="w-16 h-16 object-cover border border-earth/10"
            unoptimized
          />
        ) : (
          <div className="w-16 h-16 border border-earth/10 flex items-center justify-center">
            <Music2 size={18} className="text-earth/30" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 bg-sage rounded-full animate-pulse" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-sage">Now playing</p>
          </div>
          <p className="font-serif text-base text-earth truncate">{t.name}</p>
          <p className="font-mono text-xs text-earth/60 truncate">{t.artist}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <a
            href={t.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-widest text-earth/50 hover:text-earth flex items-center gap-1"
          >
            Spotify <ExternalLink size={10} />
          </a>
          <button
            onClick={disconnect}
            className="font-mono text-[10px] uppercase tracking-widest text-earth/30 hover:text-earth/70 flex items-center gap-1"
          >
            <Link2Off size={10} /> Disconnect
          </button>
        </div>
      </div>

      {/* progress bar */}
      <div className="absolute left-0 bottom-0 h-0.5 bg-earth/5 w-full">
        <div className="h-full bg-amber transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
