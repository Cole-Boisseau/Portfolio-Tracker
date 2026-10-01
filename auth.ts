import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { checkPassword, allowAuthAttempt, normalizeUsername } from "@/lib/password-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(credentials, request) {
        const username = normalizeUsername(credentials.username);
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!username || password.length > 128 || !await allowAuthAttempt(username, request.headers)) return null;
        const user = await prisma.user.findUnique({ where: { username } });
        if (!await checkPassword(password, user?.passwordHash)) return null;
        return user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null;
      }
    })
  ],
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider !== "google" || profile?.email_verified === true;
    },
    async session({ session, token }) {
      const user = token.sub ? await prisma.user.findUnique({ where: { id: token.sub }, select: { id: true } }) : null;
      session.user.id = user?.id ?? "";
      return session;
    }
  }
});
