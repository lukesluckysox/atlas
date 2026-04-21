import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV !== "production",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER || {
        host: "smtp.gmail.com",
        port: 587,
        auth: {
          user: process.env.EMAIL_FROM,
          pass: process.env.EMAIL_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "noreply@atlas.app",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Username or Email",
      credentials: {
        identifier: {
          label: "Username or Email",
          type: "text",
          placeholder: "yourname or your@email.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.identifier || !credentials?.password) {
            console.log("[auth] missing credentials");
            return null;
          }

          const identifier = credentials.identifier.trim().toLowerCase();
          const isEmail = identifier.includes("@");

          const user = await prisma.user.findFirst({
            where: isEmail
              ? { email: identifier }
              : { username: identifier },
          });

          if (!user) {
            console.log(`[auth] user not found for identifier: ${identifier}`);
            return null;
          }
          if (!user.passwordHash) {
            console.log(`[auth] user ${user.id} has no password set`);
            return null;
          }

          const valid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );
          if (!valid) {
            console.log(`[auth] bad password for user ${user.id}`);
            return null;
          }

          console.log(`[auth] ✓ signed in: ${user.username || user.email}`);
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? user.username ?? null,
            image: user.image ?? null,
          };
        } catch (err) {
          console.error("[auth] authorize() threw:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // Always allow credential sign-ins; other providers fall through to default handling
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;
      return !!user;
    },
    async jwt({ token, user }) {
      // First sign-in: user object is present. Copy id into token.
      if (user) {
        token.id = (user as { id: string }).id;
      }
      // On every request, refresh isPro + username from DB so Stripe upgrades
      // and profile edits propagate.
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { isPro: true, username: true },
          });
          token.isPro = dbUser?.isPro ?? false;
          token.username = dbUser?.username ?? null;
        } catch (err) {
          console.error("[auth] jwt callback db lookup failed:", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user && token?.id) {
        session.user.id = token.id as string;
        session.user.isPro = (token.isPro as boolean) ?? false;
        session.user.username = (token.username as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
