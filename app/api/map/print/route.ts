import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * High-res static map export via Mapbox Static Images API.
 * Pro-only. Renders user's path experiences + tracks pins on a single image.
 *
 * Mapbox Static Images caps overlays at ~100 markers and URL length at 8192
 * chars, so we cap to the 80 most significant markers to stay well under.
 *
 * Query params:
 *   width=1200 (max 1280 per Mapbox limit)
 *   height=900 (max 1280)
 *   style=outdoors|streets|satellite (default outdoors)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-read isPro (stale JWT protection).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });
  if (!user?.isPro) {
    return NextResponse.json({ error: "Pro required" }, { status: 402 });
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Map export unavailable (MAPBOX_TOKEN missing)" },
      { status: 503 }
    );
  }

  const url = new URL(req.url);
  const width = clamp(parseInt(url.searchParams.get("width") ?? "1200", 10), 300, 1280);
  const height = clamp(parseInt(url.searchParams.get("height") ?? "900", 10), 300, 1280);
  const rawStyle = url.searchParams.get("style") ?? "outdoors";
  const style = STYLE_MAP[rawStyle] ?? STYLE_MAP.outdoors;

  // Pull everything pinned on the user's map. Experiences with coords + pairings
  // with coords. Cap to prevent URL overflow.
  const [experiences, pairings] = await Promise.all([
    prisma.experience.findMany({
      where: { userId: session.user.id, latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true, type: true },
      orderBy: { date: "desc" },
      take: 60,
    }),
    prisma.pairing.findMany({
      where: { userId: session.user.id, latitude: { not: null }, longitude: { not: null } },
      select: { id: true, latitude: true, longitude: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (experiences.length + pairings.length === 0) {
    return NextResponse.json(
      { error: "No mapped traces yet. Add locations to your path first." },
      { status: 400 }
    );
  }

  // Build overlay string. Mapbox markers format: pin-s-<label>+<color>(lon,lat)
  // Colors (hex without #): amber D4A843, sage 7A8C6E, terracotta C17F5A.
  const markers: string[] = [];
  for (const e of experiences) {
    const color = TYPE_COLORS[e.type] ?? "D4A843";
    markers.push(`pin-s+${color}(${e.longitude!.toFixed(5)},${e.latitude!.toFixed(5)})`);
  }
  for (const p of pairings) {
    markers.push(`pin-s+8B5A9F(${p.longitude!.toFixed(5)},${p.latitude!.toFixed(5)})`);
  }

  // "auto" tells Mapbox to fit bounds to the overlays.
  const overlay = markers.join(",");
  const mapboxUrl =
    `https://api.mapbox.com/styles/v1/${style}/static/${overlay}/auto/${width}x${height}@2x` +
    `?access_token=${encodeURIComponent(token)}&padding=60`;

  // If URL would overflow Mapbox's 8192 cap, drop oldest until it fits.
  let finalUrl = mapboxUrl;
  let trimmed = [...markers];
  while (finalUrl.length > 8000 && trimmed.length > 10) {
    trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.8));
    finalUrl =
      `https://api.mapbox.com/styles/v1/${style}/static/${trimmed.join(",")}/auto/${width}x${height}@2x` +
      `?access_token=${encodeURIComponent(token)}&padding=60`;
  }

  // Fetch and stream back as image/png so the browser can download it.
  let res: Response;
  try {
    res = await fetch(finalUrl);
  } catch {
    return NextResponse.json({ error: "Map service unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Map service error (${res.status})`, detail: body.slice(0, 200) },
      { status: 502 }
    );
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="trace-map-${Date.now()}.png"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

const STYLE_MAP: Record<string, string> = {
  outdoors: "mapbox/outdoors-v12",
  streets: "mapbox/streets-v12",
  satellite: "mapbox/satellite-streets-v12",
  light: "mapbox/light-v11",
};

// Align with ExperienceMap category colors (hex without #).
const TYPE_COLORS: Record<string, string> = {
  country: "D4A843",
  national_park: "7A8C6E",
  state: "C17F5A",
  concert: "8B5A9F",
  trail: "4A7A5C",
  restaurant: "A63D40",
  stadium: "3A5A7A",
  beach: "3E7A8C",
  peak: "6B6B6B",
  landmark: "8B6F3F",
};
