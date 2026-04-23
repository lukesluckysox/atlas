import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
 * Merged feed of every trace the user has captured. Queries all four models,
 * maps through adapters in lib/trace.ts, merges, sorts reverse-chrono.
 *
 * Query params:
 *   kind   — tracks | path | notice | encounter   (repeatable; default: all)
 *   since  — ISO date; only traces at/after this timestamp
 *   q      — free-text filter; matched against title/body/read/where-label
 *   limit  — max results; default 200, cap 500
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const sp = req.nextUrl.searchParams;
  const kinds = parseKinds(sp);
  const sinceStr = sp.get("since");
  const since = sinceStr ? new Date(sinceStr) : null;
  const q = (sp.get("q") || "").trim().toLowerCase();
  const limitRaw = parseInt(sp.get("limit") || "200", 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 200 : limitRaw, 1), 500);

  const dateFilter = since && !isNaN(since.getTime()) ? { gte: since } : undefined;

  // Per-kind query promises. Skipped entirely if kind not requested.
  const [pairings, experiences, marks, encounters] = await Promise.all([
    kinds.has("tracks")
      ? prisma.pairing.findMany({
          where: {
            userId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    kinds.has("path")
      ? prisma.experience.findMany({
          where: {
            userId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    kinds.has("notice")
      ? prisma.mark.findMany({
          where: {
            userId,
            ...(dateFilter ? { createdAt: dateFilter } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
    kinds.has("encounter")
      ? prisma.encounter.findMany({
          where: {
            userId,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          orderBy: { date: "desc" },
          take: limit,
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

  const clamped = filtered.slice(0, limit);

  const counts = {
    tracks: clamped.filter((t) => t.kind === "tracks").length,
    path: clamped.filter((t) => t.kind === "path").length,
    notice: clamped.filter((t) => t.kind === "notice").length,
    encounter: clamped.filter((t) => t.kind === "encounter").length,
    total: clamped.length,
  };

  return NextResponse.json({ traces: clamped, counts });
}
