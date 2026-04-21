"use client";
import { Nav } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parchment">
      <Nav />
      <main className="pt-14 min-h-screen">
        {children}
      </main>
    </div>
  );
}
