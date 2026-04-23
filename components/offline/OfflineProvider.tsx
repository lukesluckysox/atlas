"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import {
  countQueue,
  subscribeQueue,
  listQueue,
} from "@/lib/offline-queue";
import { drainQueue } from "@/lib/offline-submit";

/**
 * OfflineProvider — mounted once at the app root.
 *
 * Responsibilities:
 *   1. Register the service worker (if supported)
 *   2. Listen to online/offline + visibilitychange and drain the queue
 *   3. Render a small pill in the top-right when items are pending
 *   4. Pre-warm core routes so they load offline after first visit
 *
 * The SW caches the app shell + visited HTML + Next static assets, so the
 * app opens without network once installed. Fresh data still needs network.
 */
export function OfflineProvider() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setCount(await countQueue());
  }, []);

  const runDrain = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await drainQueue();
      if (res.sent > 0) {
        toast.success(`synced ${res.sent} ${res.sent === 1 ? "trace" : "traces"}`);
      }
      if (res.failed > 0) {
        toast(`${res.failed} couldn't sync — dropped`, { icon: "\u26a0" });
      }
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [syncing, refresh]);

  // Initial state
  useEffect(() => {
    setOnline(navigator.onLine !== false);
    refresh();
  }, [refresh]);

  // Online/offline events
  useEffect(() => {
    const onUp = () => {
      setOnline(true);
      runDrain();
    };
    const onDown = () => setOnline(false);
    const onVis = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        runDrain();
      }
    };
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [runDrain]);

  // Queue change subscription
  useEffect(() => {
    const unsub = subscribeQueue(refresh);
    return () => {
      unsub();
    };
  }, [refresh]);

  // Register SW + request Background Sync tag on page load
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        // Listen for drain prompts from the SW
        navigator.serviceWorker.addEventListener("message", (ev) => {
          if (ev.data?.type === "trace-drain") runDrain();
        });
        // Best-effort Background Sync registration (Chromium only)
        const syncMgr = (reg as unknown as {
          sync?: { register: (tag: string) => Promise<void> };
        }).sync;
        if (syncMgr) {
          try {
            await syncMgr.register("trace-drain");
          } catch {
            /* ignore */
          }
        }
        // Pre-warm core routes into the SW HTML cache so they work offline
        // after first visit. Fire-and-forget, idle callback to avoid jank.
        const prewarm = () => {
          const routes = ["/home", "/mark", "/pair", "/map", "/encounter", "/offline"];
          routes.forEach((r) => {
            fetch(r, { credentials: "same-origin" }).catch(() => {});
          });
        };
        const idle = (window as unknown as {
          requestIdleCallback?: (cb: () => void) => number;
        }).requestIdleCallback;
        if (typeof idle === "function") idle(prewarm);
        else setTimeout(prewarm, 2500);
      })
      .catch(() => {
        /* SW disabled or blocked — non-fatal */
      });
  }, [runDrain]);

  if (count === 0 && online) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed top-16 right-4 z-[60] flex items-center gap-2 px-3 py-1.5 bg-parchment border border-earth/20 shadow-sm font-mono text-[10px] uppercase tracking-widest text-earth/70 hover:text-earth transition-colors"
        title={online ? "Pending sync" : "Offline"}
      >
        {syncing ? (
          <Loader2 size={12} className="animate-spin" />
        ) : online ? (
          <Cloud size={12} />
        ) : (
          <CloudOff size={12} />
        )}
        <span>
          {online
            ? count > 0
              ? `${count} to sync`
              : "synced"
            : count > 0
              ? `offline · ${count}`
              : "offline"}
        </span>
      </button>

      {open && (
        <div className="fixed top-28 right-4 z-[60] w-72 bg-parchment border border-earth/20 shadow-lg p-4 animate-fade-in">
          <p className="label mb-2">Sync queue</p>
          <p className="text-xs text-earth/60 leading-relaxed mb-3">
            {online
              ? count > 0
                ? "Traces saved while network was unavailable. Sending now."
                : "Everything is synced."
              : "No network. Traces will send when you're back online."}
          </p>
          <QueueList />
          <div className="flex gap-2 mt-3">
            <button
              className="btn-secondary text-xs flex-1"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
            {online && count > 0 && (
              <button
                className="btn-primary text-xs flex-1"
                onClick={runDrain}
                disabled={syncing}
              >
                {syncing ? "Syncing\u2026" : "Sync now"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function QueueList() {
  const [items, setItems] = useState<
    Array<{ id: string; kind: string; createdAt: number }>
  >([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const q = await listQueue();
      if (alive) {
        setItems(q.map((i) => ({ id: i.id, kind: i.kind, createdAt: i.createdAt })));
      }
    };
    load();
    const unsub = subscribeQueue(load);
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <ul className="max-h-40 overflow-auto space-y-1 text-xs">
      {items.map((it) => (
        <li key={it.id} className="flex justify-between text-earth/70">
          <span className="capitalize">{it.kind}</span>
          <span className="font-mono text-[10px] text-earth/40">
            {relativeTime(it.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
