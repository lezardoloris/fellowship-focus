/** Fail build if public/audio contains oversized files (keep web deploy lean). */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "public", "audio");
const MAX = 8 * 1024 * 1024; // 8 MB

if (!fs.existsSync(ROOT)) {
  process.exit(0);
}

let bad = false;
for (const name of fs.readdirSync(ROOT)) {
  const p = path.join(ROOT, name);
  const st = fs.statSync(p);
  if (!st.isFile()) continue;
  if (/\.(mp3|wav|flac|ogg|m4a)$/i.test(name) && st.size > MAX) {
    console.error(`[check:audio] ${name} is ${(st.size / 1e6).toFixed(1)} MB — max ${MAX / 1e6} MB`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log("[check:audio] ok");
