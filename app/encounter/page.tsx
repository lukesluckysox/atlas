import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EncounterView } from "@/components/encounter/EncounterView";

export default async function EncounterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <AppShell>
      <EncounterView />
    </AppShell>
  );
}
