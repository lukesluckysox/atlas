import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Onboarding from "./Onboarding";

// Server component. Renders the onboarding overlay when the logged-in user
// hasn't completed it yet. Include once in the /home page.

export default async function OnboardingGate() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardedAt: true },
  });
  if (user?.onboardedAt) return null;
  return <Onboarding />;
}
