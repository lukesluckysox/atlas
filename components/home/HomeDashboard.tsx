"use client";
import Link from "next/link";
import Image from "next/image";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Music2, MapPin, HelpCircle, Eye } from "lucide-react";
import { FreshMoment } from "@/components/home/FreshMoment";
import { OnThisDay } from "@/components/home/OnThisDay";
import { SmartCapture } from "@/components/home/SmartCapture";

// Home shows ONLY the most recent single entry of each kind. Archive is the
// full feed. This keeps Home as a pulse, not a scroll.

interface LatestPairing {
  id: string;
  photoUrl: string;
  trackName: string;
  artistName: string;
  albumArt: string | null;
  createdAt: Date;
}

interface LatestExperience {
  id: string;
  type: string;
  name: string;
  location: string | null;
  photoUrl: string | null;
  createdAt: Date;
}

interface LatestEncounter {
  id: string;
  question: string;
  answer: string | null;
  landed: boolean | null;
  sittingWith: boolean;
  date: Date;
}

interface LatestMark {
  id: string;
  content: string;
  photoUrl: string | null;
  createdAt: Date;
}

interface HomeDashboardProps {
  latestPairing: LatestPairing | null;
  latestExperience: LatestExperience | null;
  latestEncounter: LatestEncounter | null;
  latestMark: LatestMark | null;
}

export function HomeDashboard({
  latestPairing,
  latestExperience,
  latestEncounter,
  latestMark,
}: HomeDashboardProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Morning." : hour < 17 ? "Afternoon." : "Evening.";

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 animate-page-in">
      <div className="mb-12">
        <p className="label mb-2">{format(new Date(), "EEEE, MMMM d")}</p>
        <h1 className="font-serif text-4xl text-earth">{greeting}</h1>
        <p className="font-mono text-xs text-earth/40 mt-2">
          A photo, a place, a thing you noticed. That&rsquo;s the whole idea.
        </p>
      </div>

      {/* Fresh signal: the most recent trace, as a single line. */}
      <FreshMoment />

      {/* Single-input capture that infers kind. */}
      <div className="mb-8">
        <SmartCapture />
      </div>

      {/* Traces from prior years on this calendar day. Silent if empty. */}
      <div className="mb-10">
        <OnThisDay />
      </div>

      {/* Latest of each kind — one card per kind, archive has the full feed. */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <p className="label">Latest</p>
          <Link
            href="/archive"
            className="font-mono text-xs text-earth/40 hover:text-earth transition-colors"
          >
            Full archive →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-earth/10">
          <TrackCell pairing={latestPairing} />
          <PathCell experience={latestExperience} />
          <QuestionCell encounter={latestEncounter} />
          <MomentCell mark={latestMark} />
        </div>
      </div>
    </div>
  );
}

// Shared cell chrome — every latest-cell is an equal-height link with a
// label in the top-left, content in the middle, and an action hint at the
// bottom. Empty state always routes to the relevant capture page.
function CellShell({
  href,
  label,
  kindIcon,
  when,
  children,
  bgImage,
  actionHint,
}: {
  href: string;
  label: string;
  kindIcon: React.ReactNode;
  when: Date | null;
  children: React.ReactNode;
  bgImage?: string | null;
  actionHint: string;
}) {
  const relative = when ? formatDistanceToNowStrict(when, { addSuffix: true }) : null;
  return (
    <Link
      href={href}
      className="bg-parchment hover:bg-earth/2 transition-colors group relative overflow-hidden min-h-[200px] flex flex-col"
    >
      {bgImage && (
        <>
          <Image
            src={bgImage}
            alt=""
            fill
            className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-earth/90 via-earth/40 to-transparent" />
        </>
      )}
      <div
        className={`relative p-6 flex-1 flex flex-col justify-between ${
          bgImage ? "text-parchment" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <p
            className={`label flex items-center gap-2 ${
              bgImage ? "text-parchment/70" : ""
            }`}
          >
            <span className={bgImage ? "text-parchment/80" : "text-amber"}>
              {kindIcon}
            </span>
            {label}
          </p>
          {relative && (
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                bgImage ? "text-parchment/60" : "text-earth/40"
              }`}
            >
              {relative}
            </span>
          )}
        </div>
        <div className="my-4">{children}</div>
        <p
          className={`font-mono text-[10px] uppercase tracking-widest transition-colors group-hover:text-amber ${
            bgImage ? "text-parchment/60" : "text-earth/40"
          }`}
        >
          {actionHint}
        </p>
      </div>
    </Link>
  );
}

function TrackCell({ pairing }: { pairing: LatestPairing | null }) {
  if (!pairing) {
    return (
      <CellShell
        href="/pair"
        label="Track"
        kindIcon={<Music2 size={12} />}
        when={null}
        actionHint="A photo, a track →"
      >
        <p className="font-serif text-xl text-earth leading-tight">
          First pairing.
        </p>
      </CellShell>
    );
  }
  return (
    <CellShell
      href={`/explore?id=${pairing.id}`}
      label="Track"
      kindIcon={<Music2 size={12} />}
      when={pairing.createdAt}
      bgImage={pairing.photoUrl}
      actionHint="Open →"
    >
      <p className="font-serif text-xl leading-tight truncate">
        {pairing.trackName}
      </p>
      <p className="font-mono text-xs opacity-80 truncate mt-1">
        {pairing.artistName}
      </p>
    </CellShell>
  );
}

function PathCell({ experience }: { experience: LatestExperience | null }) {
  if (!experience) {
    return (
      <CellShell
        href="/map"
        label="Path"
        kindIcon={<MapPin size={12} />}
        when={null}
        actionHint="Log a place →"
      >
        <p className="font-serif text-xl text-earth leading-tight">
          First place.
        </p>
      </CellShell>
    );
  }
  return (
    <CellShell
      href="/map"
      label="Path"
      kindIcon={<MapPin size={12} />}
      when={experience.createdAt}
      bgImage={experience.photoUrl ?? null}
      actionHint="Open map →"
    >
      <p
        className={`font-serif text-xl leading-tight truncate ${
          experience.photoUrl ? "" : "text-earth"
        }`}
      >
        {experience.name}
      </p>
      {experience.location && (
        <p
          className={`font-mono text-xs truncate mt-1 ${
            experience.photoUrl ? "opacity-80" : "text-earth/50"
          }`}
        >
          {experience.location}
        </p>
      )}
    </CellShell>
  );
}

function QuestionCell({ encounter }: { encounter: LatestEncounter | null }) {
  if (!encounter) {
    return (
      <CellShell
        href="/encounter"
        label="Question"
        kindIcon={<HelpCircle size={12} />}
        when={null}
        actionHint="Today's question →"
      >
        <p className="font-serif text-xl text-earth leading-tight">
          No question yet.
        </p>
      </CellShell>
    );
  }
  const status =
    encounter.landed === true
      ? "Landed"
      : encounter.landed === false
      ? "Didn't land"
      : encounter.sittingWith
      ? "Sitting with"
      : encounter.answer
      ? "Answered"
      : "Unanswered";
  return (
    <CellShell
      href="/encounter"
      label="Question"
      kindIcon={<HelpCircle size={12} />}
      when={encounter.date}
      actionHint={`${status} →`}
    >
      <blockquote className="font-serif text-base text-earth leading-snug line-clamp-3">
        {encounter.question}
      </blockquote>
    </CellShell>
  );
}

function MomentCell({ mark }: { mark: LatestMark | null }) {
  if (!mark) {
    return (
      <CellShell
        href="/mark"
        label="Moment"
        kindIcon={<Eye size={12} />}
        when={null}
        actionHint="Notice something →"
      >
        <p className="font-serif text-xl text-earth leading-tight">
          Nothing noticed yet.
        </p>
      </CellShell>
    );
  }
  return (
    <CellShell
      href="/mark"
      label="Moment"
      kindIcon={<Eye size={12} />}
      when={mark.createdAt}
      bgImage={mark.photoUrl ?? null}
      actionHint="Open →"
    >
      <p
        className={`font-serif text-base leading-snug line-clamp-3 ${
          mark.photoUrl ? "" : "text-earth"
        }`}
      >
        {mark.content}
      </p>
    </CellShell>
  );
}
