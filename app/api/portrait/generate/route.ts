import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePortrait } from "@/lib/anthropic";

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user.isPro) {
    return NextResponse.json({ error: "Pro required" }, { status: 403 });
  }

  const [pairings, experiences, encounters, marks] = await Promise.all([
    prisma.pairing.findMany({
      where: { userId: session.user.id },
      select: { trackName: true, artistName: true, note: true, location: true },
    }),
    prisma.experience.findMany({
      where: { userId: session.user.id },
      select: { type: true, name: true, location: true },
    }),
    prisma.encounter.findMany({
      where: { userId: session.user.id, landed: { not: null } },
      select: { question: true, landed: true },
    }),
    prisma.mark.findMany({
      where: { userId: session.user.id },
      select: { content: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const portrait = await generatePortrait({ pairings, experiences, encounters, marks });

  const saved = await prisma.portrait.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...portrait },
    update: { ...portrait, generatedAt: new Date() },
  });

  return NextResponse.json(saved);
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const portrait = await prisma.portrait.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(portrait);
}
