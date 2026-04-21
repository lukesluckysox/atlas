import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Returns all photo URLs the user has uploaded across Pairings, Experiences,
 * and Marks — newest first. Used by the portrait photomosaic to tile images
 * inside a year/month glyph shape.
 */

interface PhotoTile {
  id: string;
  url: string;
  kind: "pairing" | "experience" | "mark";
  label: string;
  createdAt: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [pairings, experiences, marks] = await Promise.all([
    prisma.pairing.findMany({
      where: { userId },
      select: {
        id: true,
        photoUrl: true,
        trackName: true,
        artistName: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.experience.findMany({
      where: { userId, photoUrl: { not: null } },
      select: {
        id: true,
        photoUrl: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mark.findMany({
      where: { userId, photoUrl: { not: null } },
      select: {
        id: true,
        photoUrl: true,
        content: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  interface PairingRow {
    id: string;
    photoUrl: string;
    trackName: string;
    artistName: string;
    createdAt: Date;
  }
  interface ExperienceRow {
    id: string;
    photoUrl: string | null;
    name: string;
    createdAt: Date;
  }
  interface MarkRow {
    id: string;
    photoUrl: string | null;
    content: string;
    createdAt: Date;
  }

  const tiles: PhotoTile[] = [
    ...(pairings as PairingRow[]).map((p) => ({
      id: `p_${p.id}`,
      url: p.photoUrl,
      kind: "pairing" as const,
      label: `${p.trackName} — ${p.artistName}`,
      createdAt: p.createdAt.toISOString(),
    })),
    ...(experiences as ExperienceRow[])
      .filter((e) => e.photoUrl)
      .map((e) => ({
        id: `e_${e.id}`,
        url: e.photoUrl as string,
        kind: "experience" as const,
        label: e.name,
        createdAt: e.createdAt.toISOString(),
      })),
    ...(marks as MarkRow[])
      .filter((m) => m.photoUrl)
      .map((m) => ({
        id: `m_${m.id}`,
        url: m.photoUrl as string,
        kind: "mark" as const,
        label: m.content.slice(0, 60),
        createdAt: m.createdAt.toISOString(),
      })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ tiles });
}
