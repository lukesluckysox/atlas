import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public read-only endpoint. No auth. Returns a sanitized single trace
// keyed by (kind, shareSlug). Unknown kinds or slugs 404. We strip userId,
// email, and anything identifying beyond the author's display name.

async function resolveUser(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, name: true },
  });
  return u?.username || u?.name || "someone";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; slug: string }> }
) {
  const { kind, slug } = await params;

  try {
    if (kind === "track") {
      const p = await prisma.pairing.findUnique({ where: { shareSlug: slug } });
      if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
      const author = await resolveUser(p.userId);
      return NextResponse.json({
        kind: "track",
        author,
        photoUrl: p.photoUrl,
        albumArt: p.albumArt,
        trackName: p.trackName,
        artistName: p.artistName,
        caption: p.caption,
        note: p.note,
        location: p.location,
        weatherLabel: p.weatherLabel,
        weatherTemp: p.weatherTemp,
        moonPhase: p.moonPhase,
        createdAt: p.createdAt,
      });
    }
    if (kind === "path") {
      const e = await prisma.experience.findUnique({ where: { shareSlug: slug } });
      if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });
      const author = await resolveUser(e.userId);
      return NextResponse.json({
        kind: "path",
        author,
        type: e.type,
        name: e.name,
        location: e.location,
        latitude: e.latitude,
        longitude: e.longitude,
        date: e.date,
        note: e.note,
        photoUrl: e.photoUrl,
        weatherLabel: e.weatherLabel,
        weatherTemp: e.weatherTemp,
        moonPhase: e.moonPhase,
        createdAt: e.createdAt,
      });
    }
    if (kind === "moment") {
      const m = await prisma.mark.findUnique({ where: { shareSlug: slug } });
      if (!m) return NextResponse.json({ error: "not found" }, { status: 404 });
      const author = await resolveUser(m.userId);
      return NextResponse.json({
        kind: "moment",
        author,
        content: m.content,
        keyword: m.keyword,
        summary: m.summary,
        photoUrl: m.photoUrl,
        weatherLabel: m.weatherLabel,
        weatherTemp: m.weatherTemp,
        moonPhase: m.moonPhase,
        createdAt: m.createdAt,
      });
    }
    if (kind === "encounter") {
      const enc = await prisma.encounter.findUnique({ where: { shareSlug: slug } });
      if (!enc) return NextResponse.json({ error: "not found" }, { status: 404 });
      // Encounters only share when the user has answered.
      if (!enc.answer) {
        return NextResponse.json({ error: "not shareable" }, { status: 404 });
      }
      const author = await resolveUser(enc.userId);
      return NextResponse.json({
        kind: "encounter",
        author,
        question: enc.question,
        answer: enc.answer,
        date: enc.date,
        landed: enc.landed,
      });
    }
    return NextResponse.json({ error: "unknown kind" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
