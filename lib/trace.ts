/**
 * Trace — the shared shape for every entry in the app.
 *
 * Tracks, Path, Notice, and Encounter are all variations of a trace. The DB
 * keeps them in four separate models (Pairing, Experience, Mark, Encounter)
 * for query efficiency, but the UI should treat them as one family.
 *
 * Adapters in this file convert each model into a Trace. Use Trace wherever
 * cross-type rendering shows up (home feeds, hover cards, timelines).
 *
 * ─── VOCABULARY (canonical UI terms) ───────────────────────────────────────
 *   trace     — the universal entry (verb or noun, UI-only)
 *   mark      — the act of capturing a notice  (verb)
 *   notice    — a quick observation            (noun, DB: Mark)
 *   path      — a saved place or route         (noun, DB: Experience)
 *   tracks    — photo + song pairing           (noun, DB: Pairing)
 *   encounter — a question you answered        (noun, DB: Encounter)
 *   capture   — starting an entry
 *   save      — persisting an entry
 *   read      — the generated read-back (caption, keyword, summary)
 *
 * Avoid: "experience" as a UI noun, "road" as a page label (road is a
 * subtype of path), "reflection"/"insight" (therapy-speak).
 */

export type TraceKind = "tracks" | "path" | "notice" | "encounter";

/** One-word tone tag derived from photo mood bands (golden/noon/ember/midnight). */
export type TraceTone = "golden" | "noon" | "ember" | "midnight" | "balanced" | null;

export interface TraceWhere {
  label: string | null;
  lat: number | null;
  lng: number | null;
}

export interface Trace {
  id: string;
  kind: TraceKind;
  /** Freeform one-line description of what happened. */
  title: string;
  /** Longer body if the entry has it (pair note, mark content, encounter answer). */
  body: string | null;
  when: Date;
  where: TraceWhere;
  tone: TraceTone;
  /** The app's own read-back: caption, keyword, or summary. Null if none yet. */
  read: string | null;
  /** Photo URL if the trace has one. */
  photoUrl: string | null;
  /** Stable link into the app for this trace. */
  href: string;
}

// ─── Photo-mood helper ─────────────────────────────────────────────────────

function toneFrom(lum: number | null | undefined, warmth: number | null | undefined): TraceTone {
  if (lum == null || warmth == null) return null;
  const high = 0.62;
  const low = 0.38;
  const lumBand = lum >= high ? "bright" : lum <= low ? "dark" : "mid";
  const warmBand = warmth >= high ? "warm" : warmth <= low ? "cool" : "neutral";
  if (lumBand === "bright" && warmBand === "warm") return "golden";
  if (lumBand === "bright" && warmBand === "cool") return "noon";
  if (lumBand === "dark" && warmBand === "warm") return "ember";
  if (lumBand === "dark" && warmBand === "cool") return "midnight";
  return "balanced";
}

// ─── Adapters ──────────────────────────────────────────────────────────────

export function pairingToTrace(p: {
  id: string;
  photoUrl: string;
  trackName: string;
  artistName: string;
  note: string | null;
  caption: string | null;
  captionDismissed: boolean;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photoLum: number | null;
  photoWarmth: number | null;
  createdAt: Date;
}): Trace {
  return {
    id: p.id,
    kind: "tracks",
    title: `${p.trackName} · ${p.artistName}`,
    body: p.note,
    when: p.createdAt,
    where: { label: p.location, lat: p.latitude, lng: p.longitude },
    tone: toneFrom(p.photoLum, p.photoWarmth),
    read: p.captionDismissed ? null : p.caption,
    photoUrl: p.photoUrl,
    href: `/explore?open=${p.id}`,
  };
}

export function experienceToTrace(e: {
  id: string;
  type: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  date: Date | null;
  note: string | null;
  photoUrl: string | null;
  photoLum: number | null;
  photoWarmth: number | null;
  createdAt: Date;
}): Trace {
  return {
    id: e.id,
    kind: "path",
    title: e.name,
    body: e.note,
    when: e.date ?? e.createdAt,
    where: { label: e.location, lat: e.latitude, lng: e.longitude },
    tone: toneFrom(e.photoLum, e.photoWarmth),
    read: null,
    photoUrl: e.photoUrl,
    href: `/map?focus=${e.id}`,
  };
}

export function markToTrace(m: {
  id: string;
  content: string;
  summary: string | null;
  keyword: string | null;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  photoLum: number | null;
  photoWarmth: number | null;
  createdAt: Date;
}): Trace {
  return {
    id: m.id,
    kind: "notice",
    title: m.content,
    body: null,
    when: m.createdAt,
    where: {
      label:
        m.latitude != null && m.longitude != null
          ? `${m.latitude.toFixed(2)}, ${m.longitude.toFixed(2)}`
          : null,
      lat: m.latitude,
      lng: m.longitude,
    },
    tone: toneFrom(m.photoLum, m.photoWarmth),
    // Prefer keyword as the primary read; summary is longer + italicized.
    read: m.keyword ?? m.summary ?? null,
    photoUrl: m.photoUrl,
    href: `/mark#${m.id}`,
  };
}

export function encounterToTrace(e: {
  id: string;
  question: string;
  answer: string | null;
  landed: boolean | null;
  date: Date;
}): Trace {
  return {
    id: e.id,
    kind: "encounter",
    title: e.question,
    body: e.answer,
    when: e.date,
    where: { label: null, lat: null, lng: null },
    tone: null,
    read: e.landed === true ? "landed" : e.landed === false ? "passed" : null,
    photoUrl: null,
    href: `/encounter#${e.id}`,
  };
}

// ─── Labels ────────────────────────────────────────────────────────────────

export const TRACE_KIND_LABEL: Record<TraceKind, string> = {
  tracks: "Tracks",
  path: "Path",
  notice: "Notice",
  encounter: "Encounter",
};

export const TRACE_TONE_LABEL: Record<NonNullable<TraceTone>, string> = {
  golden: "Golden hour",
  noon: "Noon",
  ember: "Ember",
  midnight: "Midnight",
  balanced: "Balanced",
};
