import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { summarizeNotice } from "@/lib/anthropic";
import { fetchWeather } from "@/lib/weather";
import { makeShareSlug } from "@/lib/share";

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
  const { content, photoUrl, audioUrl, latitude, longitude, photoLum, photoWarmth } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  // Generate a lightweight keyword / short-phrase summary + fetch weather in
  // parallel. Both fail graceful; save never blocks on either.
  const [summary, weather] = await Promise.all([
    summarizeNotice(content.trim()),
    fetchWeather(latitude, longitude),
  ]);

  const mark = await prisma.mark.create({
    data: {
      userId: session.user.id,
      content: content.trim(),
      keyword: summary.keyword,
      summary: summary.summary,
      photoUrl,
      audioUrl,
      latitude,
      longitude,
      photoLum: typeof photoLum === "number" ? photoLum : undefined,
      photoWarmth: typeof photoWarmth === "number" ? photoWarmth : undefined,
      weatherTemp: weather.weatherTemp,
      weatherCode: weather.weatherCode,
      weatherLabel: weather.weatherLabel,
      moonPhase: weather.moonPhase,
      shareSlug: makeShareSlug(),
    },
  });

  return NextResponse.json(mark);
}
