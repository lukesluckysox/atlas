import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import OnboardingGate from "@/components/onboarding/OnboardingGate";

// Align with /api/encounter — two 12-hour windows a day, UTC-anchored.
function currentWindowStart(): Date {
  const d = new Date();
  const hours = d.getUTCHours() < 12 ? 0 : 12;
  d.setUTCHours(hours, 0, 0, 0);
  return d;
}

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  // Local day boundary (server runs UTC; client shows user's day). We
  // approximate "today" with the UTC day window, which is close enough for
  // the today-strip. The strip forgives minor drift.
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    recentPairings,
    experienceCount,
    encounterToday,
    recentMarks,
    pairingsToday,
    marksToday,
    latestExperience,
    roadsCount,
    roadsMiles,
  ] = await Promise.all([
    prisma.pairing.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.experience.count({ where: { userId: session.user.id } }),
    prisma.encounter.findFirst({
      where: {
        userId: session.user.id,
        date: { gte: currentWindowStart() },
      },
    }),
    prisma.mark.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    prisma.pairing.count({
      where: { userId: session.user.id, createdAt: { gte: startOfToday } },
    }),
    prisma.mark.count({
      where: { userId: session.user.id, createdAt: { gte: startOfToday } },
    }),
    prisma.experience.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { name: true, location: true },
    }),
    prisma.highwayStretch.count({ where: { userId: session.user.id } }),
    prisma.highwayStretch.aggregate({
      where: { userId: session.user.id },
      _sum: { distanceMi: true },
    }),
  ]);

  return (
    <AppShell>
      <OnboardingGate />
      <HomeDashboard
        recentPairings={recentPairings}
        experienceCount={experienceCount}
        encounterToday={encounterToday}
        recentMarks={recentMarks}
        pairingsToday={pairingsToday}
        marksToday={marksToday}
        latestExperience={latestExperience}
        roadsCount={roadsCount}
        roadsMiles={Math.round(roadsMiles._sum.distanceMi ?? 0)}
      />
    </AppShell>
  );
}
