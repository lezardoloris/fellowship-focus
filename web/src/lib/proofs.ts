import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const PROOFS_DIR = path.join(DATA_DIR, "proofs");
const PROOF_RETENTION_DAYS = 7;

export type ProofPrivacyTier = "signal" | "blur" | "full";
export type ProofType = "screen" | "webcam" | "signal";

export type FocusProof = {
  id: string;
  session_id: string | null;
  member_id: string;
  fellowship_id: string;
  proof_type: ProofType;
  privacy_tier: ProofPrivacyTier;
  active_app: string | null;
  thumb_path: string | null;
  created_at: string;
};

export function ensureProofsDir() {
  if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true });
}

export function saveProofThumb(base64: string): string {
  ensureProofsDir();
  const id = nanoid();
  const rel = `proofs/${id}.jpg`;
  const abs = path.join(DATA_DIR, rel);
  const raw = base64.replace(/^data:image\/\w+;base64,/, "");
  fs.writeFileSync(abs, Buffer.from(raw, "base64"));
  return rel;
}

export function readProofThumb(relPath: string): Buffer | null {
  const abs = path.join(DATA_DIR, relPath);
  if (!abs.startsWith(DATA_DIR) || !fs.existsSync(abs)) return null;
  return fs.readFileSync(abs);
}

export function purgeOldProofs(database: import("better-sqlite3").Database) {
  const cutoff = new Date(Date.now() - PROOF_RETENTION_DAYS * 86400000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  const rows = database
    .prepare("SELECT id, thumb_path FROM focus_proofs WHERE created_at < ? AND thumb_path IS NOT NULL")
    .all(cutoff) as { id: string; thumb_path: string }[];
  for (const row of rows) {
    const abs = path.join(DATA_DIR, row.thumb_path);
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }
  database.prepare("DELETE FROM focus_proofs WHERE created_at < ?").run(cutoff);
}
