import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { QuickCapture } from "@/components/capture/QuickCapture";

/**
 * /capture \u2014 mobile-first one-tap Tracks save.
 *
 * Shows what's currently playing (from Spotify) with a single large Save
 * button. Falls back to the last 5 recent tracks. No photo required \u2014 album
 * art stands in. For richer captures (location, note, real photo) use /pair.
 */
export default async function CapturePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <AppShell>
      <QuickCapture />
    </AppShell>
  );
}
