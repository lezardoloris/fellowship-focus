/**
 * Bake a ping-pong (boomerang) loop into each scene video.
 *
 * Doing this at runtime by stepping currentTime backwards forces a seek every
 * frame, and each seek re-decodes from the nearest keyframe — that is the
 * stutter. A palindrome file plays forward natively with `loop`, so the reverse
 * leg costs exactly nothing and never judders.
 *
 * The first frame of the reversed half duplicates the last forward frame, and
 * its last frame duplicates frame 0, so both are dropped: without that the turn
 * and the loop point each freeze for one frame.
 *
 * Usage: node scripts/make-pingpong.mjs [--force]
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, renameSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

const SCENES = path.join(process.cwd(), "public", "scenes");
const BACKUP = path.join(SCENES, "_original");
const force = process.argv.includes("--force");

function ffprobe(file, entries) {
  return execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", file],
    { encoding: "utf8" }
  )
    .trim()
    .split("\n")[0]
    .trim();
}

if (!existsSync(BACKUP)) mkdirSync(BACKUP, { recursive: true });

const files = readdirSync(SCENES).filter((f) => f.endsWith(".mp4"));
if (!files.length) {
  console.error("No .mp4 found in public/scenes");
  process.exit(1);
}

for (const name of files) {
  const src = path.join(SCENES, name);
  const original = path.join(BACKUP, name);

  // Always encode from the pristine original so re-runs don't stack palindromes.
  if (!existsSync(original)) copyFileSync(src, original);
  else if (!force) {
    console.log(`skip ${name} (already baked — pass --force to redo)`);
    continue;
  }

  const frames = Number(ffprobe(original, "stream=nb_frames"));
  if (!Number.isFinite(frames) || frames < 3) {
    console.warn(`skip ${name}: unusable frame count (${frames})`);
    continue;
  }

  const out = path.join(SCENES, `.pingpong-${name}`);
  // reverse → drop duplicated boundary frames → append to the forward pass.
  const filter =
    `[0:v]split[fwd][cp];` +
    `[cp]reverse,trim=start_frame=1:end_frame=${frames - 1},setpts=PTS-STARTPTS[rev];` +
    `[fwd][rev]concat=n=2:v=1[out]`;

  console.log(`baking ${name} (${frames} frames → ${frames * 2 - 2})`);
  execFileSync(
    "ffmpeg",
    [
      "-y", "-i", original,
      "-filter_complex", filter,
      "-map", "[out]",
      "-an",
      "-c:v", "libx264",
      "-crf", "26",
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  renameSync(out, src);
  const mb = (n) => (statSync(n).size / 1e6).toFixed(1);
  console.log(`  done ${name}: ${mb(original)} MB → ${mb(src)} MB`);
}

console.log("\nOriginals kept in public/scenes/_original (not served).");
