import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Aggregates the user's pairings into a tree structure:
 *   you -> artists (branches) -> tracks (leaves)
 * Top artists by pairing count are kept; long-tail artists bucketed into "Other".
 */

interface TrackLeaf {
  id: string;
  name: string;
  albumArt: string | null;
  createdAt: string;
}

interface ArtistBranch {
  name: string;
  count: number;
  tracks: TrackLeaf[];
}

interface PairingRow {
  id: string;
  trackName: string;
  artistName: string;
  albumArt: string | null;
  createdAt: Date;
}

const MAX_ARTISTS = 8;
const MAX_TRACKS_PER_ARTIST = 6;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairings = (await prisma.pairing.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      trackName: true,
      artistName: true,
      albumArt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })) as PairingRow[];

  // Group by artist
  const byArtist = new Map<string, ArtistBranch>();
  for (const p of pairings) {
    const key = p.artistName.trim();
    if (!byArtist.has(key)) {
      byArtist.set(key, { name: key, count: 0, tracks: [] });
    }
    const branch = byArtist.get(key)!;
    branch.count++;
    if (branch.tracks.length < MAX_TRACKS_PER_ARTIST) {
      branch.tracks.push({
        id: p.id,
        name: p.trackName,
        albumArt: p.albumArt,
        createdAt: p.createdAt.toISOString(),
      });
    }
  }

  // Rank by count, then recency
  const ranked = Array.from(byArtist.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const aLatest = a.tracks[0]?.createdAt ?? "";
    const bLatest = b.tracks[0]?.createdAt ?? "";
    return bLatest.localeCompare(aLatest);
  });

  const top = ranked.slice(0, MAX_ARTISTS);
  const rest = ranked.slice(MAX_ARTISTS);

  // Bucket long tail into one "Others" branch so it still appears as signal.
  if (rest.length > 0) {
    top.push({
      name: `${rest.length} more`,
      count: rest.reduce((sum, a) => sum + a.count, 0),
      tracks: rest
        .flatMap((a) => a.tracks)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_TRACKS_PER_ARTIST),
    });
  }

  return NextResponse.json({
    totalPairings: pairings.length,
    totalArtists: byArtist.size,
    branches: top,
  });
}
