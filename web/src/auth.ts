import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

/**
 * Google OAuth scopes for Fellowship Focus.
 *
 * We intentionally request ONLY identity scopes (openid, email, profile).
 * Google cannot grant Chrome browsing history — that requires the extension's
 * `history` permission. Extra Google APIs (Gmail, Drive, YouTube) are not
 * needed for blocking and would fail OAuth verification for this use case.
 */
const GOOGLE_SCOPES = "openid email profile";

/** read:user — identity + events for the authenticated user (public + private pushes). */
const GITHUB_SCOPES = "read:user";

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

const providers = [
  ...(googleConfigured
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
    : []),
  ...(githubConfigured
    ? [
        GitHub({
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          authorization: { params: { scope: GITHUB_SCOPES } },
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
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
      if (account?.provider === "github") {
        const gh = profile as { login?: string; avatar_url?: string; name?: string; email?: string };
        token.githubLogin = gh.login || (profile as { login?: string })?.login;
        token.githubAccessToken = account.access_token;
        token.picture = gh.avatar_url || token.picture;
        token.name = gh.name || gh.login || token.name;
        if (gh.email) token.email = gh.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { googleId?: string }).googleId = token.googleId as string | undefined;
        (session.user as { githubLogin?: string }).githubLogin = token.githubLogin as
          | string
          | undefined;
        // Never expose githubAccessToken to the browser — API routes read it via getToken().
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

export const authProviders = {
  google: googleConfigured,
  github: githubConfigured,
};
