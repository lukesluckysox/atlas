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

  // Ensure the experience belongs to this user before deleting.
  const exp = await prisma.experience.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!exp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (exp.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.experience.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
