"use client";
/**
 * Map representation rules (principled, single source of truth):
 *   state   → polygon (amber shade)
 *   country → polygon
 *   city    → pin
 *   road    → polyline
 * Pins are reserved for point-in-space entries. Polygons are reserved for
 * regions. Polylines are reserved for routes. Do not add exceptions without
 * updating this comment.
 */
import dynamic from "next/dynamic";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { SaveChip, useSaveState } from "@/components/ui/SaveChip";
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
  Route,
  Trash2,
} from "lucide-react";
import { searchHighways, type HighwayOption } from "@/lib/highways";
import { ShareToTrace } from "@/components/map/ShareToTrace";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapPrintButton } from "@/components/map/MapPrintButton";

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
  // Internal “notice” kind — surfaced on the map as a distinct filter from the
  // “moment” experience type (which is an Experience row). Labeled “Note” on
  // the map legend to avoid collision with the nav-level “Moments” word.
  { value: "notice", label: "Note", icon: MapPin, color: "#C17F5A" },
  { value: "road", label: "Road", icon: Route, color: "#D4A843" },
];

// Two-tier filter groups — top row is the primary toggle, the fine-grained
// chips below only appear for the active group.
const FILTER_GROUPS: { value: "places" | "moments" | "notices" | "roads"; label: string; types: string[] }[] = [
  {
    value: "places",
    label: "Places",
    types: ["country", "national_park", "state", "trail", "restaurant", "stadium", "beach", "peak", "landmark"],
  },
  { value: "moments", label: "Moments", types: ["concert", "moment"] },
  { value: "notices", label: "Notes", types: ["notice"] },
  { value: "roads", label: "Roads", types: ["road"] },
];

const ROAD_SUBTYPES = [
  { value: "interstate", label: "Interstate", color: "#D4A843" },
  { value: "us_route", label: "US Route", color: "#C17F5A" },
  { value: "state", label: "State", color: "#7A8C6E" },
  { value: "scenic", label: "Scenic", color: "#8B5A9F" },
];

type BoundaryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

interface Experience {
  id: string;
  type: string;
  name: string;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  date?: Date | null;
  note?: string | null;
  boundary?: BoundaryGeometry | null;
}

interface PlaceResult {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  kind: string;
}

export interface RoadStretch {
  id: string;
  name: string;
  ref: string | null;
  category: string | null;
  startLabel: string;
  endLabel: string;
  distanceMi: number;
  drivenAt: string | null;
  drivenNote: string | null;
  geometry: { type: "LineString"; coordinates: [number, number][] };
}

interface Props {
  experiences: Experience[];
  stats: { total: number; countries: number; nationalParks: number; concerts: number };
  isPro: boolean;
  roads?: RoadStretch[];
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
  // Road-only sub-fields
  highway: HighwayOption | null;
  roadStart: { label: string; lat: number; lng: number } | null;
  roadEnd: { label: string; lat: number; lng: number } | null;
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
  highway: null,
  roadStart: null,
  roadEnd: null,
};

const FILTER_STORAGE_KEY = "trace:map-filter";

export function ExperienceMap({ experiences, stats, isPro, roads = [] }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const save = useSaveState();

  // Active category layers. null = all enabled.
  const [activeTypes, setActiveTypes] = useState<Set<string> | null>(null);
  // Which group's fine-grained chips are expanded (null = collapsed).
  const [expandedGroup, setExpandedGroup] = useState<
    "places" | "moments" | "notices" | "roads" | null
  >(null);

  // Road-subtype filter (interstate/us_route/state/scenic). null = all shown.
  const [activeRoadCats, setActiveRoadCats] = useState<Set<string> | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);

  // Shared selection: clicking a list row opens the pin; clicking a pin
  // highlights the row and scrolls it into view.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!selectedId) return;
    const el = rowRefs.current[selectedId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  // Hydrate filter from localStorage once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setActiveTypes(new Set(parsed));
    } catch {
      /* ignore */
    }
  }, []);

  const persistFilter = (next: Set<string> | null) => {
    if (typeof window === "undefined") return;
    if (next === null) localStorage.removeItem(FILTER_STORAGE_KEY);
    else localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(Array.from(next)));
  };

  const isTypeActive = (value: string) => activeTypes === null || activeTypes.has(value);

  // Roads visibility + helpers — roads are a pseudo-type ("road") with no
  // matching Experience records, so we track visibility via activeTypes in
  // the same way: null = all shown, set containing "road" = shown.
  const roadsVisible = activeTypes === null || activeTypes.has("road");

  // Filtered list of roads respecting the second-tier subcategory chips.
  const visibleRoads = roads.filter((r) => {
    if (!roadsVisible) return false;
    if (!activeRoadCats) return true;
    return activeRoadCats.has(r.category || "scenic");
  });

  // Group helpers for the top-row primary filter.
  const groupCount = (groupTypes: string[]) => {
    if (groupTypes.includes("road")) return roads.length;
    return experiences.filter((e) => groupTypes.includes(e.type)).length;
  };

  const isGroupFullyActive = (groupTypes: string[]) =>
    groupTypes.every((t) => isTypeActive(t));

  const isGroupPartiallyActive = (groupTypes: string[]) =>
    groupTypes.some((t) => isTypeActive(t));

  // Click on "All" — clear every filter.
  const showAllGroups = () => {
    setActiveTypes(null);
    persistFilter(null);
    setExpandedGroup(null);
  };

  // Click on a group — solo it (hide every type outside the group).
  const soloGroup = (groupTypes: string[]) => {
    const next = new Set(groupTypes);
    setActiveTypes(next);
    persistFilter(next);
  };

  // Toggle a single type within a group (second-tier chips).
  const toggleGroupType = (groupTypes: string[], value: string) => {
    setActiveTypes((prev) => {
      // Start from the group set so siblings outside the group stay hidden.
      const base = prev ?? new Set(EXPERIENCE_TYPES.map((t) => t.value));
      const next = new Set(base);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      // If every group type is back in and it equals the full set — collapse to null.
      const isAll = next.size === EXPERIENCE_TYPES.length;
      const final = isAll ? null : next;
      persistFilter(final);
      return final;
    });
    // Suppress unused warning — groupTypes reserved for future partial-collapse logic.
    void groupTypes;
  };

  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const suggestionsLocked = useRef(false);
  // Active autocomplete target: 'name' for non-concert, 'city' for concert
  const [activeField, setActiveField] = useState<"name" | "city">("name");

  // Debounced place autocomplete — driven by either `name` or `city`.
  // For state/country, we suppress name autocomplete: the user types the
  // region freely, shading comes from our boundary lookup, and an optional
  // city picker (rendered below) supplies the pin coords.
  const nameSuggestsByType = form.type !== "state" && form.type !== "country";
  const query = form.type === "concert" ? form.city : nameSuggestsByType ? form.name : "";
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
    // Road: distinct save path — POST to /api/roads with start/end coords.
    if (form.type === "road") {
      if (!form.roadStart && !form.roadEnd) {
        toast.error("Type a city, then pick one from the dropdown.");
        return;
      }
      if (!form.roadStart) {
        toast.error("Pick a start city from the dropdown.");
        return;
      }
      if (!form.roadEnd) {
        toast.error("Pick an end city from the dropdown.");
        return;
      }
      setSaving(true);
      let thrownMsg: string | null = null;
      const result = await save.run(async () => {
        const res = await fetch("/api/roads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.highway?.name,
            category: form.highway?.category,
            startLabel: form.roadStart!.label,
            endLabel: form.roadEnd!.label,
            startLat: form.roadStart!.lat,
            startLng: form.roadStart!.lng,
            endLat: form.roadEnd!.lat,
            endLng: form.roadEnd!.lng,
            drivenAt: form.date || undefined,
            drivenNote: form.note || undefined,
          }),
        });
        const data: { error?: string; distanceMi?: number; ref?: string; usedFallback?: boolean } = await res.json();
        if (!res.ok) {
          thrownMsg = data.error || `Save failed (${res.status})`;
          throw new Error(thrownMsg);
        }
        return data;
      });
      setSaving(false);
      if (result && "distanceMi" in result) {
        const r = result as { distanceMi: number; usedFallback?: boolean };
        toast.success(
          r.usedFallback
            ? `Traced (straight line, ${r.distanceMi} mi). Add MAPBOX_TOKEN for real routing.`
            : `Traced. ${r.distanceMi} mi.`
        );
        setForm((f) => ({ ...INITIAL_FORM, type: f.type }));
        router.refresh();
      } else {
        toast.error(thrownMsg || "Couldn’t save road. Check connection.");
      }
      return;
    }

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
    const payload = {
      type: form.type,
      name,
      location: location || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      date: form.date || undefined,
      note: form.note || undefined,
    };
    const result = await save.run(async () => {
      const res = await fetch("/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      return data;
    });
    setSaving(false);
    if (result) {
      toast.success("Noted. Add another.");
      setForm((f) => ({ ...INITIAL_FORM, type: f.type }));
      router.refresh();
    } else {
      toast.error("Could not save.");
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (exp: Experience) => {
    if (!confirm(`Delete "${exp.name}"? This can't be undone.`)) return;
    setDeletingId(exp.id);
    // Notices are stored as Marks; route their delete accordingly.
    const isNotice = exp.id.startsWith("mark_");
    const rawId = isNotice ? exp.id.slice(5) : exp.id;
    const url = isNotice ? `/api/marks/${rawId}` : `/api/experiences/${rawId}`;
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete.");
      }
      toast.success("Removed.");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not delete.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Long-press / right-click the map: drop a pin, open drawer pre-filled.
  const handleLongPress = async (lat: number, lng: number) => {
    const rLat = Number(lat.toFixed(6));
    const rLng = Number(lng.toFixed(6));
    // Open drawer immediately with coords — location string fills in async.
    setForm({
      ...INITIAL_FORM,
      type: "moment",
      latitude: rLat,
      longitude: rLng,
      location: `${rLat}, ${rLng}`,
    });
    setShowForm(true);
    toast.success("Pin dropped. Finish the log.");
    try {
      const res = await fetch(`/api/places/reverse?lat=${rLat}&lng=${rLng}`);
      if (!res.ok) return;
      const data: { label?: string | null } = await res.json();
      if (data.label) {
        setForm((f) =>
          // Only overwrite if user hasn't started editing location.
          f.location === `${rLat}, ${rLng}` ? { ...f, location: data.label! } : f
        );
      }
    } catch {
      /* swallow — coords remain as fallback */
    }
  };

  // Include entries with either coordinates OR a boundary polygon (states/countries
  // sometimes come in boundary-only), and gate by active layer filter.
  const geoExperiences = experiences.filter(
    (e) => ((e.latitude && e.longitude) || e.boundary) && isTypeActive(e.type)
  );
  const visibleExperiences = experiences.filter((e) => isTypeActive(e.type));

  // Unified list rows: mix experiences + roads when the filter allows.
  // Roads only appear when "road" is in the active type set (null = all).
  type ListRow =
    | { kind: "exp"; id: string; item: Experience; at: number }
    | { kind: "road"; id: string; item: RoadStretch; at: number };

  const roadRowsEligible = roadsVisible
    ? roads.filter(
        (r) => !activeRoadCats || activeRoadCats.has(r.category || "scenic")
      )
    : [];

  const listRows: ListRow[] = [
    ...visibleExperiences.map<ListRow>((e) => ({
      kind: "exp",
      id: e.id,
      item: e,
      at: e.date ? new Date(e.date).getTime() : 0,
    })),
    ...roadRowsEligible.map<ListRow>((r) => ({
      kind: "road",
      id: `road_${r.id}`,
      item: r,
      at: r.drivenAt ? new Date(r.drivenAt).getTime() : 0,
    })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-page-in">
      <PageHeader
        label="Paths"
        h1="Where you&rsquo;ve been."
        tagline="Countries, parks, concerts, trails, roads. A map of what it was."
        right={
          <div className="flex items-center gap-2">
            <MapPrintButton isPro={isPro} />
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
        }
      />

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
            <MapView
              experiences={geoExperiences}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={(id) => {
                const exp = experiences.find((e) => e.id === id);
                if (exp) void handleDelete(exp);
              }}
              onLongPress={handleLongPress}
              roads={visibleRoads}
              selectedRoadId={selectedRoadId}
              onSelectRoad={setSelectedRoadId}
              onDeleteRoad={async (id) => {
                if (!confirm("Remove this stretch?")) return;
                const r = await fetch(`/api/roads/${id}`, { method: "DELETE" });
                if (r.ok) {
                  toast.success("Removed.");
                  router.refresh();
                } else {
                  toast.error("Failed to remove.");
                }
              }}
            />
          </div>

          {/* Two-tier filter: primary groups + fine-grained chips per group */}
          <div className="mt-4">
            <p className="label mb-2">Layers</p>

            {/* Top row — 4 wide buttons */}
            <div className="grid grid-cols-4 gap-px bg-earth/10 mb-2">
              <button
                onClick={showAllGroups}
                className={`bg-parchment px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  activeTypes === null
                    ? "text-earth bg-earth/5"
                    : "text-earth/50 hover:text-earth"
                }`}
              >
                All
                <span className="ml-1.5 text-earth/40">{experiences.length + roads.length}</span>
              </button>
              {FILTER_GROUPS.map((g) => {
                const count = groupCount(g.types);
                const full = isGroupFullyActive(g.types);
                const partial = isGroupPartiallyActive(g.types);
                const active = activeTypes !== null && partial;
                return (
                  <button
                    key={g.value}
                    onClick={() => {
                      // First click: solo the group. Second click on the same
                      // already-soloed group: expand its fine-grained chips.
                      if (active && full) {
                        setExpandedGroup(
                          expandedGroup === g.value ? null : g.value
                        );
                      } else {
                        soloGroup(g.types);
                        setExpandedGroup(g.value);
                      }
                    }}
                    className={`bg-parchment px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                      active
                        ? "text-earth bg-earth/5"
                        : "text-earth/50 hover:text-earth"
                    }`}
                  >
                    {g.label}
                    <span className="ml-1.5 text-earth/40">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Second tier — only the active group's fine-grained chips */}
            {expandedGroup === "roads" && (
              <div className="flex flex-wrap gap-1.5 mt-3 animate-fade-in">
                {ROAD_SUBTYPES.map((rc) => {
                  const count = roads.filter((r) => (r.category || "scenic") === rc.value).length;
                  const active = !activeRoadCats || activeRoadCats.has(rc.value);
                  return (
                    <button
                      key={rc.value}
                      onClick={() => {
                        setActiveRoadCats((prev) => {
                          const base = prev ?? new Set(ROAD_SUBTYPES.map((s) => s.value));
                          const next = new Set(base);
                          if (next.has(rc.value)) next.delete(rc.value);
                          else next.add(rc.value);
                          return next.size === ROAD_SUBTYPES.length ? null : next;
                        });
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 border font-mono text-[10px] uppercase tracking-widest transition-all ${
                        active
                          ? "border-earth/30 text-earth/80 bg-parchment"
                          : "border-earth/10 text-earth/25 line-through"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full border ${active ? "border-earth" : "border-earth/20"}`}
                        style={{ backgroundColor: active ? rc.color : "transparent" }}
                      />
                      {rc.label}
                      <span className="text-earth/40">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {expandedGroup && expandedGroup !== "roads" && (
              <div className="flex flex-wrap gap-1.5 mt-3 animate-fade-in">
                {EXPERIENCE_TYPES.filter((t) =>
                  FILTER_GROUPS.find((g) => g.value === expandedGroup)?.types.includes(t.value)
                ).map((t) => {
                  const active = isTypeActive(t.value);
                  const group = FILTER_GROUPS.find((g) => g.value === expandedGroup)!;
                  return (
                    <button
                      key={t.value}
                      onClick={() => toggleGroupType(group.types, t.value)}
                      className={`flex items-center gap-1.5 px-2 py-1 border font-mono text-[10px] uppercase tracking-widest transition-all ${
                        active
                          ? "border-earth/30 text-earth/80 bg-parchment"
                          : "border-earth/10 text-earth/25 line-through"
                      }`}
                      title={active ? "Click to hide" : "Click to show"}
                    >
                      <span
                        className={`w-2 h-2 rounded-full border ${
                          active ? "border-earth" : "border-earth/20"
                        }`}
                        style={{ backgroundColor: active ? t.color : "transparent" }}
                      />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: either the log form (when open) or the list */}
        <div className="order-2 min-h-[480px]">
          {showForm ? (
            <LogPanel
              form={form}
              setForm={setForm}
              saving={saving}
              saveState={save.state}
              onRetry={save.retry}
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
                  {activeTypes === null
                    ? `${experiences.length + roads.length} total`
                    : `${listRows.length} of ${experiences.length + roads.length}`}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {listRows.length === 0 ? (
                  <div className="py-16 text-center px-6">
                    <p className="font-mono text-sm text-earth/40">
                      {experiences.length === 0 && roads.length === 0
                        ? "Nothing here yet. Go somewhere. Hear something."
                        : "No entries in the selected layers."}
                    </p>
                  </div>
                ) : (
                  listRows.slice(0, 12).map((row) => {
                    if (row.kind === "road") {
                      const r = row.item;
                      const isSelected = selectedRoadId === r.id;
                      return (
                        <div
                          key={row.id}
                          onClick={() => {
                            setSelectedRoadId(isSelected ? null : r.id);
                            setSelectedId(null);
                          }}
                          className={`group flex items-center gap-3 px-4 py-3 border-b border-earth/5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-amber/10 border-l-2 border-l-amber"
                              : "hover:bg-earth/5"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#D4A843" }} />
                          <Route size={12} className="text-earth/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm text-earth truncate">{r.name}</p>
                            <p className="font-mono text-xs text-earth/40 truncate">
                              {r.distanceMi} mi · {r.startLabel} → {r.endLabel}
                            </p>
                          </div>
                          {r.drivenAt && (
                            <p className="font-mono text-xs text-earth/30 shrink-0">
                              {format(new Date(r.drivenAt), "MMM yyyy")}
                            </p>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm("Remove this stretch?")) return;
                              const resp = await fetch(`/api/roads/${r.id}`, { method: "DELETE" });
                              if (resp.ok) {
                                toast.success("Removed.");
                                router.refresh();
                              } else toast.error("Failed to remove.");
                            }}
                            className="opacity-0 group-hover:opacity-100 text-earth/40 hover:text-terracotta transition-opacity"
                            aria-label="Delete road"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    }
                    const exp = row.item;
                    const typeMeta = EXPERIENCE_TYPES.find((t) => t.value === exp.type);
                    const TypeIcon = typeMeta?.icon ?? MapPin;
                    const isSelected = selectedId === exp.id;
                    const hasGeo = exp.latitude != null && exp.longitude != null;
                    return (
                      <div
                        key={exp.id}
                        ref={(el) => {
                          rowRefs.current[exp.id] = el;
                        }}
                        onClick={() => {
                          if (!hasGeo) return;
                          setSelectedId(isSelected ? null : exp.id);
                        }}
                        className={`group flex items-center gap-3 px-4 py-3 border-b border-earth/5 last:border-b-0 transition-colors ${
                          hasGeo ? "cursor-pointer" : ""
                        } ${
                          isSelected
                            ? "bg-amber/10 border-l-2 border-l-amber"
                            : hasGeo
                            ? "hover:bg-earth/5"
                            : ""
                        }`}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(exp);
                          }}
                          disabled={deletingId === exp.id}
                          className="opacity-0 group-hover:opacity-100 text-earth/40 hover:text-terracotta transition-opacity disabled:opacity-30"
                          aria-label="Delete entry"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
  saveState: import("@/components/ui/SaveChip").SaveStatus;
  onRetry: () => void;
}

function LogPanel({
  form,
  setForm,
  saving,
  saveState,
  onRetry,
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
  const isRoad = form.type === "road";
  const isRegion = form.type === "state" || form.type === "country";
  const [showMore, setShowMore] = useState(false);

  // Auto-expand "More details" when an optional field already has content,
  // so editing an entry pre-reveals what's filled.
  useEffect(() => {
    if (!showMore && (form.note || (isConcert && form.venue) || (!isConcert && form.location))) {
      setShowMore(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="border border-earth/10 bg-parchment h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-earth/10 flex items-center justify-between gap-3">
        <div>
          <p className="label">Log a path</p>
          <p className="font-mono text-[10px] text-earth/40 mt-0.5">
            Drawer stays open — log as many as you want.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveChip state={saveState} onRetry={onRetry} />
          <button
            onClick={onClose}
            className="text-earth/40 hover:text-earth"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Share to Trace: upload a ticket/poster, prefill the form below */}
      <div className="px-6 pt-5">
        <ShareToTrace
          onApply={(r) => {
            // Map OCR type to the form's type enum. "Concert" → concert, etc.
            const typeMap: Record<string, string> = {
              Concert: "concert",
              Stadium: "stadium",
              Restaurant: "restaurant",
              Landmark: "landmark",
              Other: "city",
            };
            setForm((f) => ({
              ...f,
              type: (r.type && typeMap[r.type]) || f.type,
              name: r.headliner ?? r.venue ?? f.name,
              venue: r.venue ?? f.venue,
              city: r.city ?? f.city,
              artist: r.headliner ?? f.artist,
              location: r.city ?? f.location,
              date: r.date ?? f.date,
              note: r.imageUrl
                ? (f.note ? f.note + "\n\n" : "") + "(from ticket)"
                : f.note,
            }));
          }}
        />
      </div>

      <div className="p-6 space-y-5">
        <div>
          <p className="label mb-3">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {EXPERIENCE_TYPES.filter((t) => t.value !== "notice").map((type) => (
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

        {/* CORE fields — always visible. Keeps initiation to ~3 steps. */}
        {isRoad ? (
          <RoadFields form={form} setForm={setForm} />
        ) : isConcert ? (
          <input
            type="text"
            placeholder="Artist / band *"
            value={form.artist}
            onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
            className="input-field"
            autoComplete="off"
          />
        ) : (
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder={
                  isRegion
                    ? form.type === "state"
                      ? "State / region name *"
                      : "Country name *"
                    : "Name * (start typing to search)"
                }
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    // Region entries keep coords tied to their optional city picker —
                    // don't clear them here.
                    latitude: isRegion ? f.latitude : null,
                    longitude: isRegion ? f.longitude : null,
                  }))
                }
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="input-field pr-8"
                autoComplete="off"
              />
              {searching && !isRegion && (
                <Search
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-earth/40 animate-pulse"
                />
              )}
            </div>
            {!isRegion && showSuggestions && suggestions.length > 0 && (
              <SuggestionsDropdown
                suggestions={suggestions}
                onPick={selectSuggestion}
              />
            )}
          </div>
        )}

        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="input-field"
        />

        {/* State/country: optional city picker. If picked, drops a pin at the city's
            coordinates. If skipped, only the boundary polygon renders. */}
        {isRegion && (
          <RoadCityPicker
            label="City (optional)"
            value={
              form.latitude != null && form.longitude != null
                ? { label: form.location || "Selected city", lat: form.latitude, lng: form.longitude }
                : null
            }
            onSelect={(v) => {
              if (v) {
                setForm((f) => ({
                  ...f,
                  location: v.label,
                  latitude: v.lat,
                  longitude: v.lng,
                }));
              } else {
                setForm((f) => ({
                  ...f,
                  location: "",
                  latitude: null,
                  longitude: null,
                }));
              }
            }}
          />
        )}

        {/* Road uses an inline note inside RoadFields; skip the shared extras block. */}

        {/* Concert's "City" is how it geolocates, so we keep it visible. */}
        {isConcert && (
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder="City * (start typing to search)"
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
        )}

        {/* OPTIONAL fields — collapsed by default. Hidden for road (has its own note)
            and for region types (they have their own city picker above and don't need
            a free-text location). Notes still need a place — handled inline below. */}
        {isRegion ? (
          <div className="pt-2">
            <textarea
              placeholder="Note (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className="input-field resize-none"
            />
          </div>
        ) : null}

        {!isRoad && !isRegion && <div className="border-t border-earth/10 pt-4">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="w-full flex items-center justify-between text-left font-mono text-[10px] uppercase tracking-widest text-earth/50 hover:text-earth transition-colors"
          >
            <span>{showMore ? "Hide details" : "More details"}</span>
            <span className="text-earth/30">{showMore ? "−" : "+"}</span>
          </button>
          {showMore && (
            <div className="mt-3 space-y-3">
              {isConcert ? (
                <input
                  type="text"
                  placeholder="Venue (e.g. Red Rocks Amphitheatre)"
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  className="input-field"
                  autoComplete="off"
                />
              ) : (
                <input
                  type="text"
                  placeholder="Location (optional)"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="input-field"
                />
              )}
              <textarea
                placeholder={
                  isConcert
                    ? "Note (opening act, who you went with, how it felt)"
                    : "Note (optional)"
                }
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="input-field resize-none"
              />
            </div>
          )}
        </div>}

        {!isPro && (!isRoad) && (
          <p className="font-mono text-xs text-earth/40">
            Free tier: up to 50 experiences.
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary flex-1 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Log & add another"}
          </button>
          <button
            onClick={onClose}
            className="px-4 border border-earth/20 text-earth/60 hover:text-earth hover:border-earth/40 font-mono text-xs uppercase tracking-widest"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Road fields: highway picker + start/end city pickers + note. Stays
// inside the LogPanel so "Road" behaves like any other type, same drawer.
function RoadFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  const [hwyQ, setHwyQ] = useState("");
  const hwyOpts = form.highway ? [] : searchHighways(hwyQ, 6);
  return (
    <div className="space-y-3">
      {/* Highway (optional) */}
      <div>
        <p className="label mb-2">Highway (optional)</p>
        {form.highway ? (
          <div className="flex items-center justify-between border border-earth/15 px-3 py-2 bg-parchment">
            <span className="font-serif text-earth">{form.highway.name}</span>
            <button
              onClick={() => {
                setForm((f) => ({ ...f, highway: null }));
                setHwyQ("");
              }}
              className="font-mono text-[10px] text-earth/50 hover:text-earth"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={hwyQ}
              onChange={(e) => setHwyQ(e.target.value)}
              placeholder="I-90, PCH, Hana Highway..."
              className="input-field"
              autoComplete="off"
            />
            {hwyOpts.length > 0 && hwyQ.length > 0 && (
              <div className="mt-1 border border-earth/10 bg-parchment divide-y divide-earth/5 max-h-40 overflow-y-auto">
                {hwyOpts.map((h) => (
                  <button
                    key={h.ref}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, highway: h }));
                      setHwyQ(h.name);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-amber/10 flex items-baseline justify-between"
                  >
                    <span className="font-mono text-sm text-earth">{h.name}</span>
                    <span className="font-mono text-[10px] text-earth/40 uppercase">
                      {h.category.replace("_", " ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Start + End */}
      <RoadCityPicker
        label="From *"
        value={form.roadStart}
        onSelect={(v) => setForm((f) => ({ ...f, roadStart: v }))}
      />
      <RoadCityPicker
        label="To *"
        value={form.roadEnd}
        onSelect={(v) => setForm((f) => ({ ...f, roadEnd: v }))}
      />

      {/* Note (road-local; date lives in shared date field below) */}
      <textarea
        placeholder="A line (optional) — drove back from college, windows down..."
        value={form.note}
        onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
        rows={2}
        className="input-field resize-none"
      />
    </div>
  );
}

function RoadCityPicker({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: { label: string; lat: number; lng: number } | null;
  onSelect: (v: { label: string; lat: number; lng: number } | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/places/search?q=${encodeURIComponent(v)}`);
      if (r.ok) {
        const raw = await r.json();
        // Endpoint returns { results: [...] }; be forgiving of either shape.
        const list: PlaceResult[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.results)
          ? raw.results
          : [];
        setResults(list.slice(0, 5));
      }
    } finally {
      setLoading(false);
    }
  }

  if (value) {
    return (
      <div>
        <p className="label mb-2">{label}</p>
        <div className="flex items-center justify-between border border-earth/15 px-3 py-2 bg-parchment">
          <span className="font-serif text-earth text-sm truncate">{value.label}</span>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQ("");
              setResults([]);
            }}
            className="font-mono text-[10px] text-earth/50 hover:text-earth shrink-0 ml-2"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="label mb-2">{label}</p>
      <input
        type="text"
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="City, town..."
        className="input-field"
        autoComplete="off"
      />
      {loading && (
        <p className="font-mono text-[10px] text-earth/40 mt-1">Searching...</p>
      )}
      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <p className="font-mono text-[10px] text-earth/40 mt-1">No matches. Try a different spelling.</p>
      )}
      {results.length > 0 && (
        <div className="mt-1 border border-earth/10 bg-parchment divide-y divide-earth/5 max-h-40 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                const region = (r.location || "").split(",")[0]?.trim();
                onSelect({
                  label: region ? `${r.name}, ${region}` : r.name,
                  lat: r.latitude,
                  lng: r.longitude,
                });
                setQ("");
                setResults([]);
              }}
              className="w-full text-left px-3 py-2 hover:bg-amber/10"
            >
              <p className="font-mono text-sm text-earth">{r.name}</p>
              {r.location && (
                <p className="font-mono text-xs text-earth/50 truncate">{r.location}</p>
              )}
            </button>
          ))}
        </div>
      )}
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
