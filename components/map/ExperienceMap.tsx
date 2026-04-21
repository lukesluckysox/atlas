"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, MapPin, Mountain, Music2, Tent, Globe, X } from "lucide-react";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const EXPERIENCE_TYPES = [
  { value: "country", label: "Country", icon: Globe },
  { value: "national_park", label: "National Park", icon: Mountain },
  { value: "state", label: "State / Region", icon: MapPin },
  { value: "concert", label: "Concert", icon: Music2 },
  { value: "trail", label: "Trail / Hike", icon: Tent },
  { value: "moment", label: "Moment", icon: MapPin },
];

interface Experience {
  id: string;
  type: string;
  name: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  date?: Date | null;
  note?: string | null;
}

interface Props {
  experiences: Experience[];
  stats: { total: number; countries: number; nationalParks: number; concerts: number };
  isPro: boolean;
}

export function ExperienceMap({ experiences, stats, isPro }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "country",
    name: "",
    location: "",
    date: "",
    note: "",
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          name: form.name,
          location: form.location || undefined,
          date: form.date || undefined,
          note: form.note || undefined,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Noted.");
      setShowForm(false);
      setForm({ type: "country", name: "", location: "", date: "", note: "" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not save.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const geoExperiences = experiences.filter((e) => e.latitude && e.longitude);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-page-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label mb-2">Experience</p>
          <h1 className="font-serif text-4xl text-earth">Life map</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          Log
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-earth/10 mb-8">
        {[
          { label: "Total", value: stats.total },
          { label: "Countries", value: stats.countries },
          { label: "Parks", value: stats.nationalParks },
          { label: "Concerts", value: stats.concerts },
        ].map((stat) => (
          <div key={stat.label} className="bg-parchment p-6">
            <p className="font-serif text-3xl text-earth mb-1">{stat.value}</p>
            <p className="label">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="h-96 mb-12 border border-earth/10 overflow-hidden">
        <MapView experiences={geoExperiences} />
      </div>

      <div className="space-y-px">
        {experiences.map((exp) => {
          const TypeIcon = EXPERIENCE_TYPES.find((t) => t.value === exp.type)?.icon ?? MapPin;
          return (
            <div key={exp.id} className="flex items-center gap-6 py-4 border-b border-earth/5">
              <TypeIcon size={14} className="text-amber shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-earth">{exp.name}</p>
                {exp.location && (
                  <p className="font-mono text-xs text-earth/40">{exp.location}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="label text-xs">
                  {EXPERIENCE_TYPES.find((t) => t.value === exp.type)?.label}
                </p>
                {exp.date && (
                  <p className="font-mono text-xs text-earth/30 mt-1">
                    {format(new Date(exp.date), "MMM yyyy")}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {experiences.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-mono text-sm text-earth/40">
              Nothing here yet. Go somewhere. Hear something.
            </p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-earth/40 flex items-end md:items-center justify-center p-4">
          <div className="bg-parchment w-full max-w-md p-8 relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-earth/40 hover:text-earth"
            >
              <X size={16} />
            </button>
            <h2 className="font-serif text-2xl text-earth mb-8">Log experience</h2>

            <div className="space-y-6">
              <div>
                <p className="label mb-3">Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {EXPERIENCE_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setForm({ ...form, type: type.value })}
                      className={`flex items-center gap-2 p-3 border text-left font-mono text-xs transition-colors ${
                        form.type === type.value
                          ? "border-amber bg-amber/10 text-earth"
                          : "border-earth/10 text-earth/60 hover:border-earth/30"
                      }`}
                    >
                      <type.icon size={12} />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
              />
              <input
                type="text"
                placeholder="Location (optional)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-field"
              />
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input-field"
              />
              <textarea
                placeholder="Note (optional)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
                className="input-field resize-none"
              />

              {!isPro && (
                <p className="font-mono text-xs text-earth/40">
                  Free tier: up to 50 experiences.
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary w-full disabled:opacity-40"
              >
                {saving ? "Saving..." : "Log it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
