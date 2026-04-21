import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[seed] DATABASE_URL not set — skipping.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const username = "lukesluckysox";
    const email = "lukesluckysox@atlas.app";
    const password = "lukesluckysox";
    const passwordHash = await bcrypt.hash(password, 12);

    // Upsert by username so re-running the seed refreshes the password
    // and doesn't error if the user already exists.
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash },
      create: {
        email,
        username,
        passwordHash,
        name: "Luke",
        isPro: true,
      },
    });

    console.log(`[seed] ✓ test user ready: ${user.username} (${user.email})`);
  } catch (err) {
    // Don't break the deploy if seed fails — log and move on.
    console.error("[seed] failed (non-fatal):", err);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
