"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Plus,
  MapPin,
  Mountain,
  Music2,
  Tent,
  Globe,
  X,
  Search,
  UtensilsCrossed,
  Trophy,
  Waves,
  Triangle,
  Landmark as LandmarkIcon,
} from "lucide-react";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const EXPERIENCE_TYPES = [
  { value: "country", label: "Country", icon: Globe, color: "#D4A843" },
  { value: "national_park", label: "National Park", icon: Mountain, color: "#7A8C6E" },
  { value: "state", label: "State / Region", icon: MapPin, color: "#C17F5A" },
  { value: "concert", label: "Concert", icon: Music2, color: "#8B5A9F" },
  { value: "trail", label: "Trail / Hike", icon: Tent, color: "#4A7A5C" },
  { value: "restaurant", label: "Restaurant", icon: UtensilsCrossed, color: "#A63D40" },
  { value: "stadium", label: "Stadium", icon: Trophy, color: "#3A5A7A" },
  { value: "beach", label: "Beach", icon: Waves, color: "#3E7A8C" },
  { value: "peak", label: "Peak", icon: Triangle, color: "#6B6B6B" },
  { value: "landmark", label: "Landmark", icon: LandmarkIcon, color: "#8B6F3F" },
  { value: "moment", label: "Moment", icon: MapPin, color: "#E8C47A" },
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

interface PlaceResult {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  kind: string;
}

interface Props {
  experiences: Experience[];
  stats: { total: number; countries: number; nationalParks: number; concerts: number };
  isPro: boolean;
}

interface FormState {
  type: string;
  name: string;
  location: string;
  date: string;
  note: string;
  latitude: number | null;
  longitude: number | null;
  // Concert-only sub-fields
  artist: string;
  venue: string;
  city: string;
}

const INITIAL_FORM: FormState = {
  type: "country",
  name: "",
  location: "",
  date: "",
  note: "",
  latitude: null,
  longitude: null,
  artist: "",
  venue: "",
  city: "",
};

export function ExperienceMap({ experiences, stats, isPro }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const suggestionsLocked = useRef(false);
  // Active autocomplete target: 'name' for non-concert, 'city' for concert
  const [activeField, setActiveField] = useState<"name" | "city">("name");

  // Debounced place autocomplete — driven by either `name` or `city`
  const query = form.type === "concert" ? form.city : form.name;
  useEffect(() => {
    if (suggestionsLocked.current) {
      suggestionsLocked.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    // Concerts search "city" type; others use their own type hint
    const searchType = form.type === "concert" ? "state" : form.type;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/search?q=${encodeURIComponent(q)}&type=${searchType}`
        );
        const data: { results?: PlaceResult[] } = await res.json();
        setSuggestions(data.results ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, form.type]);

  const selectSuggestion = (s: PlaceResult) => {
    suggestionsLocked.current = true;
    if (form.type === "concert") {
      setForm((f) => ({
        ...f,
        city: s.name,
        location: [f.venue, s.name, s.location].filter(Boolean).join(", "),
        latitude: s.latitude,
        longitude: s.longitude,
      }));
    } else {
      setForm((f) => ({
        ...f,
        name: s.name,
        location: s.location,
        latitude: s.latitude,
        longitude: s.longitude,
      }));
    }
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const resetForm = () => setForm(INITIAL_FORM);

  const handleSave = async () => {
    // Build the stored fields from concert sub-fields, or use name directly
    let name = form.name.trim();
    let location = form.location.trim();

    if (form.type === "concert") {
      if (!form.artist.trim()) {
        toast.error("Artist / band is required.");
        return;
      }
      name = form.artist.trim();
      // Compose "Venue, City" for location display
      location = [form.venue.trim(), form.city.trim()].filter(Boolean).join(", ");
    } else if (!name) {
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
          name,
          location: location || undefined,
          latitude: form.latitude ?? undefined,
          longitude: form.longitude ?? undefined,
          date: form.date || undefined,
          note: form.note || undefined,
        }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Noted.");
      setShowForm(false);
      resetForm();
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
    <div className="max-w-7xl mx-auto px-6 py-12 animate-page-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label mb-2">Experience</p>
          <h1 className="font-serif text-4xl text-earth">Life map</h1>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
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

      {/* 2-col layout: square map on the left, form or list on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left: square map */}
        <div className="order-1">
          <div className="aspect-square border border-earth/10 overflow-hidden">
            <MapView experiences={geoExperiences} />
          </div>

          {/* Color legend */}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {EXPERIENCE_TYPES.map((t) => (
              <div key={t.value} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-earth"
                  style={{ backgroundColor: t.color }}
                />
                <span className="font-mono text-[10px] uppercase tracking-widest text-earth/60">
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: either the log form (when open) or the list */}
        <div className="order-2 min-h-[480px]">
          {showForm ? (
            <LogPanel
              form={form}
              setForm={setForm}
              saving={saving}
              isPro={isPro}
              suggestions={suggestions}
              showSuggestions={showSuggestions}
              setShowSuggestions={setShowSuggestions}
              searching={searching}
              activeField={activeField}
              setActiveField={setActiveField}
              selectSuggestion={selectSuggestion}
              onClose={() => {
                setShowForm(false);
                resetForm();
              }}
              onSave={handleSave}
            />
          ) : (
            <div className="border border-earth/10 h-full flex flex-col">
              <div className="px-4 py-3 border-b border-earth/10 flex items-center justify-between">
                <p className="label">Recent</p>
                <p className="font-mono text-xs text-earth/30">
                  {experiences.length} total
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {experiences.length === 0 ? (
                  <div className="py-16 text-center px-6">
                    <p className="font-mono text-sm text-earth/40">
                      Nothing here yet. Go somewhere. Hear something.
                    </p>
                  </div>
                ) : (
                  experiences.slice(0, 12).map((exp) => {
                    const typeMeta = EXPERIENCE_TYPES.find((t) => t.value === exp.type);
                    const TypeIcon = typeMeta?.icon ?? MapPin;
                    return (
                      <div
                        key={exp.id}
                        className="flex items-center gap-3 px-4 py-3 border-b border-earth/5 last:border-b-0"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: typeMeta?.color || "#D4A843" }}
                        />
                        <TypeIcon size={12} className="text-earth/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm text-earth truncate">{exp.name}</p>
                          {exp.location && (
                            <p className="font-mono text-xs text-earth/40 truncate">
                              {exp.location}
                            </p>
                          )}
                        </div>
                        {exp.date && (
                          <p className="font-mono text-xs text-earth/30 shrink-0">
                            {format(new Date(exp.date), "MMM yyyy")}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full list below */}
      {!showForm && experiences.length > 12 && (
        <div className="mt-12">
          <p className="label mb-4">All entries</p>
          <div className="space-y-px">
            {experiences.map((exp) => {
              const typeMeta = EXPERIENCE_TYPES.find((t) => t.value === exp.type);
              const TypeIcon = typeMeta?.icon ?? MapPin;
              return (
                <div key={exp.id} className="flex items-center gap-6 py-4 border-b border-earth/5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: typeMeta?.color || "#D4A843" }}
                  />
                  <TypeIcon size={14} className="text-earth/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-earth">{exp.name}</p>
                    {exp.location && (
                      <p className="font-mono text-xs text-earth/40">{exp.location}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="label text-xs">{typeMeta?.label}</p>
                    {exp.date && (
                      <p className="font-mono text-xs text-earth/30 mt-1">
                        {format(new Date(exp.date), "MMM yyyy")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ----- Log panel (inline on the right side of the grid) -----

interface LogPanelProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  isPro: boolean;
  suggestions: PlaceResult[];
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  searching: boolean;
  activeField: "name" | "city";
  setActiveField: (f: "name" | "city") => void;
  selectSuggestion: (s: PlaceResult) => void;
  onClose: () => void;
  onSave: () => void;
}

function LogPanel({
  form,
  setForm,
  saving,
  isPro,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  searching,
  selectSuggestion,
  onClose,
  onSave,
}: LogPanelProps) {
  const isConcert = form.type === "concert";

  return (
    <div className="border border-earth/10 bg-parchment h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-earth/10 flex items-center justify-between">
        <p className="label">Log experience</p>
        <button
          onClick={onClose}
          className="text-earth/40 hover:text-earth"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div>
          <p className="label mb-3">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {EXPERIENCE_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    type: type.value,
                    latitude: null,
                    longitude: null,
                  }))
                }
                className={`flex items-center gap-2 p-2.5 border text-left font-mono text-xs transition-colors ${
                  form.type === type.value
                    ? "border-amber bg-amber/10 text-earth"
                    : "border-earth/10 text-earth/60 hover:border-earth/30"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: type.color }}
                />
                <type.icon size={12} />
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {isConcert ? (
          <>
            <input
              type="text"
              placeholder="Artist / band *"
              value={form.artist}
              onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
              className="input-field"
              autoComplete="off"
            />
            <input
              type="text"
              placeholder="Venue (e.g. Red Rocks Amphitheatre)"
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              className="input-field"
              autoComplete="off"
            />
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="City (start typing to search)"
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      city: e.target.value,
                      latitude: null,
                      longitude: null,
                    }))
                  }
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="input-field pr-8"
                  autoComplete="off"
                />
                {searching && (
                  <Search
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-earth/40 animate-pulse"
                  />
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <SuggestionsDropdown
                  suggestions={suggestions}
                  onPick={selectSuggestion}
                />
              )}
            </div>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="input-field"
            />
            <textarea
              placeholder="Note (opening act, who you went with, how it felt)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="input-field resize-none"
            />
          </>
        ) : (
          <>
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Name * (start typing to search)"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      latitude: null,
                      longitude: null,
                    }))
                  }
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="input-field pr-8"
                  autoComplete="off"
                />
                {searching && (
                  <Search
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-earth/40 animate-pulse"
                  />
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <SuggestionsDropdown
                  suggestions={suggestions}
                  onPick={selectSuggestion}
                />
              )}
            </div>
            <input
              type="text"
              placeholder="Location (optional)"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="input-field"
            />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="input-field"
            />
            <textarea
              placeholder="Note (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="input-field resize-none"
            />
          </>
        )}

        {!isPro && (
          <p className="font-mono text-xs text-earth/40">
            Free tier: up to 50 experiences.
          </p>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          className="btn-primary w-full disabled:opacity-40"
        >
          {saving ? "Saving..." : "Log it"}
        </button>
      </div>
    </div>
  );
}

function SuggestionsDropdown({
  suggestions,
  onPick,
}: {
  suggestions: PlaceResult[];
  onPick: (s: PlaceResult) => void;
}) {
  return (
    <div className="absolute z-10 left-0 right-0 mt-1 bg-parchment border border-earth/20 shadow-lg max-h-64 overflow-y-auto">
      {suggestions.map((s) => (
        <button
          key={s.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(s);
          }}
          className="w-full text-left px-3 py-2 hover:bg-amber/10 border-b border-earth/5 last:border-b-0"
        >
          <p className="font-mono text-sm text-earth">{s.name}</p>
          {s.location && (
            <p className="font-mono text-xs text-earth/50">{s.location}</p>
          )}
        </button>
      ))}
    </div>
  );
}
