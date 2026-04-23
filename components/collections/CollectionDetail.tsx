"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { ArrowLeft, Pencil, Trash2, X } from "lucide-react";

interface Item {
  id: string;
  kind: "tracks" | "path" | "notice" | "encounter";
  refId: string;
  addedAt: string;
  trace: {
    id: string;
    title: string;
    subtitle: string | null;
    image: string | null;
    date: string;
  } | null;
}

interface Detail {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  items: Item[];
}

const KIND_LABEL: Record<Item["kind"], string> = {
  tracks: "Tracks",
  path: "Path",
  notice: "Notice",
  encounter: "Encounter",
};

export function CollectionDetail({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    // `load` closes over `id`; re-run when id changes. Safe to ignore the
    // exhaustive-deps rule here — load is stable-by-ref relative to id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const res = await fetch(`/api/collections/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = (await res.json()) as Detail;
    setDetail(data);
    setEditTitle(data.title);
    setEditDesc(data.description ?? "");
    setLoading(false);
  }

  async function saveMeta() {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, description: editDesc.trim() || null }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      await load();
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this collection? The traces inside stay.")) return;
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Deleted.");
      router.push("/collections");
    } else {
      toast.error("Could not delete.");
    }
  }

  async function removeItem(kind: string, refId: string) {
    const res = await fetch(`/api/collections/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, refId }),
    });
    if (res.ok) await load();
    else toast.error("Could not remove.");
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="font-mono text-xs text-earth/40 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="font-serif text-lg text-earth/60">Collection not found.</p>
        <Link href="/collections" className="btn-secondary text-xs">Back</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-8 pt-8 pb-24">
        <Link
          href="/collections"
          className="inline-flex items-center gap-2 font-mono text-xs text-earth/40 hover:text-earth mb-8"
        >
          <ArrowLeft size={13} />
          All collections
        </Link>

        {editing ? (
          <div className="border border-earth/15 bg-parchment p-5 mb-10">
            <p className="label mb-3">Edit</p>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={120}
              className="input-field mb-3"
              placeholder="Title"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              maxLength={500}
              rows={3}
              className="input-field mb-3 resize-none"
              placeholder="Description (optional)"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditTitle(detail.title);
                  setEditDesc(detail.description ?? "");
                }}
                className="font-mono text-xs text-earth/40 hover:text-earth px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={saveMeta}
                disabled={saving || !editTitle.trim()}
                className="btn-primary text-xs disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-10">
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-serif text-4xl text-earth leading-tight">{detail.title}</h1>
              <div className="flex gap-2 shrink-0 mt-2">
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 text-earth/40 hover:text-earth"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={remove}
                  className="p-2 text-earth/40 hover:text-terracotta"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {detail.description && (
              <p className="font-serif text-base text-earth/70 mt-3 whitespace-pre-wrap">
                {detail.description}
              </p>
            )}
            <p className="font-mono text-[11px] text-earth/30 mt-4">
              {detail.items.length} {detail.items.length === 1 ? "trace" : "traces"} \u00b7 updated{" "}
              {format(new Date(detail.updatedAt), "MMM d, yyyy")}
            </p>
          </div>
        )}

        {detail.items.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-earth/15">
            <p className="font-serif text-lg text-earth/60 mb-3">No traces yet.</p>
            <p className="font-mono text-xs text-earth/40">
              Add traces from the archive or any trace detail page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {detail.items.map((item) => (
              <div
                key={item.id}
                className="group flex items-start gap-4 border border-earth/10 bg-parchment p-4"
              >
                {item.trace?.image ? (
                  <div className="relative w-16 h-16 shrink-0 overflow-hidden">
                    <Image src={item.trace.image} alt="" fill className="object-cover" sizes="64px" />
                  </div>
                ) : (
                  <div className="w-16 h-16 shrink-0 border border-earth/10 flex items-center justify-center">
                    <span className="font-mono text-[9px] text-earth/30 uppercase tracking-wider">
                      {KIND_LABEL[item.kind]}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] text-earth/40 uppercase tracking-wider mb-1">
                    {KIND_LABEL[item.kind]}
                  </p>
                  {item.trace ? (
                    <>
                      <p className="font-serif text-base text-earth line-clamp-2 leading-snug">
                        {item.trace.title}
                      </p>
                      {item.trace.subtitle && (
                        <p className="font-serif text-sm text-earth/60 italic line-clamp-1 mt-0.5">
                          {item.trace.subtitle}
                        </p>
                      )}
                      <p className="font-mono text-[10px] text-earth/30 mt-1">
                        {format(new Date(item.trace.date), "MMM d, yyyy")}
                      </p>
                    </>
                  ) : (
                    <p className="font-serif text-sm text-earth/40 italic">This trace was removed.</p>
                  )}
                </div>
                <button
                  onClick={() => removeItem(item.kind, item.refId)}
                  className="p-2 text-earth/30 hover:text-terracotta opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Remove from collection"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
