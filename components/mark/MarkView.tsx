"use client";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import Image from "next/image";
import toast from "react-hot-toast";
import { Camera, MapPin, X, Pencil, Trash2, Check } from "lucide-react";
import { sampleFileMood } from "@/lib/photo-mood";
import { SaveChip, useSaveState } from "@/components/ui/SaveChip";
import { TraceMeta } from "@/components/ui/TraceMeta";

interface Mark {
  id: string;
  content: string;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: Date;
}

export function MarkView({ initialMarks }: { initialMarks: Mark[] }) {
  const [marks, setMarks] = useState<Mark[]>(initialMarks);
  const [content, setContent] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [photoMood, setPhotoMood] = useState<{ lum: number; warmth: number } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const save = useSaveState();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    sampleFileMood(file).then((mood) => setPhotoMood(mood));
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoUrl(base64);
      setUploading(true);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, folder: "atlas/marks" }),
        });
        const data = await res.json();
        setUploadedPhotoUrl(data.url);
      } catch {
        toast.error("Photo upload failed.");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const mark = await save.run(async () => {
      const res = await fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          photoUrl: uploadedPhotoUrl ?? undefined,
          latitude: location?.lat,
          longitude: location?.lng,
          photoLum: photoMood?.lum,
          photoWarmth: photoMood?.warmth,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    });
    setSaving(false);
    if (mark) {
      setMarks([mark, ...marks]);
      setContent("");
      setPhotoUrl(null);
      setUploadedPhotoUrl(null);
      setPhotoMood(null);
      setLocation(null);
      setLocationLabel(null);
      textRef.current?.focus();
    } else {
      toast.error("Could not save.");
    }
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
      setMarks((ms) => ms.map((m) => (m.id === id ? { ...m, content: updated.content } : m)));
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
      <div className="mb-12 flex items-start justify-between gap-4">
        <div>
          <p className="label mb-2">Notice</p>
          <h1 className="font-serif text-4xl text-earth">Capture</h1>
          <p className="font-mono text-xs text-earth/40 mt-2">
            What you noticed. One line, maybe a photo.
          </p>
        </div>
        <div className="pt-1">
          <SaveChip state={save.state} onRetry={save.retry} />
        </div>
      </div>

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
              onClick={() => { setPhotoUrl(null); setUploadedPhotoUrl(null); }}
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
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-earth/20">⌘↵</span>
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-40"
            >
              {saving ? "..." : "Notice"}
            </button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
      </div>

      <div className="space-y-0">
        {marks.map((mark, i) => {
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
          <p className="font-mono text-xs text-earth/30 py-8">
            Nothing marked yet.
          </p>
        )}
      </div>
    </div>
  );
}
