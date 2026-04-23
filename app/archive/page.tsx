import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArchiveFeed } from "@/components/archive/ArchiveFeed";

/**
 * Archive — the unified feed of every trace across all four kinds.
 *
 * One place to see what you captured, chronologically. Filtering and search
 * happen client-side against /api/traces. Taps into kind-native pages.
 */
export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-12 animate-page-in">
        <PageHeader
          label="Archive"
          h1="Everything you've traced."
          tagline="Tracks, paths, notices, encounters. One timeline."
        />
        <ArchiveFeed />
      </div>
    </AppShell>
  );
}
