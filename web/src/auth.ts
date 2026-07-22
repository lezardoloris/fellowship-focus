import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google OAuth scopes for Fellowship Focus.
 *
 * We intentionally request ONLY identity scopes (openid, email, profile).
 * Google cannot grant Chrome browsing history — that requires the extension's
 * `history` permission. Extra Google APIs (Gmail, Drive, YouTube) are not
 * needed for blocking and would fail OAuth verification for this use case.
 */
const GOOGLE_SCOPES = "openid email profile";

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: {
            params: {
              scope: GOOGLE_SCOPES,
              access_type: "offline",
              prompt: "consent",
            },
          },
        }),
      ]
    : [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/app",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile) {
        token.googleId = (profile as { sub?: string }).sub;
        token.email = profile.email;
        token.name = profile.name;
        token.picture = (profile as { picture?: string }).picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { googleId?: string }).googleId = token.googleId as string | undefined;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.image = (token.picture as string) ?? session.user.image;
      }
      return session;
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-change-me",
});
