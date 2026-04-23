import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return resolved encounters: landed set OR explicitly sitting-with-it.
  // Unanswered drafts stay out of history.
  const encounters = await prisma.encounter.findMany({
    where: {
      userId: session.user.id,
      OR: [{ landed: { not: null } }, { sittingWith: true }],
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json(encounters);
}
