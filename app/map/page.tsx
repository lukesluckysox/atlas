import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ExperienceMap } from "@/components/map/ExperienceMap";

export default async function MapPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const experiences = await prisma.experience.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: experiences.length,
    countries: new Set(
      experiences
        .filter((e: { type: string }) => e.type === "country")
        .map((e: { name: string }) => e.name)
    ).size,
    nationalParks: experiences.filter((e: { type: string }) => e.type === "national_park").length,
    concerts: experiences.filter((e: { type: string }) => e.type === "concert").length,
  };

  return (
    <AppShell>
      <ExperienceMap
        experiences={experiences}
        stats={stats}
        isPro={session.user.isPro}
      />
    </AppShell>
  );
}
