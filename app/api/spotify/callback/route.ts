import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens, fetchSpotifyMe } from "@/lib/spotify-user";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", process.env.NEXTAUTH_URL));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = cookies();
  const expectedState = cookieStore.get("spotify_oauth_state")?.value;
  cookieStore.delete("spotify_oauth_state");

  if (error) {
    return NextResponse.redirect(new URL(`/pair?spotify=denied`, process.env.NEXTAUTH_URL));
  }
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL(`/pair?spotify=invalid`, process.env.NEXTAUTH_URL));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const me = tokens.access_token ? await fetchSpotifyMe(tokens.access_token) : null;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.spotifyLink.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        spotifyId: me?.id,
        displayName: me?.display_name,
        refreshToken: tokens.refresh_token ?? "",
        accessToken: tokens.access_token,
        expiresAt,
        scope: tokens.scope,
      },
      update: {
        spotifyId: me?.id,
        displayName: me?.display_name,
        refreshToken: tokens.refresh_token ?? undefined,
        accessToken: tokens.access_token,
        expiresAt,
        scope: tokens.scope,
      },
    });

    return NextResponse.redirect(new URL(`/pair?spotify=connected`, process.env.NEXTAUTH_URL));
  } catch (err) {
    console.error("[spotify/callback]", err);
    return NextResponse.redirect(new URL(`/pair?spotify=error`, process.env.NEXTAUTH_URL));
  }
}
