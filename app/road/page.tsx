import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import RoadEntry from "@/components/road/RoadEntry";

export const dynamic = "force-dynamic";

export default async function RoadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");
  return <RoadEntry />;
}
