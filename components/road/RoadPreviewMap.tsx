"use client";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

const startIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#7A8C6E;border:2px solid #F5F0E8;box-shadow:0 0 0 1px #2C1810;"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const endIcon = L.divIcon({
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#C17F5A;border:2px solid #F5F0E8;box-shadow:0 0 0 1px #2C1810;"></div>',
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface Endpoint {
  label: string;
  lat: number;
  lng: number;
}

function FitBounds({
  start,
  end,
  geometry,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
  geometry: { coordinates: [number, number][] } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (geometry?.coordinates?.length) {
      const latlngs = geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      map.fitBounds(latlngs, { padding: [40, 40] });
    } else if (start && end) {
      map.fitBounds(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        { padding: [60, 60] }
      );
    } else if (start) {
      map.setView([start.lat, start.lng], 6);
    } else if (end) {
      map.setView([end.lat, end.lng], 6);
    }
  }, [start, end, geometry, map]);
  return null;
}

export default function RoadPreviewMap({
  start,
  end,
  geometry,
}: {
  start: Endpoint | null;
  end: Endpoint | null;
  geometry: { type: "LineString"; coordinates: [number, number][] } | null;
}) {
  const center: [number, number] = start
    ? [start.lat, start.lng]
    : end
    ? [end.lat, end.lng]
    : [39.5, -98.35]; // US centroid
  const polyline: [number, number][] = geometry
    ? geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [];

  return (
    <MapContainer
      center={center}
      zoom={4}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <FitBounds start={start} end={end} geometry={geometry} />
      {start && <Marker position={[start.lat, start.lng]} icon={startIcon} />}
      {end && <Marker position={[end.lat, end.lng]} icon={endIcon} />}
      {polyline.length > 1 && (
        <Polyline
          positions={polyline}
          pathOptions={{ color: "#D4A843", weight: 4, opacity: 0.85 }}
        />
      )}
    </MapContainer>
  );
}
