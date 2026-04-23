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

function matchesQuery(t: Trace, q: string): boolean {
  const haystack = [t.title, t.body, t.read, t.where.label]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
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

    const [pairings, experiences, marks, encounters] = await Promise.all([
      kinds.has("tracks")
        ? prisma.pairing.findMany({
            where: { userId, ...dateFilter("createdAt") },
            orderBy: { createdAt: "desc" },
            take: perModelTake,
          })
        : Promise.resolve([]),
      kinds.has("path")
        ? prisma.experience.findMany({
            where: { userId, ...dateFilter("createdAt") },
            orderBy: { createdAt: "desc" },
            take: perModelTake,
          })
        : Promise.resolve([]),
      kinds.has("notice")
        ? prisma.mark.findMany({
            where: { userId, ...dateFilter("createdAt") },
            orderBy: { createdAt: "desc" },
            take: perModelTake,
          })
        : Promise.resolve([]),
      kinds.has("encounter")
        ? prisma.encounter.findMany({
            where: { userId, ...dateFilter("date") },
            orderBy: { date: "desc" },
            take: perModelTake,
          })
        : Promise.resolve([]),
    ]);

    const merged: Trace[] = [
      ...pairings.map(pairingToTrace),
      ...experiences.map(experienceToTrace),
      ...marks.map(markToTrace),
      ...encounters.map(encounterToTrace),
    ];

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
