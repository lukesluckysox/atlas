"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isPro?: boolean;
}

export function SettingsView({ user }: { user: User }) {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  useEffect(() => {
    if (success) {
      toast.success("Welcome to Trace Pro.");
    }
  }, [success]);

  const handleUpgrade = async () => {
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Could not start checkout.");
    }
  };

  const router = useRouter();
  const [resettingTour, setResettingTour] = useState(false);

  const resetOnboarding = async () => {
    if (resettingTour) return;
    setResettingTour(true);
    try {
      const res = await fetch("/api/user/onboarding", { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("tour reset");
      router.push("/home");
    } catch {
      toast.error("couldn't reset tour");
    } finally {
      setResettingTour(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-page-in">
      <PageHeader
        label="Settings"
        h1="Account"
        tagline="Your profile, plan, and data."
      />

      <div className="space-y-12">
        <section>
          <p className="label mb-6">Profile</p>
          <div className="border border-earth/10 p-6 space-y-4">
            {user.name && (
              <div>
                <p className="font-mono text-xs text-earth/40 mb-1">Name</p>
                <p className="font-mono text-sm text-earth">{user.name}</p>
              </div>
            )}
            {user.email && (
              <div>
                <p className="font-mono text-xs text-earth/40 mb-1">Email</p>
                <p className="font-mono text-sm text-earth">{user.email}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-xs text-earth/40 mb-1">Plan</p>
              <p className="font-mono text-sm text-earth">
                {user.isPro ? (
                  <span className="flex items-center gap-2">
                    <Check size={12} className="text-amber" />
                    Trace Pro
                  </span>
                ) : (
                  "Free"
                )}
              </p>
            </div>
          </div>
        </section>

        {!user.isPro && (
          <section>
            <p className="label mb-6">Trace Pro</p>
            <div className="border border-amber/30 p-8">
              <p className="font-serif text-xl text-earth mb-6">$8 / month</p>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited paths",
                  "AI track recommendations for photos",
                  "Personality portrait generation",
                  "Shareable portrait export",
                  "Advanced taste pattern analysis",
                  "Priority question generation",
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 font-mono text-sm text-earth/70">
                    <Check size={12} className="text-amber shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button onClick={handleUpgrade} className="btn-amber w-full">
                Upgrade to Pro
              </button>
            </div>
          </section>
        )}

        <section>
          <p className="label mb-6">Data</p>
          <div className="space-y-3">
            <Link href="/settings/export" className="btn-secondary w-full block text-center">
              Export &amp; download
            </Link>
            <p className="font-mono text-[10px] uppercase tracking-widest text-earth/40">
              JSON backup or printable record — your copy to keep.
            </p>
          </div>
        </section>

        <section>
          <p className="label mb-6">Tour</p>
          <button
            onClick={resetOnboarding}
            disabled={resettingTour}
            className="font-mono text-sm text-earth/40 hover:text-earth transition-colors disabled:opacity-50"
          >
            {resettingTour ? "…" : "Show the intro again"}
          </button>
        </section>

        <section>
          <p className="label mb-6">Account</p>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="font-mono text-sm text-earth/40 hover:text-earth transition-colors"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
