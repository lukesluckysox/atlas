import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { CollectionsList } from "@/components/collections/CollectionsList";
import { ProGate } from "@/components/collections/ProGate";

export default async function CollectionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  // Re-read isPro so stale JWTs don't lock out paying users.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });

  return (
    <AppShell>
      {user?.isPro ? <CollectionsList /> : <ProGate />}
    </AppShell>
  );
}
