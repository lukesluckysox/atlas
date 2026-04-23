"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { StreakBadge } from "@/components/layout/StreakBadge";

/**
 * Top bar is deliberately spare — three primary destinations. The four capture
 * kinds (Tracks, Paths, Encounters, Moments) live inside the Capture dropdown
 * since users don't navigate there as destinations, they go there to make or
 * see one kind. Collections was folded into Archive as a sub-tab.
 *
 * The "Trace" wordmark is itself the home link.
 */

type CaptureItem = { href: string; label: string; hint: string };

const CAPTURE_ITEMS: CaptureItem[] = [
  { href: "/pair", label: "Tracks", hint: "Photo + song" },
  { href: "/map", label: "Paths", hint: "Places on a map" },
  { href: "/encounter", label: "Encounters", hint: "A question, today" },
  { href: "/mark", label: "Moments", hint: "Something you noticed" },
];

const TOP_ITEMS = [
  { href: "/archive", label: "Archive" },
  { href: "/portrait", label: "Portrait" },
];

// Paths considered "inside" Capture (so Capture highlights as active).
const CAPTURE_PATHS = new Set([
  "/capture",
  ...CAPTURE_ITEMS.map((c) => c.href),
]);

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);

  const accountRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // Shared outside-click + Escape handler for both dropdowns.
  useEffect(() => {
    if (!accountOpen && !captureOpen) return;
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
      if (captureRef.current && !captureRef.current.contains(e.target as Node)) {
        setCaptureOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAccountOpen(false);
        setCaptureOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen, captureOpen]);

  if (!session) return null;

  const user = session.user;
  const displayName =
    user.username || (user.email ? user.email.split("@")[0] : "atlas");

  const captureActive = CAPTURE_PATHS.has(pathname);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-parchment/95 backdrop-blur-sm border-b border-earth/10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/home"
            className="font-serif text-xl text-earth tracking-tight"
          >
            Trace
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {/* Capture dropdown */}
            <div className="relative" ref={captureRef}>
              <button
                onClick={() => setCaptureOpen((v) => !v)}
                className={`flex items-center gap-1 font-mono text-xs tracking-widest uppercase transition-colors ${
                  captureActive
                    ? "text-amber"
                    : "text-earth/50 hover:text-earth"
                }`}
                aria-expanded={captureOpen}
                aria-haspopup="true"
              >
                Capture
                <ChevronDown
                  size={12}
                  className={`transition-transform ${
                    captureOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {captureOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-3 w-64 bg-parchment border border-earth/15 shadow-xl z-50 animate-fade-in">
                  {CAPTURE_ITEMS.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setCaptureOpen(false)}
                        className={`block px-4 py-3 border-b border-earth/5 last:border-b-0 transition-colors ${
                          active
                            ? "bg-amber/10"
                            : "hover:bg-earth/5"
                        }`}
                      >
                        <div
                          className={`font-serif text-base leading-tight ${
                            active ? "text-amber" : "text-earth"
                          }`}
                        >
                          {item.label}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-earth/40 mt-0.5">
                          {item.hint}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {TOP_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`font-mono text-xs tracking-widest uppercase transition-colors ${
                  pathname === item.href
                    ? "text-amber"
                    : "text-earth/50 hover:text-earth"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Quiet streak badge — hides itself when streak is 0 */}
            <StreakBadge />

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="text-earth/50 hover:text-earth transition-colors p-1"
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Username dropdown */}
            <div className="relative" ref={accountRef}>
              <button
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-1.5 font-mono text-xs text-earth/70 hover:text-earth tracking-widest uppercase transition-colors px-2 py-1 border border-earth/10 hover:border-earth/30"
                aria-expanded={accountOpen}
                aria-haspopup="true"
              >
                <User size={12} />
                <span className="normal-case tracking-normal">
                  {displayName}
                </span>
                {user.isPro && (
                  <span className="text-amber text-[10px] tracking-widest">
                    PRO
                  </span>
                )}
                <ChevronDown
                  size={12}
                  className={`transition-transform ${
                    accountOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-parchment border border-earth/15 shadow-xl z-50 animate-fade-in">
                  <div className="p-5 border-b border-earth/10">
                    <p className="label mb-2">Signed in as</p>
                    <p className="font-serif text-lg text-earth truncate">
                      {displayName}
                    </p>
                    {user.email && (
                      <p className="font-mono text-xs text-earth/50 truncate mt-1">
                        {user.email}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      {user.isPro ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest bg-amber/20 text-earth px-2 py-0.5">
                          Pro member
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest bg-earth/10 text-earth/60 px-2 py-0.5">
                          Free
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={toggle}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 font-mono text-xs text-earth/70 hover:text-earth hover:bg-earth/5 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                        {theme === "dark" ? "Light mode" : "Dark mode"}
                      </span>
                      <span className="text-earth/30 text-[10px] uppercase tracking-widest">
                        {theme}
                      </span>
                    </button>

                    <Link
                      href="/settings"
                      onClick={() => setAccountOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2 font-mono text-xs text-earth/70 hover:text-earth hover:bg-earth/5 transition-colors"
                    >
                      <Settings size={13} />
                      Account settings
                    </Link>

                    <button
                      onClick={() => {
                        setAccountOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 font-mono text-xs text-terracotta hover:bg-terracotta/10 transition-colors"
                    >
                      <LogOut size={13} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            className="md:hidden text-earth"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile sheet: flat list — no nested dropdown on small screens. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-parchment pt-14 md:hidden overflow-y-auto">
          <div className="flex flex-col p-8 gap-6">
            <div>
              <p className="label mb-3">Capture</p>
              <div className="flex flex-col gap-4">
                {CAPTURE_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`font-serif text-2xl transition-colors ${
                      pathname === item.href ? "text-amber" : "text-earth"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-earth/10 pt-6 flex flex-col gap-4">
              {TOP_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`font-serif text-2xl transition-colors ${
                    pathname === item.href ? "text-amber" : "text-earth"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-earth/10 pt-6 mt-4 space-y-4">
              <div>
                <p className="label mb-1">Signed in as</p>
                <p className="font-serif text-xl text-earth">{displayName}</p>
                {user.email && (
                  <p className="font-mono text-xs text-earth/50 mt-1">
                    {user.email}
                  </p>
                )}
              </div>
              <button
                onClick={toggle}
                className="flex items-center gap-3 font-mono text-sm text-earth/70"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 font-mono text-sm text-earth/70"
              >
                <Settings size={14} />
                Account settings
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-3 font-mono text-sm text-terracotta"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
