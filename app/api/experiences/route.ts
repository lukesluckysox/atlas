import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const experiences = await prisma.experience.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(experiences);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });

  if (!dbUser?.isPro) {
    const count = await prisma.experience.count({
      where: { userId: session.user.id },
    });
    if (count >= 50) {
      return NextResponse.json(
        { error: "Free tier limit reached. Upgrade to Pro for unlimited experiences." },
        { status: 403 }
      );
    }
  }

  const body = await req.json();
  const {
    type,
    name,
    location,
    latitude,
    longitude,
    date,
    note,
    photoUrl,
    photoLum,
    photoWarmth,
  } = body;

  if (!type || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const experience = await prisma.experience.create({
    data: {
      userId: session.user.id,
      type,
      name,
      location,
      latitude,
      longitude,
      date: date ? new Date(date) : undefined,
      note,
      photoUrl,
      photoLum: typeof photoLum === "number" ? photoLum : undefined,
      photoWarmth: typeof photoWarmth === "number" ? photoWarmth : undefined,
    },
  });

  return NextResponse.json(experience);
}
