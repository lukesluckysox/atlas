/**
 * Photo "mood" sampler — client-side only.
 *
 * Downsamples an image to 16x16 and extracts:
 *   - lum:    average luminance, [0, 1]  (0 dark -> 1 bright)
 *   - warmth: (R - B) normalized to [0, 1]  (0 cool -> 0.5 neutral -> 1 warm)
 *
 * Compass portrait uses these as an (x, y) field: warmth -> x, lum -> y.
 * No ML, no server load, no cost. Runs in <10ms per photo.
 */

export interface PhotoMood {
  lum: number; // 0..1
  warmth: number; // 0..1
}

const SAMPLE_SIZE = 16;

/**
 * Sample an already-loaded HTMLImageElement. Returns null if the canvas
 * is tainted (cross-origin without CORS).
 */
export function sampleImageMood(img: HTMLImageElement): PhotoMood | null {
  if (typeof document === "undefined") return null;
  if (!img.complete || img.naturalWidth === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return reduce(data);
  } catch {
    // Canvas tainted — cross-origin image without CORS headers.
    return null;
  }
}

/**
 * Sample from a URL. Loads the image with crossOrigin="anonymous" so uploads
 * from the same origin (or CORS-friendly hosts) can be sampled.
 */
export function sampleUrlMood(url: string): Promise<PhotoMood | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(sampleImageMood(img));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Sample directly from a File (no network). Use this on upload before
 * the user has a URL — fastest and never tainted.
 */
export function sampleFileMood(file: File): Promise<PhotoMood | null> {
  return new Promise((resolve) => {
    if (typeof FileReader === "undefined" || typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(sampleImageMood(img));
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function reduce(data: Uint8ClampedArray): PhotoMood {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const rAvg = rSum / pixels;
  const gAvg = gSum / pixels;
  const bAvg = bSum / pixels;

  // Relative luminance (Rec. 601 coefficients, simple & fast).
  const lum = (0.299 * rAvg + 0.587 * gAvg + 0.114 * bAvg) / 255;

  // Warmth = R vs B balance. Shift [-255,255] -> [0,1].
  const warmth = (rAvg - bAvg + 255) / 510;

  return {
    lum: clamp01(lum),
    warmth: clamp01(warmth),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/**
 * Aggregate "shape of your year" reading. Given all analyzed moods,
 * returns a short headline + detail line based on the centroid and spread.
 *
 * Centroid sector → headline (borrowed from the same sun-path metaphor).
 * Spread (stdev) → detail adjective ("varied", "narrow", etc).
 */
export interface MoodNarration {
  headline: string;
  detail: string;
  centroid: PhotoMood;
  sampleSize: number;
}

export function narrateMoods(moods: PhotoMood[]): MoodNarration | null {
  if (moods.length === 0) return null;

  const n = moods.length;
  const mLum = moods.reduce((s, m) => s + m.lum, 0) / n;
  const mWarm = moods.reduce((s, m) => s + m.warmth, 0) / n;

  let vLum = 0;
  let vWarm = 0;
  for (const m of moods) {
    vLum += (m.lum - mLum) ** 2;
    vWarm += (m.warmth - mWarm) ** 2;
  }
  const sdLum = Math.sqrt(vLum / n);
  const sdWarm = Math.sqrt(vWarm / n);
  // Average spread across both axes, roughly [0, ~0.35]
  const spread = (sdLum + sdWarm) / 2;

  // Sector headline — by centroid.
  const sectorReading = moodReading({ lum: mLum, warmth: mWarm });
  const sector = sectorReading.split(" · ")[0];

  let headline: string;
  switch (sector) {
    case "golden hour":
      headline = "Your year leans golden hour.";
      break;
    case "noon":
      headline = "Bright days, cool light.";
      break;
    case "overhead":
      headline = "Overhead sun, high contrast.";
      break;
    case "ember":
      headline = "Late light, warm embers.";
      break;
    case "midnight":
      headline = "Mostly midnights and cool dark.";
      break;
    case "shadow":
      headline = "Low-key, shadowed.";
      break;
    case "lamplight":
      headline = "Warm interiors, lamplight.";
      break;
    case "overcast":
      headline = "Cool and overcast.";
      break;
    default:
      headline = "Balanced light, balanced year.";
  }

  // Spread descriptor.
  let detail: string;
  if (n < 4) {
    detail = `Reading ${n} photo${n === 1 ? "" : "s"}.`;
  } else if (spread < 0.08) {
    detail = "A narrow palette — your look is consistent.";
  } else if (spread < 0.16) {
    detail = "Varied, but centered.";
  } else {
    detail = "Wide range — you move through many moods.";
  }

  return {
    headline,
    detail,
    centroid: { lum: mLum, warmth: mWarm },
    sampleSize: n,
  };
}

/**
 * Human-readable reading of a (lum, warmth) pair for hover tooltips.
 * Matches the 3x3 sectors around center (0.5, 0.5).
 */
export function moodReading(mood: PhotoMood): string {
  const { lum, warmth } = mood;
  const high = 0.62;
  const low = 0.38;

  const lumBand = lum >= high ? "bright" : lum <= low ? "dark" : "mid";
  const warmBand = warmth >= high ? "warm" : warmth <= low ? "cool" : "neutral";

  // Named corners — sun-path metaphor.
  // warmth follows the sun E->W, lum follows altitude N->S.
  if (lumBand === "bright" && warmBand === "warm") return "golden hour · warm"; // NE
  if (lumBand === "bright" && warmBand === "cool") return "noon · cool";        // NW
  if (lumBand === "bright") return "overhead · bright";                         // N
  if (lumBand === "dark" && warmBand === "warm") return "ember · warm";         // SE
  if (lumBand === "dark" && warmBand === "cool") return "midnight · cool";      // SW
  if (lumBand === "dark") return "shadow · dark";                                // S
  if (warmBand === "warm") return "lamplight · warm";                            // E
  if (warmBand === "cool") return "overcast · cool";                             // W
  return "balanced · neutral";                                                   // center
}
