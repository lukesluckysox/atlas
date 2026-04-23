"use client";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";

interface HomeDashboardProps {
  recentPairings: Array<{
    id: string;
    photoUrl: string;
    trackName: string;
    artistName: string;
    albumArt?: string | null;
    createdAt: Date;
  }>;
  experienceCount: number;
  encounterToday: { question: string; landed?: boolean | null } | null;
  recentMarks: Array<{ id: string; content: string; createdAt: Date }>;
  pairingsToday: number;
  marksToday: number;
  latestExperience: { name: string; location?: string | null } | null;
  roadsCount: number;
  roadsMiles: number;
}

export function HomeDashboard({
  recentPairings,
  experienceCount,
  encounterToday,
  recentMarks,
  pairingsToday,
  marksToday,
  latestExperience,
  roadsCount,
  roadsMiles,
}: HomeDashboardProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Morning." : hour < 17 ? "Afternoon." : "Evening.";

  const lastPairing = recentPairings[0];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-page-in">
      <div className="mb-12">
        <p className="label mb-2">{format(new Date(), "EEEE, MMMM d")}</p>
        <h1 className="font-serif text-4xl text-earth">{greeting}</h1>
        <p className="font-mono text-xs text-earth/40 mt-2">
          A photo, a place, a thing you noticed. That&rsquo;s the whole idea.
        </p>
      </div>

      {/* Today-strip: three cells, each one action. Instant legibility. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-earth/10 mb-16">
        {/* Cell 1: Encounter (or Notice prompt if no encounter) */}
        {encounterToday ? (
          <Link
            href="/encounter"
            className="bg-parchment p-6 hover:bg-earth/2 transition-colors group flex flex-col justify-between min-h-[180px]"
          >
            <p className="label">Today&rsquo;s question</p>
            <blockquote className="font-serif text-base text-earth leading-snug my-4 line-clamp-3">
              {encounterToday.question}
            </blockquote>
            <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40 group-hover:text-amber transition-colors">
              {encounterToday.landed === null || encounterToday.landed === undefined
                ? "Answer →"
                : encounterToday.landed
                ? "Landed ✓"
                : "Didn’t land"}
            </p>
          </Link>
        ) : (
          <Link
            href="/mark"
            className="bg-parchment p-6 hover:bg-earth/2 transition-colors group flex flex-col justify-between min-h-[180px]"
          >
            <p className="label">Today</p>
            <p className="font-serif text-2xl text-earth my-4">
              {marksToday === 0 ? "Nothing noticed yet." : `${marksToday} noticed.`}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40 group-hover:text-amber transition-colors">
              {marksToday === 0 ? "Notice something →" : "Add another →"}
            </p>
          </Link>
        )}

        {/* Cell 2: Last pairing (with thumb) or CTA */}
        {lastPairing ? (
          <Link
            href="/explore"
            className="bg-parchment hover:bg-earth/2 transition-colors group relative overflow-hidden min-h-[180px]"
          >
            <Image
              src={lastPairing.photoUrl}
              alt={lastPairing.trackName}
              fill
              className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-earth/90 via-earth/30 to-transparent" />
            <div className="relative p-6 h-full flex flex-col justify-between min-h-[180px]">
              <p className="label text-parchment/70">Last track</p>
              <div>
                <p className="font-serif text-base text-parchment leading-tight truncate">
                  {lastPairing.trackName}
                </p>
                <p className="font-mono text-xs text-parchment/70 truncate">
                  {lastPairing.artistName}
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-parchment/60 group-hover:text-amber transition-colors">
                Archive →
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href="/pair"
            className="bg-parchment p-6 hover:bg-earth/2 transition-colors group flex flex-col justify-between min-h-[180px]"
          >
            <p className="label">Tracks</p>
            <p className="font-serif text-2xl text-earth my-4">
              First pairing.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40 group-hover:text-amber transition-colors">
              A photo, a track →
            </p>
          </Link>
        )}

        {/* Cell 3: Path count + last place + roads */}
        <Link
          href="/map"
          className="bg-parchment p-6 hover:bg-earth/2 transition-colors group flex flex-col justify-between min-h-[180px]"
        >
          <p className="label">Path</p>
          <div className="my-4">
            <p className="font-serif text-3xl text-earth leading-none">
              {experienceCount}
            </p>
            <p className="font-mono text-xs text-earth/50 mt-1">
              {experienceCount === 1 ? "place" : "places"}
              {roadsCount > 0 && (
                <span className="text-earth/40">
                  {" · "}
                  {roadsMiles.toLocaleString()} mi on {roadsCount}{" "}
                  {roadsCount === 1 ? "road" : "roads"}
                </span>
              )}
            </p>
            {latestExperience && (
              <p className="font-mono text-xs text-earth/60 mt-3 truncate">
                Last: {latestExperience.name}
              </p>
            )}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40 group-hover:text-amber transition-colors">
            {experienceCount === 0 && roadsCount === 0
              ? "Log your first →"
              : "Open map →"}
          </p>
        </Link>
      </div>

      {pairingsToday > 0 && (
        <p className="font-mono text-xs text-earth/40 mb-8 -mt-8">
          {pairingsToday} {pairingsToday === 1 ? "track" : "tracks"} today.
        </p>
      )}

      {recentPairings.length > 0 && (
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <p className="label">Recent tracks</p>
            <Link
              href="/explore"
              className="font-mono text-xs text-earth/40 hover:text-earth transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-earth/10">
            {recentPairings.map((pairing) => (
              <div key={pairing.id} className="group relative aspect-square overflow-hidden bg-earth/5">
                <Image
                  src={pairing.photoUrl}
                  alt={pairing.trackName}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-earth/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <p className="font-mono text-xs text-parchment truncate">
                    {pairing.trackName}
                  </p>
                  <p className="font-mono text-xs text-parchment/60 truncate">
                    {pairing.artistName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentPairings.length === 0 && (
        <div className="mb-16 border border-earth/10 p-12 text-center">
          <p className="font-mono text-sm text-earth/40">
            Nothing here yet. Go somewhere. Hear something.
          </p>
          <Link href="/pair" className="btn-primary inline-block mt-6">
            First pairing
          </Link>
        </div>
      )}

      {recentMarks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="label">Recent notices</p>
            <Link
              href="/mark"
              className="font-mono text-xs text-earth/40 hover:text-earth transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-px">
            {recentMarks.map((mark) => (
              <div key={mark.id} className="flex items-start gap-6 bg-parchment border-b border-earth/5 py-4">
                <span className="font-mono text-xs text-earth/30 mt-1 shrink-0">
                  {format(new Date(mark.createdAt), "MMM d")}
                </span>
                <p className="font-mono text-sm text-earth/70">{mark.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
