/**
 * Genre normalization — Spotify does not provide canonical family mappings.
 * Their artist.genres field is a flat list of 1,700+ microgenres (and is
 * officially deprecated). There is no parent/child hierarchy in the API.
 * Every Noise at Once (the community project that seeded most of them) is
 * frozen. So we roll our own mapping.
 *
 * Strategy: substring matching against lowercased raw genre strings. First
 * match wins; order below is deliberate — more specific families run before
 * more generic ones (e.g. "Metal" before "Rock" so "metalcore" doesn't catch
 * "core" against Rock, "Hip-Hop" before "Pop" so "pov: indie hip hop"
 * doesn't get caught by "pop").
 *
 * Unknown genres bucket to "Other". We also expose `isUnknown` so callers
 * can decide whether to show Other as a branch or hide it.
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
  | "Blues"
  | "Latin"
  | "World"
  | "Experimental"
  | "Ambient"
  | "Soundtrack"
  | "Other";

/**
 * Ordered rules. Within a family, keywords are lowercase substrings — if any
 * match the (lowercased) raw genre string, the genre maps to that family.
 *
 * Critical order rules:
 *   - Metal before Rock  (metalcore/hardcore sit with metal, not rock)
 *   - Hip-Hop before Pop (hip hop before catching "pop" in random strings)
 *   - Country before Pop (country pop is country)
 *   - Latin before Pop   (latin pop is latin)
 *   - Blues before Rock  (blues-rock debatable; we default to blues)
 *   - Soundtrack before everything broad (video game music, score, etc.)
 *   - Ambient before Electronic (so drone-ambient goes to ambient not elec)
 *   - Experimental before Rock (noise rock → experimental)
 */
const GENRE_RULES: Array<[GenreFamily, string[]]> = [
  ["Soundtrack", [
    "soundtrack", "score", "film score", "video game music", "vgm",
    "anime score", "showtunes", "musical", "broadway", "hollywood",
  ]],
  ["Metal", [
    "metal", "metalcore", "deathcore", "grindcore", "djent", "doom",
    "sludge", "nu metal", "thrash", "black metal", "death metal",
    "power metal", "symphonic metal", "hardcore", "mathcore",
    "crossover thrash", "post-metal",
  ]],
  // Latin MUST come before Hip-Hop: "trap latino"/"latin rap" should be Latin.
  ["Latin", [
    "latin", "reggaeton", "bachata", "salsa", "merengue", "cumbia",
    "bossa", "bossa nova", "samba", "tango", "mariachi", "ranchera",
    "banda", "norteno", "regional mexican", "mpb", "sertanejo",
    "tropical", "latin pop", "latin rock", "latin jazz", "latin rap",
    "perreo", "dembow", "funk carioca", "baile funk", "trap latino",
    "urbano latino", "vallenato", "corridos", "bolero",
  ]],
  ["Hip-Hop", [
    "hip hop", "hip-hop", "rap", "trap", "drill", "grime", "boom bap",
    "gangster rap", "conscious hip hop", "underground hip hop", "phonk",
    "crunk", "hyphy", "mumble rap", "cloud rap", "plugg", "emo rap",
    "g-funk", "old school hip hop", "uk rap", "french rap",
    "pluggnb", "drumless", "rage rap",
  ]],
  ["R&B", [
    "r&b", "rnb", "r and b", "soul", "neo soul", "neo-soul", "funk",
    "motown", "quiet storm", "new jack swing", "alternative r&b",
    "contemporary r&b", "doo-wop", "doo wop", "g-funk", "p-funk",
    "gospel", "afro-soul",
  ]],
  ["Blues", [
    "blues", "blues rock", "chicago blues", "delta blues", "rhythm and blues",
    "electric blues", "harmonica blues", "boogie-woogie", "boogie woogie",
    "piedmont blues",
  ]],
  ["Ambient", [
    "ambient", "drone", "dark ambient", "ambient electronic", "new age",
    "healing", "sleep", "meditation", "binaural", "space music",
    "field recordings", "tape music",
  ]],
  ["Electronic", [
    "electronic", "edm", "house", "techno", "trance", "dubstep",
    "drum and bass", "drum & bass", "dnb", "garage", "uk garage",
    "2-step", "synthwave", "chillwave", "vaporwave", "idm", "breakbeat",
    "breakcore", "electro", "downtempo", "trip hop", "trip-hop",
    "lo-fi", "lofi", "chillhop", "future bass", "future funk",
    "deep house", "tech house", "progressive house", "acid house",
    "minimal techno", "detroit techno", "hardstyle", "gabber", "jungle",
    "liquid funk", "neurofunk", "moombahton", "trap edm", "bass music",
    "footwork", "juke", "witch house", "microhouse", "big beat",
    "psytrance", "eurodance", "hyperpop", "hardcore techno",
    "happy hardcore", "nightcore", "phonk wave", "plunderphonics",
    "glitch", "wonky", "bitpop", "chiptune", "8-bit",
  ]],
  ["Jazz", [
    "jazz", "bebop", "bop", "hard bop", "swing", "dixieland", "ragtime",
    "big band", "cool jazz", "free jazz", "smooth jazz", "jazz fusion",
    "fusion", "vocal jazz", "nu jazz", "acid jazz", "jazz funk",
    "spiritual jazz", "post-bop", "stride",
  ]],
  ["Classical", [
    "classical", "baroque", "opera", "operatic", "orchestral",
    "symphon", "chamber music", "string quartet", "choral", "early music",
    "medieval", "renaissance", "contemporary classical",
    "neoclassical", "modern classical", "post-minimalism", "piano cover",
    "solo piano", "harpsichord",
    // "romantic" and "chamber" alone are too broad — catch only era phrases.
    "romantic era", "classical era",
  ]],
  ["Country", [
    "country", "honky", "honky-tonk", "outlaw country", "nashville",
    "country pop", "country rock", "alt-country", "alt country",
    "country rap", "country blues", "western", "cowboy", "rockabilly",
    "red dirt", "texas country", "country dawn",
  ]],
  ["Folk", [
    "folk", "singer-songwriter", "singer songwriter", "americana",
    "bluegrass", "acoustic", "indie folk", "folk rock", "freak folk",
    "neofolk", "anti-folk", "chamber folk", "british folk", "irish folk",
    "celtic folk", "sea shanty", "shanty",
  ]],
  ["World", [
    "afrobeat", "afrobeats", "afropop", "afro pop", "afroswing", "afro-",
    "african", "amapiano", "gqom", "kwaito", "highlife", "juju",
    "makossa", "soukous", "reggae", "ska", "dancehall", "dub",
    "roots reggae", "rocksteady", "lovers rock",
    "k-pop", "kpop", "j-pop", "jpop", "j-rock", "jrock", "c-pop",
    "mandopop", "cantopop", "anison", "city pop", "shibuya-kei",
    "khaleeji", "arabic", "rai", "dabke", "turkish", "balkan", "klezmer",
    "polka", "flamenco", "fado", "rebetiko", "chanson",
    "indian", "bollywood", "bhangra", "hindustani", "carnatic",
    "qawwali", "ghazal", "filmi", "punjabi",
    "thai", "vietnamese", "indonesian", "dangdut", "gamelan",
    "mongolian", "throat singing", "tuvan",
  ]],
  ["Experimental", [
    "experimental", "noise", "noise rock", "avant-garde", "avant garde",
    "free improvisation", "musique concrete", "sound art",
    "industrial", "post-industrial", "power electronics", "harsh noise",
    "deconstructed club", "glitchcore",
  ]],
  // Rock absorbs punk/emo/post-punk/shoegaze — users think of all of these as
  // rock-family even though Spotify splits them hair-thin.
  ["Rock", [
    "rock", "indie", "indie rock", "alternative", "alt rock", "alt-rock",
    "shoegaze", "grunge", "psychedelic", "psych rock", "psychedelia",
    "neo-psychedelia", "neo-psychedelic", "garage rock",
    "punk", "pop punk", "pop-punk", "post-punk", "post punk", "hardcore punk",
    "emo", "screamo", "midwest emo", "emocore", "new wave", "no wave",
    "britpop", "dream pop", "slowcore", "sadcore", "math rock",
    "art rock", "prog rock", "progressive rock", "stoner rock",
    "stoner", "surf rock", "surf", "southern rock", "heartland rock",
    "jam band", "roots rock", "power pop", "jangle pop", "jangle",
    "twee", "c86", "post-rock", "post rock", "krautrock", "space rock",
    "pov: indie",
  ]],
  // Pop is the catch-all for "pop"-ending microgenres. Runs last before Other.
  ["Pop", [
    "pop", "dance pop", "dance-pop", "synth-pop", "synthpop", "electropop",
    "bubblegum", "teen pop", "adult contemporary", "europop", "euro dance",
    "indie pop", "bedroom pop", "dream pop", "art pop", "chamber pop",
    "baroque pop", "sophisti-pop", "sunshine pop", "kawaii pop",
    "escape room", // Every Noise gag genre — vaguely poppy catchall
  ]],
];

const NORMALIZED_RULES: Array<[GenreFamily, string[]]> = GENRE_RULES.map(
  ([family, keys]) => [family, keys.map((k) => k.toLowerCase())]
);

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

export function isKnownFamily(f: GenreFamily): boolean {
  return f !== "Other";
}
