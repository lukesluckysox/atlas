import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mark = await prisma.mark.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!mark) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (mark.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.mark.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mark = await prisma.mark.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!mark) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (mark.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { content } = body;

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const updated = await prisma.mark.update({
    where: { id: params.id },
    data: { content: content.trim() },
  });

  return NextResponse.json(updated);
}
