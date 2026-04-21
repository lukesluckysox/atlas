"use client";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { MapPin } from "lucide-react";

interface Pairing {
  id: string;
  photoUrl: string;
  trackName: string;
  artistName: string;
  albumArt?: string | null;
  note?: string | null;
  location?: string | null;
  createdAt: Date;
}

export function ExploreGrid({ pairings }: { pairings: Pairing[] }) {
  if (pairings.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="label mb-2">Tracks</p>
        <h1 className="font-serif text-4xl text-earth mb-16">Archive</h1>
        <div className="border border-earth/10 p-16 text-center">
          <p className="font-mono text-sm text-earth/40">
            Nothing here yet. Go somewhere. Hear something.
          </p>
          <Link href="/pair" className="btn-primary inline-block mt-8">
            First pairing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-page-in">
      <div className="flex items-end justify-between mb-12">
        <div>
          <p className="label mb-2">Tracks</p>
          <h1 className="font-serif text-4xl text-earth">Archive</h1>
        </div>
        <p className="font-mono text-xs text-earth/40">
          {pairings.length} pairings
        </p>
      </div>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-px space-y-px">
        {pairings.map((pairing) => (
          <div key={pairing.id} className="break-inside-avoid group relative overflow-hidden bg-earth/5">
            <div className="relative w-full" style={{ paddingBottom: "100%" }}>
              <Image
                src={pairing.photoUrl}
                alt={pairing.trackName}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-earth/90 via-earth/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex flex-col justify-end p-4">
                <div className="flex items-center gap-2 mb-2">
                  {pairing.albumArt && (
                    <Image
                      src={pairing.albumArt}
                      alt={pairing.trackName}
                      width={28}
                      height={28}
                      className="shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-parchment truncate">
                      {pairing.trackName}
                    </p>
                    <p className="font-mono text-xs text-parchment/60 truncate">
                      {pairing.artistName}
                    </p>
                  </div>
                </div>
                {pairing.note && (
                  <p className="font-mono text-xs text-parchment/70 line-clamp-2 mt-1">
                    {pairing.note}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  {pairing.location && (
                    <div className="flex items-center gap-1">
                      <MapPin size={10} className="text-amber" />
                      <span className="font-mono text-xs text-parchment/60">
                        {pairing.location}
                      </span>
                    </div>
                  )}
                  <span className="font-mono text-xs text-parchment/40 ml-auto">
                    {format(new Date(pairing.createdAt), "MMM d")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
