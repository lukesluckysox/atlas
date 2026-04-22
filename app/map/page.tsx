import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ExperienceMap } from "@/components/map/ExperienceMap";

export default async function MapPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const [experiences, geoMarks] = await Promise.all([
    prisma.experience.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mark.findMany({
      where: {
        userId: session.user.id,
        latitude: { not: null },
        longitude: { not: null },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Fold geotagged notices into the same list as experiences so they render
  // as pins on the map. IDs are prefixed with `mark_` so the client can
  // route edits/deletes to /api/marks/[id] instead of /api/experiences/[id].
  const noticesAsExperiences = geoMarks.map((m) => ({
    id: `mark_${m.id}`,
    type: "notice",
    name: m.content.length > 60 ? `${m.content.slice(0, 60)}…` : m.content,
    location: null,
    latitude: m.latitude,
    longitude: m.longitude,
    date: m.createdAt,
    note: m.content,
  }));

  const merged = [...experiences, ...noticesAsExperiences].sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );

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
        experiences={merged}
        stats={stats}
        isPro={session.user.isPro}
      />
    </AppShell>
  );
}
