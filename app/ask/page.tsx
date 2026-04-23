import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AskTrace } from "@/components/ask/AskTrace";

/**
 * Ask — free-text Q&A against your own traces. Not a chatbot, not therapy.
 * Grounded lookups only; model is told to say "not enough signal yet" when
 * the retrieval is thin.
 */
export default async function AskPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-6 py-12 animate-page-in">
        <PageHeader
          label="Ask"
          h1="Ask Trace."
          tagline="Questions about what you've captured. Grounded in your own traces."
        />
        <AskTrace />
      </div>
    </AppShell>
  );
}
