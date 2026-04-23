import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns all traces across all 4 kinds from prior years where
// month+day matches today. Excludes this calendar year. Ordered by year desc.
// Used by the home dashboard "On this day" rail.

export const dynamic = "force-dynamic";

type UnifiedItem = {
  id: string;
  kind: "tracks" | "path" | "notice" | "encounter";
  createdAt: Date;
  yearsAgo: number;
  preview: string;
  photoUrl: string | null;
  shareSlug: string | null;
};

function yearsAgo(d: Date, now: Date): number {
  return now.getFullYear() - d.getFullYear();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const thisYear = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const d = now.getDate();

  // We fetch a cheap superset, then filter in JS. This avoids Postgres
  // DATE_PART raw SQL and keeps the prisma layer simple. The filter is
  // cheap because we only pull last 10 years of user data ordered by date.
  const sinceCutoff = new Date(thisYear - 10, 0, 1);

  const [pairings, experiences, marks, encounters] = await Promise.all([
    prisma.pairing.findMany({
      where: { userId: session.user.id, createdAt: { gte: sinceCutoff } },
      select: {
        id: true,
        createdAt: true,
        photoUrl: true,
        trackName: true,
        artistName: true,
        shareSlug: true,
      },
    }),
    prisma.experience.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { date: { gte: sinceCutoff } },
          { createdAt: { gte: sinceCutoff } },
        ],
      },
      select: {
        id: true,
        date: true,
        createdAt: true,
        name: true,
        type: true,
        photoUrl: true,
        shareSlug: true,
      },
    }),
    prisma.mark.findMany({
      where: { userId: session.user.id, createdAt: { gte: sinceCutoff } },
      select: {
        id: true,
        createdAt: true,
        content: true,
        keyword: true,
        photoUrl: true,
        shareSlug: true,
      },
    }),
    prisma.encounter.findMany({
      where: {
        userId: session.user.id,
        date: { gte: sinceCutoff },
        answer: { not: null },
      },
      select: {
        id: true,
        date: true,
        question: true,
        answer: true,
        shareSlug: true,
      },
    }),
  ]);

  const items: UnifiedItem[] = [];

  const matches = (candidate: Date) =>
    candidate.getMonth() === m &&
    candidate.getDate() === d &&
    candidate.getFullYear() !== thisYear;

  for (const p of pairings) {
    if (!matches(p.createdAt)) continue;
    items.push({
      id: p.id,
      kind: "tracks",
      createdAt: p.createdAt,
      yearsAgo: yearsAgo(p.createdAt, now),
      preview: `${p.trackName} \u00b7 ${p.artistName}`,
      photoUrl: p.photoUrl,
      shareSlug: p.shareSlug,
    });
  }
  for (const e of experiences) {
    // Prefer the user-provided date if present, else createdAt
    const candidate = e.date ?? e.createdAt;
    if (!matches(candidate)) continue;
    items.push({
      id: e.id,
      kind: "path",
      createdAt: candidate,
      yearsAgo: yearsAgo(candidate, now),
      preview: e.name,
      photoUrl: e.photoUrl,
      shareSlug: e.shareSlug,
    });
  }
  for (const mk of marks) {
    if (!matches(mk.createdAt)) continue;
    items.push({
      id: mk.id,
      kind: "notice",
      createdAt: mk.createdAt,
      yearsAgo: yearsAgo(mk.createdAt, now),
      preview:
        mk.keyword ||
        (mk.content.length > 80 ? mk.content.slice(0, 80) + "\u2026" : mk.content),
      photoUrl: mk.photoUrl,
      shareSlug: mk.shareSlug,
    });
  }
  for (const enc of encounters) {
    if (!matches(enc.date)) continue;
    items.push({
      id: enc.id,
      kind: "encounter",
      createdAt: enc.date,
      yearsAgo: yearsAgo(enc.date, now),
      preview:
        enc.question.length > 80
          ? enc.question.slice(0, 80) + "\u2026"
          : enc.question,
      photoUrl: null,
      shareSlug: enc.shareSlug,
    });
  }

  // Most recent first (lowest yearsAgo), then by createdAt desc within year
  items.sort((a, b) => {
    if (a.yearsAgo !== b.yearsAgo) return a.yearsAgo - b.yearsAgo;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return NextResponse.json({ items });
}
