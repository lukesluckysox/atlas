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

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Server missing MAPBOX_TOKEN" },
      { status: 500 }
    );
  }

  const coordStr = `${startLng},${startLat};${endLng},${endLat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&steps=false&access_token=${token}`;

  const r = await fetch(url);
  if (!r.ok) {
    return NextResponse.json(
      { error: `Mapbox ${r.status}` },
      { status: 502 }
    );
  }
  const data = (await r.json()) as { routes?: MapboxRoute[]; code?: string };
  if (!data.routes?.length) {
    return NextResponse.json(
      { error: "No route found between those points" },
      { status: 422 }
    );
  }

  const route = data.routes[0];
  const parsedRef = parseRefFromSummary(route.legs?.[0]?.summary);
  const distanceMi = route.distance / 1609.344;

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
      geometry: route.geometry as unknown as object,
      distanceMi: Math.round(distanceMi * 10) / 10,
      drivenAt: drivenAt ? new Date(drivenAt) : null,
      drivenNote: drivenNote?.trim() || null,
    },
  });

  return NextResponse.json(stretch);
}
