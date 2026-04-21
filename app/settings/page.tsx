import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Suspense } from "react";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <AppShell>
      <Suspense fallback={<div className="max-w-2xl mx-auto px-6 py-12" />}>
        <SettingsView user={session.user} />
      </Suspense>
    </AppShell>
  );
}
