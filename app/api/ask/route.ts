import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { askTrace } from "@/lib/anthropic";
import { reportError } from "@/lib/observability";

/**
 * POST /api/ask
 *
 * Answer a user's free-text question about their own traces. Retrieval is
 * intentionally simple: if the question contains identifiable keywords (nouns
 * 4+ chars) we prefilter rows via Prisma's case-insensitive contains across
 * every searchable column. We always add a recency slice on top so the model
 * has fresh context even when keyword hits are sparse.
 *
 * The LLM is instructed (see askTrace) to stay grounded — "not enough signal"
 * is a valid answer when the retrieval is thin.
 */

// Lowercased stopwords we drop before keyword search. Kept small on purpose —
// false positives from stopwords are worse than missing a rare query word.
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "with", "you", "your", "from", "about",
  "what", "when", "where", "which", "that", "this", "have", "has", "had",
  "was", "were", "did", "do", "does", "how", "why", "been", "being",
  "would", "could", "should", "like", "into", "onto", "over", "under",
  "near", "last", "some", "many", "much", "most", "any", "all", "more",
]);

function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 6);
}

// Max rows per kind pulled into the model context. Balance: enough signal,
// short enough to stay within Claude's context budget.
const RECENT_CAP = 25;
const KEYWORD_CAP = 25;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json({ error: "Question required" }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ error: "Question too long (max 500 chars)" }, { status: 400 });
    }

    const keywords = extractKeywords(question);

    // Build a per-model OR filter across keywords. Any row matching any keyword
    // on any searchable column gets pulled into the model context.
    const kwFilter = <T extends Record<string, unknown>>(rows: T[]): T[] => rows;
    void kwFilter; // placeholder for lint; actual filtering happens in Prisma below

    // Recent slice — always included so thin-keyword questions still have context.
    const [recentPairings, recentExperiences, recentEncounters, recentMarks] = await Promise.all([
      prisma.pairing.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: RECENT_CAP,
        select: { trackName: true, artistName: true, note: true, location: true, createdAt: true },
      }),
      prisma.experience.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: RECENT_CAP,
        select: { type: true, name: true, location: true, date: true, note: true },
      }),
      prisma.encounter.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: RECENT_CAP,
        select: { question: true, answer: true, landed: true, date: true },
      }),
      prisma.mark.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: RECENT_CAP,
        select: { content: true, createdAt: true },
      }),
    ]);

    // Keyword slice — only if we extracted any words worth searching for.
    let kwPairings: typeof recentPairings = [];
    let kwExperiences: typeof recentExperiences = [];
    let kwEncounters: typeof recentEncounters = [];
    let kwMarks: typeof recentMarks = [];

    if (keywords.length > 0) {
      const pairingsOR = keywords.flatMap((k) => [
        { trackName: { contains: k, mode: "insensitive" as const } },
        { artistName: { contains: k, mode: "insensitive" as const } },
        { note: { contains: k, mode: "insensitive" as const } },
        { caption: { contains: k, mode: "insensitive" as const } },
        { location: { contains: k, mode: "insensitive" as const } },
      ]);
      const experiencesOR = keywords.flatMap((k) => [
        { name: { contains: k, mode: "insensitive" as const } },
        { type: { contains: k, mode: "insensitive" as const } },
        { location: { contains: k, mode: "insensitive" as const } },
        { note: { contains: k, mode: "insensitive" as const } },
      ]);
      const encountersOR = keywords.flatMap((k) => [
        { question: { contains: k, mode: "insensitive" as const } },
        { answer: { contains: k, mode: "insensitive" as const } },
      ]);
      const marksOR = keywords.flatMap((k) => [
        { content: { contains: k, mode: "insensitive" as const } },
        { summary: { contains: k, mode: "insensitive" as const } },
        { keyword: { contains: k, mode: "insensitive" as const } },
      ]);

      [kwPairings, kwExperiences, kwEncounters, kwMarks] = await Promise.all([
        prisma.pairing.findMany({
          where: { userId, OR: pairingsOR },
          orderBy: { createdAt: "desc" },
          take: KEYWORD_CAP,
          select: { trackName: true, artistName: true, note: true, location: true, createdAt: true },
        }),
        prisma.experience.findMany({
          where: { userId, OR: experiencesOR },
          orderBy: { createdAt: "desc" },
          take: KEYWORD_CAP,
          select: { type: true, name: true, location: true, date: true, note: true },
        }),
        prisma.encounter.findMany({
          where: { userId, OR: encountersOR },
          orderBy: { date: "desc" },
          take: KEYWORD_CAP,
          select: { question: true, answer: true, landed: true, date: true },
        }),
        prisma.mark.findMany({
          where: { userId, OR: marksOR },
          orderBy: { createdAt: "desc" },
          take: KEYWORD_CAP,
          select: { content: true, createdAt: true },
        }),
      ]);
    }

    // Dedupe by a natural-ish key per kind. Recent slice gets priority; keyword
    // matches append unless already present.
    const pairings = dedupe(
      [...recentPairings, ...kwPairings],
      (p) => `${p.trackName}|${p.artistName}|${p.createdAt.toISOString()}`
    );
    const experiences = dedupe(
      [...recentExperiences, ...kwExperiences],
      (e) => `${e.type}|${e.name}|${(e.date ?? new Date(0)).toISOString()}`
    );
    const encounters = dedupe(
      [...recentEncounters, ...kwEncounters],
      (e) => `${e.question}|${e.date.toISOString()}`
    );
    const marks = dedupe(
      [...recentMarks, ...kwMarks],
      (m) => `${m.content.slice(0, 40)}|${m.createdAt.toISOString()}`
    );

    const totalContext = pairings.length + experiences.length + encounters.length + marks.length;
    if (totalContext === 0) {
      return NextResponse.json({
        answer: "Not enough signal yet. Log a few traces first, then ask.",
        citations: [],
      });
    }

    const result = await askTrace(question, {
      pairings,
      experiences,
      encounters,
      marks,
    });

    return NextResponse.json(result);
  } catch (err) {
    reportError(err, { route: "POST /api/ask" });
    return NextResponse.json({ error: "Could not ask." }, { status: 500 });
  }
}

function dedupe<T>(items: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
