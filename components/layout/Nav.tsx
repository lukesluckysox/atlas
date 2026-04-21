"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/pair", label: "Taste" },
  { href: "/map", label: "Experience" },
  { href: "/encounter", label: "Encounter" },
  { href: "/mark", label: "Mark" },
  { href: "/explore", label: "Archive" },
  { href: "/portrait", label: "Portrait" },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-parchment/95 backdrop-blur-sm border-b border-earth/10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/home" className="font-serif text-xl text-earth tracking-tight">
            Atlas
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
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

          <div className="hidden md:flex items-center gap-4">
            {session.user.isPro && (
              <span className="font-mono text-xs text-amber tracking-widest">PRO</span>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="font-mono text-xs text-earth/40 hover:text-earth tracking-widest uppercase transition-colors"
            >
              Out
            </button>
          </div>

          <button
            className="md:hidden text-earth"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 bg-parchment pt-14 md:hidden">
          <div className="flex flex-col p-8 gap-8">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`font-serif text-2xl transition-colors ${
                  pathname === item.href ? "text-amber" : "text-earth"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="font-mono text-sm text-earth/40 text-left mt-8"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
