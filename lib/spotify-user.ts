import { prisma } from "./prisma";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-top-read",
].join(" ");

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/spotify/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: "false",
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

function basicAuthHeader(): string {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  return `Basic ${credentials}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Spotify refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const link = await prisma.spotifyLink.findUnique({ where: { userId } });
  if (!link) return null;

  // Refresh if <60s until expiry
  const now = Date.now();
  const expiresMs = new Date(link.expiresAt).getTime();
  if (expiresMs - now > 60_000) return link.accessToken;

  try {
    const refreshed = await refreshAccessToken(link.refreshToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await prisma.spotifyLink.update({
      where: { userId },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: newExpiresAt,
        // Spotify sometimes rotates the refresh token
        refreshToken: refreshed.refresh_token ?? link.refreshToken,
      },
    });
    return refreshed.access_token;
  } catch (err) {
    console.error("[spotify] refresh failed", err);
    return null;
  }
}

export async function spotifyApi<T>(userId: string, path: string): Promise<T | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 204) return null; // no content (e.g. nothing playing)
  if (!res.ok) {
    console.error(`[spotify] ${path} -> ${res.status}`);
    return null;
  }
  return res.json() as Promise<T>;
}

export async function fetchSpotifyMe(accessToken: string): Promise<{ id: string; display_name?: string } | null> {
  const res = await fetch(`${SPOTIFY_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}
