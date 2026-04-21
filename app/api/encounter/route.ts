import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDailyQuestion } from "@/lib/anthropic";

/**
 * Returns the current 12-hour encounter question for the user. Each global
 * half-day window (UTC 00:00-11:59 and 12:00-23:59) gets its own question.
 * If the user already has an encounter created inside the current window it's
 * returned as-is; otherwise a fresh question is generated.
 */

function currentWindowStart(now: Date = new Date()): Date {
  const d = new Date(now);
  // Truncate to the nearest prior half-day boundary in UTC.
  const hours = d.getUTCHours() < 12 ? 0 : 12;
  d.setUTCHours(hours, 0, 0, 0);
  return d;
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
    encounter = await prisma.encounter.create({
      data: {
        userId: session.user.id,
        question,
      },
    });
  }

  return NextResponse.json(encounter);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, landed, answer } = body as {
    id: string;
    landed?: boolean | null;
    answer?: string | null;
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
  // update either landed, answer, or both.
  const data: { landed?: boolean | null; answer?: string | null } = {};
  if (landed !== undefined) data.landed = landed;
  if (answer !== undefined) {
    const trimmed = typeof answer === "string" ? answer.trim() : "";
    data.answer = trimmed.length > 0 ? trimmed : null;
  }

  const encounter = await prisma.encounter.update({
    where: { id },
    data,
  });

  return NextResponse.json(encounter);
}
