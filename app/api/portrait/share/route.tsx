import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Edge runtime required for ImageResponse \u2014 ships as a WASM bundle.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shareable portrait image (1200x1500, 4:5 \u2014 Instagram portrait sweet spot).
 *
 * Renders the user's portrait summary + counts as a PNG for download and
 * socials. No Pro gate \u2014 the portrait page itself is open; the image is just
 * another read of the same data. Tokens unnecessary since we auth per request.
 *
 * Format override via ?size=square|story:
 *   - square: 1200x1200 (Twitter, LinkedIn)
 *   - story:  1080x1920 (Instagram/TikTok stories)
 *   - (default) 1200x1500 portrait
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sizeParam = url.searchParams.get("size") ?? "portrait";
  const { width, height } = dimsFor(sizeParam);

  const [portrait, user, counts] = await Promise.all([
    prisma.portrait.findUnique({ where: { userId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, name: true },
    }),
    Promise.all([
      prisma.pairing.count({ where: { userId: session.user.id } }),
      prisma.experience.count({ where: { userId: session.user.id } }),
      prisma.encounter.count({
        where: { userId: session.user.id, landed: { not: null } },
      }),
      prisma.mark.count({ where: { userId: session.user.id } }),
    ]),
  ]);

  if (!portrait) {
    return NextResponse.json(
      { error: "Generate a portrait first" },
      { status: 400 }
    );
  }

  const [tracks, paths, encounters, notices] = counts;
  const displayName = user?.name || user?.username || "A tracer";

  // Pull a few "patterns" tags for texture \u2014 tasteProfile.patterns.
  const taste = portrait.tasteProfile as { patterns?: string[] } | null;
  const patterns = Array.isArray(taste?.patterns) ? taste!.patterns!.slice(0, 4) : [];

  // Palette constants \u2014 kept in sync with tailwind tokens.
  const PARCHMENT = "#F5F0E8";
  const EARTH = "#2C1810";
  const AMBER = "#D4A843";
  const EARTH_60 = "rgba(44, 24, 16, 0.6)";
  const EARTH_30 = "rgba(44, 24, 16, 0.3)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PARCHMENT,
          padding: sizeParam === "story" ? "100px 80px" : "80px",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: AMBER,
              }}
            />
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                color: EARTH_60,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              Portrait
            </span>
          </div>
          <div
            style={{
              fontSize: sizeParam === "story" ? 58 : 64,
              color: EARTH,
              lineHeight: 1.05,
              letterSpacing: -0.5,
              display: "flex",
            }}
          >
            What Trace sees.
          </div>
        </div>

        {/* Summary \u2014 the hero quote */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: `3px solid ${AMBER}`,
            paddingLeft: 32,
            marginBottom: 48,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: sizeParam === "story" ? 36 : 40,
              color: EARTH,
              lineHeight: 1.3,
              display: "flex",
            }}
          >
            {truncate(portrait.summary, 320)}
          </div>
        </div>

        {/* Patterns chips \u2014 only if we have them */}
        {patterns.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 40,
            }}
          >
            {patterns.map((p, i) => (
              <div
                key={i}
                style={{
                  fontFamily: "monospace",
                  fontSize: 18,
                  color: EARTH,
                  backgroundColor: "rgba(212, 168, 67, 0.2)",
                  padding: "8px 16px",
                  display: "flex",
                }}
              >
                {p}
              </div>
            ))}
          </div>
        )}

        {/* Counts row */}
        <div
          style={{
            display: "flex",
            borderTop: `1px solid ${EARTH_30}`,
            paddingTop: 32,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Tracks", value: tracks },
            { label: "Paths", value: paths },
            { label: "Encounters", value: encounters },
            { label: "Notices", value: notices },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 52,
                  color: EARTH,
                  lineHeight: 1,
                  marginBottom: 8,
                  display: "flex",
                }}
              >
                {c.value}
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  color: EARTH_60,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  display: "flex",
                }}
              >
                {c.label}
              </div>
            </div>
          ))}
        </div>

        {/* Footer \u2014 attribution + brand */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: "auto",
            paddingTop: 32,
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              color: EARTH_60,
              display: "flex",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 28,
              color: EARTH,
              letterSpacing: -0.5,
              display: "flex",
            }}
          >
            trace
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

function dimsFor(size: string): { width: number; height: number } {
  if (size === "square") return { width: 1200, height: 1200 };
  if (size === "story") return { width: 1080, height: 1920 };
  return { width: 1200, height: 1500 }; // default portrait 4:5
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "\u2026";
}
