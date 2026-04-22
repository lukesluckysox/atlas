import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const marks = await prisma.mark.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(marks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { content, photoUrl, latitude, longitude, photoLum, photoWarmth } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const mark = await prisma.mark.create({
    data: {
      userId: session.user.id,
      content: content.trim(),
      photoUrl,
      latitude,
      longitude,
      photoLum: typeof photoLum === "number" ? photoLum : undefined,
      photoWarmth: typeof photoWarmth === "number" ? photoWarmth : undefined,
    },
  });

  return NextResponse.json(mark);
}
