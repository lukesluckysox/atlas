const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function getSpotifyToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  return data.access_token;
}

export async function searchSpotifyTrack(
  query: string,
  token: string
): Promise<SpotifyTrack | null> {
  const res = await fetch(
    `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const track = data.tracks?.items?.[0];
  if (!track) return null;

  return {
    id: track.id,
    name: track.name,
    artist: track.artists[0]?.name,
    albumArt: track.album?.images?.[0]?.url,
    previewUrl: track.preview_url,
    externalUrl: track.external_urls?.spotify,
  };
}

export async function searchSpotifyTracks(
  query: string,
  token: string,
  limit = 5
): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const tracks = data.tracks?.items ?? [];

  return tracks.map((track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    preview_url: string;
    external_urls: { spotify: string };
  }) => ({
    id: track.id,
    name: track.name,
    artist: track.artists[0]?.name,
    albumArt: track.album?.images?.[0]?.url,
    previewUrl: track.preview_url,
    externalUrl: track.external_urls?.spotify,
  }));
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  previewUrl?: string;
  externalUrl?: string;
}
