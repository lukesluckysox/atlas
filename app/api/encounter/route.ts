import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDailyQuestion } from "@/lib/anthropic";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let encounter = await prisma.encounter.findFirst({
    where: {
      userId: session.user.id,
      date: { gte: today },
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
