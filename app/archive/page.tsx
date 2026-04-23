import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArchiveTabs } from "@/components/archive/ArchiveTabs";

/**
 * Archive — the unified feed of every trace across all four kinds.
 *
 * One place to see what you captured, chronologically. Filtering and search
 * happen client-side against /api/traces. Taps into kind-native pages.
 */
export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  // Re-read isPro so the AddToCollection affordance respects current Pro status.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true },
  });

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-12 animate-page-in">
        <PageHeader
          label="Archive"
          h1="Everything you've traced."
          tagline="Tracks, paths, moments, encounters. One timeline."
          right={
            <Link
              href="/ask"
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-earth/70 hover:text-earth border border-earth/20 hover:border-amber hover:text-amber transition-colors px-3 py-1.5"
            >
              <Sparkles size={12} />
              Ask Trace
            </Link>
          }
        />
        <ArchiveTabs isPro={!!user?.isPro} />
      </div>
    </AppShell>
  );
}
