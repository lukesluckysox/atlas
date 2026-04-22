"use client";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
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

interface Experience {
  id: string;
  name: string;
  type: string;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
}

export default function MapView({
  experiences,
  onDelete,
  selectedId,
  onSelect,
}: {
  experiences: Experience[];
  onDelete?: (id: string) => void;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
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
      <ZoomAwareLayer
        experiences={validExps}
        onDelete={onDelete}
        selectedId={selectedId ?? null}
        onSelect={onSelect}
      />
      <PanToSelected experiences={validExps} selectedId={selectedId ?? null} />
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
