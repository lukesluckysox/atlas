import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PairStudio } from "@/components/pair/PairStudio";

export default async function PairPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <AppShell>
      <PairStudio isPro={session.user.isPro} />
    </AppShell>
  );
}
