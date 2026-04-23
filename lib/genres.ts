/**
 * Genre normalization — Spotify returns highly granular microgenres like
 * "pov: indie", "chillwave", "neo-psychedelia", "escape room". For the Music
 * Tree we want a stable set of ~12 canonical families so artists actually
 * cluster. Substring matching against lowercased raw genre strings. First
 * match wins; order below is deliberate (more specific before more generic).
 *
 * Unknown genres bucket to "Other" — better than dropping them into
 * "unsorted" which should be reserved for pairings with no genre data at all.
 */

export type GenreFamily =
  | "Rock"
  | "Pop"
  | "Hip-Hop"
  | "R&B"
  | "Electronic"
  | "Jazz"
  | "Classical"
  | "Folk"
  | "Country"
  | "Metal"
  | "World"
  | "Experimental"
  | "Other";

// Order matters — "hip hop" must hit before "pop", "metalcore" before "core".
const GENRE_RULES: Array<[GenreFamily, string[]]> = [
  ["Metal", ["metal", "metalcore", "hardcore", "grindcore", "djent", "doom", "sludge"]],
  ["Hip-Hop", ["hip hop", "hip-hop", "rap", "trap", "drill", "grime", "boom bap"]],
  ["R&B", ["r&b", "rnb", "soul", "funk", "neo soul", "motown", "quiet storm"]],
  ["Electronic", [
    "electronic", "edm", "house", "techno", "trance", "dubstep", "drum and bass",
    "dnb", "garage", "synthwave", "chillwave", "vaporwave", "ambient", "idm",
    "breakbeat", "electro", "downtempo", "lo-fi", "lofi", "future bass",
  ]],
  ["Jazz", ["jazz", "bop", "bebop", "swing", "fusion", "ragtime"]],
  ["Classical", ["classical", "baroque", "romantic", "opera", "orchestral", "symphon", "chamber"]],
  ["Folk", ["folk", "singer-songwriter", "singer songwriter", "americana", "bluegrass", "acoustic"]],
  ["Country", ["country", "honky", "outlaw country", "nashville"]],
  ["World", [
    "afrobeat", "afropop", "afro", "latin", "reggae", "ska", "dancehall", "reggaeton",
    "bossa", "samba", "cumbia", "k-pop", "j-pop", "mandopop", "arabic", "indian",
    "bollywood", "celtic", "flamenco", "highlife", "gqom", "amapiano",
  ]],
  ["Experimental", ["experimental", "noise", "drone", "avant-garde", "avant garde", "free improvisation"]],
  // Punk/emo/post-punk all collapse into Rock below — consistent with how
  // most users think of them as rock-family even though Spotify splits them.
  ["Rock", [
    "rock", "indie", "alternative", "shoegaze", "grunge", "psychedelic", "garage rock",
    "punk", "post-punk", "emo", "screamo", "new wave", "britpop", "dream pop",
    "art rock", "prog", "stoner",
  ]],
  ["Pop", ["pop", "dance pop", "synth-pop", "synthpop", "electropop", "bubblegum"]],
];

const NORMALIZED_RULES: Array<[GenreFamily, string[]]> = GENRE_RULES
  .map(([family, keys]) => [family, keys.map((k) => k.toLowerCase())]);

export function normalizeGenre(raw: string | null | undefined): GenreFamily {
  if (!raw) return "Other";
  const lower = raw.toLowerCase().trim();
  if (!lower) return "Other";
  for (const [family, keys] of NORMALIZED_RULES) {
    for (const k of keys) {
      if (lower.includes(k)) return family;
    }
  }
  return "Other";
}

/**
 * Map a list of raw Spotify genres to their families, preserving order and
 * deduping. Useful when we want the full family-set for an artist (e.g. to
 * show as chips), not just the primary.
 */
export function normalizeGenreList(raw: string[]): GenreFamily[] {
  const seen = new Set<GenreFamily>();
  const out: GenreFamily[] = [];
  for (const g of raw) {
    const f = normalizeGenre(g);
    if (!seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}
