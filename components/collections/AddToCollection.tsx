"use client";
import { useEffect, useState } from "react";
import { FolderPlus, Check, Plus } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  kind: "tracks" | "path" | "notice" | "encounter";
  refId: string;
  // If false, we render nothing. Useful for Pro-gating without the caller
  // having to conditionally render.
  isPro?: boolean;
}

interface Row {
  id: string;
  title: string;
  itemCount: number;
}

/**
 * Inline "add to collection" control. Opens a popover listing the user's
 * collections with an inline "new" option. Idempotent \u2014 re-adding is a no-op
 * on the server. Stops event propagation so it can live inside a Link card.
 */
export function AddToCollection({ kind, refId, isPro = true }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || rows) return;
    (async () => {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRows(data);
      } else if (res.status === 402) {
        setRows([]);
      }
    })();
  }, [open, rows]);

  if (!isPro) return null;

  async function add(collectionId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, refId }),
      });
      if (!res.ok) throw new Error();
      setAdded(new Set(added).add(collectionId));
      toast.success("Added.");
    } catch {
      toast.error("Could not add.");
    } finally {
      setBusy(false);
    }
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as { id: string; title: string };
      await fetch(`/api/collections/${created.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, refId }),
      });
      setRows([
        { id: created.id, title: created.title, itemCount: 1 },
        ...(rows ?? []),
      ]);
      setAdded(new Set(added).add(created.id));
      setNewTitle("");
      setCreating(false);
      toast.success("Created and added.");
    } catch {
      toast.error("Could not create.");
    } finally {
      setBusy(false);
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!open);
  };

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={handleClick}
        className="p-2 text-earth/40 hover:text-earth"
        title="Add to collection"
        aria-label="Add to collection"
      >
        <FolderPlus size={14} />
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-parchment border border-earth/20 shadow-lg py-2">
            <p className="label px-3 pb-2 border-b border-earth/10">Add to</p>
            {rows === null ? (
              <p className="px-3 py-4 font-mono text-xs text-earth/40 animate-pulse">
                Loading...
              </p>
            ) : rows.length === 0 && !creating ? (
              <p className="px-3 py-3 font-mono text-xs text-earth/50">
                No collections yet.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {rows.map((c) => {
                  const isAdded = added.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isAdded) add(c.id);
                      }}
                      disabled={busy || isAdded}
                      className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-earth/5 font-serif text-sm text-earth disabled:opacity-60"
                    >
                      <span className="truncate">{c.title}</span>
                      {isAdded && <Check size={13} className="text-amber shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {creating ? (
              <form onSubmit={createAndAdd} className="border-t border-earth/10 px-3 py-3">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="New collection"
                  autoFocus
                  maxLength={120}
                  className="w-full px-2 py-1.5 bg-parchment border border-earth/20 font-serif text-sm focus:outline-none focus:border-earth/50"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCreating(false);
                      setNewTitle("");
                    }}
                    className="font-mono text-[10px] text-earth/40 hover:text-earth px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !newTitle.trim()}
                    className="font-mono text-[10px] text-earth bg-amber/30 hover:bg-amber/50 px-2 py-1 disabled:opacity-40"
                  >
                    Create + add
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCreating(true);
                }}
                className="w-full text-left px-3 py-2 border-t border-earth/10 hover:bg-earth/5 flex items-center gap-2 font-mono text-xs text-earth/60"
              >
                <Plus size={12} />
                New collection
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
