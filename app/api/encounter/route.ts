import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDailyQuestion, pickEncounterEcho } from "@/lib/anthropic";
import { makeShareSlug } from "@/lib/share";

/**
 * Returns the current 12-hour encounter question for the user. Each global
 * half-day window (UTC 00:00-11:59 and 12:00-23:59) gets its own question.
 * If the user already has an encounter created inside the current window it's
 * returned as-is; otherwise a fresh question is generated. When a new
 * encounter is created, Claude picks an optional echoOfId — a past encounter
 * this question rhymes with. When present, the echo is hydrated inline.
 */

function currentWindowStart(now: Date = new Date()): Date {
  const d = new Date(now);
  // Truncate to the nearest prior half-day boundary in UTC.
  const hours = d.getUTCHours() < 12 ? 0 : 12;
  d.setUTCHours(hours, 0, 0, 0);
  return d;
}

type EchoPayload = {
  id: string;
  question: string;
  answer: string | null;
  date: Date;
} | null;

async function hydrateEcho(echoOfId: string | null): Promise<EchoPayload> {
  if (!echoOfId) return null;
  const echo = await prisma.encounter.findUnique({
    where: { id: echoOfId },
    select: { id: true, question: true, answer: true, date: true },
  });
  return echo ?? null;
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const windowStart = currentWindowStart();

  // Look for the user's encounter in the current 12-hour window.
  let encounter = await prisma.encounter.findFirst({
    where: {
      userId: session.user.id,
      date: { gte: windowStart },
    },
    orderBy: { date: "desc" },
  });

  if (!encounter) {
    const question = await generateDailyQuestion();

    // Pull up to 50 most recent resolved past encounters as echo candidates.
    // Resolved = landed set OR sittingWith=true. Unanswered ones aren't
    // meaningful echoes.
    const past = await prisma.encounter.findMany({
      where: {
        userId: session.user.id,
        OR: [{ landed: { not: null } }, { sittingWith: true }],
      },
      orderBy: { date: "desc" },
      take: 50,
      select: { id: true, question: true },
    });

    const echoOfId = await pickEncounterEcho(question, past);

    encounter = await prisma.encounter.create({
      data: {
        userId: session.user.id,
        question,
        echoOfId: echoOfId ?? null,
        shareSlug: makeShareSlug(),
      },
    });
  }

  const echo = await hydrateEcho(encounter.echoOfId);
  return NextResponse.json({ ...encounter, echo });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, landed, answer, sittingWith } = body as {
    id: string;
    landed?: boolean | null;
    answer?: string | null;
    sittingWith?: boolean;
  };

  // Verify ownership (Prisma requires the where clause to match uniquely)
  const existing = await prisma.encounter.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build update payload only from provided fields so callers can
  // update landed, answer, sittingWith, or any combination.
  const data: {
    landed?: boolean | null;
    answer?: string | null;
    sittingWith?: boolean;
  } = {};
  if (landed !== undefined) {
    data.landed = landed;
    // Choosing landed/didn't-land clears sittingWith. They're mutually
    // exclusive resolutions.
    if (landed !== null) data.sittingWith = false;
  }
  if (answer !== undefined) {
    const trimmed = typeof answer === "string" ? answer.trim() : "";
    data.answer = trimmed.length > 0 ? trimmed : null;
  }
  if (sittingWith !== undefined) {
    data.sittingWith = sittingWith;
    // Choosing sit-with-it clears landed (back to null).
    if (sittingWith) data.landed = null;
  }

  const encounter = await prisma.encounter.update({
    where: { id },
    data,
  });

  const echo = await hydrateEcho(encounter.echoOfId);
  return NextResponse.json({ ...encounter, echo });
}
