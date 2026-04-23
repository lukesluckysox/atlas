"use client";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import Image from "next/image";
import toast from "react-hot-toast";
import { Camera, MapPin, X, Pencil, Trash2, Check } from "lucide-react";
import { sampleFileMood } from "@/lib/photo-mood";
import { submitWithQueue } from "@/lib/offline-submit";
import { SaveChip, useSaveState } from "@/components/ui/SaveChip";
import { TraceMeta } from "@/components/ui/TraceMeta";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoiceMemo } from "@/components/mark/VoiceMemo";

interface Mark {
  id: string;
  content: string;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  keyword?: string | null;
  summary?: string | null;
  createdAt: Date;
}

export function MarkView({ initialMarks }: { initialMarks: Mark[] }) {
  const [marks, setMarks] = useState<Mark[]>(initialMarks);
  const [content, setContent] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  // Keep the raw file around so we can queue it if the user is offline.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoMood, setPhotoMood] = useState<{ lum: number; warmth: number } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const save = useSaveState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterKeyword, setFilterKeyword] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        // Coords as immediate fallback; reverse-geocode if it succeeds.
        setLocationLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        try {
          const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`);
          if (res.ok) {
            const data: { label?: string | null } = await res.json();
            if (data.label) setLocationLabel(data.label);
          }
        } catch {
          /* keep coord fallback */
        }
      },
      () => toast.error("Could not get location.")
    );
  };

  // Fetch now-playing from Spotify and append as "♪ Track — Artist".
  const attachNowPlaying = async () => {
    try {
      const res = await fetch("/api/spotify/now-playing");
      const data = await res.json();
      if (!data.connected) {
        toast.error("Connect Spotify in Settings first.");
        return;
      }
      if (!data.playing || !data.track) {
        toast("Nothing playing right now.");
        return;
      }
      const snippet = `♪ ${data.track.name} — ${data.track.artist}`;
      setContent((c) => {
        const trimmed = c.replace(/\s*$/, "");
        return trimmed ? `${trimmed}\n${snippet}` : snippet;
      });
    } catch {
      toast.error("Could not fetch track.");
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    sampleFileMood(file).then((mood) => setPhotoMood(mood));
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoUrl(base64);
      // Don't block save if we're offline — the blob goes on the queue.
      if (navigator.onLine === false) return;
      setUploading(true);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, folder: "atlas/marks" }),
        });
        const data = await res.json();
        if (data.url) setUploadedPhotoUrl(data.url);
      } catch {
        // Silent — save will queue the blob instead.
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const res = await submitWithQueue({
      kind: "moment",
      endpoint: "/api/marks",
      payload: {
        content: content.trim(),
        photoUrl: uploadedPhotoUrl ?? undefined,
        latitude: location?.lat,
        longitude: location?.lng,
        photoLum: photoMood?.lum,
        photoWarmth: photoMood?.warmth,
      },
      // If we have a file but no uploaded URL, queue the blob for later upload.
      images:
        !uploadedPhotoUrl && photoFile
          ? [{ payloadField: "photoUrl", folder: "atlas/marks", blob: photoFile }]
          : [],
    });
    setSaving(false);
    if (res.ok && !res.offline) {
      const mark = (res as { data: Mark }).data;
      setMarks([mark, ...marks]);
      resetForm();
    } else if (res.ok && res.offline) {
      toast.success("saved offline — syncing when back online");
      resetForm();
    } else {
      toast.error(res.error || "Could not save.");
    }
  };

  const resetForm = () => {
    setContent("");
    setPhotoUrl(null);
    setUploadedPhotoUrl(null);
    setPhotoFile(null);
    setPhotoMood(null);
    setLocation(null);
    setLocationLabel(null);
    textRef.current?.focus();
  };

  const beginEdit = (mark: Mark) => {
    setEditingId(mark.id);
    setEditDraft(mark.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const commitEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const res = await fetch(`/api/marks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: body }),
      });
      if (!res.ok) throw new Error("update failed");
      const updated: Mark = await res.json();
      setMarks((ms) =>
        ms.map((m) =>
          m.id === id
            ? { ...m, content: updated.content, keyword: updated.keyword ?? null, summary: updated.summary ?? null }
            : m
        )
      );
      setEditingId(null);
      setEditDraft("");
    } catch {
      toast.error("Could not update.");
    }
  };

  const handleDelete = async (mark: Mark) => {
    if (!confirm("Delete this notice?")) return;
    setDeletingId(mark.id);
    try {
      const res = await fetch(`/api/marks/${mark.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setMarks((ms) => ms.filter((m) => m.id !== mark.id));
    } catch {
      toast.error("Could not delete.");
    } finally {
      setDeletingId(null);
    }
  };

  // Slash commands — detect in content and trigger the matching action.
  // Runs on every change; strips the slash token when consumed.
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    // Match "/word" at end of value, preceded by start-or-whitespace.
    const match = v.match(/(^|\s)\/(here|song|photo)(\s|$)/i);
    if (match) {
      const cmd = match[2].toLowerCase();
      const stripped =
        v.slice(0, match.index! + match[1].length) +
        v.slice(match.index! + match[0].length);
      setContent(stripped);
      if (cmd === "here") getLocation();
      else if (cmd === "song") attachNowPlaying();
      else if (cmd === "photo") fileRef.current?.click();
      return;
    }
    setContent(v);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-page-in">
      <PageHeader
        label="Moments"
        h1="What you noticed."
        tagline="One line, maybe a photo. The app reads it back as a keyword."
        right={<SaveChip state={save.state} onRetry={save.retry} />}
      />

      <div className="mb-16">
        <textarea
          ref={textRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="You noticed something."
          rows={3}
          className="w-full bg-transparent border-b border-earth/20 py-4 font-mono text-sm text-earth placeholder:text-earth/30 focus:outline-none focus:border-earth transition-colors resize-none"
        />
        <p className="font-mono text-[10px] uppercase tracking-widest text-earth/30 mt-2">
          Try <span className="text-earth/60">/here</span>{" "}
          <span className="text-earth/60">/song</span>{" "}
          <span className="text-earth/60">/photo</span>
        </p>

        {photoUrl && (
          <div className="relative mt-4 inline-block">
            <Image
              src={photoUrl}
              alt="Notice photo"
              width={200}
              height={200}
              className="object-cover"
            />
            {uploading && (
              <div className="absolute inset-0 bg-earth/50 flex items-center justify-center">
                <p className="font-mono text-xs text-parchment">Uploading...</p>
              </div>
            )}
            <button
              onClick={() => { setPhotoUrl(null); setUploadedPhotoUrl(null); setPhotoFile(null); }}
              className="absolute top-2 right-2 bg-earth text-parchment p-1"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 font-mono text-xs text-earth/40 hover:text-earth transition-colors"
            >
              <Camera size={14} />
              Photo
            </button>
            <button
              onClick={getLocation}
              className={`flex items-center gap-2 font-mono text-xs transition-colors ${
                locationLabel ? "text-amber" : "text-earth/40 hover:text-earth"
              }`}
            >
              <MapPin size={14} />
              {locationLabel ?? "Location"}
            </button>
            <VoiceMemo
              onTranscript={(text) => {
                setContent((c) => (c ? c.trimEnd() + " " + text : text));
              }}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-earth/20">⌘↵</span>
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
            >
              {saving ? "..." : "Mark it"}
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
      </div>

      {(() => {
        // Aggregate recurring keywords into tappable cluster chips.
        // Quiet styling, no counts — feels like something the app noticed.
        const counts = new Map<string, number>();
        for (const m of marks) {
          const k = m.keyword?.trim().toLowerCase();
          if (!k) continue;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        const recurring = Array.from(counts.entries())
          .filter(([, c]) => c >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([k]) => k);
        if (recurring.length === 0) return null;
        return (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-earth/30">
              Recurring
            </span>
            {recurring.map((k) => {
              const active = filterKeyword === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilterKeyword(active ? null : k)}
                  className={`font-mono text-xs px-2 py-1 border transition-colors ${
                    active
                      ? "border-amber bg-amber/15 text-earth"
                      : "border-earth/10 text-earth/55 hover:border-earth/30"
                  }`}
                >
                  {k}
                </button>
              );
            })}
            {filterKeyword && (
              <button
                onClick={() => setFilterKeyword(null)}
                className="font-mono text-[10px] uppercase tracking-widest text-earth/40 hover:text-earth transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        );
      })()}

      <div className="space-y-0">
        {marks
          .filter((m) =>
            !filterKeyword || m.keyword?.trim().toLowerCase() === filterKeyword
          )
          .map((mark, i) => {
          const isEditing = editingId === mark.id;
          const isDeleting = deletingId === mark.id;
          const locLabel = mark.latitude != null && mark.longitude != null
            ? `${mark.latitude.toFixed(2)}, ${mark.longitude.toFixed(2)}`
            : null;
          return (
            <div
              key={mark.id}
              className="group py-6 border-b border-earth/5 animate-slide-up"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start gap-6">
                <div className="shrink-0 pt-1 w-16">
                  <p className="font-mono text-xs text-earth/30">
                    {format(new Date(mark.createdAt), "MMM d")}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="w-full bg-transparent border-b border-earth/30 font-mono text-sm text-earth focus:outline-none focus:border-earth resize-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => commitEdit(mark.id)}
                          disabled={!editDraft.trim()}
                          className="flex items-center gap-1 font-mono text-xs text-amber hover:text-earth disabled:opacity-40 transition-colors"
                        >
                          <Check size={12} /> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="font-mono text-xs text-earth/40 hover:text-earth transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-mono text-sm text-earth/80 leading-relaxed">
                        {mark.content}
                      </p>
                      {(mark.keyword || mark.summary) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {mark.keyword && (
                            <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-earth/5 text-earth/60">
                              {mark.keyword}
                            </span>
                          )}
                          {mark.summary && (
                            <span className="font-mono text-[10px] text-earth/40 italic">
                              {mark.summary}
                            </span>
                          )}
                        </div>
                      )}
                      {mark.photoUrl && (
                        <div className="mt-3">
                          <Image
                            src={mark.photoUrl}
                            alt="Notice"
                            width={240}
                            height={180}
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="mt-2">
                        <TraceMeta
                          date={mark.createdAt}
                          location={locLabel}
                          tags={["notice"]}
                          size="sm"
                        />
                      </div>
                    </>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => beginEdit(mark)}
                      className="text-earth/40 hover:text-earth transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(mark)}
                      disabled={isDeleting}
                      className="text-earth/40 hover:text-terracotta transition-colors disabled:opacity-40"
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {marks.length === 0 && (
          <EmptyState
            headline="Nothing here yet."
            hint="Notice one thing. Write it down."
          />
        )}
      </div>
    </div>
  );
}
