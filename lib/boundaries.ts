/**
 * Boundary lookup for state/country experiences.
 *
 * Reads GeoJSON files from /public/boundaries on first use and caches
 * feature-by-name indexes in memory. Only runs server-side (uses fs).
 */
import fs from "fs";
import path from "path";

type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

type Feature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: Geometry;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Feature[];
};

let statesIndex: Map<string, Geometry> | null = null;
let countriesIndex: Map<string, Geometry> | null = null;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function loadJson(file: string): FeatureCollection | null {
  try {
    const p = path.join(process.cwd(), "public", "boundaries", file);
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as FeatureCollection;
  } catch {
    return null;
  }
}

function buildStatesIndex(): Map<string, Geometry> {
  if (statesIndex) return statesIndex;
  const fc = loadJson("us-states.geojson");
  const idx = new Map<string, Geometry>();
  if (fc) {
    for (const f of fc.features) {
      const name = (f.properties?.name as string) || "";
      if (name) idx.set(norm(name), f.geometry);
    }
  }
  statesIndex = idx;
  return idx;
}

function buildCountriesIndex(): Map<string, Geometry> {
  if (countriesIndex) return countriesIndex;
  const fc = loadJson("world-countries.geojson");
  const idx = new Map<string, Geometry>();
  if (fc) {
    for (const f of fc.features) {
      const p = f.properties || {};
      const names: string[] = [];
      for (const key of ["ADMIN", "NAME", "NAME_LONG", "FORMAL_EN", "SOVEREIGNT"]) {
        const v = p[key];
        if (typeof v === "string" && v) names.push(v);
      }
      for (const n of names) {
        const k = norm(n);
        if (!idx.has(k)) idx.set(k, f.geometry);
      }
    }
  }
  countriesIndex = idx;
  return idx;
}

// Common aliases so "USA" / "U.S." / "America" all resolve.
const COUNTRY_ALIASES: Record<string, string[]> = {
  "unitedstatesofamerica": ["usa", "us", "unitedstates", "america", "theunitedstates"],
  "unitedkingdom": ["uk", "greatbritain", "britain"],
  "russianfederation": ["russia"],
  "czechia": ["czechrepublic"],
  "myanmar": ["burma"],
  "southkorea": ["koreasouth", "republicofkorea"],
  "northkorea": ["koreanorth", "democraticpeoplesrepublicofkorea"],
};

function tryAliasLookup(key: string, idx: Map<string, Geometry>): Geometry | null {
  for (const [canon, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.includes(key)) {
      const hit = idx.get(canon);
      if (hit) return hit;
    }
    if (canon === key) {
      for (const a of aliases) {
        const hit = idx.get(a);
        if (hit) return hit;
      }
    }
  }
  return null;
}

export function lookupStateBoundary(name: string): Geometry | null {
  if (!name) return null;
  const idx = buildStatesIndex();
  return idx.get(norm(name)) ?? null;
}

export function lookupCountryBoundary(name: string): Geometry | null {
  if (!name) return null;
  const idx = buildCountriesIndex();
  const k = norm(name);
  return idx.get(k) ?? tryAliasLookup(k, idx);
}

/**
 * Look up a boundary by experience type + name. Returns a GeoJSON geometry
 * (Polygon or MultiPolygon) or null if not found.
 */
export function lookupBoundary(type: string, name: string): Geometry | null {
  if (type === "state") return lookupStateBoundary(name);
  if (type === "country") return lookupCountryBoundary(name);
  return null;
}
