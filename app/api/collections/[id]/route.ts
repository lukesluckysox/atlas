import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePro, hydrateItems } from "@/lib/collections";

/**
 * Collection detail: metadata + hydrated items. Items whose referenced trace
 * has been deleted are surfaced as trace=null so the UI can render a
 * "this trace was removed" placeholder or skip.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requirePro(session.user.id))) {
    return NextResponse.json({ error: "Pro required" }, { status: 402 });
  }

  const collection = await prisma.collection.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      items: {
        orderBy: { addedAt: "desc" },
        select: { id: true, kind: true, refId: true, addedAt: true },
      },
    },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = await hydrateItems(collection.items);

  return NextResponse.json({
    id: collection.id,
    title: collection.title,
    description: collection.description,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    items,
  });
}

// Rename / edit description.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requirePro(session.user.id))) {
    return NextResponse.json({ error: "Pro required" }, { status: 402 });
  }

  const existing = await prisma.collection.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, description } = (await req.json()) as {
    title?: string;
    description?: string | null;
  };
  const data: { title?: string; description?: string | null } = {};
  if (typeof title === "string") {
    const trimmed = title.trim();
    if (!trimmed) return NextResponse.json({ error: "Title required" }, { status: 400 });
    data.title = trimmed.slice(0, 120);
  }
  if (description !== undefined) {
    const trimmed = typeof description === "string" ? description.trim() : "";
    data.description = trimmed.length ? trimmed.slice(0, 500) : null;
  }

  const collection = await prisma.collection.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(collection);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requirePro(session.user.id))) {
    return NextResponse.json({ error: "Pro required" }, { status: 402 });
  }

  const existing = await prisma.collection.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.collection.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
