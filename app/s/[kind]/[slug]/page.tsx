import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { moonPhaseLabel } from "@/lib/weather";
import Image from "next/image";

// Public, unauthenticated, read-only share view. Renders a single trace
// with parchment styling and a quiet "Traced on Trace" wordmark link.

export const dynamic = "force-dynamic";

async function load(kind: string, slug: string) {
  if (kind === "track") {
    const p = await prisma.pairing.findUnique({ where: { shareSlug: slug } });
    if (!p) return null;
    const u = await prisma.user.findUnique({
      where: { id: p.userId },
      select: { username: true, name: true },
    });
    return { ...p, _author: u?.username || u?.name || "someone", _kind: "track" as const };
  }
  if (kind === "path") {
    const e = await prisma.experience.findUnique({ where: { shareSlug: slug } });
    if (!e) return null;
    const u = await prisma.user.findUnique({
      where: { id: e.userId },
      select: { username: true, name: true },
    });
    return { ...e, _author: u?.username || u?.name || "someone", _kind: "path" as const };
  }
  if (kind === "moment") {
    const m = await prisma.mark.findUnique({ where: { shareSlug: slug } });
    if (!m) return null;
    const u = await prisma.user.findUnique({
      where: { id: m.userId },
      select: { username: true, name: true },
    });
    return { ...m, _author: u?.username || u?.name || "someone", _kind: "moment" as const };
  }
  if (kind === "encounter") {
    const enc = await prisma.encounter.findUnique({ where: { shareSlug: slug } });
    if (!enc || !enc.answer) return null;
    const u = await prisma.user.findUnique({
      where: { id: enc.userId },
      select: { username: true, name: true },
    });
    return { ...enc, _author: u?.username || u?.name || "someone", _kind: "encounter" as const };
  }
  return null;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function WeatherLine({
  label,
  temp,
  moon,
}: {
  label: string | null | undefined;
  temp: number | null | undefined;
  moon: number | null | undefined;
}) {
  const parts: string[] = [];
  if (label) parts.push(label);
  if (temp !== null && temp !== undefined) parts.push(`${temp}\u00b0`);
  const m = moonPhaseLabel(moon);
  if (m) parts.push(m);
  if (parts.length === 0) return null;
  return (
    <p className="text-sm text-earth/50 italic tracking-wide">
      {parts.join(" \u00b7 ")}
    </p>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ kind: string; slug: string }>;
}) {
  const { kind, slug } = await params;
  const trace = await load(kind, slug);
  if (!trace) notFound();

  return (
    <div className="min-h-screen bg-parchment text-earth flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-earth/10">
        <Link href="/" className="font-serif text-xl tracking-wide">
          Trace
        </Link>
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-earth/60 hover:text-earth"
        >
          Start your own
        </Link>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 md:py-20">
        <p className="text-xs uppercase tracking-[0.25em] text-earth/50 mb-4">
          A {trace._kind} from {trace._author}
        </p>

        {trace._kind === "track" && (
          <article className="space-y-6">
            {trace.photoUrl && (
              <div className="relative w-full aspect-square overflow-hidden rounded-sm bg-earth/5">
                <Image
                  src={trace.photoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div>
              <h1 className="font-serif text-3xl md:text-4xl leading-tight">
                {trace.trackName}
              </h1>
              <p className="text-earth/70 mt-1">{trace.artistName}</p>
            </div>
            {trace.caption && (
              <p className="font-serif text-lg italic text-earth/80 leading-relaxed">
                {trace.caption}
              </p>
            )}
            {trace.note && (
              <p className="text-earth/80 leading-relaxed whitespace-pre-wrap">
                {trace.note}
              </p>
            )}
            <div className="text-sm text-earth/60 space-y-1 pt-4 border-t border-earth/10">
              {trace.location && <p>{trace.location}</p>}
              <p>{formatDate(trace.createdAt)}</p>
              <WeatherLine
                label={trace.weatherLabel}
                temp={trace.weatherTemp}
                moon={trace.moonPhase}
              />
            </div>
          </article>
        )}

        {trace._kind === "path" && (
          <article className="space-y-6">
            {trace.photoUrl && (
              <div className="relative w-full aspect-[4/3] overflow-hidden rounded-sm bg-earth/5">
                <Image
                  src={trace.photoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-earth/50 mb-1">
                {trace.type}
              </p>
              <h1 className="font-serif text-3xl md:text-4xl leading-tight">
                {trace.name}
              </h1>
              {trace.location && (
                <p className="text-earth/70 mt-1">{trace.location}</p>
              )}
            </div>
            {trace.note && (
              <p className="text-earth/80 leading-relaxed whitespace-pre-wrap">
                {trace.note}
              </p>
            )}
            <div className="text-sm text-earth/60 space-y-1 pt-4 border-t border-earth/10">
              {trace.date && <p>{formatDate(trace.date)}</p>}
              <WeatherLine
                label={trace.weatherLabel}
                temp={trace.weatherTemp}
                moon={trace.moonPhase}
              />
            </div>
          </article>
        )}

        {trace._kind === "moment" && (
          <article className="space-y-6">
            {trace.photoUrl && (
              <div className="relative w-full aspect-square overflow-hidden rounded-sm bg-earth/5">
                <Image
                  src={trace.photoUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            {trace.keyword && (
              <p className="text-xs uppercase tracking-[0.25em] text-amber">
                {trace.keyword}
              </p>
            )}
            <p className="font-serif text-2xl md:text-3xl leading-relaxed text-earth">
              {trace.content}
            </p>
            <div className="text-sm text-earth/60 space-y-1 pt-4 border-t border-earth/10">
              <p>{formatDate(trace.createdAt)}</p>
              <WeatherLine
                label={trace.weatherLabel}
                temp={trace.weatherTemp}
                moon={trace.moonPhase}
              />
            </div>
          </article>
        )}

        {trace._kind === "encounter" && (
          <article className="space-y-6">
            <p className="font-serif text-2xl md:text-3xl leading-relaxed text-earth">
              {trace.question}
            </p>
            <p className="text-earth/80 leading-relaxed whitespace-pre-wrap text-lg">
              {trace.answer}
            </p>
            <div className="text-sm text-earth/60 pt-4 border-t border-earth/10">
              <p>{formatDate(trace.date)}</p>
            </div>
          </article>
        )}
      </main>

      <footer className="px-6 py-6 text-center border-t border-earth/10">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-earth/50 hover:text-earth"
        >
          Traced on Trace
        </Link>
      </footer>
    </div>
  );
}
