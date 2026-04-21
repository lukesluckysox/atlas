import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/home");

  const pillars = [
    {
      id: "01",
      name: "Taste",
      description: "Photo and track pairings. Pure instinct. No analysis required.",
    },
    {
      id: "02",
      name: "Experience",
      description: "A life map. National parks, countries, concerts, trails, moments.",
    },
    {
      id: "03",
      name: "Encounter",
      description: "One philosophical question per day. You mark whether it landed.",
    },
    {
      id: "04",
      name: "Mark",
      description: "What you noticed. A cloud formation. A conversation fragment. Raw observation.",
    },
  ];

  return (
    <div className="min-h-screen bg-parchment flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <span className="font-serif text-2xl text-earth">Atlas</span>
        <Link
          href="/auth/signin"
          className="font-mono text-xs text-earth/60 hover:text-earth tracking-widest uppercase transition-colors"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-5xl">
        <div className="mb-24 animate-fade-in">
          <p className="font-mono text-xs text-earth/50 tracking-widest uppercase mb-8">
            A portrait of who you are
          </p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-earth leading-[0.95] mb-12 max-w-3xl">
            Not through introspection.
          </h1>
          <p className="font-mono text-sm text-earth/60 max-w-md leading-relaxed mb-12">
            Atlas builds a picture of who you are through what you love, where
            you&apos;ve been, and what sounds right next to what image.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block btn-primary"
          >
            Start free
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-earth/10">
          {pillars.map((pillar) => (
            <div key={pillar.id} className="bg-parchment p-8 animate-slide-up">
              <p className="font-mono text-xs text-amber tracking-widest mb-4">
                {pillar.id}
              </p>
              <h2 className="font-serif text-xl text-earth mb-3">{pillar.name}</h2>
              <p className="font-mono text-xs text-earth/50 leading-relaxed">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="px-8 py-8 flex items-center justify-between border-t border-earth/10 mt-24">
        <span className="font-mono text-xs text-earth/30 tracking-widest">
          Atlas — {new Date().getFullYear()}
        </span>
        <div className="flex gap-6">
          <Link
            href="/auth/signin"
            className="font-mono text-xs text-earth/40 hover:text-earth tracking-widest uppercase transition-colors"
          >
            Free
          </Link>
          <span className="font-mono text-xs text-earth/20">·</span>
          <span className="font-mono text-xs text-earth/40 tracking-widest">Pro $8/mo</span>
        </div>
      </footer>
    </div>
  );
}
