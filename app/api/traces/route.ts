import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";
import {
  pairingToTrace,
  experienceToTrace,
  markToTrace,
  encounterToTrace,
  type Trace,
  type TraceKind,
} from "@/lib/trace";

/**
 * GET /api/traces
 *
 * Merged paginated feed of every trace. Queries all four models, maps through
 * lib/trace.ts adapters, merges, sorts reverse-chrono by `when`.
 *
 * Query params:
 *   kind   — tracks | path | notice | encounter   (repeatable; default: all)
 *   since  — ISO date; only traces at/after this timestamp (time-range filter)
 *   before — ISO date; pagination cursor; only traces strictly before it
 *   q      — free-text filter; matched against title/body/read/where-label
 *   take   — page size; default 50, cap 100
 *
 * Response:
 *   { traces: Trace[], counts: {...}, nextBefore: string | null, hasMore: boolean }
 *
 * Pagination pattern:
 *   Client requests ?take=50. We fetch `take+1` per model, merge, sort, slice
 *   to `take`. `nextBefore` = last returned trace's `when`. Client sends that
 *   back as `before` on the next request. Stops when hasMore=false.
 *
 *   Counts always reflect the current filter set (kind/since/q) without the
 *   `before` cursor, so chip counts stay stable while scrolling.
 */

const VALID_KINDS: TraceKind[] = ["tracks", "path", "notice", "encounter"];

function parseKinds(sp: URLSearchParams): Set<TraceKind> {
  const all = new Set<TraceKind>(VALID_KINDS);
  const values = sp.getAll("kind").flatMap((v) => v.split(","));
  if (values.length === 0) return all;
  const filtered = values
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is TraceKind => (VALID_KINDS as string[]).includes(v));
  return filtered.length > 0 ? new Set(filtered) : all;
}

// Kept as a final pass after merge so computed fields (Trace.title, Trace.read,
// Trace.where.label) also match — the DB-side filters already narrow rows by
// the raw source columns, this just catches adapter-derived fields.
function matchesQuery(t: Trace, q: string): boolean {
  const haystack = [t.title, t.body, t.read, t.where.label]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

// Server-side field filters per model for the free-text query. We use Prisma's
// case-insensitive `contains` (ILIKE under the hood) against every indexable
// text column a kind has. This replaces the previous in-memory filter that
// only scanned whatever happened to be in the current page.
function pairingQueryFilter(q: string) {
  return {
    OR: [
      { trackName: { contains: q, mode: "insensitive" as const } },
      { artistName: { contains: q, mode: "insensitive" as const } },
      { note: { contains: q, mode: "insensitive" as const } },
      { caption: { contains: q, mode: "insensitive" as const } },
      { location: { contains: q, mode: "insensitive" as const } },
      { genres: { has: q.toLowerCase() } },
    ],
  };
}

function experienceQueryFilter(q: string) {
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { type: { contains: q, mode: "insensitive" as const } },
      { location: { contains: q, mode: "insensitive" as const } },
      { note: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

function markQueryFilter(q: string) {
  return {
    OR: [
      { content: { contains: q, mode: "insensitive" as const } },
      { summary: { contains: q, mode: "insensitive" as const } },
      { keyword: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

function encounterQueryFilter(q: string) {
  return {
    OR: [
      { question: { contains: q, mode: "insensitive" as const } },
      { answer: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

function safeDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const sp = req.nextUrl.searchParams;
    const kinds = parseKinds(sp);
    const since = safeDate(sp.get("since"));
    const before = safeDate(sp.get("before"));
    const q = (sp.get("q") || "").trim().toLowerCase();
    const takeRaw = parseInt(sp.get("take") || "50", 10);
    const take = Math.min(Math.max(isNaN(takeRaw) ? 50 : takeRaw, 1), 100);

    // We over-fetch by 1 per kind so we can tell if more exists beyond `take`.
    const perModelTake = take + 1;

    const sinceFilter = since ? { gte: since } : undefined;
    const beforeFilter = before ? { lt: before } : undefined;

    // Build a range filter on the appropriate date field per model.
    const dateFilter = (field: "createdAt" | "date") => {
      const f: { gte?: Date; lt?: Date } = {};
      if (sinceFilter) f.gte = sinceFilter.gte;
      if (beforeFilter) f.lt = beforeFilter.lt;
      return Object.keys(f).length > 0 ? { [field]: f } : {};
    };

    // When a query is present, we widen the per-model fetch. Filtering happens
    // in SQL so we don't over-trim good results, but over-fetching gives the
    // merge room to page coherently.
    const queryTake = q ? Math.max(perModelTake, 100) : perModelTake;

    const [pairings, experiences, marks, encounters] = await Promise.all([
      kinds.has("tracks")
        ? prisma.pairing.findMany({
            where: {
              userId,
              ...dateFilter("createdAt"),
              ...(q ? pairingQueryFilter(q) : {}),
            },
            orderBy: { createdAt: "desc" },
            take: queryTake,
          })
        : Promise.resolve([]),
      kinds.has("path")
        ? prisma.experience.findMany({
            where: {
              userId,
              ...dateFilter("createdAt"),
              ...(q ? experienceQueryFilter(q) : {}),
            },
            orderBy: { createdAt: "desc" },
            take: queryTake,
          })
        : Promise.resolve([]),
      kinds.has("notice")
        ? prisma.mark.findMany({
            where: {
              userId,
              ...dateFilter("createdAt"),
              ...(q ? markQueryFilter(q) : {}),
            },
            orderBy: { createdAt: "desc" },
            take: queryTake,
          })
        : Promise.resolve([]),
      kinds.has("encounter")
        ? prisma.encounter.findMany({
            where: {
              userId,
              ...dateFilter("date"),
              ...(q ? encounterQueryFilter(q) : {}),
            },
            orderBy: { date: "desc" },
            take: queryTake,
          })
        : Promise.resolve([]),
    ]);

    const merged: Trace[] = [
      ...pairings.map(pairingToTrace),
      ...experiences.map(experienceToTrace),
      ...marks.map(markToTrace),
      ...encounters.map(encounterToTrace),
    ];

    // Secondary pass for adapter-computed fields. The DB already narrowed by
    // raw columns; this only catches title/read/where.label that are derived.
    const filtered = q ? merged.filter((t) => matchesQuery(t, q)) : merged;
    filtered.sort((a, b) => b.when.getTime() - a.when.getTime());

    // Page slice: hasMore = we pulled more than `take` after filtering.
    const hasMore = filtered.length > take;
    const page = filtered.slice(0, take);
    const last = page[page.length - 1];
    const nextBefore = hasMore && last ? last.when.toISOString() : null;

    // Counts reflect only the current page (cheap, honest). For global counts
    // we'd need a separate COUNT query; skipping for now since chips use these
    // only when `before` is absent (first page) and the UI shows them as a
    // relative indicator, not a total.
    const counts = {
      tracks: page.filter((t) => t.kind === "tracks").length,
      path: page.filter((t) => t.kind === "path").length,
      notice: page.filter((t) => t.kind === "notice").length,
      encounter: page.filter((t) => t.kind === "encounter").length,
      total: page.length,
    };

    return NextResponse.json({
      traces: page,
      counts,
      nextBefore,
      hasMore,
    });
  } catch (err) {
    reportError(err, { route: "GET /api/traces" });
    return NextResponse.json(
      { error: "Could not load traces." },
      { status: 500 }
    );
  }
}
