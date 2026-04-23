"use client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Polygon,
  useMap,
  useMapEvents,
  CircleMarker,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

// Category colors — kept in sync with ExperienceMap legend
const CATEGORY_COLORS: Record<string, string> = {
  country: "#D4A843",
  national_park: "#7A8C6E",
  state: "#C17F5A",
  concert: "#8B5A9F",
  trail: "#4A7A5C",
  moment: "#E8C47A",
  restaurant: "#A63D40",
  stadium: "#3A5A7A",
  beach: "#3E7A8C",
  peak: "#6B6B6B",
  landmark: "#8B6F3F",
  notice: "#C17F5A",
};

const CATEGORY_LABELS: Record<string, string> = {
  country: "Country",
  national_park: "National Park",
  state: "State",
  concert: "Concert",
  trail: "Trail",
  moment: "Moment",
  restaurant: "Restaurant",
  stadium: "Stadium",
  beach: "Beach",
  peak: "Peak",
  landmark: "Landmark",
  notice: "Moment",
};

// Categories kept visible at mid zoom. Everything else fades to tiny pips.
const PRIORITY_TYPES = new Set([
  "concert",
  "stadium",
  "landmark",
  "peak",
  "country",
]);

function iconForType(type: string, opts?: { selected?: boolean; faded?: boolean }) {
  const color = CATEGORY_COLORS[type] || "#D4A843";
  const size = opts?.selected ? 18 : opts?.faded ? 6 : 12;
  const border = opts?.selected ? "3px solid #2C1810" : "2px solid #2C1810";
  const ring = opts?.selected
    ? "box-shadow: 0 0 0 4px rgba(212, 168, 67, 0.35), 0 1px 3px rgba(0,0,0,0.3);"
    : "box-shadow: 0 1px 3px rgba(0,0,0,0.3);";
  const opacity = opts?.faded ? 0.55 : 1;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:${border};${ring};opacity:${opacity};"></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type BoundaryGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

interface Experience {
  id: string;
  name: string;
  type: string;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  boundary?: BoundaryGeometry | null;
}

interface RoadStretch {
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

const ROAD_COLORS: Record<string, string> = {
  interstate: "#D4A843",
  us_route: "#C17F5A",
  state: "#7A8C6E",
  scenic: "#8B5A9F",
};

export default function MapView({
  experiences,
  onDelete,
  selectedId,
  onSelect,
  onLongPress,
  roads = [],
  selectedRoadId,
  onSelectRoad,
  onDeleteRoad,
  draftMarker,
}: {
  experiences: Experience[];
  onDelete?: (id: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onLongPress?: (lat: number, lng: number) => void;
  roads?: RoadStretch[];
  selectedRoadId?: string | null;
  onSelectRoad?: (id: string | null) => void;
  onDeleteRoad?: (id: string) => void;
  draftMarker?: { lat: number; lng: number; label?: string } | null;
}) {
  const validExps = experiences.filter((e) => e.latitude && e.longitude);
  const center: [number, number] =
    validExps.length > 0
      ? [validExps[0].latitude!, validExps[0].longitude!]
      : [20, 0];

  return (
    <MapContainer
      center={center}
      zoom={validExps.length > 0 ? 4 : 2}
      style={{ height: "100%", width: "100%", background: "#F5F0E8" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {/* Border polygons for state/country entries — render first so pins + roads sit above */}
      {experiences.flatMap((e) => {
        if (!e.boundary) return [];
        const key = `boundary-${e.id}`;
        const pathOpts = {
          color: "#D4A843",
          weight: 1,
          opacity: 0.9,
          fillColor: "#D4A843",
          fillOpacity: 0.15,
        };
        if (e.boundary.type === "Polygon") {
          const rings = e.boundary.coordinates.map((ring) =>
            ring.map(([lng, lat]) => [lat, lng] as [number, number])
          );
          return [<Polygon key={key} positions={rings} pathOptions={pathOpts} />];
        }
        // MultiPolygon — one <Polygon> per part
        return e.boundary.coordinates.map((poly, i) => {
          const rings = poly.map((ring) =>
            ring.map(([lng, lat]) => [lat, lng] as [number, number])
          );
          return <Polygon key={`${key}-${i}`} positions={rings} pathOptions={pathOpts} />;
        });
      })}
      <ZoomAwareLayer
        experiences={validExps}
        onDelete={onDelete}
        selectedId={selectedId ?? null}
        onSelect={onSelect}
      />
      {roads.map((r) => {
        const positions = r.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number]
        );
        const color = ROAD_COLORS[r.category || "scenic"] || "#D4A843";
        const active = selectedRoadId === r.id;
        return (
          <Polyline
            key={r.id}
            positions={positions}
            pathOptions={{
              color,
              weight: active ? 6 : 4,
              opacity: active ? 0.95 : 0.75,
            }}
            eventHandlers={{
              click: () => onSelectRoad?.(r.id),
            }}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontFamily: "serif", fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  {r.name}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#6b6056", marginBottom: 6 }}>
                  {r.distanceMi} mi{r.drivenAt ? ` · ${new Date(r.drivenAt).getFullYear()}` : ""}
                </div>
                {r.drivenNote && (
                  <div style={{ fontFamily: "serif", fontSize: 12, fontStyle: "italic", color: "#4a4036", borderLeft: "2px solid #D4A843", paddingLeft: 8, marginBottom: 6 }}>
                    {r.drivenNote}
                  </div>
                )}
                {onDeleteRoad && (
                  <button
                    onClick={() => onDeleteRoad(r.id)}
                    style={{ fontFamily: "monospace", fontSize: 10, color: "#A63D40", textTransform: "uppercase", letterSpacing: 1, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </Popup>
          </Polyline>
        );
      })}
      <PanToSelected experiences={validExps} selectedId={selectedId ?? null} />
      <FitToRoad roads={roads} selectedRoadId={selectedRoadId ?? null} />
      {draftMarker && <DraftPin marker={draftMarker} />}
      {onLongPress && <LongPressCatcher onFire={onLongPress} />}
    </MapContainer>
  );
}

/**
 * Reacts to zoom level and switches between three presentations:
 *   - z <= 5 : grid clusters; each cluster sized by count, colored by dominant category
 *   - z 6-9 : priority categories full size, others faded small pips (low-clutter)
 *   - z >= 10: everything full, with hover tooltips for names
 */
function ZoomAwareLayer({
  experiences,
  onDelete,
  selectedId,
  onSelect,
}: {
  experiences: Experience[];
  onDelete?: (id: string) => void;
  selectedId: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState<number>(map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  // Cluster view for wide zooms
  if (zoom <= 5) {
    const clusters = clusterByGrid(experiences, zoom);
    return (
      <>
        {clusters.map((c) => (
          <ClusterMarker
            key={c.key}
            lat={c.lat}
            lng={c.lng}
            count={c.items.length}
            dominantType={c.dominantType}
            onClick={() => {
              map.flyTo([c.lat, c.lng], Math.min(zoom + 3, 11), { duration: 0.6 });
            }}
          />
        ))}
      </>
    );
  }

  // Detail view
  return (
    <>
      {experiences.map((exp) => {
        const selected = selectedId === exp.id;
        const faded = zoom <= 9 && !PRIORITY_TYPES.has(exp.type) && !selected;
        return (
          <ExperienceMarker
            key={exp.id}
            experience={exp}
            icon={iconForType(exp.type, { selected, faded })}
            selected={selected}
            faded={faded}
            onSelect={onSelect}
            onDelete={onDelete}
            showLabel={zoom >= 10}
          />
        );
      })}
    </>
  );
}

function ExperienceMarker({
  experience: exp,
  icon,
  selected,
  faded,
  onSelect,
  onDelete,
  showLabel,
}: {
  experience: Experience;
  icon: L.DivIcon;
  selected: boolean;
  faded: boolean;
  onSelect?: (id: string | null) => void;
  onDelete?: (id: string) => void;
  showLabel: boolean;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  // When this marker becomes the selected one from outside, open its popup.
  useEffect(() => {
    if (selected && markerRef.current) {
      markerRef.current.openPopup();
    }
  }, [selected]);

  return (
    <Marker
      position={[exp.latitude!, exp.longitude!]}
      icon={icon}
      ref={(ref) => {
        markerRef.current = ref;
      }}
      eventHandlers={{
        click: () => onSelect?.(exp.id),
        popupclose: () => {
          if (selected) onSelect?.(null);
        },
      }}
    >
      {showLabel && !faded && (
        <Tooltip direction="top" offset={[0, -8]} opacity={0.9} permanent={false}>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10 }}>
            {exp.name}
          </span>
        </Tooltip>
      )}
      <Popup>
        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "12px", minWidth: "160px" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: "9px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "2px 6px",
              background: CATEGORY_COLORS[exp.type] || "#D4A843",
              color: "#2C1810",
              marginBottom: "6px",
            }}
          >
            {CATEGORY_LABELS[exp.type] || exp.type}
          </div>
          <div><strong>{exp.name}</strong></div>
          {exp.location && (
            <div style={{ color: "#888", marginTop: "4px" }}>{exp.location}</div>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(exp.id)}
              style={{
                marginTop: "8px",
                fontFamily: "IBM Plex Mono, monospace",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#C17F5A",
                background: "transparent",
                border: "1px solid #C17F5A",
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * Long-press / right-click catcher. Leaflet fires `contextmenu` for both
 * right-click on desktop and long-press on touch devices (its tap handler
 * promotes a sustained touch into a contextmenu event). We also implement
 * a manual touch-hold fallback so it works even when Leaflet's tap shim is
 * disabled on pinch-zoom gestures.
 */
function LongPressCatcher({ onFire }: { onFire: (lat: number, lng: number) => void }) {
  const map = useMap();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  useMapEvents({
    contextmenu: (e) => {
      // Prevent browser's default right-click menu
      (e.originalEvent as MouseEvent).preventDefault();
      onFire(e.latlng.lat, e.latlng.lng);
    },
  });

  // Touch-hold fallback (~550ms, <12px movement)
  useEffect(() => {
    const container = map.getContainer();
    const onTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      const t = ev.touches[0];
      startPt.current = { x: t.clientX, y: t.clientY };
      holdTimer.current = setTimeout(() => {
        if (!startPt.current) return;
        const rect = container.getBoundingClientRect();
        const x = startPt.current.x - rect.left;
        const y = startPt.current.y - rect.top;
        const latlng = map.containerPointToLatLng([x, y]);
        onFire(latlng.lat, latlng.lng);
        startPt.current = null;
      }, 550);
    };
    const cancel = (ev?: TouchEvent) => {
      if (ev && ev.touches.length === 1 && startPt.current) {
        const t = ev.touches[0];
        const dx = t.clientX - startPt.current.x;
        const dy = t.clientY - startPt.current.y;
        if (dx * dx + dy * dy < 144) return; // <12px movement — keep timer
      }
      if (holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      startPt.current = null;
    };
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", cancel, { passive: true });
    container.addEventListener("touchend", cancel as EventListener);
    container.addEventListener("touchcancel", cancel as EventListener);
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", cancel);
      container.removeEventListener("touchend", cancel as EventListener);
      container.removeEventListener("touchcancel", cancel as EventListener);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, [map, onFire]);

  return null;
}

/**
 * Draft pin — rendered while the user is drafting a Path (e.g. after a
 * ticket upload auto-geocodes). Pulses amber so it's obvious it's unsaved.
 * Flies the map to it the moment it appears or moves.
 */
function DraftPin({
  marker,
}: {
  marker: { lat: number; lng: number; label?: string };
}) {
  const map = useMap();
  useEffect(() => {
    const targetZoom = Math.max(map.getZoom(), 12);
    map.flyTo([marker.lat, marker.lng], targetZoom, { duration: 0.8 });
  }, [marker.lat, marker.lng, map]);

  const icon = L.divIcon({
    html: `<div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;background:#D4A843;border-radius:50%;border:3px solid #2C1810;box-shadow:0 0 0 6px rgba(212,168,67,0.3),0 2px 6px rgba(0,0,0,0.35);animation:pulse 1.6s ease-in-out infinite;"></div>
    </div>
    <style>@keyframes pulse{0%,100%{box-shadow:0 0 0 6px rgba(212,168,67,0.3),0 2px 6px rgba(0,0,0,0.35)}50%{box-shadow:0 0 0 14px rgba(212,168,67,0),0 2px 6px rgba(0,0,0,0.35)}}</style>`,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

  return (
    <Marker position={[marker.lat, marker.lng]} icon={icon}>
      {marker.label && (
        <Tooltip direction="top" offset={[0, -8]} permanent>
          {marker.label}
        </Tooltip>
      )}
    </Marker>
  );
}

/**
 * Pan/zoom to the selected experience. Separate component because
 * react-leaflet hooks must live inside MapContainer.
 */
function PanToSelected({
  experiences,
  selectedId,
}: {
  experiences: Experience[];
  selectedId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const exp = experiences.find((e) => e.id === selectedId);
    if (!exp || !exp.latitude || !exp.longitude) return;
    const targetZoom = Math.max(map.getZoom(), 10);
    map.flyTo([exp.latitude, exp.longitude], targetZoom, { duration: 0.6 });
  }, [selectedId, experiences, map]);
  return null;
}

function FitToRoad({
  roads,
  selectedRoadId,
}: {
  roads: RoadStretch[];
  selectedRoadId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedRoadId) return;
    const r = roads.find((x) => x.id === selectedRoadId);
    if (!r || !r.geometry?.coordinates?.length) return;
    const coords = r.geometry.coordinates;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lng, lat] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    if (!isFinite(minLat)) return;
    map.flyToBounds(
      [[minLat, minLng], [maxLat, maxLng]],
      { padding: [40, 40], duration: 0.6, maxZoom: 10 }
    );
  }, [selectedRoadId, roads, map]);
  return null;
}

// ---------- Grid clustering for low zoom ----------

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  items: Experience[];
  dominantType: string;
}

/**
 * Cheap deterministic grid cluster: snap coordinates to a grid whose size
 * depends on zoom. Fast (O(n)) and stable across renders.
 */
function clusterByGrid(experiences: Experience[], zoom: number): Cluster[] {
  // Grid size in degrees. Looser at wide zoom, tighter as we approach z6.
  const step = zoom <= 2 ? 20 : zoom <= 3 ? 12 : zoom <= 4 ? 6 : 3;
  const buckets = new Map<string, Experience[]>();
  for (const exp of experiences) {
    if (exp.latitude == null || exp.longitude == null) continue;
    const lat = Math.round(exp.latitude / step) * step;
    const lng = Math.round(exp.longitude / step) * step;
    const key = `${lat}_${lng}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(exp);
  }
  return Array.from(buckets.entries()).map(([key, items]) => {
    const lat = items.reduce((s, e) => s + e.latitude!, 0) / items.length;
    const lng = items.reduce((s, e) => s + e.longitude!, 0) / items.length;
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
    const dominantType = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "moment";
    return { key, lat, lng, items, dominantType };
  });
}

function ClusterMarker({
  lat,
  lng,
  count,
  dominantType,
  onClick,
}: {
  lat: number;
  lng: number;
  count: number;
  dominantType: string;
  onClick: () => void;
}) {
  const color = CATEGORY_COLORS[dominantType] ?? "#D4A843";
  // Radius grows with count, capped.
  const radius = Math.min(10 + Math.sqrt(count) * 3, 28);
  return (
    <>
      <CircleMarker
        center={[lat, lng]}
        radius={radius}
        pathOptions={{
          color: "#2C1810",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.82,
        }}
        eventHandlers={{ click: onClick }}
      >
        <Tooltip direction="top" offset={[0, -radius]} opacity={0.95} permanent={count >= 3}>
          <span
            style={{
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {count}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

// Re-export for use in the sidebar legend
export { CATEGORY_COLORS, CATEGORY_LABELS };
