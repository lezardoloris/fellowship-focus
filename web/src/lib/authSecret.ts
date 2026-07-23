/** Resolve Auth.js secret — fail hard in production without a real secret. */

export function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    if (!secret || secret === "dev-only-change-me") {
      throw new Error(
        "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to a strong value in production"
      );
    }
    return secret;
  }
  return secret || "dev-only-change-me";
}
