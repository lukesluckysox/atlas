import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shareable pairing image (1080×1350, 4:5 — Instagram portrait sweet spot).
 *
 * Photo on the left, album art on the right as equal squares separated by a
 * hairline. Serif track + artist below, mono small-caps location · date.
 * Tiny amber "trace" wordmark in the lower-right. No UI chrome.
 *
 * Auth per request — scoped to the session user so nobody can mint a
 * share card from somebody else's pairing.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pairing = await prisma.pairing.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!pairing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Palette — kept in sync with tailwind tokens.
  const PARCHMENT = "#F5F0E8";
  const EARTH = "#2C1810";
  const AMBER = "#D4A843";
  const EARTH_60 = "rgba(44, 24, 16, 0.6)";
  const EARTH_20 = "rgba(44, 24, 16, 0.2)";

  const WIDTH = 1080;
  const HEIGHT = 1350;

  // Canvas layout — generous parchment padding, squares sized to leave
  // room for title block + brand mark below without feeling cramped.
  const PAD = 72;
  const GAP = 2; // hairline between photo + album art
  const SQUARE = Math.floor((WIDTH - PAD * 2 - GAP) / 2); // ~467

  const dateStr = new Date(pairing.createdAt)
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();

  const metaBits: string[] = [];
  if (pairing.location) metaBits.push(pairing.location.toUpperCase());
  metaBits.push(dateStr);
  const metaLine = metaBits.join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PARCHMENT,
          padding: PAD,
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Top-left kind label — tiny, keeps the card identifiable as a Trace pairing */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: AMBER,
            }}
          />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: EARTH_60,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            Pairing
          </span>
        </div>

        {/* Image pair — photo + album art, equal squares, hairline between */}
        <div
          style={{
            display: "flex",
            gap: GAP,
            backgroundColor: EARTH_20,
          }}
        >
          {/* Photo */}
          <div
            style={{
              width: SQUARE,
              height: SQUARE,
              display: "flex",
              overflow: "hidden",
              backgroundColor: EARTH_20,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pairing.photoUrl}
              alt=""
              width={SQUARE}
              height={SQUARE}
              style={{ width: SQUARE, height: SQUARE, objectFit: "cover" }}
            />
          </div>
          {/* Album art (or photo fallback if missing) */}
          <div
            style={{
              width: SQUARE,
              height: SQUARE,
              display: "flex",
              overflow: "hidden",
              backgroundColor: EARTH_20,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pairing.albumArt || pairing.photoUrl}
              alt=""
              width={SQUARE}
              height={SQUARE}
              style={{ width: SQUARE, height: SQUARE, objectFit: "cover" }}
            />
          </div>
        </div>

        {/* Title block — serif track name em-dash artist */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 40,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 56,
              color: EARTH,
              lineHeight: 1.1,
              letterSpacing: -0.5,
              display: "flex",
              marginBottom: 14,
            }}
          >
            {truncate(pairing.trackName, 48)}
          </div>
          <div
            style={{
              fontSize: 30,
              color: EARTH_60,
              lineHeight: 1.2,
              fontStyle: "italic",
              display: "flex",
              marginBottom: 24,
            }}
          >
            {truncate(pairing.artistName, 64)}
          </div>

          {/* Location · date — small mono, tracked */}
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: EARTH_60,
              letterSpacing: 3,
              display: "flex",
            }}
          >
            {metaLine}
          </div>
        </div>

        {/* Bottom-right: tiny amber trace wordmark */}
        <div
          style={{
            position: "absolute",
            right: PAD,
            bottom: PAD,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              backgroundColor: AMBER,
            }}
          />
          <span
            style={{
              fontSize: 22,
              color: EARTH,
              letterSpacing: -0.3,
            }}
          >
            trace
          </span>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "\u2026";
}
