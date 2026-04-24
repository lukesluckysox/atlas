"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Camera, MapPin, Image as ImageIcon } from "lucide-react";
import { submitWithQueue } from "@/lib/offline-submit";

// Single input on Home that infers the trace kind from what you give it:
// - Starts with "@" or includes a place query + picks from suggestions -> Path
// - Has a photo attached (+ Spotify now-playing) -> Track
// - Has a photo attached (no song) -> Moment with photo
// - Just text -> Moment
// We never commit a guess silently — always show the detected kind with a
// chip, let the user override before saving. The form previews the kind in
// real time so there's no mystery.

type DetectedKind = "moment" | "moment-photo" | "track" | "path";

type NowPlaying = {
  id: string;
  name: string;
  artist: string;
  albumArt: string | null;
  playing: boolean;
} | null;

export function SmartCapture() {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [kindOverride, setKindOverride] = useState<DetectedKind | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Ambient now-playing check. Best-effort; fails silent.
  // API shape: { connected, playing, track: { id, name, artist, albumArt } }
  useEffect(() => {
    let cancelled = false;
    fetch("/api/spotify/now-playing")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        setSpotifyConnected(Boolean(j.connected));
        if (j.connected && j.playing && j.track) {
          setNowPlaying({
            id: j.track.id,
            name: j.track.name,
            artist: j.track.artist,
            albumArt: j.track.albumArt,
            playing: true,
          });
        } else {
          setNowPlaying(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Silent geo capture for weather + map context. No prompt; if user
  // previously denied, we just skip.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 2500, maximumAge: 300000 }
    );
  }, []);

  const detected: DetectedKind = kindOverride ?? detect(text, photo);

  async function onPhoto(file: File) {
    try {
      // /api/upload expects { image: <base64 data URL>, folder } as JSON,
      // not multipart. Convert first, then POST. (Multipart was a bug that
      // made every home-screen photo-track save fail on upload.)
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, folder: "tracks" }),
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const j = (await res.json()) as { url?: string };
      if (!j.url) throw new Error("upload no url");
      setPhoto(j.url);
      setPhotoName(file.name);
    } catch {
      toast.error("photo upload failed");
    }
  }

  async function save() {
    if (saving) return;
    const content = text.trim();
    setSaving(true);
    try {
      if (detected === "track") {
        if (nowPlaying) {
          // Track capture uses the paired endpoint. Photo optional; falls back
          // to album art via the API's quick path.
          const res = await submitWithQueue({
            kind: "track",
            endpoint: "/api/pairings",
            payload: {
              photoUrl: photo,
              spotifyTrackId: nowPlaying.id,
              trackName: nowPlaying.name,
              artistName: nowPlaying.artist,
              albumArt: nowPlaying.albumArt,
              note: content || null,
              latitude: coords?.lat,
              longitude: coords?.lng,
              quick: !photo,
            },
          });
          if (!res.ok) throw new Error(res.error || "save failed");
          toast.success(res.offline ? "saved offline" : "tracked");
          reset();
          if (!res.offline) router.refresh();
          return;
        }
        // No active now-playing — hand off to the full /pair page so the user
        // can search a track, attach a photo, etc. Pre-fill any text as note.
        const params = new URLSearchParams();
        if (content) params.set("note", content);
        if (photo) params.set("photo", photo);
        router.push(`/pair${params.toString() ? `?${params.toString()}` : ""}`);
        return;
      }

      if (detected === "path") {
        // Hand off to the Paths page with the text pre-filled as the query.
        const q = encodeURIComponent(content);
        router.push(`/map?new=1&q=${q}`);
        return;
      }

      // Default: Moment (with or without photo).
      if (!content && !photo) {
        toast.error("say or show something");
        setSaving(false);
        return;
      }
      const res = await submitWithQueue({
        kind: "moment",
        endpoint: "/api/marks",
        payload: {
          content: content || "(photo)",
          photoUrl: photo,
          latitude: coords?.lat,
          longitude: coords?.lng,
        },
      });
      if (!res.ok) throw new Error(res.error || "save failed");
      toast.success(res.offline ? "saved offline" : "noted");
      reset();
      if (!res.offline) router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      // Surface the real reason — "couldn't save" with no context has been
      // hiding real bugs (e.g. upload 400s, missing fields).
      toast.error(`couldn't save: ${msg.slice(0, 80)}`);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setText("");
    setPhoto(null);
    setPhotoName(null);
    setKindOverride(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const placeholder =
    detected === "track"
      ? `save "${nowPlaying?.name}" with a note`
      : detected === "path"
      ? "a place, a venue, a trailhead..."
      : detected === "moment-photo"
      ? "a line about what you saw"
      : "what did you notice?";

  return (
    <section className="border border-earth/15 bg-parchment p-4 md:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <KindChip
            active={detected === "moment" || detected === "moment-photo"}
            onClick={() => setKindOverride("moment")}
            label="Moment"
          />
          <KindChip
            active={detected === "track"}
            onClick={() => setKindOverride("track")}
            label="Track"
          />
          <KindChip
            active={detected === "path"}
            onClick={() => setKindOverride("path")}
            label="Path"
          />
          {spotifyConnected && <NowPlayingPill track={nowPlaying} />}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-transparent border-none outline-none resize-none text-earth placeholder:text-earth/40 font-serif text-lg leading-relaxed"
      />

      {photo && (
        <div className="flex items-center justify-between text-xs text-earth/60 border-t border-earth/10 pt-2">
          <span className="flex items-center gap-2">
            <ImageIcon className="w-3 h-3" />
            {photoName ?? "photo attached"}
          </span>
          <button
            type="button"
            onClick={() => {
              setPhoto(null);
              setPhotoName(null);
            }}
            className="uppercase tracking-[0.2em]"
          >
            remove
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-earth/10">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-earth/60 hover:text-earth"
          >
            <Camera className="w-3.5 h-3.5" /> Photo
          </button>
          {coords && (
            <span className="flex items-center gap-1.5 text-xs text-earth/40">
              <MapPin className="w-3 h-3" /> here
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPhoto(f);
            }}
          />
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || (!text.trim() && !photo)}
          className="btn-primary disabled:opacity-30"
        >
          {saving ? "..." : "Trace it"}
        </button>
      </div>
    </section>
  );
}

function KindChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-[10px] uppercase tracking-[0.2em] border transition-colors ${
        active
          ? "bg-earth text-parchment border-earth"
          : "text-earth/50 border-earth/20 hover:border-earth/50"
      }`}
    >
      {label}
    </button>
  );
}

// Connection/now-playing pill. Sits in-line with kind chips.
// - Spotify connected, nothing playing: live dot + "spotify"
// - Spotify connected, playing: live dot + "now playing: <track>"
// No album art — deliberately text-only so it stays on the same line.
function NowPlayingPill({ track }: { track: NowPlaying }) {
  const playing = Boolean(track?.playing && track.name);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] border border-amber/40 text-amber max-w-[55%] md:max-w-[40%]"
      title={playing ? `${track!.name} — ${track!.artist}` : "Spotify connected"}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-60" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber" />
      </span>
      <span className="truncate font-mono">
        {playing ? (
          <>
            <span className="uppercase tracking-[0.2em]">now playing:</span>{" "}
            <span className="normal-case tracking-normal">{track!.name}</span>
          </>
        ) : (
          <span className="uppercase tracking-[0.2em]">spotify</span>
        )}
      </span>
    </span>
  );
}

// Pure detection helper; also exported for tests if we add them later.
export function detect(text: string, photo: string | null): DetectedKind {
  const t = text.trim();
  // Place-hint heuristics: starts with @ or contains venue words
  if (t.startsWith("@")) return "path";
  const placeHints = /\b(at|@|in|near|on)\s+[A-Z]/;
  if (t.length > 0 && placeHints.test(t) && t.length < 80 && !photo) {
    return "path";
  }
  if (photo) return "moment-photo";
  return "moment";
}
