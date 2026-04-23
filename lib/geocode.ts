// Free geocoding via Nominatim (OpenStreetMap). No key required.
// Rate-limit policy: max 1 req/sec, User-Agent required.
// https://operations.osmfoundation.org/policies/nominatim/
//
// Never throws. Returns null on any failure.

export type GeocodeHit = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function geocode(query: string): Promise<GeocodeHit | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      q
    )}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Trace/1.0 (trace-journal)",
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const first = arr[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: first.display_name };
  } catch {
    return null;
  }
}
