import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Export every trace the user owns, as JSON. This is the trust signal that
// their data isn't trapped. Served with Content-Disposition so the browser
// downloads it. Sensitive fields (shareSlug, internal ids) are preserved
// because it's the user's own data \u2014 they get everything.
//
// ?format=json (default) \u2014 streamed JSON object
// ?format=pdf            \u2014 delegated to /api/export/pdf

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();

  // For now we only implement JSON at this route. PDF has its own route so it
  // can set different headers and reuse server-side PDF rendering.
  if (format !== "json") {
    return NextResponse.json({ error: "Use /api/export/pdf for pdf" }, { status: 400 });
  }

  const [user, pairings, experiences, marks, encounters, collections, roads] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true, name: true, createdAt: true, isPro: true },
      }),
      prisma.pairing.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.experience.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.mark.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.encounter.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.collection.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.highwayStretch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    app: "Trace",
    user,
    counts: {
      tracks: pairings.length,
      paths: experiences.length,
      moments: marks.length,
      encounters: encounters.length,
      collections: collections.length,
      roads: roads.length,
    },
    tracks: pairings,
    paths: experiences,
    moments: marks,
    encounters,
    collections,
    roads,
  };

  const body = JSON.stringify(payload, null, 2);
  const filename = `trace-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
