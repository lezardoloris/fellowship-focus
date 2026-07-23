import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { resolveAuthSecret } from "@/lib/authSecret";

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

/** Prefer GOOGLE_CLIENT_*; Auth.js-style AUTH_GOOGLE_* aliases also work. */
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "";
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET || "";
const googleConfigured = Boolean(googleClientId && googleClientSecret);

const githubClientId = process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID || "";
const githubClientSecret =
  process.env.GITHUB_CLIENT_SECRET || process.env.AUTH_GITHUB_SECRET || "";
const githubConfigured = Boolean(githubClientId && githubClientSecret);

const providers = [
  ...(googleConfigured
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
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
          clientId: githubClientId,
          clientSecret: githubClientSecret,
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
  secret: resolveAuthSecret(),
});

export const authProviders = {
  google: googleConfigured,
  github: githubConfigured,
};
