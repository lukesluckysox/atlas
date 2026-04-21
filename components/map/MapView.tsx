"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.divIcon({
  html: `<div style="width:10px;height:10px;background:#D4A843;border-radius:50%;border:2px solid #2C1810;"></div>`,
  className: "",
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

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
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {validExps.map((exp) => (
        <Marker
          key={exp.id}
          position={[exp.latitude!, exp.longitude!]}
          icon={markerIcon}
        >
          <Popup>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "12px" }}>
              <strong>{exp.name}</strong>
              {exp.location && <div style={{ color: "#888", marginTop: "4px" }}>{exp.location}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
