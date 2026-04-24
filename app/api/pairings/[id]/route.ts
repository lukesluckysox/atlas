import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/pairings/[id]
 *
 * Removes a pairing (photo + track combo) the current user owns. The row
 * backs both the Tracks page and the Archive feed, so deleting here
 * propagates to both views automatically.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairing = await prisma.pairing.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!pairing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (pairing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.pairing.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
