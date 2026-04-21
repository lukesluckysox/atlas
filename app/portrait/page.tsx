import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PortraitView } from "@/components/portrait/PortraitView";

export default async function PortraitPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  if (!session.user.isPro) {
    redirect("/settings");
  }

  const portrait = await prisma.portrait.findUnique({
    where: { userId: session.user.id },
  });

  const [pairingCount, experienceCount, encounterCount, markCount] = await Promise.all([
    prisma.pairing.count({ where: { userId: session.user.id } }),
    prisma.experience.count({ where: { userId: session.user.id } }),
    prisma.encounter.count({ where: { userId: session.user.id, landed: { not: null } } }),
    prisma.mark.count({ where: { userId: session.user.id } }),
  ]);

  return (
    <AppShell>
      <PortraitView
        portrait={portrait}
        dataCount={{ pairingCount, experienceCount, encounterCount, markCount }}
      />
    </AppShell>
  );
}
