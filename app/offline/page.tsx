export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        background: "#F5F0E8",
        color: "#2C1810",
        fontFamily: "IBM Plex Mono, monospace",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#7A8C6E",
            marginBottom: 24,
          }}
        >
          Offline
        </div>
        <h1
          style={{
            fontFamily: "Fraunces, serif",
            fontSize: 36,
            lineHeight: 1.1,
            fontWeight: 400,
            marginBottom: 16,
          }}
        >
          No signal.
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.8, marginBottom: 28 }}>
          Saves you make will queue and sync when you&apos;re back online.
          Tap a page you&apos;ve visited before to keep working.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <a
            href="/mark"
            style={{
              padding: "12px 20px",
              background: "#2C1810",
              color: "#F5F0E8",
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            New Moment
          </a>
          <a
            href="/pair"
            style={{
              padding: "12px 20px",
              background: "transparent",
              color: "#2C1810",
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "1px solid #2C1810",
            }}
          >
            New Track
          </a>
          <a
            href="/map"
            style={{
              padding: "12px 20px",
              background: "transparent",
              color: "#2C1810",
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              border: "1px solid #2C1810",
            }}
          >
            Map
          </a>
        </div>
      </div>
    </div>
  );
}
