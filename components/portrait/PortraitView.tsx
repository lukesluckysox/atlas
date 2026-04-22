"use client";
import { useState } from "react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { RefreshCw, Compass } from "lucide-react";
import { PhotoMosaic } from "./PhotoMosaic";
import { MusicTree } from "./MusicTree";

interface Portrait {
  id: string;
  summary: string;
  tasteProfile: unknown;
  movementProfile: unknown;
  questionProfile: unknown;
  markProfile?: unknown;
  generatedAt: Date;
}

interface Props {
  portrait: Portrait | null;
  dataCount: {
    pairingCount: number;
    experienceCount: number;
    encounterCount: number;
    markCount: number;
  };
}

export function PortraitView({ portrait: initialPortrait, dataCount }: Props) {
  const [portrait, setPortrait] = useState<Portrait | null>(initialPortrait);
  const [generating, setGenerating] = useState(false);

  const hasEnoughData =
    dataCount.pairingCount >= 3 ||
    dataCount.experienceCount >= 3 ||
    dataCount.encounterCount >= 3;

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/portrait/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPortrait(data);
      toast.success("Portrait updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate portrait.";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  if (!hasEnoughData && !portrait) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <Compass size={32} className="text-amber mx-auto mb-8" />
        <h1 className="font-serif text-3xl text-earth mb-4">Not enough data yet.</h1>
        <p className="font-mono text-sm text-earth/50 mb-8 leading-relaxed">
          Trace needs more signal. Add some pairings, log some places, answer some questions.
          Come back when you&apos;ve lived a little more.
        </p>
        <div className="grid grid-cols-2 gap-4 text-left mt-12">
          {[
            { label: "Pairings", count: dataCount.pairingCount, needed: 3 },
            { label: "Experiences", count: dataCount.experienceCount, needed: 3 },
            { label: "Encounters", count: dataCount.encounterCount, needed: 3 },
            { label: "Marks", count: dataCount.markCount, needed: 0 },
          ].map((item) => (
            <div key={item.label} className="border border-earth/10 p-4">
              <p className="font-serif text-2xl text-earth mb-1">{item.count}</p>
              <p className="label">{item.label}</p>
              {item.needed > 0 && item.count < item.needed && (
                <p className="font-mono text-xs text-earth/30 mt-1">
                  Need {item.needed - item.count} more
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 animate-page-in">
      <div className="flex items-end justify-between mb-12">
        <div>
          <p className="label mb-2">Portrait</p>
          <h1 className="font-serif text-4xl text-earth">What Trace sees</h1>
          <p className="font-mono text-xs text-earth/40 mt-2">
            Light, sound, distance. Your signal.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 btn-secondary text-sm disabled:opacity-40"
        >
          <RefreshCw size={12} className={generating ? "animate-spin" : ""} />
          {portrait ? "Regenerate" : "Generate portrait"}
        </button>
      </div>

      {portrait ? (
        <div className="space-y-12">
          <div className="border-l-2 border-amber pl-8 py-2">
            <p className="font-serif text-xl text-earth leading-relaxed">
              {portrait.summary}
            </p>
            <p className="font-mono text-xs text-earth/30 mt-4">
              Generated {format(new Date(portrait.generatedAt), "MMMM d, yyyy")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ProfileSection
              title="Tracks"
              data={portrait.tasteProfile as Record<string, unknown>}
              fields={[
                { key: "musicalRange", label: "Musical range" },
                { key: "visualSensibility", label: "Visual sensibility" },
                { key: "patterns", label: "Patterns", isList: true },
              ]}
            />

            <ProfileSection
              title="Movement"
              data={portrait.movementProfile as Record<string, unknown>}
              fields={[
                { key: "geographicStyle", label: "Geographic style" },
                { key: "breadth", label: "Breadth" },
                { key: "experienceTypes", label: "Experience types", isList: true },
              ]}
            />

            <ProfileSection
              title="Encounter"
              data={portrait.questionProfile as Record<string, unknown>}
              fields={[
                { key: "philosophicalLeanings", label: "Philosophical leanings" },
                { key: "tendencies", label: "Tendencies" },
                { key: "themes", label: "Themes", isList: true },
              ]}
            />

            {!!portrait.markProfile && (
              <ProfileSection
                title="Notice"
                data={portrait.markProfile as Record<string, unknown>}
                fields={[
                  { key: "observationStyle", label: "Observation style" },
                  { key: "texture", label: "Texture" },
                  { key: "patterns", label: "Patterns", isList: true },
                ]}
              />
            )}
          </div>

          <div className="border-t border-earth/10 pt-8">
            <p className="label mb-4">Photomosaic</p>
            <PhotoMosaic />
          </div>

          <div className="border-t border-earth/10 pt-8">
            <p className="label mb-4">Music tree</p>
            <MusicTree />
          </div>

          <div className="border-t border-earth/10 pt-8">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Pairings", count: dataCount.pairingCount },
                { label: "Experiences", count: dataCount.experienceCount },
                { label: "Encounters", count: dataCount.encounterCount },
                { label: "Marks", count: dataCount.markCount },
              ].map((item) => (
                <div key={item.label}>
                  <p className="font-serif text-2xl text-earth">{item.count}</p>
                  <p className="label">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-earth/10 p-16 text-center">
          <p className="font-mono text-sm text-earth/50 mb-8">
            See what Trace sees.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="btn-primary disabled:opacity-40"
          >
            {generating ? "Building your portrait..." : "Generate portrait"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileSection({
  title,
  data,
  fields,
}: {
  title: string;
  data: Record<string, unknown>;
  fields: Array<{ key: string; label: string; isList?: boolean }>;
}) {
  return (
    <div className="border border-earth/10 p-6">
      <p className="label mb-6">{title}</p>
      <div className="space-y-4">
        {fields.map((field) => {
          const value = data?.[field.key];
          if (!value) return null;
          return (
            <div key={field.key}>
              <p className="font-mono text-xs text-earth/40 mb-1">{field.label}</p>
              {field.isList && Array.isArray(value) ? (
                <div className="flex flex-wrap gap-2">
                  {value.map((item: string, i: number) => (
                    <span
                      key={i}
                      className="font-mono text-xs bg-amber/15 text-earth px-2 py-1"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-sm text-earth/80 leading-relaxed">
                  {String(value)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
