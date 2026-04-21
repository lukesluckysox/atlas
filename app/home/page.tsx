import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";

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

  const [recentPairings, experienceCount, encounterToday, recentMarks] = await Promise.all([
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
  ]);

  return (
    <AppShell>
      <HomeDashboard
        user={session.user}
        recentPairings={recentPairings}
        experienceCount={experienceCount}
        encounterToday={encounterToday}
        recentMarks={recentMarks}
      />
    </AppShell>
  );
}
