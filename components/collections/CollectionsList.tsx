"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

interface CollectionRow {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
  updatedAt: string;
}

export function CollectionsList() {
  const [items, setItems] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/collections");
    const data = await res.json();
    if (Array.isArray(data)) setItems(data);
    setLoading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error();
      setTitle("");
      setCreating(false);
      await load();
    } catch {
      toast.error("Could not create.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        label="Collections"
        h1="Curate your traces."
        tagline="Group by hand. A trip. A year. A mood."
        right={
          !creating && (
            <button
              onClick={() => setCreating(true)}
              className="btn-secondary text-xs flex items-center gap-2"
            >
              <Plus size={13} /> New
            </button>
          )
        }
      />

      <div className="max-w-3xl mx-auto px-8 pb-24">
        {creating && (
          <form
            onSubmit={create}
            className="mb-10 border border-earth/15 bg-parchment p-5 animate-fade-in"
          >
            <p className="label mb-3">New collection</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              maxLength={120}
              className="input-field mb-3"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setTitle("");
                }}
                className="font-mono text-xs text-earth/40 hover:text-earth px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="btn-primary text-xs disabled:opacity-40"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="font-mono text-xs text-earth/40 text-center py-24 animate-pulse">
            Loading...
          </p>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-serif text-lg text-earth/60 mb-6">No collections yet.</p>
            {!creating && (
              <button onClick={() => setCreating(true)} className="btn-primary">
                Start one
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="block border border-earth/10 hover:border-earth/30 bg-parchment p-5 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-serif text-xl text-earth truncate">{c.title}</h3>
                  <p className="font-mono text-[11px] text-earth/40 shrink-0">
                    {c.itemCount} {c.itemCount === 1 ? "trace" : "traces"}
                  </p>
                </div>
                {c.description && (
                  <p className="font-serif text-sm text-earth/70 mt-1 line-clamp-2">
                    {c.description}
                  </p>
                )}
                <p className="font-mono text-[10px] text-earth/30 mt-3">
                  Updated {format(new Date(c.updatedAt), "MMM d, yyyy")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
