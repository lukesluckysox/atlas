import { NextRequest, NextResponse } from "next/server";

/**
 * Reverse geocode: lat/lng -> human label.
 * Thin proxy over Nominatim so we can own the User-Agent header and
 * keep the client free of CORS quirks.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return NextResponse.json({ error: "invalid coords" }, { status: 400 });
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lngNum}&zoom=14&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Trace (https://atlas-production-df1b.up.railway.app)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) {
      return NextResponse.json({ label: null, location: null }, { status: 200 });
    }
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };

    // Prefer "City, State, Country" shape; fall back to display_name.
    const a = data.address ?? {};
    const city = a.city || a.town || a.village || a.hamlet || a.municipality || a.suburb;
    const state = a.state || a.region;
    const country = a.country;
    const parts = [city, state, country].filter(Boolean);
    const label = parts.length ? parts.join(", ") : data.display_name ?? null;

    return NextResponse.json({
      label,
      display_name: data.display_name ?? null,
      city: city ?? null,
      state: state ?? null,
      country: country ?? null,
    });
  } catch (err) {
    console.error("[places/reverse] error:", err);
    return NextResponse.json({ label: null }, { status: 200 });
  }
}
