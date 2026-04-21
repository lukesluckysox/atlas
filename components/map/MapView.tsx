"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Category colors — kept in sync with ExperienceMap legend
const CATEGORY_COLORS: Record<string, string> = {
  country: "#D4A843",        // amber
  national_park: "#7A8C6E",  // sage
  state: "#C17F5A",          // terracotta
  concert: "#8B5A9F",         // violet
  trail: "#4A7A5C",          // forest green
  moment: "#E8C47A",          // amber-light
  restaurant: "#A63D40",     // deep red
  stadium: "#3A5A7A",        // steel blue
  beach: "#3E7A8C",          // teal
  peak: "#6B6B6B",           // granite gray
  landmark: "#8B6F3F",       // bronze
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

function iconForType(type: string) {
  const color = CATEGORY_COLORS[type] || "#D4A843";
  return L.divIcon({
    html: `<div style="width:12px;height:12px;background:${color};border-radius:50%;border:2px solid #2C1810;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
    className: "",
    iconSize: [12, 12],
    iconAnchor: [6, 6],
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

export default function MapView({ experiences }: { experiences: Experience[] }) {
  const validExps = experiences.filter((e) => e.latitude && e.longitude);
  const center: [number, number] = validExps.length > 0
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
      {validExps.map((exp) => (
        <Marker
          key={exp.id}
          position={[exp.latitude!, exp.longitude!]}
          icon={iconForType(exp.type)}
        >
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
              {exp.location && <div style={{ color: "#888", marginTop: "4px" }}>{exp.location}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Re-export for use in the sidebar legend
export { CATEGORY_COLORS, CATEGORY_LABELS };
