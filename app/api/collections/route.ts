import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePro } from "@/lib/collections";

// List the user's collections (lightweight — counts only, no hydration).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requirePro(session.user.id))) {
    return NextResponse.json({ error: "Pro required" }, { status: 402 });
  }

  const collections = await prisma.collection.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json(
    collections.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      itemCount: c._count.items,
    }))
  );
}

// Create a new collection.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await requirePro(session.user.id))) {
    return NextResponse.json({ error: "Pro required" }, { status: 402 });
  }

  const { title, description } = (await req.json()) as {
    title?: string;
    description?: string;
  };
  const trimmedTitle = (title ?? "").trim();
  if (!trimmedTitle) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const collection = await prisma.collection.create({
    data: {
      userId: session.user.id,
      title: trimmedTitle.slice(0, 120),
      description: description?.trim().slice(0, 500) || null,
    },
  });

  return NextResponse.json(collection);
}
