import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { spotifyApi } from "@/lib/spotify-user";
import { prisma } from "@/lib/prisma";

interface CurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number | null;
  item: {
    id: string;
    name: string;
    duration_ms: number;
    artists: Array<{ name: string }>;
    album: { name: string; images: Array<{ url: string }> };
    external_urls: { spotify: string };
  } | null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.spotifyLink.findUnique({ where: { userId: session.user.id } });
  if (!link) {
    return NextResponse.json({ connected: false });
  }

  const data = await spotifyApi<CurrentlyPlaying>(session.user.id, "/me/player/currently-playing");

  if (!data || !data.item) {
    return NextResponse.json({ connected: true, playing: false });
  }

  return NextResponse.json({
    connected: true,
    playing: data.is_playing,
    progressMs: data.progress_ms,
    track: {
      id: data.item.id,
      name: data.item.name,
      durationMs: data.item.duration_ms,
      artist: data.item.artists.map((a) => a.name).join(", "),
      album: data.item.album.name,
      albumArt: data.item.album.images[0]?.url ?? null,
      url: data.item.external_urls.spotify,
    },
  });
}
