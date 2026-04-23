// Offline-aware submit: tries network first, queues on failure.
//
// Usage:
//   const res = await submitWithQueue({
//     kind: "moment",
//     endpoint: "/api/marks",
//     payload: { text, mood, ... },
//     images: [{ payloadField: "photoUrl", folder: "moments", blob }],
//   });
//   if (res.ok) { ... } else if (res.offline) { toast "saved offline" }

"use client";

import {
  enqueue,
  listQueue,
  removeQueue,
  updateQueue,
  type QueueItem,
  type QueueKind,
  type QueueImage,
} from "@/lib/offline-queue";

type SubmitArgs = {
  kind: QueueKind;
  endpoint: string;
  payload: Record<string, unknown>;
  images?: QueueImage[];
};

type SubmitResult =
  | { ok: true; offline: false; data: unknown }
  | { ok: true; offline: true; queueId: string }
  | { ok: false; offline: false; error: string };

const MAX_ATTEMPTS = 8;

// Convert blob → base64 data URL for /api/upload's JSON body.
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("blob read failed"));
    r.readAsDataURL(blob);
  });
}

async function uploadImage(image: QueueImage): Promise<string> {
  const dataUrl = await blobToDataUrl(image.blob);
  const up = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, folder: image.folder }),
  });
  if (!up.ok) {
    throw new Error(`upload ${up.status}`);
  }
  const json = (await up.json()) as { url?: string };
  if (!json.url) throw new Error("upload no url");
  return json.url;
}

async function runItem(item: QueueItem): Promise<unknown> {
  // 1) Upload any pending images, mutating the payload copy.
  const payload = { ...item.payload };
  for (const img of item.images) {
    const url = await uploadImage(img);
    payload[img.payloadField] = url;
  }
  // 2) POST to the final endpoint.
  const res = await fetch(item.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Try to send now. If offline or server fails with network-y error,
 * enqueue for later. Returns offline:true on queue.
 */
export async function submitWithQueue(args: SubmitArgs): Promise<SubmitResult> {
  const { kind, endpoint, payload, images = [] } = args;

  // If flagged offline, skip straight to queue.
  if (!isOnline()) {
    const item = await enqueue({ kind, endpoint, payload, images });
    return { ok: true, offline: true, queueId: item.id };
  }

  // Try live path.
  try {
    const data = await runItem({
      id: "live",
      kind,
      endpoint,
      method: "POST",
      payload,
      images,
      createdAt: Date.now(),
      attempts: 0,
    });
    return { ok: true, offline: false, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Network-flavored failures → queue. Validation (4xx) → surface error.
    const is4xx = /^4\d\d:/.test(msg);
    if (is4xx) {
      return { ok: false, offline: false, error: msg };
    }
    const item = await enqueue({ kind, endpoint, payload, images });
    return { ok: true, offline: true, queueId: item.id };
  }
}

// ---- drain ----

let draining = false;

export type DrainSummary = {
  sent: number;
  failed: number;
  remaining: number;
};

export async function drainQueue(): Promise<DrainSummary> {
  if (draining) return { sent: 0, failed: 0, remaining: await (await listQueue()).length };
  if (!isOnline()) return { sent: 0, failed: 0, remaining: (await listQueue()).length };

  draining = true;
  let sent = 0;
  let failed = 0;
  try {
    const items = await listQueue();
    for (const item of items) {
      try {
        await runItem(item);
        await removeQueue(item.id);
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const is4xx = /^4\d\d:/.test(msg);
        const next: QueueItem = {
          ...item,
          attempts: item.attempts + 1,
          lastError: msg,
        };
        if (is4xx || next.attempts >= MAX_ATTEMPTS) {
          // Permanent failure: drop so we don't block the queue forever.
          await removeQueue(item.id);
          failed++;
        } else {
          await updateQueue(next);
          // Transient: stop draining so we don't hammer.
          break;
        }
      }
    }
  } finally {
    draining = false;
  }
  return { sent, failed, remaining: (await listQueue()).length };
}
