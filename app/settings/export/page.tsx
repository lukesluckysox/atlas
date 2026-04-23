import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format as fmt } from "date-fns";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import ExportControls from "@/components/settings/ExportControls";

// Printable export view. Tab layout shows every trace grouped by year+kind.
// User clicks browser Print \u2192 Save as PDF. No external PDF dep.
//
// This page renders server-side so print-preview is deterministic: no
// loading states, no images half-loaded. The JSON export is a plain
// download from /api/export.

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const userId = session.user.id;
  const [pairings, experiences, marks, encounters] = await Promise.all([
    prisma.pairing.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.experience.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.mark.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.encounter.findMany({
      where: { userId, answer: { not: null } },
      orderBy: { date: "desc" },
    }),
  ]);

  const total =
    pairings.length + experiences.length + marks.length + encounters.length;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-10 print:py-0 print:px-0">
        <div className="print:hidden mb-8">
          <PageHeader
            label="Export"
            h1="Your traces, your copy."
            tagline="Download a JSON backup or print a paper record. Your data stays yours."
          />
          <div className="mt-6">
            <ExportControls total={total} />
          </div>
        </div>

        {/* Print-only preview. Structured so one year prints per page group. */}
        <article className="export-sheet">
          <header className="mb-10 print:mb-6 border-b border-earth/20 pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-earth/50">
              Trace Export \u00b7 {fmt(new Date(), "MMMM d, yyyy")}
            </p>
            <h1 className="font-serif text-4xl mt-2">A record of what you traced.</h1>
            <p className="text-earth/60 mt-2 text-sm">
              {total} traces \u00b7 {pairings.length} tracks \u00b7 {experiences.length}{" "}
              paths \u00b7 {marks.length} moments \u00b7 {encounters.length} encounters
            </p>
          </header>

          {pairings.length > 0 && (
            <Section title="Tracks">
              {pairings.map((p) => (
                <Entry
                  key={p.id}
                  date={p.createdAt}
                  headline={`${p.trackName} \u2014 ${p.artistName}`}
                  body={p.caption || p.note || ""}
                  meta={p.location ?? undefined}
                />
              ))}
            </Section>
          )}

          {experiences.length > 0 && (
            <Section title="Paths">
              {experiences.map((e) => (
                <Entry
                  key={e.id}
                  date={e.date ?? e.createdAt}
                  headline={`${e.type} \u00b7 ${e.name}`}
                  body={e.note || ""}
                  meta={e.location ?? undefined}
                />
              ))}
            </Section>
          )}

          {marks.length > 0 && (
            <Section title="Moments">
              {marks.map((m) => (
                <Entry
                  key={m.id}
                  date={m.createdAt}
                  headline={m.keyword || m.summary || null}
                  body={m.content}
                />
              ))}
            </Section>
          )}

          {encounters.length > 0 && (
            <Section title="Encounters">
              {encounters.map((e) => (
                <Entry
                  key={e.id}
                  date={e.date}
                  headline={e.question}
                  body={e.answer || ""}
                />
              ))}
            </Section>
          )}
        </article>

        {/* Print styles scoped to this page */}
        <style>{`
          @media print {
            body { background: white; }
            .export-sheet { max-width: none; }
            h2 { page-break-before: auto; page-break-after: avoid; }
            .entry { page-break-inside: avoid; }
          }
        `}</style>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 print:mb-6">
      <h2 className="font-serif text-2xl mb-4 border-b border-earth/15 pb-2 print:text-xl">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Entry({
  date,
  headline,
  body,
  meta,
}: {
  date: Date | string;
  headline: string | null;
  body: string;
  meta?: string;
}) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <div className="entry">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-earth/50">
        {fmt(d, "MMMM d, yyyy")}
        {meta ? ` \u00b7 ${meta}` : ""}
      </p>
      {headline && (
        <p className="font-serif text-lg text-earth mt-1">{headline}</p>
      )}
      {body && (
        <p className="text-earth/80 text-sm leading-relaxed whitespace-pre-wrap mt-1">
          {body}
        </p>
      )}
    </div>
  );
}
