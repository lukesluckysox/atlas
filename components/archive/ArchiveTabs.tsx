"use client";

import { useState } from "react";
import { ArchiveFeed } from "@/components/archive/ArchiveFeed";
import { CollectionsList } from "@/components/collections/CollectionsList";
import { ProGate } from "@/components/collections/ProGate";

/**
 * ArchiveTabs — two-view switcher living inside the Archive page.
 *
 * Feed: the chronological, cross-kind timeline (existing component).
 * Collections: hand-curated groupings. Pro-gated; falls back to ProGate for
 * free users so the tab is visible but soft-blocked, matching the behavior
 * of the old standalone /collections route.
 */
export function ArchiveTabs({ isPro }: { isPro: boolean }) {
  const [tab, setTab] = useState<"feed" | "collections">("feed");

  return (
    <div>
      <div className="flex gap-6 border-b border-earth/10 mb-8">
        <TabButton active={tab === "feed"} onClick={() => setTab("feed")}>
          Feed
        </TabButton>
        <TabButton
          active={tab === "collections"}
          onClick={() => setTab("collections")}
        >
          Collections
        </TabButton>
      </div>

      {tab === "feed" && <ArchiveFeed isPro={isPro} />}
      {tab === "collections" &&
        (isPro ? <CollectionsList embedded /> : <ProGate embedded />)}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`font-mono text-xs uppercase tracking-widest pb-3 -mb-px border-b-2 transition-colors ${
        active
          ? "text-amber border-amber"
          : "text-earth/50 hover:text-earth border-transparent"
      }`}
    >
      {children}
    </button>
  );
}
