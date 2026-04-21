import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spotifyApi } from "@/lib/spotify-user";

/**
 * Builds the music tree from the user's actual listening:
 *   you -> artists -> tracks
 *
 * Priority order:
 *   1. If Spotify is linked: blend top artists (weight 3) + recent plays (weight 1).
 *      Tracks per branch come from top tracks + recent plays for that artist.
 *   2. Fall back to local Pairings (user-logged track-photo pairs).
 */

interface TrackLeaf {
  id: string;
  name: string;
  albumArt: string | null;
  createdAt: string;
  url?: string;
}

interface ArtistBranch {
  name: string;
  count: number;          // internal sort weight (not user-facing)
  rank?: number | null;   // 1-based rank in top-artists list, if any
  recentPlays?: number;   // actual plays in the recently-played window (<=50)
  genres?: string[];
  tracks: TrackLeaf[];
}

interface SpotifyTopArtist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  genres: string[];
}
interface SpotifyTopTracks {
  items: Array<{
    id: string;
    name: string;
    artists: Array<{ id: string; name: string }>;
    album: { images: Array<{ url: string }> };
    external_urls: { spotify: string };
  }>;
}
interface SpotifyRecent {
  items: Array<{
    played_at: string;
    track: {
      id: string;
      name: string;
      artists: Array<{ id: string; name: string }>;
      album: { images: Array<{ url: string }> };
      external_urls: { spotify: string };
    };
  }>;
}

const MAX_ARTISTS = 8;
const MAX_TRACKS_PER_ARTIST = 6;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.spotifyLink.findUnique({
    where: { userId: session.user.id },
  });

  if (link) {
    return NextResponse.json(await buildFromSpotify(session.user.id));
  }
  return NextResponse.json(await buildFromPairings(session.user.id));
}

async function buildFromSpotify(userId: string) {
  const [topArtistsResp, topTracksResp, recentResp] = await Promise.all([
    spotifyApi<{ items: SpotifyTopArtist[] }>(userId, "/me/top/artists?limit=20&time_range=short_term"),
    spotifyApi<SpotifyTopTracks>(userId, "/me/top/tracks?limit=50&time_range=short_term"),
    spotifyApi<SpotifyRecent>(userId, "/me/player/recently-played?limit=50"),
  ]);

  const artistScore = new Map<
    string,
    {
      name: string;
      score: number;
      rank: number | null;
      recentPlays: number;
      image: string | null;
      genres: string[];
    }
  >();

  // Top artists: weight 3, rank-scaled (internal sort signal only)
  (topArtistsResp?.items ?? []).forEach((a, i) => {
    const prev = artistScore.get(a.id) ?? {
      name: a.name,
      score: 0,
      rank: null,
      recentPlays: 0,
      image: a.images[0]?.url ?? null,
      genres: a.genres ?? [],
    };
    prev.score += 3 * Math.max(1, 20 - i);
    prev.rank = i + 1; // 1-based rank
    if ((!prev.genres || prev.genres.length === 0) && a.genres?.length) {
      prev.genres = a.genres;
    }
    artistScore.set(a.id, prev);
  });

  // Recent plays: count actual plays (and use them as a small sort nudge)
  (recentResp?.items ?? []).forEach((item) => {
    const artist = item.track.artists[0];
    if (!artist) return;
    const prev = artistScore.get(artist.id) ?? {
      name: artist.name,
      score: 0,
      rank: null,
      recentPlays: 0,
      image: item.track.album.images[0]?.url ?? null,
      genres: [],
    };
    prev.score += 1;
    prev.recentPlays += 1;
    artistScore.set(artist.id, prev);
  });

  // Map artistId -> tracks (top tracks + recent plays)
  const tracksByArtist = new Map<string, TrackLeaf[]>();
  const pushTrack = (artistId: string, leaf: TrackLeaf) => {
    const arr = tracksByArtist.get(artistId) ?? [];
    if (!arr.find((t) => t.id === leaf.id)) arr.push(leaf);
    tracksByArtist.set(artistId, arr);
  };

  (topTracksResp?.items ?? []).forEach((t) => {
    const artistId = t.artists[0]?.id;
    if (!artistId) return;
    pushTrack(artistId, {
      id: t.id,
      name: t.name,
      albumArt: t.album.images[0]?.url ?? null,
      createdAt: new Date().toISOString(),
      url: t.external_urls.spotify,
    });
  });

  (recentResp?.items ?? []).forEach((item) => {
    const artistId = item.track.artists[0]?.id;
    if (!artistId) return;
    pushTrack(artistId, {
      id: item.track.id,
      name: item.track.name,
      albumArt: item.track.album.images[0]?.url ?? null,
      createdAt: item.played_at,
      url: item.track.external_urls.spotify,
    });
  });

  const ranked: ArtistBranch[] = Array.from(artistScore.entries())
    .map(([id, meta]) => ({
      name: meta.name,
      count: Math.round(meta.score),
      rank: meta.rank,
      recentPlays: meta.recentPlays,
      genres: meta.genres,
      tracks: (tracksByArtist.get(id) ?? []).slice(0, MAX_TRACKS_PER_ARTIST),
    }))
    .sort((a, b) => b.count - a.count);

  const top = ranked.slice(0, MAX_ARTISTS);
  const rest = ranked.slice(MAX_ARTISTS);

  if (rest.length > 0) {
    top.push({
      name: `${rest.length} more`,
      count: rest.reduce((sum, a) => sum + a.count, 0),
      rank: null,
      recentPlays: rest.reduce((sum, a) => sum + (a.recentPlays ?? 0), 0),
      genres: [],
      tracks: rest
        .flatMap((a) => a.tracks)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_TRACKS_PER_ARTIST),
    });
  }

  // Compute similarity links by shared genres
  const links = computeSimilarityLinks(top);

  return {
    source: "spotify",
    timeRange: "short_term",
    totalPairings: topTracksResp?.items.length ?? 0,
    totalArtists: ranked.length,
    branches: top,
    links,
  };
}

/** Returns pairs of branch names that share >=1 genre, with shared genres. */
function computeSimilarityLinks(
  branches: ArtistBranch[]
): Array<{ a: string; b: string; shared: string[] }> {
  const out: Array<{ a: string; b: string; shared: string[] }> = [];
  for (let i = 0; i < branches.length; i++) {
    const A = branches[i];
    if (!A.genres || A.genres.length === 0) continue;
    for (let j = i + 1; j < branches.length; j++) {
      const B = branches[j];
      if (!B.genres || B.genres.length === 0) continue;
      const shared = A.genres.filter((g) => B.genres!.includes(g));
      if (shared.length > 0) {
        out.push({ a: A.name, b: B.name, shared });
      }
    }
  }
  return out;
}

async function buildFromPairings(userId: string) {
  interface PairingRow {
    id: string;
    trackName: string;
    artistName: string;
    albumArt: string | null;
    createdAt: Date;
  }

  const pairings = (await prisma.pairing.findMany({
    where: { userId },
    select: { id: true, trackName: true, artistName: true, albumArt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })) as PairingRow[];

  const byArtist = new Map<string, ArtistBranch>();
  for (const p of pairings) {
    const key = p.artistName.trim();
    if (!byArtist.has(key))
      byArtist.set(key, { name: key, count: 0, rank: null, recentPlays: 0, tracks: [] });
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

  const ranked = Array.from(byArtist.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (b.tracks[0]?.createdAt ?? "").localeCompare(a.tracks[0]?.createdAt ?? "");
  });

  const top = ranked.slice(0, MAX_ARTISTS);
  const rest = ranked.slice(MAX_ARTISTS);

  if (rest.length > 0) {
    top.push({
      name: `${rest.length} more`,
      count: rest.reduce((sum, a) => sum + a.count, 0),
      rank: null,
      recentPlays: 0,
      tracks: rest
        .flatMap((a) => a.tracks)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_TRACKS_PER_ARTIST),
    });
  }

  // Assign ranks so the UI can display #1, #2, ... for the Pairings fallback too
  top.forEach((b, i) => {
    if (b.name !== `${rest.length} more`) b.rank = i + 1;
  });

  return {
    source: "pairings",
    totalPairings: pairings.length,
    totalArtists: byArtist.size,
    branches: top,
    links: [],
  };
}
