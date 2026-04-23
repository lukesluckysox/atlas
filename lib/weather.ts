// Passive weather + moon capture for any trace with coords.
// Source: Open-Meteo (no key, free). Silent-fail: if anything breaks,
// return nulls. We never block a save on this.

export interface WeatherSnap {
  weatherTemp: number | null;
  weatherCode: number | null;
  weatherLabel: string | null;
  moonPhase: number | null;
}

const EMPTY: WeatherSnap = {
  weatherTemp: null,
  weatherCode: null,
  weatherLabel: null,
  moonPhase: null,
};

// WMO weather codes -> terse labels. Parchment vibe, not app-store weather.
const LABELS: Record<number, string> = {
  0: "clear",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "freezing drizzle",
  57: "freezing drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "showers",
  81: "showers",
  82: "heavy showers",
  85: "snow showers",
  86: "snow showers",
  95: "thunder",
  96: "thunder + hail",
  99: "thunder + hail",
};

export function labelFor(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  return LABELS[code] ?? null;
}

// Moon phase as a 0..1 fraction where 0 = new, 0.5 = full.
// Astronomical approximation, accurate to ~1 day. No external call.
export function moonPhase(date: Date = new Date()): number {
  // Reference new moon: 2000-01-06 18:14 UTC
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodic = 29.530588853; // days
  const days = (date.getTime() - ref) / 86400000;
  const phase = ((days % synodic) + synodic) % synodic / synodic;
  return phase;
}

export function moonPhaseLabel(phase: number | null | undefined): string | null {
  if (phase === null || phase === undefined) return null;
  if (phase < 0.03 || phase > 0.97) return "new moon";
  if (phase < 0.22) return "waxing crescent";
  if (phase < 0.28) return "first quarter";
  if (phase < 0.47) return "waxing gibbous";
  if (phase < 0.53) return "full moon";
  if (phase < 0.72) return "waning gibbous";
  if (phase < 0.78) return "last quarter";
  return "waning crescent";
}

// Pull current weather for a location. Never throws.
export async function fetchWeather(
  lat: number | null | undefined,
  lng: number | null | undefined,
  at: Date = new Date()
): Promise<WeatherSnap> {
  const moon = moonPhase(at);
  if (lat == null || lng == null) {
    return { ...EMPTY, moonPhase: moon };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
    const res = await fetch(url, {
      // Short timeout via AbortSignal; if Open-Meteo is slow we bail.
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
    });
    if (!res.ok) return { ...EMPTY, moonPhase: moon };
    const j = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };
    const temp = j.current?.temperature_2m ?? null;
    const code = j.current?.weather_code ?? null;
    return {
      weatherTemp: temp !== null ? Math.round(temp) : null,
      weatherCode: code,
      weatherLabel: labelFor(code),
      moonPhase: moon,
    };
  } catch {
    return { ...EMPTY, moonPhase: moon };
  }
}
