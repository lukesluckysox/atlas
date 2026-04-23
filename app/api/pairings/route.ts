import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captionPairing } from "@/lib/anthropic";
import { spotifyApi } from "@/lib/spotify-user";

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

// Resolve genres for a track's primary artist via Spotify. Best-effort;
// returns [] on any failure so saves never block.
async function resolveGenres(userId: string, trackId: string): Promise<string[]> {
  try {
    const track = await spotifyApi<{
      artists: Array<{ id: string }>;
    }>(userId, `/tracks/${trackId}`);
    const artistId = track?.artists?.[0]?.id;
    if (!artistId) return [];
    const artist = await spotifyApi<{ genres?: string[] }>(
      userId,
      `/artists/${artistId}`
    );
    return Array.isArray(artist?.genres) ? artist!.genres!.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    photoUrl,
    spotifyTrackId,
    trackName,
    artistName,
    albumArt,
    note,
    location,
    latitude,
    longitude,
    photoLum,
    photoWarmth,
    quick,
  } = body;

  if (!spotifyTrackId || !trackName || !artistName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Quick-capture mode: no photo required. Falls back to album art as the
  // visual. Skips caption generation (no real photo to speak to). Used by
  // mobile instant capture.
  const isQuick = !!quick;
  const resolvedPhoto = photoUrl || (isQuick ? albumArt ?? null : null);
  if (!resolvedPhoto) {
    return NextResponse.json({ error: "photoUrl or albumArt required" }, { status: 400 });
  }

  // Fetch genres (for the music tree) — always. Caption only when not quick.
  const [genres, caption] = await Promise.all([
    resolveGenres(session.user.id, spotifyTrackId),
    isQuick
      ? Promise.resolve(null)
      : captionPairing({
          photoUrl: resolvedPhoto,
          trackName,
          artistName,
          note: note ?? null,
          location: location ?? null,
        }),
  ]);

  const pairing = await prisma.pairing.create({
    data: {
      userId: session.user.id,
      photoUrl: resolvedPhoto,
      spotifyTrackId,
      trackName,
      artistName,
      albumArt,
      genres,
      note,
      caption,
      location,
      latitude,
      longitude,
      photoLum: typeof photoLum === "number" ? photoLum : undefined,
      photoWarmth: typeof photoWarmth === "number" ? photoWarmth : undefined,
    },
  });

  return NextResponse.json(pairing);
}
