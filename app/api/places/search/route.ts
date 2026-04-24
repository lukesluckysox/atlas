import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Place autocomplete via OpenStreetMap Nominatim.
 * Free, keyless — but requires a descriptive User-Agent per their policy.
 *
 * Query params:
 *   q    - search string (required)
 *   type - one of: country | national_park | state | concert | trail | moment
 *          Narrows the results via Nominatim's class/type filters when useful.
 */

type ExperienceType =
  | "country"
  | "national_park"
  | "state"
  | "city"
  | "concert"
  | "trail"
  | "moment"
  | "restaurant"
  | "stadium"
  | "beach"
  | "peak"
  | "landmark";

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  addresstype?: string;
}

interface PlaceSuggestion {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  kind: string;
}

/** Per-type hints that bias Nominatim toward the right results. */
function buildQuery(rawQ: string, type: ExperienceType | null): string {
  const q = rawQ.trim();
  if (!type) return q;

  // Light hints — don't force if user is specific already.
  switch (type) {
    case "national_park":
      return q.toLowerCase().includes("national park") ? q : `${q} national park`;
    case "stadium":
      return /stadium|arena|field|park|coliseum/i.test(q) ? q : `${q} stadium`;
    case "peak":
      return /mount|mt |peak|summit/i.test(q) ? q : `Mount ${q}`;
    case "beach":
      return /beach|coast|shore/i.test(q) ? q : `${q} beach`;
    case "country":
    case "state":
    case "city":
    case "trail":
    case "concert":
    case "moment":
    case "restaurant":
    case "landmark":
    default:
      return q;
  }
}

/** Build the Nominatim URL with sensible filters. */
function buildUrl(q: string, type: ExperienceType | null): string {
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "8",
    addressdetails: "1",
  });

  if (type === "country") {
    params.set("featuretype", "country");
  } else if (type === "state") {
    params.set("featuretype", "state");
  } else if (type === "city") {
    // Bias toward populated places for concert-city lookups and the
    // road start/end pickers. Nominatim's "city" featuretype is a useful
    // hint but not exclusive — smaller towns still come through.
    params.set("featuretype", "city");
  }

  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get("q") || "";
  if (rawQ.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const type = (searchParams.get("type") as ExperienceType | null) || null;
  const q = buildQuery(rawQ, type);
  const url = buildUrl(q, type);

  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim requires a UA identifying the app.
        "User-Agent": "Trace (https://atlas-production-df1b.up.railway.app)",
        "Accept-Language": "en",
      },
      // Soft cache so we don't hammer the free service.
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("[places] nominatim non-200:", res.status);
      return NextResponse.json({ results: [] });
    }

    const raw = (await res.json()) as NominatimResult[];

    const results: PlaceSuggestion[] = raw
      .filter((r) => r.display_name && r.lat && r.lon)
      .map((r) => {
        // First component of display_name is usually the clean name.
        const parts = r.display_name.split(",").map((p) => p.trim());
        const name = r.name || parts[0];
        const location = parts.slice(1).join(", ");
        return {
          id: String(r.place_id),
          name,
          location,
          latitude: parseFloat(r.lat),
          longitude: parseFloat(r.lon),
          kind: r.type || r.class || r.addresstype || "place",
        };
      });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[places] fetch failed:", err);
    return NextResponse.json({ results: [] });
  }
}
