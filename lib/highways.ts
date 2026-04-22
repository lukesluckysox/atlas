// Curated list of US highways for the Mode A picker.
// Not exhaustive. Free-text fallback handles everything else.

export type HighwayCategory = "interstate" | "us_route" | "scenic" | "state";

export interface HighwayOption {
  name: string;        // display name
  ref: string;         // normalized ref ("I-90", "US-101")
  category: HighwayCategory;
  aka?: string[];      // search aliases
}

export const HIGHWAYS: HighwayOption[] = [
  // Primary Interstates (even = E/W, odd = N/S)
  { name: "I-5", ref: "I-5", category: "interstate" },
  { name: "I-8", ref: "I-8", category: "interstate" },
  { name: "I-10", ref: "I-10", category: "interstate" },
  { name: "I-15", ref: "I-15", category: "interstate" },
  { name: "I-20", ref: "I-20", category: "interstate" },
  { name: "I-25", ref: "I-25", category: "interstate" },
  { name: "I-29", ref: "I-29", category: "interstate" },
  { name: "I-35", ref: "I-35", category: "interstate" },
  { name: "I-40", ref: "I-40", category: "interstate" },
  { name: "I-44", ref: "I-44", category: "interstate" },
  { name: "I-49", ref: "I-49", category: "interstate" },
  { name: "I-55", ref: "I-55", category: "interstate" },
  { name: "I-57", ref: "I-57", category: "interstate" },
  { name: "I-59", ref: "I-59", category: "interstate" },
  { name: "I-64", ref: "I-64", category: "interstate" },
  { name: "I-65", ref: "I-65", category: "interstate" },
  { name: "I-69", ref: "I-69", category: "interstate" },
  { name: "I-70", ref: "I-70", category: "interstate" },
  { name: "I-74", ref: "I-74", category: "interstate" },
  { name: "I-75", ref: "I-75", category: "interstate" },
  { name: "I-76", ref: "I-76", category: "interstate" },
  { name: "I-77", ref: "I-77", category: "interstate" },
  { name: "I-78", ref: "I-78", category: "interstate" },
  { name: "I-80", ref: "I-80", category: "interstate" },
  { name: "I-81", ref: "I-81", category: "interstate" },
  { name: "I-82", ref: "I-82", category: "interstate" },
  { name: "I-83", ref: "I-83", category: "interstate" },
  { name: "I-84", ref: "I-84", category: "interstate" },
  { name: "I-85", ref: "I-85", category: "interstate" },
  { name: "I-86", ref: "I-86", category: "interstate" },
  { name: "I-87", ref: "I-87", category: "interstate" },
  { name: "I-88", ref: "I-88", category: "interstate" },
  { name: "I-89", ref: "I-89", category: "interstate" },
  { name: "I-90", ref: "I-90", category: "interstate" },
  { name: "I-91", ref: "I-91", category: "interstate" },
  { name: "I-93", ref: "I-93", category: "interstate" },
  { name: "I-94", ref: "I-94", category: "interstate" },
  { name: "I-95", ref: "I-95", category: "interstate" },
  { name: "I-96", ref: "I-96", category: "interstate" },
  { name: "I-97", ref: "I-97", category: "interstate" },
  { name: "I-99", ref: "I-99", category: "interstate" },
  { name: "H-1", ref: "H-1", category: "interstate", aka: ["Hawaii 1", "Lunalilo"] },
  { name: "H-2", ref: "H-2", category: "interstate" },
  { name: "H-3", ref: "H-3", category: "interstate" },

  // US Routes — major
  { name: "US-1", ref: "US-1", category: "us_route", aka: ["US Route 1", "Overseas Highway"] },
  { name: "US-2", ref: "US-2", category: "us_route" },
  { name: "US-6", ref: "US-6", category: "us_route" },
  { name: "US-11", ref: "US-11", category: "us_route" },
  { name: "US-12", ref: "US-12", category: "us_route" },
  { name: "US-20", ref: "US-20", category: "us_route" },
  { name: "US-30", ref: "US-30", category: "us_route", aka: ["Lincoln Highway"] },
  { name: "US-40", ref: "US-40", category: "us_route" },
  { name: "US-41", ref: "US-41", category: "us_route" },
  { name: "US-50", ref: "US-50", category: "us_route", aka: ["Loneliest Road"] },
  { name: "US-60", ref: "US-60", category: "us_route" },
  { name: "US-66", ref: "US-66", category: "us_route", aka: ["Route 66", "Historic 66"] },
  { name: "US-70", ref: "US-70", category: "us_route" },
  { name: "US-80", ref: "US-80", category: "us_route" },
  { name: "US-89", ref: "US-89", category: "us_route" },
  { name: "US-90", ref: "US-90", category: "us_route" },
  { name: "US-93", ref: "US-93", category: "us_route" },
  { name: "US-95", ref: "US-95", category: "us_route" },
  { name: "US-97", ref: "US-97", category: "us_route" },
  { name: "US-101", ref: "US-101", category: "us_route", aka: ["101"] },
  { name: "US-191", ref: "US-191", category: "us_route" },
  { name: "US-395", ref: "US-395", category: "us_route" },
  { name: "US-550", ref: "US-550", category: "us_route", aka: ["Million Dollar Highway"] },

  // Named scenic + state highways
  { name: "PCH", ref: "CA-1", category: "scenic", aka: ["Pacific Coast Highway", "Highway 1", "Cabrillo"] },
  { name: "Blue Ridge Parkway", ref: "BRP", category: "scenic", aka: ["BRP"] },
  { name: "Going-to-the-Sun Road", ref: "GTSR", category: "scenic", aka: ["Glacier"] },
  { name: "Trail Ridge Road", ref: "US-34", category: "scenic", aka: ["Rocky Mountain"] },
  { name: "Beartooth Highway", ref: "US-212", category: "scenic" },
  { name: "Kancamagus Highway", ref: "NH-112", category: "scenic", aka: ["The Kanc"] },
  { name: "Skyline Drive", ref: "Skyline", category: "scenic", aka: ["Shenandoah"] },
  { name: "Hana Highway", ref: "HI-360", category: "scenic", aka: ["Road to Hana"] },
  { name: "Chain of Craters Road", ref: "HI-CCR", category: "scenic" },
  { name: "Saddle Road", ref: "HI-200", category: "scenic" },
  { name: "Hawaii Belt Road", ref: "HI-11", category: "scenic", aka: ["Mamalahoa", "Big Island Belt"] },
  { name: "Natchez Trace Parkway", ref: "NTP", category: "scenic" },
  { name: "Overseas Highway", ref: "US-1-FL", category: "scenic", aka: ["Keys Highway"] },
  { name: "Avenue of the Giants", ref: "CA-254", category: "scenic" },
  { name: "Seventeen Mile Drive", ref: "17MD", category: "scenic", aka: ["17 Mile"] },
  { name: "Tail of the Dragon", ref: "US-129", category: "scenic", aka: ["Dragon"] },
  { name: "Loveland Pass", ref: "US-6-CO", category: "scenic" },
  { name: "Dalton Highway", ref: "AK-11", category: "scenic", aka: ["Haul Road"] },
  { name: "Seward Highway", ref: "AK-1", category: "scenic" },
  { name: "Richardson Highway", ref: "AK-4", category: "scenic" },
];

export function searchHighways(q: string, limit = 8): HighwayOption[] {
  if (!q.trim()) return HIGHWAYS.slice(0, limit);
  const needle = q.toLowerCase().replace(/\s+/g, " ").trim();
  const scored = HIGHWAYS.map((h) => {
    const hay = [h.name, h.ref, ...(h.aka || [])].join(" ").toLowerCase();
    let score = 0;
    if (h.name.toLowerCase() === needle) score += 100;
    if (h.ref.toLowerCase() === needle) score += 90;
    if (hay.includes(needle)) score += 10;
    if (hay.startsWith(needle)) score += 5;
    return { h, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.h);
}
