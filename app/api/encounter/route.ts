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

  const { id, landed } = await req.json();

  const encounter = await prisma.encounter.update({
    where: { id, userId: session.user.id },
    data: { landed },
  });

  return NextResponse.json(encounter);
}
