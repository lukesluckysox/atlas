"use client";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { MapPin, Music, Compass, Pencil } from "lucide-react";

interface HomeDashboardProps {
  user: { name?: string | null; isPro?: boolean };
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
}

export function HomeDashboard({
  user,
  recentPairings,
  experienceCount,
  encounterToday,
  recentMarks,
}: HomeDashboardProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Morning." : hour < 17 ? "Afternoon." : "Evening.";

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-page-in">
      <div className="mb-16">
        <p className="label mb-2">{format(new Date(), "EEEE, MMMM d")}</p>
        <h1 className="font-serif text-4xl text-earth">{greeting}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {encounterToday && (
          <div className="lg:col-span-2 border border-earth/10 p-8 bg-earth/2">
            <p className="label mb-6">Today&rsquo;s question</p>
            <blockquote className="font-serif text-xl md:text-2xl text-earth leading-relaxed mb-8">
              {encounterToday.question}
            </blockquote>
            {encounterToday.landed === null || encounterToday.landed === undefined ? (
              <Link href="/encounter" className="btn-secondary inline-block text-sm">
                Mark it
              </Link>
            ) : (
              <p className="font-mono text-xs text-earth/40">
                {encounterToday.landed ? "Landed." : "Didn't land."}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Link
            href="/pair"
            className="flex items-center gap-4 border border-earth/10 p-6 hover:border-amber transition-colors group"
          >
            <Music size={18} className="text-amber" />
            <div>
              <p className="font-serif text-sm text-earth group-hover:text-amber transition-colors">
                New pairing
              </p>
              <p className="font-mono text-xs text-earth/40">Taste</p>
            </div>
          </Link>
          <Link
            href="/map"
            className="flex items-center gap-4 border border-earth/10 p-6 hover:border-amber transition-colors group"
          >
            <MapPin size={18} className="text-amber" />
            <div>
              <p className="font-serif text-sm text-earth group-hover:text-amber transition-colors">
                Log experience
              </p>
              <p className="font-mono text-xs text-earth/40">
                {experienceCount} places
              </p>
            </div>
          </Link>
          <Link
            href="/mark"
            className="flex items-center gap-4 border border-earth/10 p-6 hover:border-amber transition-colors group"
          >
            <Pencil size={18} className="text-amber" />
            <div>
              <p className="font-serif text-sm text-earth group-hover:text-amber transition-colors">
                Mark something
              </p>
              <p className="font-mono text-xs text-earth/40">Raw observation</p>
            </div>
          </Link>
          {user.isPro && (
            <Link
              href="/portrait"
              className="flex items-center gap-4 border border-amber/30 bg-amber/5 p-6 hover:border-amber transition-colors group"
            >
              <Compass size={18} className="text-amber" />
              <div>
                <p className="font-serif text-sm text-earth group-hover:text-amber transition-colors">
                  Your portrait
                </p>
                <p className="font-mono text-xs text-earth/40">Pro</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {recentPairings.length > 0 && (
        <div className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <p className="label">Recent pairings</p>
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
            <p className="label">Recent marks</p>
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
