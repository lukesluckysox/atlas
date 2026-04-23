import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { readTicket } from "@/lib/anthropic";

// Given an uploaded image URL (ticket/poster/flyer), return extracted fields
// for the user to confirm. We never auto-save — the client prefills the
// Path form and the user commits. This is a pure read endpoint.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { imageUrl } = body as { imageUrl?: string };
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }
  const read = await readTicket(imageUrl);
  return NextResponse.json(read);
}
