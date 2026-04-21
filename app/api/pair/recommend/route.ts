import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recommendTracksForPhoto } from "@/lib/anthropic";
import { searchSpotifyTrack, getSpotifyToken } from "@/lib/spotify";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.isPro) {
    return NextResponse.json({ error: "Pro required" }, { status: 403 });
  }

  const { photoUrl } = await req.json();
  if (!photoUrl) {
    return NextResponse.json({ error: "photoUrl required" }, { status: 400 });
  }

  const recommendations = await recommendTracksForPhoto(photoUrl);
  const token = await getSpotifyToken();

  const tracks = await Promise.all(
    recommendations.map(async (rec) => {
      const track = await searchSpotifyTrack(rec.trackQuery, token);
      return { ...track, reasoning: rec.reasoning };
    })
  );

  return NextResponse.json({ tracks: tracks.filter(Boolean) });
}
