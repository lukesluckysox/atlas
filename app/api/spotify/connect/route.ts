import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/spotify-user";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", process.env.NEXTAUTH_URL));
  }

  const state = crypto.randomBytes(16).toString("hex");
  cookies().set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
