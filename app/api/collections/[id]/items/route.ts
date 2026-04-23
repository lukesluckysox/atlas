import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePro, isValidKind } from "@/lib/collections";

// Add a trace to a collection. Body: { kind, refId }. Idempotent via the
// compound unique (collectionId, kind, refId) \u2014 duplicate adds return 200.
export async function POST(
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

  const collection = await prisma.collection.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { kind, refId } = (await req.json()) as { kind?: string; refId?: string };
  if (!isValidKind(kind) || !refId) {
    return NextResponse.json({ error: "kind + refId required" }, { status: 400 });
  }

  // Verify the referenced trace belongs to this user. Prevents adding
  // someone else's trace by id.
  const owns = await traceBelongsToUser(kind, refId, session.user.id);
  if (!owns) {
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  }

  try {
    const item = await prisma.collectionItem.create({
      data: { collectionId: params.id, kind, refId },
    });
    // Bump parent updatedAt so collection list re-sorts.
    await prisma.collection.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json(item);
  } catch (err: unknown) {
    // Unique-constraint violation \u2014 already in collection.
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ ok: true, existed: true });
    }
    throw err;
  }
}

// Remove a trace from a collection. Body: { kind, refId }.
export async function DELETE(
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

  const collection = await prisma.collection.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { kind, refId } = (await req.json()) as { kind?: string; refId?: string };
  if (!isValidKind(kind) || !refId) {
    return NextResponse.json({ error: "kind + refId required" }, { status: 400 });
  }

  await prisma.collectionItem.deleteMany({
    where: { collectionId: params.id, kind, refId },
  });

  return NextResponse.json({ ok: true });
}

async function traceBelongsToUser(
  kind: "tracks" | "path" | "notice" | "encounter",
  refId: string,
  userId: string
): Promise<boolean> {
  if (kind === "tracks") {
    return !!(await prisma.pairing.findFirst({ where: { id: refId, userId }, select: { id: true } }));
  }
  if (kind === "path") {
    return !!(await prisma.experience.findFirst({ where: { id: refId, userId }, select: { id: true } }));
  }
  if (kind === "notice") {
    return !!(await prisma.mark.findFirst({ where: { id: refId, userId }, select: { id: true } }));
  }
  if (kind === "encounter") {
    return !!(await prisma.encounter.findFirst({ where: { id: refId, userId }, select: { id: true } }));
  }
  return false;
}
