"use client";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { Check } from "lucide-react";

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

  const handleExport = async () => {
    try {
      const [pairings, experiences, marks] = await Promise.all([
        fetch("/api/pairings").then((r) => r.json()),
        fetch("/api/experiences").then((r) => r.json()),
        fetch("/api/marks").then((r) => r.json()),
      ]);
      const data = { pairings, experiences, marks, exportedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "atlas-export.json";
      a.click();
    } catch {
      toast.error("Export failed.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 animate-page-in">
      <div className="mb-12">
        <p className="label mb-2">Settings</p>
        <h1 className="font-serif text-4xl text-earth">Account</h1>
      </div>

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
                  "Unlimited experiences",
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
          <div className="space-y-4">
            <button
              onClick={handleExport}
              className="btn-secondary w-full"
            >
              Export all data (JSON)
            </button>
          </div>
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
