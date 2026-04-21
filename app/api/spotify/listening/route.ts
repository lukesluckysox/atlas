import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spotifyApi } from "@/lib/spotify-user";
import { prisma } from "@/lib/prisma";

interface RecentResp {
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

interface TopArtistsResp {
  items: Array<{
    id: string;
    name: string;
    images: Array<{ url: string }>;
    genres: string[];
  }>;
}

interface TopTracksResp {
  items: Array<{
    id: string;
    name: string;
    artists: Array<{ id: string; name: string }>;
    album: { images: Array<{ url: string }> };
    external_urls: { spotify: string };
  }>;
}

/**
 * Aggregates the user's actual Spotify listening into a tree:
 *   you -> artists -> tracks (real plays)
 * Blends top artists (long-term signal) with recent plays (freshness).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.spotifyLink.findUnique({ where: { userId: session.user.id } });
  if (!link) return NextResponse.json({ connected: false });

  const [recent, topArtists, topTracks] = await Promise.all([
    spotifyApi<RecentResp>(session.user.id, "/me/player/recently-played?limit=50"),
    spotifyApi<TopArtistsResp>(session.user.id, "/me/top/artists?limit=20&time_range=medium_term"),
    spotifyApi<TopTracksResp>(session.user.id, "/me/top/tracks?limit=50&time_range=medium_term"),
  ]);

  return NextResponse.json({
    connected: true,
    recent: recent?.items.slice(0, 20).map((i) => ({
      playedAt: i.played_at,
      id: i.track.id,
      name: i.track.name,
      artist: i.track.artists.map((a) => a.name).join(", "),
      albumArt: i.track.album.images[0]?.url ?? null,
      url: i.track.external_urls.spotify,
    })) ?? [],
    topArtists: topArtists?.items.map((a) => ({
      id: a.id,
      name: a.name,
      image: a.images[0]?.url ?? null,
      genres: a.genres.slice(0, 3),
    })) ?? [],
    topTracks: topTracks?.items.map((t) => ({
      id: t.id,
      name: t.name,
      artist: t.artists.map((a) => a.name).join(", "),
      artistId: t.artists[0]?.id ?? "",
      albumArt: t.album.images[0]?.url ?? null,
      url: t.external_urls.spotify,
    })) ?? [],
  });
}
