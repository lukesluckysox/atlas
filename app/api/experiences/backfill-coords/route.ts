import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocode } from "@/lib/geocode";

// One-shot backfill: find this user's experiences missing coords,
// geocode by location or name, update. Polite to Nominatim (1/sec).
//
// Trigger from Settings once; idempotent so re-running does nothing new.

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const missing = await prisma.experience.findMany({
      where: {
        userId: session.user.id,
        OR: [{ latitude: null }, { longitude: null }],
      },
      select: { id: true, name: true, location: true, type: true },
      take: 100,
    });

    let updated = 0;
    let skipped = 0;
    for (const e of missing) {
      // For concerts, location is stored as "Venue, City". Try venue alone
      // first — most specific — then the full string, then the name.
      const queries: string[] = [];
      const add = (q?: string | null) => {
        const v = (q ?? "").trim();
        if (v && !queries.includes(v)) queries.push(v);
      };
      if (e.location && e.location.includes(",")) {
        const [venuePart] = e.location.split(",");
        add(venuePart);
      }
      add(e.location);
      add(e.name);
      let hit = null as { lat: number; lng: number } | null;
      for (const q of queries) {
        const h = await geocode(q);
        if (h) {
          hit = { lat: h.lat, lng: h.lng };
          break;
        }
      }
      if (hit) {
        await prisma.experience.update({
          where: { id: e.id },
          data: { latitude: hit.lat, longitude: hit.lng },
        });
        updated++;
      } else {
        skipped++;
      }
      // Nominatim fair-use: ~1 request per second.
      await new Promise((r) => setTimeout(r, 1100));
    }

    return NextResponse.json({
      checked: missing.length,
      updated,
      skipped,
      remaining: Math.max(0, missing.length - updated - skipped),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `backfill failed: ${msg}` }, { status: 500 });
  }
}
