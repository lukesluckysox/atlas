import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportError } from "@/lib/observability";

/**
 * GET /api/streak
 *
 * Returns the user's current streak of consecutive days with at least one
 * trace (any kind: tracks, path, notice, encounter). Also returns longest
 * streak and the timestamp of the last trace.
 *
 * Streak rules (intentionally forgiving):
 *   - A day counts if ANY trace kind has ≥1 entry that day (UTC day boundary)
 *   - Streak is "current" if today or yesterday has a trace (grace period for
 *     timezone edge cases and late-night / early-morning captures)
 *   - First day without a trace breaks the streak
 *
 * Performance: we pull the last 400 days of trace timestamps (just the date
 * fields, no payload) and reduce in-memory. This is cheap: 4 indexed queries
 * on userId + date column, projecting one field each.
 */

const LOOKBACK_DAYS = 400;

function dayKey(d: Date): string {
  // UTC day boundary. Matches DB timestamp semantics.
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const lookback = addDays(new Date(), -LOOKBACK_DAYS);

    // Pull only timestamps from each model. Small payload.
    const [pairings, experiences, marks, encounters] = await Promise.all([
      prisma.pairing.findMany({
        where: { userId, createdAt: { gte: lookback } },
        select: { createdAt: true },
      }),
      prisma.experience.findMany({
        where: { userId, createdAt: { gte: lookback } },
        select: { createdAt: true },
      }),
      prisma.mark.findMany({
        where: { userId, createdAt: { gte: lookback } },
        select: { createdAt: true },
      }),
      prisma.encounter.findMany({
        where: { userId, date: { gte: lookback } },
        select: { date: true },
      }),
    ]);

    // Build a set of days that have at least one trace.
    const activeDays = new Set<string>();
    for (const p of pairings) activeDays.add(dayKey(p.createdAt));
    for (const e of experiences) activeDays.add(dayKey(e.createdAt));
    for (const m of marks) activeDays.add(dayKey(m.createdAt));
    for (const e of encounters) activeDays.add(dayKey(e.date));

    const todayKey = dayKey(new Date());
    const yesterdayKey = dayKey(addDays(new Date(), -1));

    // Current streak: walk back from today. If today isn't active, start from
    // yesterday (grace period). If neither, streak is 0.
    let current = 0;
    let cursor: Date;
    if (activeDays.has(todayKey)) {
      cursor = new Date();
    } else if (activeDays.has(yesterdayKey)) {
      cursor = addDays(new Date(), -1);
    } else {
      current = 0;
      cursor = new Date();
    }

    if (activeDays.has(dayKey(cursor))) {
      while (activeDays.has(dayKey(cursor))) {
        current += 1;
        cursor = addDays(cursor, -1);
      }
    }

    // Longest streak within lookback window: sort keys, walk consecutive days.
    const sortedDays = Array.from(activeDays).sort();
    let longest = 0;
    let run = 0;
    let prev: string | null = null;
    for (const day of sortedDays) {
      if (prev === null) {
        run = 1;
      } else {
        const expected = dayKey(addDays(new Date(prev + "T00:00:00Z"), 1));
        run = day === expected ? run + 1 : 1;
      }
      if (run > longest) longest = run;
      prev = day;
    }

    // Most recent trace timestamp across all kinds.
    const allTimes = [
      ...pairings.map((p) => p.createdAt.getTime()),
      ...experiences.map((e) => e.createdAt.getTime()),
      ...marks.map((m) => m.createdAt.getTime()),
      ...encounters.map((e) => e.date.getTime()),
    ];
    const lastTraceAt =
      allTimes.length > 0 ? new Date(Math.max(...allTimes)).toISOString() : null;

    return NextResponse.json({
      current,
      longest,
      lastTraceAt,
      tracedToday: activeDays.has(todayKey),
    });
  } catch (err) {
    reportError(err, { route: "GET /api/streak" });
    return NextResponse.json(
      { error: "Could not load streak." },
      { status: 500 }
    );
  }
}
