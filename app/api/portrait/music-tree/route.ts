import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeGenre, normalizeGenreList } from "@/lib/genres";

/**
 * Music tree — TRACE-NATIVE ONLY.
 *
 * Source of truth: the user's Pairings (photos they paired with a song inside
 * Traces). Generic Spotify top-listening is intentionally not used here —
 * this view answers "what music has attached itself to my life moments?"
 *
 * Shape: you → genre branches → artist twigs → track leaves (album art).
 * If a pairing has no genres stored (older rows, or Spotify failed at save
 * time), it falls under "unsorted".
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
  genres: string[];
  tracks: TrackLeaf[];
}

interface GenreGroup {
  genre: string;
  artists: ArtistBranch[];
}

const MAX_GENRES = 8;
const MAX_ARTISTS_PER_GENRE = 6;
const MAX_TRACKS_PER_ARTIST = 6;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairings = await prisma.pairing.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Group by artist first so we dedupe tracks per artist.
  const byArtist = new Map<
    string,
    { genres: Set<string>; tracks: Map<string, TrackLeaf>; count: number }
  >();

  for (const p of pairings) {
    const artist = p.artistName.trim();
    if (!artist) continue;
    let entry = byArtist.get(artist);
    if (!entry) {
      entry = { genres: new Set(), tracks: new Map(), count: 0 };
      byArtist.set(artist, entry);
    }
    entry.count += 1;
    // Store raw lowercased genres — we normalize to families at grouping time.
    for (const g of p.genres ?? []) {
      const norm = g.trim().toLowerCase();
      if (norm) entry.genres.add(norm);
    }
    if (!entry.tracks.has(p.spotifyTrackId)) {
      entry.tracks.set(p.spotifyTrackId, {
        id: p.spotifyTrackId,
        name: p.trackName,
        albumArt: p.albumArt,
        createdAt: p.createdAt.toISOString(),
      });
    }
  }

  // Score genres by how many pairings sit under them.
  const genreCounts = new Map<string, number>();
  const artists: ArtistBranch[] = [];

  for (const [name, data] of Array.from(byArtist.entries())) {
    const rawGenres = Array.from(data.genres);
    // Map each raw microgenre to a canonical family, dedupe, preserve order.
    const families = normalizeGenreList(rawGenres);
    const branch: ArtistBranch = {
      name,
      count: data.count,
      // Show normalized families on the branch so the UI labels stay stable.
      genres: families,
      tracks: Array.from(data.tracks.values()).slice(0, MAX_TRACKS_PER_ARTIST),
    };
    artists.push(branch);
    if (rawGenres.length === 0) {
      genreCounts.set("unsorted", (genreCounts.get("unsorted") ?? 0) + branch.count);
    } else {
      // Primary family = family of the first Spotify genre (the anchor).
      const primary = normalizeGenre(rawGenres[0]);
      genreCounts.set(primary, (genreCounts.get(primary) ?? 0) + branch.count);
    }
  }

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GENRES)
    .map(([g]) => g);

  const groups: GenreGroup[] = topGenres.map((genre) => {
    const members = artists
      .filter((a) => {
        if (genre === "unsorted") return a.genres.length === 0;
        // An artist belongs to the group whose family is their primary family.
        return a.genres[0] === genre;
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_ARTISTS_PER_GENRE);
    return { genre, artists: members };
  });

  return NextResponse.json({
    totalPairings: pairings.length,
    totalArtists: byArtist.size,
    groups,
  });
}
