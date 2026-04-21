import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairings = await prisma.pairing.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pairings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { photoUrl, spotifyTrackId, trackName, artistName, albumArt, note, location, latitude, longitude } = body;

  if (!photoUrl || !spotifyTrackId || !trackName || !artistName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pairing = await prisma.pairing.create({
    data: {
      userId: session.user.id,
      photoUrl,
      spotifyTrackId,
      trackName,
      artistName,
      albumArt,
      note,
      location,
      latitude,
      longitude,
    },
  });

  return NextResponse.json(pairing);
}
