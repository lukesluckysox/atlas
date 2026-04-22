import { redirect } from "next/navigation";

// The road entry flow is now a log type on /map. Keep /road alive as a redirect
// so old bookmarks still land somewhere sensible.
export default function RoadPage() {
  redirect("/map");
}
