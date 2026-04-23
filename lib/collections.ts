import { prisma } from "@/lib/prisma";

// Valid trace kinds for collection items. Mirrors lib/trace.ts.
export const COLLECTION_KINDS = ["tracks", "path", "notice", "encounter"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export function isValidKind(k: unknown): k is CollectionKind {
  return typeof k === "string" && (COLLECTION_KINDS as readonly string[]).includes(k);
}

/**
 * Re-read isPro from the DB. A stale JWT shouldn't lock out paying users,
 * and we use collections to gate Pro-only functionality.
 */
export async function requirePro(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true },
  });
  return !!u?.isPro;
}

type HydratedItem = {
  id: string;
  kind: CollectionKind;
  refId: string;
  addedAt: Date;
  // Null when the referenced trace was deleted (soft ref). Callers filter.
  trace: {
    id: string;
    title: string;
    subtitle?: string | null;
    image?: string | null;
    date: Date;
  } | null;
};

/**
 * Hydrate CollectionItem rows by fetching the underlying trace for each kind
 * in one round-trip per kind. Preserves the input order (addedAt desc).
 */
export async function hydrateItems(
  items: Array<{ id: string; kind: string; refId: string; addedAt: Date }>
): Promise<HydratedItem[]> {
  const byKind: Record<string, string[]> = { tracks: [], path: [], notice: [], encounter: [] };
  for (const it of items) {
    if (isValidKind(it.kind)) byKind[it.kind].push(it.refId);
  }

  const [pairings, experiences, marks, encounters] = await Promise.all([
    byKind.tracks.length
      ? prisma.pairing.findMany({
          where: { id: { in: byKind.tracks } },
          select: { id: true, trackName: true, artistName: true, albumArt: true, photoUrl: true, createdAt: true },
        })
      : [],
    byKind.path.length
      ? prisma.experience.findMany({
          where: { id: { in: byKind.path } },
          select: { id: true, name: true, type: true, date: true, createdAt: true },
        })
      : [],
    byKind.notice.length
      ? prisma.mark.findMany({
          where: { id: { in: byKind.notice } },
          select: { id: true, content: true, createdAt: true },
        })
      : [],
    byKind.encounter.length
      ? prisma.encounter.findMany({
          where: { id: { in: byKind.encounter } },
          select: { id: true, question: true, answer: true, date: true },
        })
      : [],
  ]);

  const lookup: Record<CollectionKind, Map<string, HydratedItem["trace"]>> = {
    tracks: new Map(
      pairings.map((p) => [
        p.id,
        {
          id: p.id,
          title: p.trackName,
          subtitle: p.artistName,
          image: p.albumArt ?? p.photoUrl,
          date: p.createdAt,
        },
      ])
    ),
    path: new Map(
      experiences.map((e) => [
        e.id,
        { id: e.id, title: e.name, subtitle: e.type, image: null, date: e.date ?? e.createdAt },
      ])
    ),
    notice: new Map(
      marks.map((m) => [
        m.id,
        {
          id: m.id,
          title: m.content.slice(0, 80) + (m.content.length > 80 ? "\u2026" : ""),
          subtitle: null,
          image: null,
          date: m.createdAt,
        },
      ])
    ),
    encounter: new Map(
      encounters.map((e) => [
        e.id,
        { id: e.id, title: e.question, subtitle: e.answer, image: null, date: e.date },
      ])
    ),
  };

  return items.map((it) => ({
    id: it.id,
    kind: it.kind as CollectionKind,
    refId: it.refId,
    addedAt: it.addedAt,
    trace: isValidKind(it.kind) ? lookup[it.kind].get(it.refId) ?? null : null,
  }));
}
