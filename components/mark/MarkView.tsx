"use client";
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import Image from "next/image";
import toast from "react-hot-toast";
import { Camera, MapPin, X } from "lucide-react";
import { sampleFileMood } from "@/lib/photo-mood";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const getLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLabel(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      () => toast.error("Could not get location.")
    );
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
    try {
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
      const mark = await res.json();
      setMarks([mark, ...marks]);
      setContent("");
      setPhotoUrl(null);
      setUploadedPhotoUrl(null);
      setPhotoMood(null);
      setLocation(null);
      setLocationLabel(null);
      textRef.current?.focus();
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-page-in">
      <div className="mb-12">
        <p className="label mb-2">Notice</p>
        <p className="font-mono text-xs text-earth/40">
          What you noticed. One line, maybe a photo.
        </p>
      </div>

      <div className="mb-16">
        <textarea
          ref={textRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="You noticed something."
          rows={3}
          className="w-full bg-transparent border-b border-earth/20 py-4 font-mono text-sm text-earth placeholder:text-earth/30 focus:outline-none focus:border-earth transition-colors resize-none"
        />

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
        {marks.map((mark, i) => (
          <div
            key={mark.id}
            className="py-6 border-b border-earth/5 animate-slide-up"
            style={{ animationDelay: `${i * 30}ms` }}
          >
            <div className="flex items-start gap-6">
              <div className="shrink-0 pt-1">
                <p className="font-mono text-xs text-earth/30">
                  {format(new Date(mark.createdAt), "MMM d")}
                </p>
                {mark.latitude && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin size={8} className="text-amber/50" />
                    <span className="font-mono text-xs text-earth/20">
                      {mark.latitude.toFixed(2)}, {mark.longitude?.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1">
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
              </div>
            </div>
          </div>
        ))}

        {marks.length === 0 && (
          <p className="font-mono text-xs text-earth/30 py-8">
            Nothing marked yet.
          </p>
        )}
      </div>
    </div>
  );
}
