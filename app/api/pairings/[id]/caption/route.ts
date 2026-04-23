import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captionPairing } from "@/lib/anthropic";

/**
 * Regenerate a pairing's caption. POST /api/pairings/[id]/caption
 * Also un-dismisses if the user had previously hidden it.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairing = await prisma.pairing.findUnique({ where: { id: params.id } });
  if (!pairing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pairing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const caption = await captionPairing({
    photoUrl: pairing.photoUrl,
    trackName: pairing.trackName,
    artistName: pairing.artistName,
    note: pairing.note,
    location: pairing.location,
  });

  const updated = await prisma.pairing.update({
    where: { id: params.id },
    data: { caption, captionDismissed: false },
  });

  return NextResponse.json(updated);
}

/**
 * Dismiss/hide a caption. PATCH /api/pairings/[id]/caption
 * Body: { dismissed: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairing = await prisma.pairing.findUnique({ where: { id: params.id } });
  if (!pairing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pairing.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dismissed = body?.dismissed !== false;

  const updated = await prisma.pairing.update({
    where: { id: params.id },
    data: { captionDismissed: dismissed },
  });

  return NextResponse.json(updated);
}
