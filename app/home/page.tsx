import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import OnboardingGate from "@/components/onboarding/OnboardingGate";

// Home shows the ONE most recent of every kind (track, path, question,
// moment). Archive is where the full feeds live. The idea is that Home is
// the pulse — what's latest, what's today, what's next — not a scrollable
// history. No overlap with Archive.

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");
  const userId = session.user.id;

  const [latestPairing, latestExperience, latestEncounter, latestMark] =
    await Promise.all([
      prisma.pairing.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          photoUrl: true,
          trackName: true,
          artistName: true,
          albumArt: true,
          createdAt: true,
        },
      }),
      prisma.experience.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          name: true,
          location: true,
          photoUrl: true,
          createdAt: true,
        },
      }),
      prisma.encounter.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: {
          id: true,
          question: true,
          answer: true,
          landed: true,
          sittingWith: true,
          date: true,
        },
      }),
      prisma.mark.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          photoUrl: true,
          createdAt: true,
        },
      }),
    ]);

  return (
    <AppShell>
      <OnboardingGate />
      <HomeDashboard
        latestPairing={latestPairing}
        latestExperience={latestExperience}
        latestEncounter={latestEncounter}
        latestMark={latestMark}
      />
    </AppShell>
  );
}
