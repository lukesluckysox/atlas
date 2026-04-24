import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shareable portrait image — abbreviated, editorial, one artifact from each
 * of the four capture modes (Track / Path / Question / Moment). Counts are
 * shown as a subtle single mono line, not giant numbers.
 *
 * Sizes via ?size=square|story (default portrait 4:5 1080x1350).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sizeParam = url.searchParams.get("size") ?? "portrait";
  const { width, height } = dimsFor(sizeParam);

  const userId = session.user.id;
  const [portrait, user, latestPairing, latestExperience, latestEncounter, latestMark, counts] =
    await Promise.all([
      prisma.portrait.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true },
      }),
      prisma.pairing.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { trackName: true, artistName: true, location: true },
      }),
      prisma.experience.findFirst({
        where: { userId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { name: true, location: true, type: true },
      }),
      prisma.encounter.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: { question: true },
      }),
      prisma.mark.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { content: true, summary: true, keyword: true },
      }),
      Promise.all([
        prisma.pairing.count({ where: { userId } }),
        prisma.experience.count({ where: { userId } }),
        prisma.encounter.count({
          where: { userId, landed: { not: null } },
        }),
        prisma.mark.count({ where: { userId } }),
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

  // Palette — tailwind-synced.
  const PARCHMENT = "#F5F0E8";
  const EARTH = "#2C1810";
  const AMBER = "#D4A843";
  const EARTH_60 = "rgba(44, 24, 16, 0.6)";
  const EARTH_40 = "rgba(44, 24, 16, 0.4)";
  const EARTH_20 = "rgba(44, 24, 16, 0.2)";

  // One representative line per mode. Falls back to a quiet em-dash when
  // the user hasn't captured in that mode yet — keeps the grid balanced.
  const trackLine = latestPairing
    ? `${latestPairing.trackName} — ${latestPairing.artistName}`
    : "—";
  const pathLine = latestExperience
    ? latestExperience.location
      ? `${latestExperience.name}, ${latestExperience.location}`
      : latestExperience.name
    : "—";
  const questionLine = latestEncounter ? latestEncounter.question : "—";
  const momentLine = latestMark
    ? latestMark.summary || latestMark.content
    : "—";

  const countsLine = `${tracks} tracks  ·  ${paths} paths  ·  ${encounters} questions  ·  ${notices} moments`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PARCHMENT,
          padding: sizeParam === "story" ? "96px 72px" : "72px",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 36 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
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
              Portrait
            </span>
          </div>
          <div
            style={{
              fontSize: sizeParam === "story" ? 52 : 54,
              color: EARTH,
              lineHeight: 1.05,
              letterSpacing: -0.5,
              display: "flex",
            }}
          >
            What Trace sees.
          </div>
        </div>

        {/* Hero summary — tighter, ~200 chars. Amber hairline on the left. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: `2px solid ${AMBER}`,
            paddingLeft: 22,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              fontSize: 30,
              color: EARTH,
              lineHeight: 1.35,
              display: "flex",
              fontStyle: "italic",
            }}
          >
            {truncate(portrait.summary, 200)}
          </div>
        </div>

        {/* 2×2 editorial grid — one artifact from each mode. Hairline dividers. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderTop: `1px solid ${EARTH_20}`,
            flex: 1,
          }}
        >
          <ModeRow
            left={{ label: "Track", line: trackLine }}
            right={{ label: "Path", line: pathLine }}
            earth={EARTH}
            earth40={EARTH_40}
            earth20={EARTH_20}
          />
          <ModeRow
            left={{ label: "Question", line: questionLine }}
            right={{ label: "Moment", line: momentLine }}
            earth={EARTH}
            earth40={EARTH_40}
            earth20={EARTH_20}
            last
          />
        </div>

        {/* Single subtle counts line */}
        <div
          style={{
            display: "flex",
            borderTop: `1px solid ${EARTH_20}`,
            paddingTop: 20,
            marginTop: 24,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: EARTH_40,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {countsLine}
          </span>
        </div>

        {/* Footer — attribution + wordmark */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: 12,
          }}
        >
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 14,
              color: EARTH_60,
              display: "flex",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
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
                fontSize: 26,
                color: EARTH,
                letterSpacing: -0.3,
                display: "flex",
              }}
            >
              trace
            </span>
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

/**
 * Two-column row inside the editorial grid. A thin hairline sits below each
 * row (suppressed on the last row) and between the two cells for that
 * classic index-card feel.
 */
function ModeRow({
  left,
  right,
  earth,
  earth40,
  earth20,
  last,
}: {
  left: { label: string; line: string };
  right: { label: string; line: string };
  earth: string;
  earth40: string;
  earth20: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        borderBottom: last ? "none" : `1px solid ${earth20}`,
        paddingTop: 28,
        paddingBottom: 28,
      }}
    >
      <ModeCell label={left.label} line={left.line} earth={earth} earth40={earth40} />
      <div
        style={{
          width: 1,
          display: "flex",
          backgroundColor: earth20,
          marginLeft: 24,
          marginRight: 24,
        }}
      />
      <ModeCell label={right.label} line={right.line} earth={earth} earth40={earth40} />
    </div>
  );
}

function ModeCell({
  label,
  line,
  earth,
  earth40,
}: {
  label: string;
  line: string;
  earth: string;
  earth40: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: earth40,
          letterSpacing: 3,
          textTransform: "uppercase",
          marginBottom: 10,
          display: "flex",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          color: earth,
          lineHeight: 1.3,
          display: "flex",
        }}
      >
        {truncate(line, 90)}
      </div>
    </div>
  );
}

function dimsFor(size: string): { width: number; height: number } {
  if (size === "square") return { width: 1080, height: 1080 };
  if (size === "story") return { width: 1080, height: 1920 };
  return { width: 1080, height: 1350 }; // default portrait 4:5
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "\u2026";
}
