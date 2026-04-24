import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { ExperienceMap } from "@/components/map/ExperienceMap";
import { lookupBoundary } from "@/lib/boundaries";

// Map accepts a ?new=1&q=...&lat=...&lng=...&location=...&kind=... hand-off
// from /home. When present, ExperienceMap opens the log panel prefilled.
export default async function MapPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const sp = searchParams ? await searchParams : {};
  const pick = (k: string): string | null => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const initial =
    pick("new") === "1" && pick("q")
      ? {
          q: pick("q")!,
          location: pick("location"),
          lat: pick("lat") ? Number(pick("lat")) : null,
          lng: pick("lng") ? Number(pick("lng")) : null,
          kind: pick("kind"),
        }
      : null;

  const [experiences, geoMarks, roads] = await Promise.all([
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
    prisma.highwayStretch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Backfill boundaries for state/country entries logged before the feature existed.
  // Cheap: in-memory lookup from a static geojson. Only hydrates at read-time;
  // doesn't persist, so new entries (via POST) are the source of truth.
  const hydratedExperiences = experiences.map((e) => {
    if (e.boundary) return e;
    if (e.type !== "state" && e.type !== "country") return e;
    const b = lookupBoundary(e.type, e.name);
    return b ? { ...e, boundary: b } : e;
  });

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

  const merged = [...hydratedExperiences, ...noticesAsExperiences].sort(
    (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()
  );

  // Prisma types `boundary` as JsonValue; the client treats it as a narrower
  // GeoJSON polygon shape. Cast at the boundary (pun intended) rather than
  // proving it to TS repeatedly.
  const mergedForClient = merged as unknown as Parameters<typeof ExperienceMap>[0]["experiences"];

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
        experiences={mergedForClient}
        stats={stats}
        isPro={session.user.isPro}
        initial={initial}
        roads={roads.map((r) => ({
          id: r.id,
          name: r.name,
          ref: r.ref,
          category: r.category,
          startLabel: r.startLabel,
          endLabel: r.endLabel,
          distanceMi: r.distanceMi,
          drivenAt: r.drivenAt ? r.drivenAt.toISOString() : null,
          drivenNote: r.drivenNote,
          geometry: r.geometry as { type: "LineString"; coordinates: [number, number][] },
        }))}
      />
    </AppShell>
  );
}
