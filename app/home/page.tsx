import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";

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
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
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
