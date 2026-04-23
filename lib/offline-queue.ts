// Offline queue — IndexedDB-backed write queue for all 4 trace kinds.
//
// Items carry the full payload plus any pending image blobs. When the
// drainer runs, images upload first → replace blob with URL → then the
// create endpoint is called. All idempotent: on retry we redo from scratch.
//
// Never throws to callers; surface state via the queue API.

"use client";

import { openDB, type IDBPDatabase } from "idb";

export type QueueKind = "track" | "path" | "moment" | "encounter";

export type QueueImage = {
  // Field on the payload whose value should become the uploaded URL.
  payloadField: string;
  // Where the upload endpoint puts the image (e.g. "paths", "moments").
  folder: string;
  // The actual bytes.
  blob: Blob;
};

export type QueueItem = {
  id: string;
  kind: QueueKind;
  endpoint: string; // e.g. "/api/marks"
  method: "POST";
  // Serializable payload that will go to endpoint as JSON.
  payload: Record<string, unknown>;
  // Zero-or-more pending image uploads to do BEFORE the POST.
  images: QueueImage[];
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB_NAME = "trace-offline";
const STORE = "queue";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("offline-queue: server-side"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: "id" });
          s.createIndex("createdAt", "createdAt");
          s.createIndex("kind", "kind");
        }
      },
    });
  }
  return dbPromise;
}

function newId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueue(
  item: Omit<QueueItem, "id" | "createdAt" | "attempts" | "method">
): Promise<QueueItem> {
  const db = await getDB();
  const full: QueueItem = {
    id: newId(),
    createdAt: Date.now(),
    attempts: 0,
    method: "POST",
    ...item,
  };
  await db.put(STORE, full);
  emitChange();
  return full;
}

export async function listQueue(): Promise<QueueItem[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex(STORE, "createdAt");
    return all as QueueItem[];
  } catch {
    return [];
  }
}

export async function countQueue(): Promise<number> {
  try {
    const db = await getDB();
    return (await db.count(STORE)) || 0;
  } catch {
    return 0;
  }
}

export async function removeQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
  emitChange();
}

export async function updateQueue(item: QueueItem): Promise<void> {
  const db = await getDB();
  await db.put(STORE, item);
  emitChange();
}

// ---- change bus ----

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitChange() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}
