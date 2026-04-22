import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Mood backfill: returns photo URLs that don't yet have (lum, warmth) computed.
 * The mosaic client samples them in the browser and PATCHes the result back.
 *
 *  GET  -> { pending: [{ kind, id, url }] }
 *  PATCH body: { updates: [{ kind, id, lum, warmth }] }
 */

type Kind = "pairing" | "experience" | "mark";

interface Pending {
  kind: Kind;
  id: string;
  url: string;
}

const BATCH = 40;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Each model: rows with a photoUrl but null lum.
  const [pairings, experiences, marks] = await Promise.all([
    prisma.pairing.findMany({
      where: { userId, photoLum: null },
      select: { id: true, photoUrl: true },
      take: BATCH,
      orderBy: { createdAt: "desc" },
    }),
    prisma.experience.findMany({
      where: { userId, photoLum: null, photoUrl: { not: null } },
      select: { id: true, photoUrl: true },
      take: BATCH,
      orderBy: { createdAt: "desc" },
    }),
    prisma.mark.findMany({
      where: { userId, photoLum: null, photoUrl: { not: null } },
      select: { id: true, photoUrl: true },
      take: BATCH,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pending: Pending[] = [
    ...pairings.map((p) => ({ kind: "pairing" as const, id: p.id, url: p.photoUrl })),
    ...experiences
      .filter((e) => e.photoUrl)
      .map((e) => ({ kind: "experience" as const, id: e.id, url: e.photoUrl as string })),
    ...marks
      .filter((m) => m.photoUrl)
      .map((m) => ({ kind: "mark" as const, id: m.id, url: m.photoUrl as string })),
  ];

  return NextResponse.json({ pending });
}

interface Update {
  kind: Kind;
  id: string;
  lum: number;
  warmth: number;
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const updates: Update[] = Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  let updated = 0;
  for (const u of updates) {
    if (
      !u ||
      typeof u.id !== "string" ||
      typeof u.lum !== "number" ||
      typeof u.warmth !== "number" ||
      !Number.isFinite(u.lum) ||
      !Number.isFinite(u.warmth)
    ) {
      continue;
    }
    const lum = clamp01(u.lum);
    const warmth = clamp01(u.warmth);

    try {
      if (u.kind === "pairing") {
        const r = await prisma.pairing.updateMany({
          where: { id: u.id, userId },
          data: { photoLum: lum, photoWarmth: warmth },
        });
        updated += r.count;
      } else if (u.kind === "experience") {
        const r = await prisma.experience.updateMany({
          where: { id: u.id, userId },
          data: { photoLum: lum, photoWarmth: warmth },
        });
        updated += r.count;
      } else if (u.kind === "mark") {
        const r = await prisma.mark.updateMany({
          where: { id: u.id, userId },
          data: { photoLum: lum, photoWarmth: warmth },
        });
        updated += r.count;
      }
    } catch {
      // skip bad rows, keep going
    }
  }

  return NextResponse.json({ updated });
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
