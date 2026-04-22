import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PairStudio } from "@/components/pair/PairStudio";
import { prisma } from "@/lib/prisma";

export default async function PairPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  // Two most-recent pairings power the "lands in archive" ribbon shown after save.
  const recentPairings = await prisma.pairing.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { id: true, photoUrl: true, albumArt: true, trackName: true },
  });

  return (
    <AppShell>
      <PairStudio isPro={session.user.isPro} recentPairings={recentPairings} />
    </AppShell>
  );
}
