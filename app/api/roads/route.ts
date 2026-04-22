import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface MapboxRoute {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distance: number; // meters
  legs: Array<{ summary?: string }>;
}

// Normalize Mapbox summary strings like "I 90, I 82" -> "I-90"
function parseRefFromSummary(summary: string | undefined): string | null {
  if (!summary) return null;
  const first = summary.split(",")[0].trim();
  // Collapse internal whitespace: "I 90" -> "I-90", "US 101" -> "US-101"
  const m = first.match(/^([A-Z]+)\s*[-]?\s*(\d+[A-Z]?)/i);
  if (m) return `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
  return first || null;
}

function categoryFromRef(ref: string | null): string | null {
  if (!ref) return null;
  const up = ref.toUpperCase();
  if (up.startsWith("I-") || up.startsWith("H-")) return "interstate";
  if (up.startsWith("US-")) return "us_route";
  if (/^[A-Z]{2}-/.test(up)) return "state";
  return "scenic";
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roads = await prisma.highwayStretch.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(roads);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    startLabel,
    endLabel,
    startLat,
    startLng,
    endLat,
    endLng,
    drivenAt,
    drivenNote,
    category: categoryHint,
  } = body as {
    name?: string;
    startLabel: string;
    endLabel: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    drivenAt?: string;
    drivenNote?: string;
    category?: string;
  };

  if (!startLabel || !endLabel) {
    return NextResponse.json({ error: "Start and end required" }, { status: 400 });
  }
  if (
    typeof startLat !== "number" ||
    typeof startLng !== "number" ||
    typeof endLat !== "number" ||
    typeof endLng !== "number"
  ) {
    return NextResponse.json({ error: "Coordinates required" }, { status: 400 });
  }

  // Try Mapbox Directions for the real road geometry. If the token is missing
  // or the call fails, fall back to a straight-line so the entry still saves.
  const token = process.env.MAPBOX_TOKEN;
  let geometry: { type: "LineString"; coordinates: [number, number][] } = {
    type: "LineString",
    coordinates: [[startLng, startLat], [endLng, endLat]],
  };
  let parsedRef: string | null = null;
  // Haversine fallback for distance (miles).
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(endLat - startLat);
  const dLng = toRad(endLng - startLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(startLat)) * Math.cos(toRad(endLat)) * Math.sin(dLng / 2) ** 2;
  let distanceMi = 2 * R * Math.asin(Math.sqrt(a));
  let usedFallback = !token;

  if (token) {
    const coordStr = `${startLng},${startLat};${endLng},${endLat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&steps=false&access_token=${token}`;
    try {
      const r = await fetch(url);
      if (r.ok) {
        const data = (await r.json()) as { routes?: MapboxRoute[]; code?: string };
        if (data.routes?.length) {
          const route = data.routes[0];
          geometry = route.geometry;
          parsedRef = parseRefFromSummary(route.legs?.[0]?.summary);
          distanceMi = route.distance / 1609.344;
        } else {
          usedFallback = true;
        }
      } else {
        console.error("[roads] mapbox non-200:", r.status);
        usedFallback = true;
      }
    } catch (err) {
      console.error("[roads] mapbox fetch failed:", err);
      usedFallback = true;
    }
  }

  // Prefer user-supplied name, fall back to parsed summary
  const finalName = name?.trim() || (parsedRef ? `${parsedRef}: ${startLabel} → ${endLabel}` : `${startLabel} → ${endLabel}`);
  const finalRef = parsedRef || (name ? name.trim() : null);
  const finalCategory = categoryHint || categoryFromRef(finalRef);

  const stretch = await prisma.highwayStretch.create({
    data: {
      userId: session.user.id,
      name: finalName,
      ref: finalRef,
      category: finalCategory,
      startLabel,
      endLabel,
      startLat,
      startLng,
      endLat,
      endLng,
      geometry: geometry as unknown as object,
      distanceMi: Math.round(distanceMi * 10) / 10,
      drivenAt: drivenAt ? new Date(drivenAt) : null,
      drivenNote: drivenNote?.trim() || null,
    },
  });

  return NextResponse.json({ ...stretch, usedFallback });
}
