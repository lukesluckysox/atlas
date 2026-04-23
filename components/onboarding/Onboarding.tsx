"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, MapPin, HelpCircle, Feather } from "lucide-react";

// Four-screen onboarding shown once per user. Skippable.
// Writes onboardedAt to the user's record on finish (or skip) so it never
// reappears. Re-triggerable from Settings > "Show tour again".
//
// Mount strategy: rendered by a thin server component wrapper that reads
// session.user.onboardedAt. This component only handles UI + completion.

type Kind = "tracks" | "path" | "encounter" | "moment";

const KINDS: Array<{
  kind: Kind;
  label: string;
  tagline: string;
  example: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    kind: "tracks",
    label: "Tracks",
    tagline: "a photo + the song playing",
    example: "golden-hour porch, Big Thief humming underneath",
    href: "/pair",
    Icon: Camera,
  },
  {
    kind: "path",
    label: "Paths",
    tagline: "a place on the map",
    example: "the diner off Route 9 that still has the old signage",
    href: "/map",
    Icon: MapPin,
  },
  {
    kind: "encounter",
    label: "Encounters",
    tagline: "today's question",
    example: "a quiet prompt, twice a day, no streak pressure",
    href: "/encounter",
    Icon: HelpCircle,
  },
  {
    kind: "moment",
    label: "Moments",
    tagline: "something you noticed",
    example: "the way the dog crossed the street before looking",
    href: "/mark",
    Icon: Feather,
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Kind | null>(null);
  const [finishing, setFinishing] = useState(false);
  const router = useRouter();

  // Lock body scroll while the overlay is up
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function complete(goto?: string) {
    if (finishing) return;
    setFinishing(true);
    try {
      await fetch("/api/user/onboarding", { method: "POST" });
    } catch {
      // non-fatal — worst case the user sees onboarding again
    }
    if (goto) router.push(goto);
    else router.refresh();
  }

  function skip() {
    complete();
  }

  const pickedKind = KINDS.find((k) => k.kind === picked);

  return (
    <div className="fixed inset-0 z-[100] bg-parchment text-earth overflow-y-auto">
      <div className="max-w-2xl mx-auto min-h-screen px-6 py-10 md:py-16 flex flex-col">
        <div className="flex justify-between items-center mb-10">
          <p className="font-serif text-xl tracking-wide">Trace</p>
          <button
            type="button"
            onClick={skip}
            className="text-xs uppercase tracking-[0.2em] text-earth/50 hover:text-earth"
          >
            Skip
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 mb-10">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-[2px] flex-1 transition-colors ${
                i <= step ? "bg-earth" : "bg-earth/15"
              }`}
            />
          ))}
        </div>

        {/* Step 0: What is Trace */}
        {step === 0 && (
          <div className="flex-1 flex flex-col justify-center animate-fade-in">
            <p className="text-xs uppercase tracking-[0.25em] text-earth/50 mb-4">
              What&apos;s Trace
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-6">
              A quiet place for what you saw, heard, went, and noticed.
            </h1>
            <p className="text-earth/70 text-lg leading-relaxed mb-10">
              No streaks screaming at you. No insights. Just the things you
              want to keep — building into a portrait of who you are.
            </p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="self-start btn-primary"
            >
              Show me how
            </button>
          </div>
        )}

        {/* Step 1: Pick a first kind */}
        {step === 1 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <p className="text-xs uppercase tracking-[0.25em] text-earth/50 mb-4">
              Four ways to trace
            </p>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-8">
              Pick the one that feels most like today.
            </h2>
            <div className="grid gap-3 mb-8">
              {KINDS.map((k) => {
                const Icon = k.Icon;
                const active = picked === k.kind;
                return (
                  <button
                    type="button"
                    key={k.kind}
                    onClick={() => setPicked(k.kind)}
                    className={`text-left p-5 border transition-all ${
                      active
                        ? "border-earth bg-earth/5"
                        : "border-earth/15 hover:border-earth/40"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Icon className="w-5 h-5 mt-1 flex-shrink-0 text-earth/70" />
                      <div className="flex-1">
                        <p className="font-serif text-xl">{k.label}</p>
                        <p className="text-earth/60 text-sm mt-1">
                          {k.tagline}
                        </p>
                        <p className="text-earth/50 text-xs italic mt-2">
                          {k.example}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="text-xs uppercase tracking-[0.2em] text-earth/50 hover:text-earth"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!picked}
                onClick={() => setStep(2)}
                className="btn-primary disabled:opacity-30"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Guided first capture */}
        {step === 2 && pickedKind && (
          <div className="flex-1 flex flex-col justify-center animate-fade-in">
            <p className="text-xs uppercase tracking-[0.25em] text-earth/50 mb-4">
              Your first {pickedKind.label.toLowerCase()}
            </p>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-6">
              {pickedKind.kind === "tracks" &&
                "Snap something. We'll pick up the song playing."}
              {pickedKind.kind === "path" &&
                "Drop a pin on a place that mattered."}
              {pickedKind.kind === "encounter" &&
                "One question, twice a day. Answer when it lands."}
              {pickedKind.kind === "moment" &&
                "Type what you noticed. That's the whole move."}
            </h2>
            <p className="text-earth/70 leading-relaxed mb-10">
              {pickedKind.kind === "tracks" &&
                "Link Spotify on the Tracks page and your now-playing song auto-pairs with whatever photo you add."}
              {pickedKind.kind === "path" &&
                "Type a place name, pick from the list, add a note if you want. That's it."}
              {pickedKind.kind === "encounter" &&
                "There's one waiting for you now. You can sit with it or answer — both are fine."}
              {pickedKind.kind === "moment" &&
                "A sentence or two. A photo if you want. A voice memo if your hands are full."}
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs uppercase tracking-[0.2em] text-earth/50 hover:text-earth"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn-primary"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Come back tomorrow */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center animate-fade-in">
            <p className="text-xs uppercase tracking-[0.25em] text-earth/50 mb-4">
              Come back tomorrow
            </p>
            <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-6">
              Your Portrait blooms after 3 traces.
            </h2>
            <p className="text-earth/70 text-lg leading-relaxed mb-8">
              There&apos;s a question waiting on Encounters. No notifications.
              No email. Just show up when you want to.
            </p>
            <p className="text-earth/60 text-sm italic mb-10">
              Tip: The Trace wordmark in the top-left is always home.
            </p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs uppercase tracking-[0.2em] text-earth/50 hover:text-earth"
              >
                Back
              </button>
              <Link
                href={pickedKind?.href ?? "/home"}
                onClick={() => complete(pickedKind?.href ?? "/home")}
                className="btn-primary"
              >
                Start tracing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
