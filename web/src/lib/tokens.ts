import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { resolveAuthSecret } from "@/lib/authSecret";

/** SHA-256 hex digest — stored in members.token / google_users.token for lookup. */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

/** Fresh member/google bearer (returned once at create/join/rotate). */
export function mintToken(): string {
  return randomBytes(24).toString("base64url");
}

/** True if a DB value looks like a legacy plaintext nanoid (pre-hash era). */
export function looksLikeLegacyPlaintext(stored: string): boolean {
  // sha256 hex is always 64 chars
  if (stored.length === 64 && /^[a-f0-9]+$/i.test(stored)) return false;
  return /^[A-Za-z0-9_-]{16,64}$/.test(stored);
}

function vaultKey(): Buffer {
  return createHash("sha256").update(`ff-token-vault:${resolveAuthSecret()}`, "utf8").digest();
}

/** Encrypt plaintext for server-side re-issue (Google session-user). */
export function sealToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function openToken(sealed: string): string | null {
  try {
    const buf = Buffer.from(sealed, "base64url");
    if (buf.length < 29) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", vaultKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function hashesEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
