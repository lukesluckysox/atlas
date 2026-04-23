import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { CollectionDetail } from "@/components/collections/CollectionDetail";
import { ProGate } from "@/components/collections/ProGate";

export default async function CollectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });

  return (
    <AppShell>
      {user?.isPro ? <CollectionDetail id={params.id} /> : <ProGate />}
    </AppShell>
  );
}
