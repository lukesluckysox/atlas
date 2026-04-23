// Short, opaque share slugs for public trace URLs.
// Slugs are unguessable; sharing is opt-in per trace (always on, but the
// URL only exists if the client asks for it).

import { randomBytes } from "crypto";

export function makeShareSlug(): string {
  // 9 chars, url-safe base36. ~2e14 space; collision risk negligible.
  return randomBytes(6).toString("base64url").slice(0, 9).toLowerCase();
}

// Normalizes a kind key to the public share route segment.
export function shareKindPath(kind: string): string {
  switch (kind) {
    case "tracks":
    case "pairing":
      return "track";
    case "path":
    case "experience":
      return "path";
    case "notice":
    case "moment":
    case "mark":
      return "moment";
    case "encounter":
      return "encounter";
    default:
      return kind;
  }
}
